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
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ArbitragensService } from './arbitragens.service';
import { ConvitesService } from '../convites/convites.service';
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
    private convitesService: ConvitesService,
    private prisma: PrismaService,
    private adminService: AdminService,
  ) {}

  @Post()
  @Roles('USUARIO', 'ADVOGADO', 'ADMIN')
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
  @Roles('USUARIO', 'ADVOGADO', 'ARBITRO', 'ADMIN')
  @ApiOperation({
    summary: 'Requerido aceita convite (delegado ao ConvitesService para gerar compromisso, notificar etc)',
  })
  async aceitar(
    @Param('id') id: string,
    @Body() body: { aceiteRegras?: boolean; aceiteLei?: boolean; aceiteEquidade?: boolean; aceiteCostumes?: boolean },
    @Request() req: any,
  ) {
    // Valida que o usuario logado eh o requerido desta arbitragem
    const arb = await this.prisma.arbitragem.findUnique({
      where: { id },
      select: { requeridoId: true, status: true },
    });
    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');
    if (arb.requeridoId !== req.user.sub && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Apenas o requerido pode aceitar este convite');
    }

    // Busca convite vinculado e delega ao ConvitesService (faz status, compromisso, email, eventos)
    const convite = await this.prisma.convite.findUnique({ where: { arbitragemId: id } });
    if (!convite) throw new NotFoundException('Convite nao encontrado para esta arbitragem');

    return this.convitesService.aceitar(convite.token, {
      aceiteRegras: body?.aceiteRegras ?? true,
      aceiteLei: body?.aceiteLei,
      aceiteEquidade: body?.aceiteEquidade,
      aceiteCostumes: body?.aceiteCostumes,
    });
  }

  @Post(':id/recusar')
  @Roles('USUARIO', 'ADVOGADO', 'ARBITRO', 'ADMIN')
  @ApiOperation({ summary: 'Requerido recusa convite de arbitragem' })
  async recusar(@Param('id') id: string, @Request() req: any) {
    const arb = await this.prisma.arbitragem.findUnique({
      where: { id },
      select: { requeridoId: true },
    });
    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');
    if (arb.requeridoId !== req.user.sub && req.user.role !== 'ADMIN') {
      throw new ForbiddenException('Apenas o requerido pode recusar este convite');
    }

    const convite = await this.prisma.convite.findUnique({ where: { arbitragemId: id } });
    if (!convite) throw new NotFoundException('Convite nao encontrado para esta arbitragem');

    return this.convitesService.recusar(convite.token);
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
