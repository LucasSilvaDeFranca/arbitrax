import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Modelo de chats da ArbitraX (Apr/2026 - rework do cliente):
 *
 * - 'processo' — grupo publico do caso (Chat 1)
 *   Participantes: requerente, requerido, advogados, arbitros
 *   NAO tem IA. E onde rola a dialetica publica: tese, antitese, provas,
 *   perguntas oficiais as partes, publicacao da sentenca no final.
 *
 * - 'sentenca' — grupo privado de bastidor (Chat 2)
 *   Participantes: arbitros designados + IA
 *   INVISIVEL para as partes e advogados. Usado pelo arbitro pra conversar
 *   com a IA e construir a sentenca iterativamente. IA pode pedir
 *   esclarecimentos; o arbitro encaminha a pergunta pro Chat 1.
 *
 * Valores legados aceitos: 'privado' e 'arbitragem' (mapeados para 'processo'
 * e 'sentenca' respectivamente). Manter ate frontend migrar completamente.
 */
const CANAIS_VALIDOS = ['processo', 'sentenca'] as const;
const CANAL_LEGADO_MAP: Record<string, string> = {
  privado: 'processo',
  arbitragem: 'sentenca',
};

function normalizarCanal(canal?: string): 'processo' | 'sentenca' {
  const c = canal || 'processo';
  const mapped = CANAL_LEGADO_MAP[c] || c;
  if (!CANAIS_VALIDOS.includes(mapped as any)) {
    throw new BadRequestException(
      `Canal invalido: ${c}. Use 'processo' ou 'sentenca'.`,
    );
  }
  return mapped as 'processo' | 'sentenca';
}

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  /**
   * Checa permissao de leitura/escrita em um canal especifico.
   * Regras:
   * - 'processo': requerente, requerido, advogados, arbitros, admin
   * - 'sentenca': apenas arbitros designados e admin (IA posta com userId=null)
   */
  private async checkCanalAccess(
    arbitragemId: string,
    userId: string,
    userRole: string,
    canal: 'processo' | 'sentenca',
  ) {
    if (userRole === 'ADMIN') return;

    const arb = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
      include: { arbitros: true },
    });
    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');

    const isArbitro = arb.arbitros.some((a) => a.arbitroId === userId);
    const isParte =
      arb.requerenteId === userId ||
      arb.requeridoId === userId ||
      arb.advRequerenteId === userId ||
      arb.advRequeridoId === userId;

    if (canal === 'sentenca') {
      // So arbitros designados veem/escrevem no chat de sentenca
      if (!isArbitro) {
        throw new ForbiddenException(
          'Chat de sentenca e privado - somente arbitros tem acesso',
        );
      }
      return;
    }

    // canal === 'processo': partes, advogados ou arbitros
    if (!isArbitro && !isParte) {
      throw new ForbiddenException('Sem acesso ao chat deste caso');
    }
  }

  async sendMessage(
    arbitragemId: string,
    userId: string,
    userRole: string,
    data: { conteudo?: string; tipo?: string; mediaUrl?: string; canal?: string },
  ) {
    const canal = normalizarCanal(data.canal);
    await this.checkCanalAccess(arbitragemId, userId, userRole, canal);

    const msg = await this.prisma.chatMessage.create({
      data: {
        arbitragemId,
        userId,
        tipo: data.tipo || 'text',
        conteudo: data.conteudo,
        mediaUrl: data.mediaUrl,
        canal,
      },
      include: {
        user: { select: { id: true, nome: true, role: true } },
      },
    });

    return msg;
  }

  /** Mensagem de sistema (notificacao automatica no chat). Sem checagem de role. */
  async sendSystemMessage(
    arbitragemId: string,
    conteudo: string,
    canal: string = 'processo',
  ) {
    const canalNormalizado = normalizarCanal(canal);
    return this.prisma.chatMessage.create({
      data: {
        arbitragemId,
        userId: null,
        tipo: 'system',
        conteudo,
        canal: canalNormalizado,
      },
    });
  }

  /** Mensagem da IA (userId null). Usado pelo chat-ia.service. */
  async sendIaMessage(
    arbitragemId: string,
    conteudo: string,
    canal: string = 'sentenca',
    respondidoParaId?: string,
  ) {
    const canalNormalizado = normalizarCanal(canal);
    return this.prisma.chatMessage.create({
      data: {
        arbitragemId,
        userId: null,
        tipo: 'ia',
        conteudo,
        canal: canalNormalizado,
        respondidoParaId,
      },
    });
  }

  /**
   * Lista mensagens do canal. Retorna em ordem cronologica (asc).
   * - 'processo': todos os participantes veem tudo (grupo publico)
   * - 'sentenca': so arbitros veem (checagem ja feita em checkCanalAccess)
   */
  async getMessages(
    arbitragemId: string,
    userId: string,
    userRole: string,
    canal: string = 'processo',
    cursor?: string,
    limit = 50,
  ) {
    const canalNormalizado = normalizarCanal(canal);
    await this.checkCanalAccess(arbitragemId, userId, userRole, canalNormalizado);

    const where: any = { arbitragemId, canal: canalNormalizado };
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    const messages = await this.prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, nome: true, role: true } },
      },
    });

    // Marcar como lidas as mensagens deste canal (todas - modelo grupo)
    await this.prisma.chatMessage.updateMany({
      where: {
        arbitragemId,
        canal: canalNormalizado,
        lida: false,
        NOT: { userId }, // nao marca proprias mensagens
      },
      data: { lida: true },
    });

    return messages.reverse();
  }

  /**
   * Encaminha uma mensagem do Chat 2 (sentenca) como pergunta oficial no Chat 1 (processo).
   * Usado pelo arbitro quando a IA levanta uma duvida que precisa ser esclarecida pelas partes.
   * Somente arbitros podem encaminhar. A mensagem posta no Chat 1 e do tipo 'system' para
   * destacar que e uma pergunta oficial do arbitro.
   */
  async encaminharParaProcesso(
    arbitragemId: string,
    userId: string,
    userRole: string,
    data: { messageId: string; textoEditado?: string },
  ) {
    // So arbitros ou admin podem encaminhar
    await this.checkCanalAccess(arbitragemId, userId, userRole, 'sentenca');

    const msgOriginal = await this.prisma.chatMessage.findUnique({
      where: { id: data.messageId },
      include: { user: { select: { id: true, nome: true } } },
    });
    if (!msgOriginal) {
      throw new NotFoundException('Mensagem nao encontrada');
    }
    if (msgOriginal.arbitragemId !== arbitragemId) {
      throw new ForbiddenException('Mensagem nao pertence a esta arbitragem');
    }
    if (msgOriginal.canal !== 'sentenca') {
      throw new BadRequestException(
        'So e possivel encaminhar mensagens do chat de sentenca',
      );
    }

    const arbitro = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nome: true },
    });
    const arbitroNome = arbitro?.nome || 'Arbitro';

    const textoFinal = (data.textoEditado || msgOriginal.conteudo || '').trim();
    if (!textoFinal) {
      throw new BadRequestException('Texto da pergunta nao pode ser vazio');
    }

    const conteudoFormatado = `📋 PERGUNTA OFICIAL DO ARBITRO (${arbitroNome}):\n\n${textoFinal}\n\nPor favor respondam neste chat.`;

    const msgProcesso = await this.prisma.chatMessage.create({
      data: {
        arbitragemId,
        userId, // posta como o arbitro
        tipo: 'system',
        conteudo: conteudoFormatado,
        canal: 'processo',
      },
      include: {
        user: { select: { id: true, nome: true, role: true } },
      },
    });

    return msgProcesso;
  }

  /**
   * Contador de mensagens nao lidas por canal para o user logado.
   * Ignora mensagens que o proprio user enviou.
   */
  async getUnreadCount(userId: string, userRole: string) {
    const arbs = await this.prisma.arbitragem.findMany({
      where: {
        OR: [
          { requerenteId: userId },
          { requeridoId: userId },
          { advRequerenteId: userId },
          { advRequeridoId: userId },
          { arbitros: { some: { arbitroId: userId } } },
        ],
      },
      select: { id: true },
    });

    const arbIds = arbs.map((a) => a.id);
    if (!arbIds.length) return { processo: 0, sentenca: 0 };

    // Nao lidas no canal 'processo' (exceto proprias)
    const processo = await this.prisma.chatMessage.count({
      where: {
        arbitragemId: { in: arbIds },
        canal: { in: ['processo', 'privado'] }, // aceita legado
        lida: false,
        NOT: { userId },
      },
    });

    // 'sentenca' so conta para arbitros e admin
    let sentenca = 0;
    if (userRole === 'ARBITRO' || userRole === 'ADMIN') {
      // Filtrar por arbitragens onde o user e arbitro designado
      const arbsArbitro = await this.prisma.arbitragem.findMany({
        where: { arbitros: { some: { arbitroId: userId } } },
        select: { id: true },
      });
      const arbsArbitroIds = arbsArbitro.map((a) => a.id);
      if (arbsArbitroIds.length) {
        sentenca = await this.prisma.chatMessage.count({
          where: {
            arbitragemId: { in: arbsArbitroIds },
            canal: { in: ['sentenca', 'arbitragem'] }, // aceita legado
            lida: false,
            NOT: { userId },
          },
        });
      }
    }

    return { processo, sentenca };
  }
}
