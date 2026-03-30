import { Injectable, Logger } from '@nestjs/common';
import { PrazosService } from './prazos.service';

@Injectable()
export class PrazosCronService {
  private readonly logger = new Logger(PrazosCronService.name);
  private intervalId: NodeJS.Timeout | null = null;

  constructor(private prazosService: PrazosService) {}

  /** Inicia verificacao a cada 15 minutos */
  onModuleInit() {
    this.logger.log('Cron de prazos iniciado (intervalo: 15min)');
    this.intervalId = setInterval(() => this.run(), 15 * 60 * 1000);
    // Rodar uma vez ao iniciar
    setTimeout(() => this.run(), 5000);
  }

  onModuleDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async run() {
    try {
      const result = await this.prazosService.processarPrazos();
      if (result.expirados || result.notificadosD1 || result.notificadosD3) {
        this.logger.log(
          `Prazos processados: ${result.expirados} expirados, ` +
          `${result.notificadosD1} D-1, ${result.notificadosD3} D-3`,
        );
      }
    } catch (err) {
      this.logger.error('Erro ao processar prazos', err);
    }
  }
}
