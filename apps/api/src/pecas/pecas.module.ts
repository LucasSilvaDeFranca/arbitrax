import { Module } from '@nestjs/common';
import { PecasController } from './pecas.controller';
import { PecasService } from './pecas.service';

@Module({
  controllers: [PecasController],
  providers: [PecasService],
  exports: [PecasService],
})
export class PecasModule {}
