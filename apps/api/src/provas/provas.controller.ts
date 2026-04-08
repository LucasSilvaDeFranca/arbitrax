import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { ProvasService } from './provas.service';
import { CreateProvaDto } from './dto/create-prova.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Provas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/arbitragens/:arbitragemId/provas')
export class ProvasController {
  constructor(private provasService: ProvasService) {}

  @Post()
  @ApiOperation({ summary: 'Upload de prova (doc, imagem, video, audio)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('arquivo', { limits: { fileSize: 50 * 1024 * 1024 } }))
  upload(
    @Param('arbitragemId') arbitragemId: string,
    @Body() dto: CreateProvaDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.provasService.upload(
      arbitragemId,
      req.user.sub,
      req.user.role,
      dto,
      file,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar provas do caso' })
  findAll(@Param('arbitragemId') arbitragemId: string, @Request() req: any) {
    return this.provasService.findAll(arbitragemId, req.user.sub, req.user.role);
  }

  @Get(':provaId/download')
  @ApiOperation({ summary: 'Download de prova (URL assinada)' })
  download(
    @Param('arbitragemId') arbitragemId: string,
    @Param('provaId') provaId: string,
    @Request() req: any,
  ) {
    return this.provasService.download(arbitragemId, provaId, req.user.sub, req.user.role);
  }

  @Post('reprocessar-rag')
  @ApiOperation({ summary: 'Reprocessar todas as provas do caso no RAG (admin/arbitro)' })
  reprocessarRag(
    @Param('arbitragemId') arbitragemId: string,
    @Request() req: any,
  ) {
    return this.provasService.reprocessarRag(arbitragemId, req.user.sub, req.user.role);
  }
}
