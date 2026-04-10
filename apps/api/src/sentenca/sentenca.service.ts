import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IaService } from '../ia/ia.service';
import { PdfSignerService } from '../certificado-digital/pdf-signer.service';
import { EmailService } from '../email/email.service';
import { EventsService } from '../events/events.service';
import * as crypto from 'crypto';

const MAX_VERSOES = 5;

@Injectable()
export class SentencaService {
  constructor(
    private prisma: PrismaService,
    private iaService: IaService,
    private pdfSignerService: PdfSignerService,
    private emailService: EmailService,
    private events: EventsService,
  ) {}

  /** Acionar IA para gerar projeto de sentenca */
  async gerar(arbitragemId: string) {
    const arb = await this.getArbitragem(arbitragemId);

    const [pecas, provas, chatHistorico] = await Promise.all([
      this.prisma.peca.findMany({ where: { arbitragemId } }),
      this.prisma.prova.findMany({ where: { arbitragemId } }),
      // Carregar historico do Chat de Sentenca (dialetica arbitro+IA)
      this.prisma.chatMessage.findMany({
        where: { arbitragemId, canal: { in: ['sentenca', 'arbitragem'] } },
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: { tipo: true, conteudo: true, createdAt: true, user: { select: { nome: true } } },
      }),
    ]);

    const ultimaSentenca = await this.prisma.sentenca.findFirst({
      where: { arbitragemId },
      orderBy: { versao: 'desc' },
    });

    const novaVersao = (ultimaSentenca?.versao || 0) + 1;
    if (novaVersao > MAX_VERSOES) {
      throw new BadRequestException(`Maximo de ${MAX_VERSOES} versoes atingido`);
    }

    const resultado = await this.iaService.gerarSentenca(
      {
        numero: arb.numero,
        objeto: arb.objeto,
        valorCausa: Number(arb.valorCausa),
        categoria: arb.categoria,
      },
      pecas.map((p) => ({ tipo: p.tipo, conteudo: p.conteudo || undefined })),
      provas.map((p) => ({ tipo: p.tipo, descricao: p.descricao || undefined })),
      arbitragemId,
      // Passa historico do chat de sentenca como contexto adicional
      chatHistorico.length > 0
        ? chatHistorico.map((m) => {
            const autor = m.tipo === 'ia' ? 'IA' : m.user?.nome || 'Arbitro';
            return `[${autor}]: ${(m.conteudo || '').slice(0, 500)}`;
          }).join('\n\n')
        : undefined,
    );

    const conteudoTexto = JSON.stringify(resultado);
    const hash = crypto.createHash('sha256').update(conteudoTexto).digest('hex');

    const sentenca = await this.prisma.sentenca.create({
      data: {
        arbitragemId,
        versao: novaVersao,
        conteudoTexto,
        hashSha256: hash,
        status: 'RASCUNHO',
        geradaPor: 'ia',
      },
    });

    // Atualizar status da arbitragem
    await this.prisma.arbitragem.update({
      where: { id: arbitragemId },
      data: { status: 'SENTENCA_EM_REVISAO' },
    });

    return { ...sentenca, conteudo: resultado };
  }

  /** Consultar sentenca atual */
  async getCurrent(arbitragemId: string, userId: string, userRole: string) {
    await this.checkAccess(arbitragemId, userId, userRole);

    const sentenca = await this.prisma.sentenca.findFirst({
      where: { arbitragemId },
      orderBy: { versao: 'desc' },
      include: {
        aprovacoes: {
          include: { arbitro: { select: { id: true, nome: true } } },
        },
      },
    });

    if (!sentenca) throw new NotFoundException('Nenhuma sentenca encontrada');

    let conteudo = {};
    try { conteudo = JSON.parse(sentenca.conteudoTexto); } catch { /* malformed */ }

    return { ...sentenca, conteudo };
  }

