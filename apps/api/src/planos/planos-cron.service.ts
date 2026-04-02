import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PlanosService } from './planos.service';

@Injectable()
export class PlanosCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlanosCronService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;
  private lastResetMonth: number = -1;

  constructor(private planosService: PlanosService) {}

  onModuleInit() {
    // Checar a cada hora
    this.intervalRef = setInterval(() => this.checkAndReset(), 60 * 60 * 1000);
    this.logger.log('Cron de reset mensal iniciado (verifica a cada hora)');

    // Verificar imediatamente no startup
    setTimeout(() => this.checkAndReset(), 10000);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  private async checkAndReset() {
    const now = new Date();
    const currentMonth = now.getFullYear() * 12 + now.getMonth();

    // Reset no dia 1 de cada mes, mas so uma vez por mes
    if (now.getDate() === 1 && this.lastResetMonth !== currentMonth) {
      this.logger.log('Dia 1 do mes - resetando uso mensal...');
      try {
        await this.planosService.resetarUsoMensal();
        this.lastResetMonth = currentMonth;
        this.logger.log('Uso mensal resetado com sucesso');
      } catch (err: any) {
        this.logger.error(`Erro ao resetar uso mensal: ${err.message}`);
      }
    }
  }
}
