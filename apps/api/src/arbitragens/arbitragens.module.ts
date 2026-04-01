import { Module } from '@nestjs/common';
import { ArbitragensController } from './arbitragens.controller';
import { ArbitragensService } from './arbitragens.service';
import { EventsModule } from '../events/events.module';
import { PlanosModule } from '../planos/planos.module';

@Module({
  imports: [EventsModule, PlanosModule],
  controllers: [ArbitragensController],
  providers: [ArbitragensService],
  exports: [ArbitragensService],
})
export class ArbitragensModule {}
