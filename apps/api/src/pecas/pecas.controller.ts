import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Request,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { PecasService } from './pecas.service';
import { CreatePecaDto } from './dto/create-peca.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Pecas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/arbitragens/:arbitragemId/pecas')
export class PecasController {
  constructor(private pecasService: PecasService) {}

  @Post()
  @ApiOperation({ summary: 'Protocolar peca (peticao, contestacao, etc.)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('anexos', 10, { limits: { fileSize: 20 * 1024 * 1024 } }))
  create(
    @Param('arbitragemId') arbitragemId: string,
    @Body() dto: CreatePecaDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: any,
  ) {
    return this.pecasService.create(
      arbitragemId,
      req.user.sub,
      req.user.role,
      dto,
      files,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar pecas do caso' })
  findAll(@Param('arbitragemId') arbitragemId: string, @Request() req: any) {
    return this.pecasService.findAll(arbitragemId, req.user.sub, req.user.role);
  }
}
