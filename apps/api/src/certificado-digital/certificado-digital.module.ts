import { Module } from '@nestjs/common';
import { CertificadoDigitalController } from './certificado-digital.controller';
import { CertificadoDigitalService } from './certificado-digital.service';
import { PdfSignerService } from './pdf-signer.service';

@Module({
  controllers: [CertificadoDigitalController],
  providers: [CertificadoDigitalService, PdfSignerService],
  exports: [CertificadoDigitalService, PdfSignerService],
})
export class CertificadoDigitalModule {}
