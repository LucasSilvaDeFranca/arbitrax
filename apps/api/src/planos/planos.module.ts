import { Module } from '@nestjs/common';
import { PlanosController } from './planos.controller';
import { PlanosService } from './planos.service';
import { PlanosCronService } from './planos-cron.service';

@Module({
  controllers: [PlanosController],
  providers: [PlanosService, PlanosCronService],
  exports: [PlanosService],
})
export class PlanosModule {}
