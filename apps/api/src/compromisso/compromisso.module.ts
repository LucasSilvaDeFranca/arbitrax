import { Module } from '@nestjs/common';
import { CompromissoController, ZapSignWebhookController } from './compromisso.controller';
import { CompromissoService } from './compromisso.service';
import { ZapSignService } from './zapsign.service';

@Module({
  controllers: [CompromissoController, ZapSignWebhookController],
  providers: [CompromissoService, ZapSignService],
  exports: [CompromissoService],
})
export class CompromissoModule {}
