import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  MinLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum CategoriaEnum {
  COMERCIAL = 'COMERCIAL',
  CONSUMIDOR = 'CONSUMIDOR',
  EMPRESARIAL = 'EMPRESARIAL',
  TRABALHISTA = 'TRABALHISTA',
  IMOBILIARIO = 'IMOBILIARIO',
  OUTROS = 'OUTROS',
}

export class CreateArbitragemDto {
  @ApiProperty({ example: 'Roberto Almeida' })
  @IsString()
  @MinLength(3)
  requeridoNome: string;

  @ApiProperty({ example: '987.654.321-00' })
  @IsString()
  requeridoCpfCnpj: string;

  @ApiProperty({ example: '+5511988888888' })
  @IsString()
  requeridoTelefone: string;

  @ApiPropertyOptional({ example: 'roberto@email.com' })
  @IsOptional()
  @IsString()
  requeridoEmail?: string;

  @ApiProperty({ example: 'Disputa contratual referente a prestacao de servicos de TI...' })
  @IsString()
  @MinLength(50)
  objeto: string;

  @ApiProperty({ example: 25000 })
  @IsNumber()
  @Type(() => Number)
  @Min(1000)
  valorCausa: number;

  @ApiProperty({ enum: CategoriaEnum, example: 'COMERCIAL' })
  @IsEnum(CategoriaEnum)
  categoria: CategoriaEnum;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  urgencia?: boolean;

  // Campos opcionais para quando ADVOGADO cria em nome do cliente
  @ApiPropertyOptional({ description: 'Nome do requerente (quando advogado cria em nome do cliente)' })
  @IsOptional()
  @IsString()
  requerenteNome?: string;

  @ApiPropertyOptional({ description: 'CPF/CNPJ do requerente' })
  @IsOptional()
  @IsString()
  requerenteCpfCnpj?: string;

  @ApiPropertyOptional({ description: 'Telefone do requerente' })
  @IsOptional()
  @IsString()
  requerenteTelefone?: string;

  @ApiPropertyOptional({ description: 'Email do requerente' })
  @IsOptional()
  @IsString()
  requerenteEmail?: string;
}
