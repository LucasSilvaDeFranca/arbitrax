import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ZapSignService } from './zapsign.service';
import { EventsService } from '../events/events.service';
import * as crypto from 'crypto';

@Injectable()
export class CompromissoService {
  constructor(
    private prisma: PrismaService,
    private zapSign: ZapSignService,
    private events: EventsService,
  ) {}

  /** Gerar compromisso arbitral e enviar para assinatura */
  async gerar(arbitragemId: string) {
    const arb = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
      include: {
        requerente: true,
        requerido: true,
        arbitros: { include: { arbitro: true } },
      },
    });

    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');
    if (!arb.requerido) throw new BadRequestException('Requerido nao vinculado');

    // Verificar se ja existe
    const existing = await this.prisma.compromisso.findUnique({
      where: { arbitragemId },
    });
    if (existing) throw new BadRequestException('Compromisso ja gerado para este caso');

    // Gerar HTML do termo
    const html = this.gerarHtmlCompromisso(arb);
    const hash = crypto.createHash('sha256').update(html).digest('hex');

    // Enviar para ZapSign
    const arbitroNome = arb.arbitros?.[0]?.arbitro?.nome || 'A designar';
    const zapDoc = await this.zapSign.criarDocumento({
      nome: `Compromisso Arbitral - ${arb.numero}`,
      htmlContent: html,
      signatarios: [
        { nome: arb.requerente.nome, email: arb.requerente.email, cpf: arb.requerente.cpfCnpj },
        { nome: arb.requerido.nome, email: arb.requerido.email, cpf: arb.requerido.cpfCnpj },
      ],
    });

    const compromisso = await this.prisma.compromisso.create({
      data: {
        arbitragemId,
        hashSha256: hash,
        clicksignKey: zapDoc?.token || null, // reutilizando campo para ZapSign token
        status: zapDoc ? 'enviado' : 'pendente',
      },
    });

    // Criar notificacoes
    await this.prisma.notificacao.create({
      data: {
        userId: arb.requerenteId,
        titulo: 'Compromisso Arbitral para assinar',
        mensagem: `O Termo de Compromisso Arbitral do caso ${arb.numero} esta disponivel para assinatura.`,
        tipo: 'sistema',
        link: `/arbitragens/${arbitragemId}/compromisso`,
      },
    });

    if (arb.requeridoId) {
      await this.prisma.notificacao.create({
        data: {
          userId: arb.requeridoId,
          titulo: 'Compromisso Arbitral para assinar',
          mensagem: `O Termo de Compromisso Arbitral do caso ${arb.numero} esta disponivel para assinatura.`,
          tipo: 'sistema',
          link: `/arbitragens/${arbitragemId}/compromisso`,
        },
      });
    }

    return {
      ...compromisso,
      signatarios: zapDoc?.signers?.map((s) => ({
        nome: s.name,
        email: s.email,
        signUrl: s.sign_url,
        status: s.status,
      })) || [],
    };
  }

  /** Consultar status do compromisso */
  async consultar(arbitragemId: string) {
    const compromisso = await this.prisma.compromisso.findUnique({
      where: { arbitragemId },
    });

    if (!compromisso) throw new NotFoundException('Compromisso nao encontrado');

    // Se tiver token ZapSign, consultar status atualizado
    let signatarios: any[] = [];
    if (compromisso.clicksignKey) {
      const zapDoc = await this.zapSign.consultarDocumento(compromisso.clicksignKey);
      if (zapDoc) {
        signatarios = zapDoc.signers.map((s) => ({
          nome: s.name,
          email: s.email,
          signUrl: s.sign_url,
          status: s.status,
        }));

        // Verificar se todos assinaram
        const todosAssinaram = zapDoc.signers.every((s) => s.status === 'signed');
        if (todosAssinaram && compromisso.status !== 'assinado') {
          await this.prisma.compromisso.update({
            where: { id: compromisso.id },
            data: {
              status: 'assinado',
              assinReqAt: new Date(),
              assinReqdoAt: new Date(),
            },
          });

          // Avancar status da arbitragem
          await this.prisma.arbitragem.update({
            where: { id: arbitragemId },
            data: { status: 'EM_INSTRUCAO' },
          });

          compromisso.status = 'assinado';
        }
      }
    }

    return { ...compromisso, signatarios };
  }

  /** Aceite interno (fallback sem ZapSign) */
  async aceiteInterno(arbitragemId: string, userId: string, userRole: string) {
    const arb = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
    });
    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');

    let compromisso = await this.prisma.compromisso.findUnique({
      where: { arbitragemId },
    });

    if (!compromisso) {
      const html = this.gerarHtmlCompromisso(arb);
      const hash = crypto.createHash('sha256').update(html).digest('hex');
      compromisso = await this.prisma.compromisso.create({
        data: { arbitragemId, hashSha256: hash, status: 'pendente' },
      });
    }

    const update: any = {};
    if (arb.requerenteId === userId) update.assinReqAt = new Date();
    if (arb.requeridoId === userId) update.assinReqdoAt = new Date();

    const updated = await this.prisma.compromisso.update({
      where: { id: compromisso.id },
      data: update,
    });

    // Se ambos assinaram
    if (updated.assinReqAt && updated.assinReqdoAt) {
      await this.prisma.compromisso.update({
        where: { id: compromisso.id },
        data: { status: 'assinado' },
      });
      await this.prisma.arbitragem.update({
        where: { id: arbitragemId },
        data: { status: 'EM_INSTRUCAO' },
      });

      // Emitir evento de compromisso assinado
      this.events.emitCompromissoAssinado({
        arbitragemId,
        numero: arb.numero,
        requerenteId: arb.requerenteId,
        requeridoId: arb.requeridoId!,
      });
    }

    return updated;
  }

  /** Webhook ZapSign */
  async processarWebhook(body: any) {
    const docToken = body.doc?.token;
    if (!docToken) return;

    const compromisso = await this.prisma.compromisso.findFirst({
      where: { clicksignKey: docToken },
    });
    if (!compromisso) return;

    // Reconsultar para atualizar status
    await this.consultar(compromisso.arbitragemId);
  }

  private gerarHtmlCompromisso(arb: any): string {
    const hoje = new Date();
    const dataStr = `${hoje.getDate()} de ${['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][hoje.getMonth()]} de ${hoje.getFullYear()}`;
    const arbitroNome = arb.arbitros?.[0]?.arbitro?.nome || 'A designar';

    return `
<h1>TERMO DE COMPROMISSO ARBITRAL</h1>

<p>Pelo presente instrumento, as partes abaixo qualificadas:</p>

<p><strong>Parte Requerente:</strong> ${arb.requerente?.nome || '[Nome]'}, CPF/CNPJ: ${arb.requerente?.cpfCnpj || '[CPF/CNPJ]'}</p>
<p><strong>Parte Requerida:</strong> ${arb.requerido?.nome || '[Nome]'}, CPF/CNPJ: ${arb.requerido?.cpfCnpj || '[CPF/CNPJ]'}</p>

<p>Concordam em submeter a controversia identificada como <em>${arb.objeto}</em> ao procedimento de arbitragem digital da plataforma Arbitrax, nos seguintes termos:</p>

<h2>1. Aceitacao da Arbitragem</h2>
<p>As partes aceitam e reconhecem a arbitragem como meio exclusivo de solucao da presente disputa, afastando a jurisdicao estatal, conforme os termos da Lei de Arbitragem (Lei 9.307/96).</p>
<p>As partes concordam que a arbitragem sera realizada de forma totalmente digital, sem audiencias presenciais, por meio da plataforma Arbitrax, com envio de provas por documento, audio e video.</p>

<h2>2. Regras Aplicaveis</h2>
<ul>
<li>Lei aplicavel: Normas juridicas vigentes no Brasil.</li>
<li>Equidade: Podera ser aplicada a criterio do arbitro, caso as partes concordem.</li>
<li>Costumes do setor: Consideracao das praticas comerciais usuais relacionadas a materia objeto da arbitragem.</li>
</ul>

<h2>3. Designacao do Arbitro</h2>
<p>O arbitro sera escolhido pelas partes entre os cadastrados na plataforma, ou sorteado automaticamente pela plataforma.</p>
<p>Arbitro designado: ${arbitroNome}</p>

<h2>4. Procedimento e Prazos</h2>
<ul>
<li>Prazo para adesao: 5 (cinco) dias a partir do recebimento deste compromisso.</li>
<li>Prazo maximo para decisao: 6 (seis) meses, salvo atraso causado pelas partes.</li>
</ul>

<h2>5. Taxas e Custos Administrativos</h2>
<p>As partes estao cientes de que a plataforma Arbitrax pode prever taxas administrativas, conforme o plano de assinatura de cada usuario. Os custos serao informados antes da adesao ao procedimento.</p>

<h2>6. Sentenca Arbitral</h2>
<ul>
<li>A decisao final sera elaborada com o auxilio de inteligencia artificial, sendo editada e validada pelo arbitro designado.</li>
<li>A sentenca arbitral sera final e obrigatoria para as partes, tendo os mesmos efeitos de uma decisao judicial definitiva.</li>
</ul>

<h2>7. Foro de Execucao</h2>
<p>Para execucao da sentenca arbitral, as partes elegem o foro da Comarca competente, com renuncia expressa a qualquer outro.</p>

<p>E, por estarem de pleno acordo, firmam este Termo de Compromisso Arbitral digitalmente.</p>

<p>Data: ${dataStr}</p>
<p>Caso: ${arb.numero} | Valor: R$ ${Number(arb.valorCausa).toLocaleString('pt-BR')}</p>

<p><strong>ARBITRAX - A justica do futuro, hoje!</strong></p>
`.trim();
  }
}
