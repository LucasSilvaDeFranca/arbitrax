import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { PlanosService } from './planos.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Planos')
@Controller('api/v1/planos')
export class PlanosController {
  constructor(private planosService: PlanosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar planos disponiveis' })
  listar() {
    return this.planosService.listar();
  }

  @Get('minha-assinatura')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar assinatura do usuario logado' })
  getAssinatura(@Request() req: any) {
    return this.planosService.getAssinatura(req.user.sub);
  }
}
