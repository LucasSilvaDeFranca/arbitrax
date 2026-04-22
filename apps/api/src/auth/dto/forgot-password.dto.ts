import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'carlos@email.com' })
  @IsEmail({}, { message: 'Email invalido' })
  email: string;
}
