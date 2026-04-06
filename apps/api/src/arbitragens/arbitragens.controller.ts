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
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from '../admin/admin.service';

@ApiTags('Arbitragens')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/arbitragens')
export class ArbitragensController {
  constructor(
    private arbitragensService: ArbitragensService,
    private prisma: PrismaService,
    private adminService: AdminService,
  ) {}

  @Post()
  @Roles('REQUERENTE', 'ADVOGADO', 'ADMIN')
  @ApiOperation({ summary: 'Criar pedido de arbitragem' })
  create(@Request() req: any, @Body() dto: CreateArbitragemDto) {
    return this.arbitragensService.create(req.user.sub, req.user.role, dto);
  }

  @Get('tipos-demanda')
  @ApiOperation({ summary: 'Listar tipos de demanda ativos' })
  listarTiposDemanda() {
    return this.adminService.listarTiposDemanda();
  }

  @Get('arbitros-disponiveis')
  @ApiOperation({ summary: 'Listar arbitros disponiveis para selecao' })
  arbitrosDisponiveis() {
    return this.prisma.user.findMany({
      where: { role: 'ARBITRO', ativo: true },
      select: { id: true, nome: true, oabNumero: true },
    });
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
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Atualizar status (transicao de estado) - apenas Admin' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Request() req: any,
  ) {
    return this.arbitragensService.updateStatus(id, dto.status, req.user.sub, req.user.role);
  }

  @Post(':id/aceitar')
  @Roles('REQUERIDO')
  @ApiOperation({ summary: 'Requerido aceita convite de arbitragem' })
  aceitar(@Param('id') id: string, @Request() req: any) {
    return this.arbitragensService.updateStatus(id, 'AGUARDANDO_ASSINATURA', req.user.sub, 'ADMIN');
  }

  @Post(':id/recusar')
  @Roles('REQUERIDO')
  @ApiOperation({ summary: 'Requerido recusa convite de arbitragem' })
  recusar(@Param('id') id: string, @Request() req: any) {
    return this.arbitragensService.updateStatus(id, 'RECUSADA', req.user.sub, 'ADMIN');
  }

  @Post(':id/indicar-advogado')
  @ApiOperation({ summary: 'Indicar advogado para representar a parte' })
  indicarAdvogado(
    @Param('id') id: string,
    @Body() body: { advogadoEmail: string },
    @Request() req: any,
  ) {
    return this.arbitragensService.indicarAdvogado(id, req.user.sub, body.advogadoEmail);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Timeline de eventos da arbitragem' })
  getTimeline(@Param('id') id: string, @Request() req: any) {
    return this.arbitragensService.getTimeline(id, req.user.sub, req.user.role);
  }
}
