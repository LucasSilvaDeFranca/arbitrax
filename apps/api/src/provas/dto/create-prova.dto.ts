import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProvaDto {
  @ApiPropertyOptional({ example: 'Contrato de prestacao de servicos assinado em 2025' })
  @IsOptional()
  @IsString()
  descricao?: string;
}
