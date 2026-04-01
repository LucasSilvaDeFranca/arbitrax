import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { DesignarArbitroDto } from './dto/designar-arbitro.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('api/v1/admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard stats' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('casos')
  @ApiOperation({ summary: 'Listar todos os casos' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  listarCasos(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.listarCasos(
      Number(page) || 1,
      Number(limit) || 20,
      status,
    );
  }

  @Get('arbitros')
  @ApiOperation({ summary: 'Listar arbitros com carga de trabalho' })
  listarArbitros() {
    return this.adminService.listarArbitros();
  }

  @Post('arbitragens/:arbitragemId/designar')
  @ApiOperation({ summary: 'Designar arbitro para caso' })
  designarArbitro(
    @Param('arbitragemId') arbitragemId: string,
    @Body() dto: DesignarArbitroDto,
    @Request() req: any,
  ) {
    return this.adminService.designarArbitro(arbitragemId, dto.arbitroId, req.user.sub);
  }

  @Post('arbitros')
  @ApiOperation({ summary: 'Cadastrar novo arbitro' })
  criarArbitro(@Body() dto: { nome: string; cpfCnpj: string; email: string; telefone: string; oabNumero?: string }) {
    return this.adminService.criarArbitro(dto);
  }

  @Get('arbitros/:arbitroId/casos')
  @ApiOperation({ summary: 'Listar casos de um arbitro' })
  casosDoArbitro(@Param('arbitroId') arbitroId: string) {
    return this.adminService.casosDoArbitro(arbitroId);
  }
}

// Controller separado para arbitros (acao propria, nao admin)
import { Controller as Ctrl } from '@nestjs/common';

@ApiTags('Arbitros')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ARBITRO')
@Ctrl('api/v1/arbitros')
export class ArbitrosSelfController {
  constructor(private adminService: AdminService) {}

  @Get('meus-casos')
  @ApiOperation({ summary: 'Listar meus casos (arbitro logado)' })
  meusCasos(@Request() req: any) {
    return this.adminService.casosDoArbitro(req.user.sub);
  }

  @Post(':arbitragemId/impedimento')
  @ApiOperation({ summary: 'Declarar impedimento/suspeicao' })
  impedimento(
    @Param('arbitragemId') arbitragemId: string,
    @Body() dto: { motivo: string },
    @Request() req: any,
  ) {
    return this.adminService.declararImpedimento(arbitragemId, req.user.sub, dto.motivo);
  }
}
