import { Controller, Get, UseGuards, UseInterceptors, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { PlanosService } from './planos.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MemoryCacheInterceptor } from '../common/interceptors/cache.interceptor';

const planosCache = new MemoryCacheInterceptor(300); // 5 min - planos raramente mudam

@ApiTags('Planos')
@Controller('api/v1/planos')
export class PlanosController {
  constructor(private planosService: PlanosService) {}

  @Get()
  @UseInterceptors(planosCache)
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
