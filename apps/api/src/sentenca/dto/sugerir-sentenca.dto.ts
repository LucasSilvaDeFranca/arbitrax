import { IsString, IsOptional, IsArray, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SugerirSentencaDto {
  @ApiProperty({ example: 'A fundamentacao precisa incluir a clausula 8.3 do contrato...' })
  @IsString()
  @MinLength(20)
  sugestoes: string;

  @ApiPropertyOptional({ example: ['fundamentacao', 'dispositivo'] })
  @IsOptional()
  @IsArray()
  secoes?: string[];
}
