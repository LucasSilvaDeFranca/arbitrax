import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ArbitragensService } from './arbitragens.service';
import { CreateArbitragemDto } from './dto/create-arbitragem.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ListArbitragensDto } from './dto/list-arbitragens.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Arbitragens')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/arbitragens')
export class ArbitragensController {
  constructor(private arbitragensService: ArbitragensService) {}

  @Post()
  @Roles('REQUERENTE', 'ADVOGADO', 'ADMIN')
  @ApiOperation({ summary: 'Criar pedido de arbitragem' })
  create(@Request() req: any, @Body() dto: CreateArbitragemDto) {
    return this.arbitragensService.create(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar arbitragens do usuario' })
  findAll(@Request() req: any, @Query() dto: ListArbitragensDto) {
    return this.arbitragensService.findAll(req.user.sub, req.user.role, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe completo da arbitragem' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.arbitragensService.findOne(id, req.user.sub, req.user.role);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'REQUERENTE', 'REQUERIDO', 'ARBITRO')
  @ApiOperation({ summary: 'Atualizar status (transicao de estado)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Request() req: any,
  ) {
    return this.arbitragensService.updateStatus(id, dto.status, req.user.sub, req.user.role);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Timeline de eventos da arbitragem' })
  getTimeline(@Param('id') id: string, @Request() req: any) {
    return this.arbitragensService.getTimeline(id, req.user.sub, req.user.role);
  }
}
