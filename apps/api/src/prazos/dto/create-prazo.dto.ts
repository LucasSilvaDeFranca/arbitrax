import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PrazoTipoEnum {
  ACEITE = 'ACEITE',
  ASSINATURA = 'ASSINATURA',
  PETICAO = 'PETICAO',
  CONTESTACAO = 'CONTESTACAO',
  PROVAS_ADICIONAIS = 'PROVAS_ADICIONAIS',
  REVISAO_SENTENCA = 'REVISAO_SENTENCA',
  RATIFICACAO = 'RATIFICACAO',
  CUSTOM = 'CUSTOM',
}

export class CreatePrazoDto {
  @ApiProperty({ enum: PrazoTipoEnum, example: 'PETICAO' })
  @IsEnum(PrazoTipoEnum)
  tipo: PrazoTipoEnum;

  @ApiPropertyOptional({ description: 'ID da parte responsavel' })
  @IsOptional()
  @IsString()
  parteId?: string;

  @ApiProperty({ example: '2026-04-15T23:59:59.000Z' })
  @IsDateString()
  fim: string;
}
