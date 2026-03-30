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
    data: { conteudo?: string; tipo?: string; mediaUrl?: string },
  ) {
    await this.checkAccess(arbitragemId, userId, userRole);

    const msg = await this.prisma.chatMessage.create({
      data: {
        arbitragemId,
        userId,
        tipo: data.tipo || 'text',
        conteudo: data.conteudo,
        mediaUrl: data.mediaUrl,
      },
      include: {
        user: { select: { id: true, nome: true, role: true } },
      },
    });

    return msg;
  }

  /** Enviar mensagem de sistema (notificacoes automaticas no chat) */
  async sendSystemMessage(arbitragemId: string, conteudo: string) {
    // Buscar admin ou usar primeiro user como fallback
    const admin = await this.prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) return;

    return this.prisma.chatMessage.create({
      data: {
        arbitragemId,
        userId: admin.id,
        tipo: 'system',
        conteudo,
      },
    });
  }

  async getMessages(
    arbitragemId: string,
    userId: string,
    userRole: string,
    cursor?: string,
    limit = 50,
  ) {
    await this.checkAccess(arbitragemId, userId, userRole);

    const where: any = { arbitragemId };
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
        userId: { not: userId },
        lida: false,
      },
      data: { lida: true },
    });

    return messages.reverse();
  }

  async getUnreadCount(userId: string) {
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
    if (!arbIds.length) return 0;

    return this.prisma.chatMessage.count({
      where: {
        arbitragemId: { in: arbIds },
        userId: { not: userId },
        lida: false,
      },
    });
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
