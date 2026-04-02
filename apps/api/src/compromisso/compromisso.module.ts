import { Module } from '@nestjs/common';
import { CompromissoController, ZapSignWebhookController } from './compromisso.controller';
import { CompromissoService } from './compromisso.service';
import { ZapSignService } from './zapsign.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [CompromissoController, ZapSignWebhookController],
  providers: [CompromissoService, ZapSignService],
  exports: [CompromissoService],
})
export class CompromissoModule {}
