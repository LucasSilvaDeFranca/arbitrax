import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CompromissoService } from './compromisso.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Compromisso')
@Controller('api/v1/arbitragens/:arbitragemId/compromisso')
export class CompromissoController {
  constructor(private compromissoService: CompromissoService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gerar compromisso arbitral + PDF + enviar para assinatura (ZapSign)' })
  gerar(@Param('arbitragemId') arbitragemId: string) {
    return this.compromissoService.gerar(arbitragemId);
  }

  @Post('regerar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regerar compromisso (admin ou partes do caso). Substitui se ninguem assinou.' })
  regerar(
    @Param('arbitragemId') arbitragemId: string,
    @Request() req: any,
  ) {
    return this.compromissoService.regerarComAutorizacao(arbitragemId, req.user.sub, req.user.role);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar status do compromisso e assinaturas' })
  consultar(@Param('arbitragemId') arbitragemId: string) {
    return this.compromissoService.consultar(arbitragemId);
  }

  @Post('assinar-digital')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assinar compromisso com certificado digital A1 (ICP-Brasil)' })
  assinarDigital(
    @Param('arbitragemId') arbitragemId: string,
    @Request() req: any,
  ) {
    return this.compromissoService.assinarDigital(arbitragemId, req.user.sub);
  }
}

@Controller('webhooks/zapsign')
export class ZapSignWebhookController {
  constructor(private compromissoService: CompromissoService) {}

  @Post()
  @ApiOperation({ summary: 'Webhook ZapSign' })
  webhook(@Body() body: any) {
    return this.compromissoService.processarWebhook(body);
  }
}
