import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('PDF Downloads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/arbitragens/:arbitragemId')
export class PdfController {
  constructor(
    private pdfService: PdfService,
    private prisma: PrismaService,
  ) {}

  @Get('compromisso/pdf')
  @ApiOperation({ summary: 'Download PDF do Compromisso Arbitral' })
  async downloadCompromisso(
    @Param('arbitragemId') arbitragemId: string,
    @Res() res: Response,
  ) {
    const arb = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
      include: {
        requerente: true,
        requerido: true,
        arbitros: { include: { arbitro: true } },
        compromisso: true,
      },
    });

    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');

    const { buffer } = await this.pdfService.gerarCompromissoPdf({
      numero: arb.numero,
      objeto: arb.objeto,
      valorCausa: Number(arb.valorCausa),
      categoria: arb.categoria,
      requerenteNome: arb.requerente.nome,
      requerenteCpfCnpj: arb.requerente.cpfCnpj,
      requeridoNome: arb.requerido?.nome || 'N/A',
      requeridoCpfCnpj: arb.requerido?.cpfCnpj || 'N/A',
      arbitroNome: arb.arbitros?.[0]?.arbitro?.nome,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="compromisso-${arb.numero}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('sentenca/pdf')
  @ApiOperation({ summary: 'Download PDF da Sentenca Arbitral' })
  async downloadSentenca(
    @Param('arbitragemId') arbitragemId: string,
    @Res() res: Response,
  ) {
    const arb = await this.prisma.arbitragem.findUnique({
      where: { id: arbitragemId },
      include: {
        requerente: true,
        requerido: true,
        arbitros: { include: { arbitro: true } },
      },
    });

    if (!arb) throw new NotFoundException('Arbitragem nao encontrada');

    const sentenca = await this.prisma.sentenca.findFirst({
      where: { arbitragemId },
      orderBy: { versao: 'desc' },
    });

    if (!sentenca) throw new NotFoundException('Sentenca nao encontrada');

    let conteudo: any = {};
    try { conteudo = JSON.parse(sentenca.conteudoTexto); } catch { /* malformed */ }

    const { buffer } = await this.pdfService.gerarSentencaPdf({
      numero: arb.numero,
      versao: sentenca.versao,
      ementa: conteudo.ementa || '',
      relatorio: conteudo.relatorio || '',
      fundamentacao: conteudo.fundamentacao || '',
      dispositivo: conteudo.dispositivo || '',
      custas: conteudo.custas || { requerente: 0, requerido: 0 },
      requerenteNome: arb.requerente.nome,
      requeridoNome: arb.requerido?.nome || 'N/A',
      arbitroNome: arb.arbitros?.[0]?.arbitro?.nome,
      codigoVerif: sentenca.codigoVerif || undefined,
      hashSha256: sentenca.hashSha256 || undefined,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="sentenca-${arb.numero}-v${sentenca.versao}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
