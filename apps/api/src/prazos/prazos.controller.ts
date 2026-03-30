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
import { PrazosService } from './prazos.service';
import { CreatePrazoDto } from './dto/create-prazo.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Prazos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/arbitragens/:arbitragemId/prazos')
export class PrazosController {
  constructor(private prazosService: PrazosService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Criar prazo manual (Admin)' })
  create(
    @Param('arbitragemId') arbitragemId: string,
    @Body() dto: CreatePrazoDto,
    @Request() req: any,
  ) {
    return this.prazosService.create(arbitragemId, req.user.sub, req.user.role, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar prazos do caso' })
  findAll(@Param('arbitragemId') arbitragemId: string, @Request() req: any) {
    return this.prazosService.findAll(arbitragemId, req.user.sub, req.user.role);
  }
}
