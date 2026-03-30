import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PecaTipoEnum {
  PETICAO_INICIAL = 'PETICAO_INICIAL',
  CONTESTACAO = 'CONTESTACAO',
  REPLICA = 'REPLICA',
  TREPLICA = 'TREPLICA',
  ALEGACOES_FINAIS = 'ALEGACOES_FINAIS',
  OUTROS = 'OUTROS',
}

export class CreatePecaDto {
  @ApiProperty({ enum: PecaTipoEnum, example: 'PETICAO_INICIAL' })
  @IsEnum(PecaTipoEnum)
  tipo: PecaTipoEnum;

  @ApiPropertyOptional({ example: 'Petição inicial referente ao contrato...' })
  @IsOptional()
  @IsString()
  @MinLength(10)
  conteudo?: string;
}
