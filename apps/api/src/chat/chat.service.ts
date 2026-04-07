import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async sendMessage(
    arbitragemId: string,
    userId: string,
    userRole: string,
    data: { conteudo?: string; tipo?: string; mediaUrl?: string; canal?: string },
  ) {
    await this.checkAccess(arbitragemId, userId, userRole);

    const canal = data.canal || 'processos';

    if (canal === 'arbitragem' && userRole !== 'ARBITRO' && userRole !== 'ADMIN') {
      throw new ForbiddenException('Acesso ao Grupo Arbitragem restrito a arbitros');
    }

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

  /** Enviar mensagem de sistema (notificacoes automaticas no chat) */
  async sendSystemMessage(arbitragemId: string, conteudo: string, canal: string = 'processos') {
    // Buscar admin ou usar primeiro user como fallback
    const admin = await this.prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) return;

    return this.prisma.chatMessage.create({
      data: {
        arbitragemId,
        userId: admin.id,
        tipo: 'system',
        conteudo,
        canal,
      },
    });
  }

  /** Enviar mensagem da IA (userId null) */
  async sendIaMessage(arbitragemId: string, conteudo: string, canal: string = 'processos') {
    return this.prisma.chatMessage.create({
      data: {
        arbitragemId,
        userId: null,
        tipo: 'ia',
        conteudo,
        canal,
      },
    });
  }

  async getMessages(
    arbitragemId: string,
    userId: string,
    userRole: string,
    canal: string = 'processos',
    cursor?: string,
    limit = 50,
  ) {
    await this.checkAccess(arbitragemId, userId, userRole);

    if (canal === 'arbitragem' && userRole !== 'ARBITRO' && userRole !== 'ADMIN') {
      throw new ForbiddenException('Acesso ao Grupo Arbitragem restrito a arbitros');
    }

    const where: any = { arbitragemId, canal };
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

    // Marcar como lidas as mensagens de outros usuarios
    await this.prisma.chatMessage.updateMany({
      where: {
        arbitragemId,
        canal,
        userId: { not: userId },
        lida: false,
      },
      data: { lida: true },
    });

    return messages.reverse();
  }

  async getUnreadCount(userId: string, userRole: string) {
    // Buscar arbitragens do usuario
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
    if (!arbIds.length) return { processos: 0, arbitragem: 0 };

    const processos = await this.prisma.chatMessage.count({
      where: {
        arbitragemId: { in: arbIds },
        canal: 'processos',
        userId: { not: userId },
        lida: false,
      },
    });

    let arbitragem = 0;
    if (userRole === 'ARBITRO' || userRole === 'ADMIN') {
      arbitragem = await this.prisma.chatMessage.count({
        where: {
          arbitragemId: { in: arbIds },
          canal: 'arbitragem',
          userId: { not: userId },
          lida: false,
        },
      });
    }

    return { processos, arbitragem };
  }

  private async checkAccess(arbitragemId: string, userId: string, userRole: string) {
    if (userRole === 'ADMIN') return;

    const arb = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
      include: { arbitros: true },
    });
    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');

    const isParticipant =
      arb.requerenteId === userId ||
      arb.requeridoId === userId ||
      arb.advRequerenteId === userId ||
      arb.advRequeridoId === userId ||
      arb.arbitros.some((a) => a.arbitroId === userId);

    if (!isParticipant) throw new ForbiddenException('Sem acesso ao chat');
  }
}
