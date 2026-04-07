import { Module, forwardRef } from '@nestjs/common';
import { ConvitesController } from './convites.controller';
import { ConvitesService } from './convites.service';
import { EventsModule } from '../events/events.module';
import { CompromissoModule } from '../compromisso/compromisso.module';

@Module({
  imports: [EventsModule, forwardRef(() => CompromissoModule)],
  controllers: [ConvitesController],
  providers: [ConvitesService],
  exports: [ConvitesService],
})
export class ConvitesModule {}