  /** Listar versoes */
  async getVersoes(arbitragemId: string, userId: string, userRole: string) {
    await this.checkAccess(arbitragemId, userId, userRole);

    const sentencas = await this.prisma.sentenca.findMany({
      where: { arbitragemId },
      orderBy: { versao: 'desc' },
      select: {
        id: true,
        versao: true,
        status: true,
        geradaPor: true,
        createdAt: true,
        aprovacoes: {
          select: { acao: true, arbitro: { select: { nome: true } }, createdAt: true },
        },
      },
    });

    return sentencas;
  }

  /** Arbitro aprova projeto (via painel web) */
  async aprovar(arbitragemId: string, userId: string) {
    const sentenca = await this.getUltimaSentenca(arbitragemId);

    if (sentenca.status !== 'RASCUNHO' && sentenca.status !== 'EM_REVISAO') {
      throw new BadRequestException('Sentenca nao esta em estado de revisao');
    }

    await this.prisma.sentencaAprovacao.create({
      data: {
        sentencaId: sentenca.id,
        arbitroId: userId,
        acao: 'aprovar',
      },
    });

    await this.prisma.sentenca.update({
      where: { id: sentenca.id },
      data: { status: 'APROVADA' },
    });

    await this.prisma.arbitragem.update({
      where: { id: arbitragemId },
      data: { status: 'SENTENCA_APROVADA' },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        acao: 'SENTENCA_APROVADA',
        entidade: 'sentenca',
        entidadeId: sentenca.id,
      },
    });

