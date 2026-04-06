import { Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { CompromissoModule } from '../compromisso/compromisso.module';
import { SentencaModule } from '../sentenca/sentenca.module';
import { PrazosModule } from '../prazos/prazos.module';
import { IaModule } from '../ia/ia.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    CompromissoModule,
    SentencaModule,
    PrazosModule,
    IaModule,
    EventsModule,
  ],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
