import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConvitesService } from './convites.service';

@ApiTags('Convites (Publico)')
@Controller('api/v1/convites')
export class ConvitesController {
  constructor(private convitesService: ConvitesService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Consultar convite por token (publico, sem auth)' })
  consultar(@Param('token') token: string) {
    return this.convitesService.consultarPorToken(token);
  }

  @Post(':token/aceitar')
  @ApiOperation({ summary: 'Aceitar convite de arbitragem (publico)' })
  aceitar(
    @Param('token') token: string,
    @Body() body: { aceiteRegras?: boolean; aceiteLei?: boolean; aceiteEquidade?: boolean; aceiteCostumes?: boolean },
  ) {
    return this.convitesService.aceitar(token, body);
  }

  @Post(':token/recusar')
  @ApiOperation({ summary: 'Recusar convite de arbitragem (publico)' })
  recusar(@Param('token') token: string) {
    return this.convitesService.recusar(token);
  }
}
