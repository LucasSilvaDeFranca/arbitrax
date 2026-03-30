import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificacoesService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, apenasNaoLidas = false) {
    const where: any = { userId };
    if (apenasNaoLidas) where.lida = false;

    const [data, total, naoLidas] = await Promise.all([
      this.prisma.notificacao.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notificacao.count({ where: { userId } }),
      this.prisma.notificacao.count({ where: { userId, lida: false } }),
    ]);

    return { data, total, naoLidas };
  }

  async marcarLida(id: string, userId: string) {
    return this.prisma.notificacao.updateMany({
      where: { id, userId },
      data: { lida: true },
    });
  }

  async marcarTodasLidas(userId: string) {
    return this.prisma.notificacao.updateMany({
      where: { userId, lida: false },
      data: { lida: true },
    });
  }
}
