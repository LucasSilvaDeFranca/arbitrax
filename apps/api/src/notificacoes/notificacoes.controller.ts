import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { NotificacoesService } from './notificacoes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Notificacoes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/notificacoes')
export class NotificacoesController {
  constructor(private notificacoesService: NotificacoesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificacoes do usuario' })
  @ApiQuery({ name: 'naoLidas', required: false, type: Boolean })
  findAll(@Request() req: any, @Query('naoLidas') naoLidas?: string) {
    return this.notificacoesService.findAll(req.user.sub, naoLidas === 'true');
  }

  @Patch(':id/lida')
  @ApiOperation({ summary: 'Marcar notificacao como lida' })
  marcarLida(@Param('id') id: string, @Request() req: any) {
    return this.notificacoesService.marcarLida(id, req.user.sub);
  }

  @Post('marcar-todas-lidas')
  @ApiOperation({ summary: 'Marcar todas as notificacoes como lidas' })
  marcarTodasLidas(@Request() req: any) {
    return this.notificacoesService.marcarTodasLidas(req.user.sub);
  }
}
