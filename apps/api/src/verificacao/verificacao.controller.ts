import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

@ApiTags('Verificacao Publica')
@Controller('api/v1/verificar')
export class VerificacaoController {
  constructor(private prisma: PrismaService) {}

  @Get(':codigo')
  @ApiOperation({ summary: 'Verificar autenticidade de sentenca (publico, sem auth)' })
  async verificar(@Param('codigo') codigo: string) {
    const sentenca = await this.prisma.sentenca.findFirst({
      where: { codigoVerif: codigo },
      include: {
        arbitragem: {
          select: {
            numero: true,
            status: true,
            categoria: true,
            createdAt: true,
            requerente: { select: { nome: true } },
            requerido: { select: { nome: true } },
          },
        },
      },
    });

    if (!sentenca) throw new NotFoundException('Documento nao encontrado');

    return {
      codigoVerif: sentenca.codigoVerif,
      numero: sentenca.arbitragem.numero,
      status: sentenca.status,
      versao: sentenca.versao,
      hashSha256: sentenca.hashSha256,
      requerente: sentenca.arbitragem.requerente?.nome,
      requerido: sentenca.arbitragem.requerido?.nome,
      categoria: sentenca.arbitragem.categoria,
      dataRatificacao: sentenca.createdAt,
      assinadoDigitalmente: !!sentenca.assinadoDigitalmenteAt,
      certificadoCn: sentenca.certificadoCn,
    };
  }
}