    return { message: 'Sentenca aprovada', versao: sentenca.versao };
  }

  /** Arbitro edita manualmente o conteudo da sentenca (sem gerar nova versao) */
  async editarConteudo(
    arbitragemId: string,
    userId: string,
    conteudo: { ementa?: string; relatorio?: string; fundamentacao?: string; dispositivo?: string },
  ) {
    const sentenca = await this.getUltimaSentenca(arbitragemId);

    if (sentenca.status !== 'RASCUNHO' && sentenca.status !== 'EM_REVISAO') {
      throw new BadRequestException('Sentenca nao esta em estado de revisao');
    }

    let atual: any = {};
    try { atual = JSON.parse(sentenca.conteudoTexto); } catch {}

    // Merge: so atualiza os campos enviados
    if (conteudo.ementa !== undefined) atual.ementa = conteudo.ementa;
    if (conteudo.relatorio !== undefined) atual.relatorio = conteudo.relatorio;
    if (conteudo.fundamentacao !== undefined) atual.fundamentacao = conteudo.fundamentacao;
    if (conteudo.dispositivo !== undefined) atual.dispositivo = conteudo.dispositivo;

    const conteudoTexto = JSON.stringify(atual);
    const hash = crypto.createHash('sha256').update(conteudoTexto).digest('hex');

    await this.prisma.sentenca.update({
      where: { id: sentenca.id },
      data: { conteudoTexto, hashSha256: hash },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        acao: 'SENTENCA_EDITADA_MANUALMENTE',
        entidade: 'sentenca',
        entidadeId: sentenca.id,
      },
    });

    return { message: 'Sentenca atualizada', versao: sentenca.versao, conteudo: atual };
  }

  /** Arbitro envia sugestoes (via painel web) → IA refina */
  async sugerir(arbitragemId: string, userId: string, sugestoes: string) {
    const sentenca = await this.getUltimaSentenca(arbitragemId);

    if (sentenca.status !== 'RASCUNHO' && sentenca.status !== 'EM_REVISAO') {
      throw new BadRequestException('Sentenca nao esta em estado de revisao');
    }

    const novaVersao = sentenca.versao + 1;
    if (novaVersao > MAX_VERSOES) {
      throw new BadRequestException(`Maximo de ${MAX_VERSOES} versoes atingido`);
    }

    // Registrar sugestao
    await this.prisma.sentencaAprovacao.create({
      data: {
        sentencaId: sentenca.id,
        arbitroId: userId,
        acao: 'sugerir',
        sugestoesTexto: sugestoes,
      },
    });

    // IA refina com base nas sugestoes
    let sentencaAtual: any = {};
    try { sentencaAtual = JSON.parse(sentenca.conteudoTexto); } catch { /* malformed */ }
    const refinada = await this.iaService.refinarSentenca(sentencaAtual, sugestoes);

    const conteudoTexto = JSON.stringify(refinada);
    const hash = crypto.createHash('sha256').update(conteudoTexto).digest('hex');

    const novaSentenca = await this.prisma.sentenca.create({
      data: {
        arbitragemId,
        versao: novaVersao,
        conteudoTexto,
        hashSha256: hash,
        status: 'EM_REVISAO',
        geradaPor: 'ia',
      },
    });

    // Notificar arbitro
    const arbitros = await this.prisma.arbitragemArbitro.findMany({
      where: { arbitragemId },
    });
    for (const arb of arbitros) {
      await this.prisma.notificacao.create({
        data: {
          userId: arb.arbitroId,
          titulo: 'Nova versao de sentenca',
          mensagem: `Versao ${novaVersao} gerada com base nas suas sugestoes.`,
          tipo: 'sentenca',
          link: `/arbitragens/${arbitragemId}`,
        },
      });
    }

    return { ...novaSentenca, conteudo: refinada };
  }

  /** Arbitro ratifica versao final */
  async ratificar(arbitragemId: string, userId: string) {
    const sentenca = await this.getUltimaSentenca(arbitragemId);

    if (sentenca.status !== 'APROVADA') {
      throw new BadRequestException('Sentenca precisa estar APROVADA para ratificar');
    }

    const codigoVerif = `ARB-VRF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    await this.prisma.sentencaAprovacao.create({
      data: {
        sentencaId: sentenca.id,
        arbitroId: userId,
        acao: 'ratificar',
      },
    });

    await this.prisma.sentenca.update({
      where: { id: sentenca.id },
      data: {
        status: 'RATIFICADA',
        codigoVerif,
      },
    });

    await this.prisma.arbitragem.update({
      where: { id: arbitragemId },
      data: { status: 'SENTENCA_RATIFICADA' },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        acao: 'SENTENCA_RATIFICADA',
        entidade: 'sentenca',
        entidadeId: sentenca.id,
        dadosDepois: { codigoVerif },
      },
    });

    // Emitir evento de sentenca ratificada
    const arb = await this.getArbitragem(arbitragemId);
    this.events.emitSentencaRatificada({
      arbitragemId,
      numero: arb.numero,
      sentencaId: sentenca.id,
      requerenteId: arb.requerenteId,
      requeridoId: arb.requeridoId || '',
      codigoVerif,
    });

    return { message: 'Sentenca ratificada', codigoVerif, versao: sentenca.versao };
  }

  /** Analisar provas via IA */
  async analisarProvas(arbitragemId: string) {
    const arb = await this.getArbitragem(arbitragemId);
    const pecas = await this.prisma.peca.findMany({ where: { arbitragemId } });
    const provas = await this.prisma.prova.findMany({ where: { arbitragemId } });

    return this.iaService.analisarProvas(
      {
        numero: arb.numero,
        objeto: arb.objeto,
        valorCausa: Number(arb.valorCausa),
        categoria: arb.categoria,
      },
      pecas.map((p) => ({ tipo: p.tipo, conteudo: p.conteudo || undefined })),
      provas.map((p) => ({ tipo: p.tipo, descricao: p.descricao || undefined, mimeType: p.mimeType || undefined })),
      arbitragemId,
    );
  }

  /** Assinar sentenca digitalmente com certificado A1 */
  async assinarDigital(arbitragemId: string, userId: string) {
    const sentenca = await this.getUltimaSentenca(arbitragemId);

    if (sentenca.status !== 'RATIFICADA') {
      throw new BadRequestException('Sentenca precisa estar RATIFICADA para assinar digitalmente');
    }

    if (sentenca.assinadoDigitalmenteAt) {
      throw new BadRequestException('Sentenca ja foi assinada digitalmente');
    }

    const result = await this.pdfSignerService.gerarEAssinarSentencaPdf(sentenca.id, userId);

    return {
      message: 'Sentenca assinada digitalmente com sucesso',
      pdfUrl: result.pdfUrl,
      hash: result.hash,
      certificadoCn: result.cn,
    };
  }

  /** Publicar sentenca (admin) - envia para as partes e encerra arbitragem */
  async publicar(arbitragemId: string, userId: string) {
    const sentenca = await this.getUltimaSentenca(arbitragemId);

    if (sentenca.status !== 'RATIFICADA') {
      throw new BadRequestException('Sentenca precisa estar RATIFICADA para publicar');
    }

    const arb = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
      include: {
        requerente: { select: { id: true, nome: true, email: true } },
        requerido: { select: { id: true, nome: true, email: true } },
      },
    });

    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');

    // Atualizar sentenca para PUBLICADA
    await this.prisma.sentenca.update({
      where: { id: sentenca.id },
      data: { status: 'PUBLICADA' },
    });

    // Encerrar arbitragem
    await this.prisma.arbitragem.update({
      where: { id: arbitragemId },
      data: { status: 'ENCERRADA' },
    });

    // Enviar email para ambas as partes
    if (arb.requerente) {
      await this.emailService.enviarNotificacaoSentenca(
        arb.requerente.email,
        arb.requerente.nome,
        { numero: arb.numero, acao: 'Publicada', codigoVerif: sentenca.codigoVerif || undefined },
      );
    }

    if (arb.requerido) {
      await this.emailService.enviarNotificacaoSentenca(
        arb.requerido.email,
        arb.requerido.nome,
        { numero: arb.numero, acao: 'Publicada', codigoVerif: sentenca.codigoVerif || undefined },
      );
    }

    // Criar notificacoes para ambas as partes
    await this.prisma.notificacao.create({
      data: {
        userId: arb.requerenteId,
        titulo: 'Sentenca Publicada',
        mensagem: `A sentenca do caso ${arb.numero} foi publicada. Codigo de verificacao: ${sentenca.codigoVerif || 'N/A'}`,
        tipo: 'sentenca',
        link: `/arbitragens/${arbitragemId}`,
      },
    });

    if (arb.requeridoId) {
      await this.prisma.notificacao.create({
        data: {
          userId: arb.requeridoId,
          titulo: 'Sentenca Publicada',
          mensagem: `A sentenca do caso ${arb.numero} foi publicada. Codigo de verificacao: ${sentenca.codigoVerif || 'N/A'}`,
          tipo: 'sentenca',
          link: `/arbitragens/${arbitragemId}`,
        },
      });
    }

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        acao: 'SENTENCA_PUBLICADA',
        entidade: 'sentenca',
        entidadeId: sentenca.id,
        dadosDepois: { codigoVerif: sentenca.codigoVerif },
      },
    });

    return {
      message: 'Sentenca publicada com sucesso',
      codigoVerif: sentenca.codigoVerif,
      versao: sentenca.versao,
    };
  }

  // ── Helpers ──

  private async getArbitragem(id: string) {
    const arb = await this.prisma.arbitragem.findUnique({ where: { id } });
    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');
    return arb;
  }

  private async getUltimaSentenca(arbitragemId: string) {
    const s = await this.prisma.sentenca.findFirst({
      where: { arbitragemId },
      orderBy: { versao: 'desc' },
    });
    if (!s) throw new NotFoundException('Nenhuma sentenca encontrada');
    return s;
  }

  private async checkAccess(arbitragemId: string, userId: string, userRole: string) {
    if (userRole === 'ADMIN') return;
    const arb = await this.getArbitragem(arbitragemId);
    if (userRole === 'ARBITRO') {
      const isArbitro = await this.prisma.arbitragemArbitro.findFirst({
        where: { arbitragemId, arbitroId: userId },
      });
      if (isArbitro) return;
    }
    if (arb.requerenteId === userId || arb.requeridoId === userId) return;
    throw new ForbiddenException('Sem acesso');
  }
}
