import { IsString, IsEmail, IsEnum, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RegisterRole {
  REQUERENTE = 'REQUERENTE',
  ADVOGADO = 'ADVOGADO',
}

export class RegisterDto {
  @ApiProperty({ example: 'Carlos Silva' })
  @IsString()
  @MinLength(3)
  nome: string;

  @ApiProperty({ example: '123.456.789-00' })
  @IsString()
  cpfCnpj: string;

  @ApiProperty({ example: 'carlos@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+5511999999999' })
  @IsString()
  telefone: string;

  @ApiProperty({ example: 'senha123' })
  @IsString()
  @MinLength(6)
  senha: string;

  @ApiProperty({ enum: RegisterRole, example: 'REQUERENTE' })
  @IsEnum(RegisterRole)
  role: RegisterRole;

  @ApiPropertyOptional({ example: 'OAB/SP 123.456' })
  @IsOptional()
  @IsString()
  oabNumero?: string;
}
