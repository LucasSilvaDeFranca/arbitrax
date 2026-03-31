import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: process.env.NODE_ENV === 'production'
        ? ['error']
        : ['query', 'error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();

    // Middleware para reconectar automaticamente em caso de perda de conexao
    this.$use(async (params, next) => {
      try {
        return await next(params);
      } catch (err: any) {
        const isConnectionError =
          err.message?.includes("Can't reach database server") ||
          err.message?.includes('Circuit breaker') ||
          err.message?.includes('prepared statement') ||
          err.code === 'P1001' ||
          err.code === 'P1002' ||
          err.code === 'P2024';

        if (isConnectionError) {
          this.logger.warn(`Erro de conexao detectado, reconectando: ${err.message?.substring(0, 100)}`);
          try {
            await this.$disconnect();
            await this.$connect();
            this.logger.log('Reconectado ao banco com sucesso');
            return await next(params);
          } catch (retryErr: any) {
            this.logger.error(`Falha na reconexao: ${retryErr.message?.substring(0, 100)}`);
            throw err;
          }
        }
        throw err;
      }
    });
  }

  private async connectWithRetry() {
    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Conectado ao banco de dados');
        return;
      } catch (err: any) {
        this.logger.warn(
          `Tentativa ${attempt}/${maxRetries} de conexao falhou: ${err.message?.substring(0, 150)}`,
        );
        if (attempt === maxRetries) {
          this.logger.error(
            'Nao foi possivel conectar ao banco. App iniciando sem conexao.',
          );
          return;
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
