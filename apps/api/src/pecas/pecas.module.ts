import { Module } from '@nestjs/common';
import { PecasController } from './pecas.controller';
import { PecasService } from './pecas.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [PecasController],
  providers: [PecasService],
  exports: [PecasService],
})
export class PecasModule {}
