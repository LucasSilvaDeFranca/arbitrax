import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
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

  @Post('enviar-otp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Envia codigo OTP por email para assinatura avancada (valida CPF antes)' })
  enviarOtp(
    @Param('arbitragemId') arbitragemId: string,
    @Body() body: { cpf: string },
    @Request() req: any,
  ) {
    return this.compromissoService.enviarOtpAssinatura(arbitragemId, req.user.sub, body.cpf);
  }

  @Post('assinar-avancada')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assinar com OTP validado (assinatura avancada por email + CPF)' })
  assinarAvancada(
    @Param('arbitragemId') arbitragemId: string,
    @Body() body: { codigo: string },
    @Request() req: any,
    @Headers('x-forwarded-for') forwardedFor: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const ip = forwardedFor?.split(',')[0]?.trim() || req.ip || 'desconhecido';
    return this.compromissoService.assinarAvancada(arbitragemId, req.user.sub, body.codigo, { ip, userAgent });
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
