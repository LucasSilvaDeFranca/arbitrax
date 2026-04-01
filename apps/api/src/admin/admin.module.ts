import { Module } from '@nestjs/common';
import { AdminController, ArbitrosSelfController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController, ArbitrosSelfController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
