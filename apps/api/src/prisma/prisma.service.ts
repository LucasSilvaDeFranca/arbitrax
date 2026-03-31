import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Conectado ao banco de dados');
        return;
      } catch (err: any) {
        this.logger.warn(
          `Tentativa ${attempt}/${maxRetries} de conexao falhou: ${err.message}`,
        );
        if (attempt === maxRetries) {
          this.logger.error('Nao foi possivel conectar ao banco apos todas as tentativas');
          throw err;
        }
        const delay = attempt * 3000;
        this.logger.log(`Aguardando ${delay / 1000}s antes da proxima tentativa...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
