import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadCertificadoDto {
  @ApiProperty({ description: 'Senha do arquivo PFX/P12' })
  @IsString()
  @IsNotEmpty({ message: 'Senha do certificado e obrigatoria' })
  senha: string;
}
