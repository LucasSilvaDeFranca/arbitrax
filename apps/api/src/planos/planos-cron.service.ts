import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PlanosService } from './planos.service';

@Injectable()
export class PlanosCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlanosCronService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;

  constructor(private planosService: PlanosService) {}

  onModuleInit() {
    // Checar a cada hora se e dia 1 do mes
    this.intervalRef = setInterval(() => this.checkAndReset(), 60 * 60 * 1000);
    this.logger.log('PlanosCronService inicializado - verificacao mensal ativa');

    // Verificar imediatamente no startup
    this.checkAndReset();
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  private async checkAndReset() {
    const now = new Date();
    if (now.getDate() === 1 && now.getHours() === 0) {
      this.logger.log('Primeiro dia do mes detectado - resetando uso mensal...');
      try {
        await this.planosService.resetarUsoMensal();
        this.logger.log('Uso mensal resetado com sucesso');
      } catch (err: any) {
        this.logger.error(`Erro ao resetar uso mensal: ${err.message}`);
      }
    }
  }
}
