import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PLANOS_DEFAULT = [
  {
    nome: 'free',
    label: 'Gratuito',
    preco: 0,
    arbitragensMes: 1,
    valorMaxCausa: 5000,
    escolherArbitro: false,
    urgenciaDisponivel: false,
    prioridadeFila: 0,
  },
  {
    nome: 'basic',
    label: 'Basic',
    preco: 49,
    arbitragensMes: 3,
    valorMaxCausa: 20000,
    escolherArbitro: false,
    urgenciaDisponivel: false,
    prioridadeFila: 0,
  },
  {
    nome: 'plus',
    label: 'Plus',
    preco: 199,
    arbitragensMes: 10,
    valorMaxCausa: 50000,
    escolherArbitro: true,
    urgenciaDisponivel: true,
    prioridadeFila: 1,
  },
  {
    nome: 'pro',
    label: 'Pro / Empresa',
    preco: 499,
    arbitragensMes: -1,
    valorMaxCausa: 1000000,
    escolherArbitro: true,
    urgenciaDisponivel: true,
    prioridadeFila: 2,
  },
];

@Injectable()
export class PlanosService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    // Seed planos se nao existirem
    try {
      for (const plano of PLANOS_DEFAULT) {
        await this.prisma.plano.upsert({
          where: { nome: plano.nome },
          update: {},
          create: plano,
        });
      }
    } catch {
      // Banco indisponivel no startup - seed sera feito na proxima inicializacao
    }
  }

  async listar() {
    return this.prisma.plano.findMany({
      where: { ativo: true },
      orderBy: { preco: 'asc' },
    });
  }

  async getAssinatura(userId: string) {
    const assinatura = await this.prisma.assinatura.findUnique({
      where: { userId },
      include: { plano: true },
    });

    if (!assinatura) {
      // Criar assinatura free por padrao
      const planoFree = await this.prisma.plano.findUnique({ where: { nome: 'free' } });
      if (!planoFree) return null;

      return this.prisma.assinatura.create({
        data: { userId, planoId: planoFree.id },
        include: { plano: true },
      });
    }

    return assinatura;
  }

  async verificarLimite(userId: string): Promise<{ permitido: boolean; motivo?: string }> {
    const assinatura = await this.getAssinatura(userId);
    if (!assinatura) return { permitido: true };

    const plano = assinatura.plano;

    // Ilimitado
    if (plano.arbitragensMes === -1) return { permitido: true };

    // Verificar uso do mes
    if (assinatura.usadoMes >= plano.arbitragensMes) {
      return {
        permitido: false,
        motivo: `Limite de ${plano.arbitragensMes} arbitragem(ns)/mes atingido no plano ${plano.label}. Faca upgrade ou use pay-per-case.`,
      };
    }

    return { permitido: true };
  }

  async incrementarUso(userId: string) {
    await this.prisma.assinatura.update({
      where: { userId },
      data: { usadoMes: { increment: 1 } },
    });
  }
}
