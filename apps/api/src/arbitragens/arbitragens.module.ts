import { Module } from '@nestjs/common';
import { ArbitragensController } from './arbitragens.controller';
import { ArbitragensService } from './arbitragens.service';

@Module({
  controllers: [ArbitragensController],
  providers: [ArbitragensService],
  exports: [ArbitragensService],
})
export class ArbitragensModule {}
