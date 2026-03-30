import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DesignarArbitroDto {
  @ApiProperty({ description: 'ID do arbitro a ser designado' })
  @IsString()
  arbitroId: string;
}
