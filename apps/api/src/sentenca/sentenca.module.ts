import { Module } from '@nestjs/common';
import { IaModule } from '../ia/ia.module';
import { CertificadoDigitalModule } from '../certificado-digital/certificado-digital.module';
import { SentencaController } from './sentenca.controller';
import { SentencaService } from './sentenca.service';

@Module({
  imports: [IaModule, CertificadoDigitalModule],
  controllers: [SentencaController],
  providers: [SentencaService],
  exports: [SentencaService],
})
export class SentencaModule {}
