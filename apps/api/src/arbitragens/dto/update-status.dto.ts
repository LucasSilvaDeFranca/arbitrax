import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateStatusDto {
  @ApiProperty({
    example: 'AGUARDANDO_ACEITE',
    description: 'Novo status da arbitragem (deve ser uma transicao valida)',
  })
  @IsString()
  status: string;
}
