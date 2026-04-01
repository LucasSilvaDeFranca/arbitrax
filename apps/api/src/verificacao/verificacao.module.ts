import { Module } from '@nestjs/common';
import { VerificacaoController } from './verificacao.controller';

@Module({
  controllers: [VerificacaoController],
})
export class VerificacaoModule {}
