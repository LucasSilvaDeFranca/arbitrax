import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { IaService } from './ia.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('IA')
@Controller('api/v1/ia')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class IaController {
  constructor(
    private iaService: IaService,
    private prisma: PrismaService,
  ) {}

  @Post('resumir-caso')
  @Roles('ADMIN', 'ARBITRO')
  @ApiOperation({ summary: 'Gerar resumo executivo de um caso via IA' })
  async resumirCaso(@Body('arbitragemId') arbitragemId: string) {
    const arbitragem = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
      include: {
        pecas: { select: { tipo: true, conteudo: true } },
        provas: { select: { tipo: true, descricao: true } },
      },
    });

    if (!arbitragem) {
      throw new NotFoundException('Arbitragem nao encontrada');
    }

    const resumo = await this.iaService.resumirCaso(
      {
        numero: arbitragem.numero,
        objeto: arbitragem.objeto,
        valorCausa: Number(arbitragem.valorCausa),
        categoria: arbitragem.categoria,
        status: arbitragem.status,
      },
      arbitragem.pecas.map((p: any) => ({ tipo: p.tipo, conteudo: p.conteudo || undefined })),
      arbitragem.provas.map((p: any) => ({ tipo: p.tipo, descricao: p.descricao || undefined })),
      arbitragemId,
    );

    return resumo;
  }

  @Get('modelos')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Listar todos os prompts de IA cadastrados' })
  async listarModelos() {
    return this.prisma.iaPrompt.findMany({
      orderBy: { tipo: 'asc' },
    });
  }

  @Patch('modelos/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Atualizar um prompt de IA' })
  async atualizarModelo(
    @Param('id') id: string,
    @Body()
    body: {
      promptSistema?: string;
      promptTemplate?: string;
      modelo?: string;
      temperatura?: number;
      ativo?: boolean;
    },
  ) {
    const existing = await this.prisma.iaPrompt.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Prompt de IA nao encontrado');
    }

    return this.prisma.iaPrompt.update({
      where: { id },
      data: {
        ...(body.promptSistema !== undefined && {
          promptSistema: body.promptSistema,
        }),
        ...(body.promptTemplate !== undefined && {
          promptTemplate: body.promptTemplate,
        }),
        ...(body.modelo !== undefined && { modelo: body.modelo }),
        ...(body.temperatura !== undefined && {
          temperatura: body.temperatura,
        }),
        ...(body.ativo !== undefined && { ativo: body.ativo }),
      },
    });
  }
}
