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
import { SentencaService } from './sentenca.service';
import { SugerirSentencaDto } from './dto/sugerir-sentenca.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Sentenca')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/arbitragens/:arbitragemId')
export class SentencaController {
  constructor(private sentencaService: SentencaService) {}

  @Post('sentenca/gerar')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Acionar IA para gerar projeto de sentenca' })
  gerar(@Param('arbitragemId') arbitragemId: string) {
    return this.sentencaService.gerar(arbitragemId);
  }

  @Get('sentenca')
  @ApiOperation({ summary: 'Consultar sentenca atual' })
  getCurrent(@Param('arbitragemId') arbitragemId: string, @Request() req: any) {
    return this.sentencaService.getCurrent(arbitragemId, req.user.sub, req.user.role);
  }

  @Get('sentenca/versoes')
  @Roles('ARBITRO', 'ADMIN')
  @ApiOperation({ summary: 'Listar versoes da sentenca' })
  getVersoes(@Param('arbitragemId') arbitragemId: string, @Request() req: any) {
    return this.sentencaService.getVersoes(arbitragemId, req.user.sub, req.user.role);
  }

  @Post('sentenca/aprovar')
  @Roles('ARBITRO')
  @ApiOperation({ summary: 'Arbitro aprova projeto de sentenca (painel web)' })
  aprovar(@Param('arbitragemId') arbitragemId: string, @Request() req: any) {
    return this.sentencaService.aprovar(arbitragemId, req.user.sub);
  }

  @Post('sentenca/sugerir')
  @Roles('ARBITRO')
  @ApiOperation({ summary: 'Arbitro envia sugestoes de melhoria (painel web)' })
  sugerir(
    @Param('arbitragemId') arbitragemId: string,
    @Body() dto: SugerirSentencaDto,
    @Request() req: any,
  ) {
    return this.sentencaService.sugerir(arbitragemId, req.user.sub, dto.sugestoes);
  }

  @Post('sentenca/ratificar')
  @Roles('ARBITRO')
  @ApiOperation({ summary: 'Arbitro ratifica sentenca final (painel web)' })
  ratificar(@Param('arbitragemId') arbitragemId: string, @Request() req: any) {
    return this.sentencaService.ratificar(arbitragemId, req.user.sub);
  }

  @Post('ia/analisar-provas')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'IA analisa suficiencia de provas' })
  analisarProvas(@Param('arbitragemId') arbitragemId: string) {
    return this.sentencaService.analisarProvas(arbitragemId);
  }
}
