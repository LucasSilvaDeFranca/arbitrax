import { Module } from '@nestjs/common';
import { PrazosController } from './prazos.controller';
import { PrazosService } from './prazos.service';
import { PrazosCronService } from './prazos-cron.service';

@Module({
  controllers: [PrazosController],
  providers: [PrazosService, PrazosCronService],
  exports: [PrazosService],
})
export class PrazosModule {}
