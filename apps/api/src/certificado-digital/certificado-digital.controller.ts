import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CertificadoDigitalService } from './certificado-digital.service';
import { UploadCertificadoDto } from './dto/upload-certificado.dto';

@ApiTags('Certificado Digital')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ARBITRO', 'ADVOGADO', 'ADMIN')
@Controller('api/v1/certificado-digital')
export class CertificadoDigitalController {
  constructor(private certificadoService: CertificadoDigitalService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload de certificado A1 (.pfx/.p12)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 }, // 50KB
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadCertificadoDto,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo .pfx ou .p12 e obrigatorio');
    }
    return this.certificadoService.uploadCertificado(req.user.sub, file, dto.senha);
  }

  @Get('status')
  @ApiOperation({ summary: 'Consultar status do certificado A1' })
  getStatus(@Request() req: any) {
    return this.certificadoService.getStatus(req.user.sub);
  }

  @Delete()
  @ApiOperation({ summary: 'Remover certificado A1' })
  remover(@Request() req: any) {
    return this.certificadoService.removeCertificado(req.user.sub);
  }

  @Post('validar')
  @ApiOperation({ summary: 'Re-validar certificado A1 armazenado' })
  validar(@Request() req: any) {
    return this.certificadoService.validar(req.user.sub);
  }
}
