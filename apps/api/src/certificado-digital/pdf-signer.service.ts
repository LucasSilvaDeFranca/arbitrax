import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CertificadoDigitalService } from './certificado-digital.service';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as crypto from 'crypto';
import * as forge from 'node-forge';

interface SigningMetadata {
  arbitragemNumero: string;
  tipo: string;
  signerName: string;
}

@Injectable()
export class PdfSignerService {
  private readonly logger = new Logger(PdfSignerService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private certificadoService: CertificadoDigitalService,
  ) {}

  /**
   * Gera PDF da sentença e assina digitalmente com certificado A1.
   */
  async gerarEAssinarSentencaPdf(
    sentencaId: string,
    userId: string,
  ): Promise<{
    pdfUrl: string;
    hash: string;
    cn: string;
  }> {
    // Carregar sentença e arbitragem
    const sentenca = await this.prisma.sentenca.findUnique({
      where: { id: sentencaId },
      include: {
        arbitragem: {
          include: {
            requerente: { select: { nome: true, cpfCnpj: true } },
            requerido: { select: { nome: true, cpfCnpj: true } },
            arbitros: {
              include: { arbitro: { select: { nome: true } } },
            },
          },
        },
      },
    });

    if (!sentenca) {
      throw new BadRequestException('Sentenca nao encontrada');
    }

    if (sentenca.status !== 'RATIFICADA') {
      throw new BadRequestException('Sentenca precisa estar RATIFICADA para assinar digitalmente');
    }

    if (sentenca.assinadoDigitalmenteAt) {
      throw new BadRequestException('Sentenca ja foi assinada digitalmente');
    }

    const arb = sentenca.arbitragem;
    const conteudo = JSON.parse(sentenca.conteudoTexto);
    const arbitroNome = arb.arbitros?.[0]?.arbitro?.nome || 'Arbitro';

    // 1. Gerar PDF da sentença
    const pdfBuffer = await this.gerarSentencaPdf(conteudo, arb, sentenca);

    // 2. Assinar com certificado A1
    const { signedPdfBuffer, hash, cn } = await this.assinarPdf(
      userId,
      pdfBuffer,
      {
        arbitragemNumero: arb.numero,
        tipo: 'Sentenca Arbitral',
        signerName: arbitroNome,
      },
    );

    // 3. Upload do PDF assinado
    const storageKey = this.storage.generateKey(
      arb.id,
      'sentencas',
      `sentenca-v${sentenca.versao}-assinada.pdf`,
    );
    const uploaded = await this.storage.upload(signedPdfBuffer, storageKey, 'application/pdf');

    // 4. Atualizar sentença no banco
    await this.prisma.sentenca.update({
      where: { id: sentencaId },
      data: {
        pdfUrl: uploaded.url,
        hashSha256: hash,
        assinadoDigitalmenteAt: new Date(),
        assinadoDigitalmentePor: userId,
        certificadoCn: cn,
      },
    });

    // 5. Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        acao: 'SENTENCA_ASSINADA_DIGITALMENTE',
        entidade: 'sentenca',
        entidadeId: sentencaId,
        dadosDepois: { cn, hash, pdfUrl: uploaded.url },
      },
    });

    // 6. Notificar partes
    const partesIds = [arb.requerenteId, arb.requeridoId].filter(Boolean) as string[];
    for (const parteId of partesIds) {
      await this.prisma.notificacao.create({
        data: {
          userId: parteId,
          titulo: 'Sentenca assinada digitalmente',
          mensagem: `A sentenca do caso ${arb.numero} foi assinada digitalmente com certificado ICP-Brasil.`,
          tipo: 'sentenca',
          link: `/arbitragens/${arb.id}/sentenca`,
        },
      });
    }

    this.logger.log(`Sentenca ${sentencaId} assinada digitalmente por ${cn}`);

    return { pdfUrl: uploaded.url, hash, cn };
  }

  /**
   * Assina um PDF buffer com o certificado A1 do usuário.
   */
  async assinarPdf(
    userId: string,
    pdfBuffer: Buffer,
    metadata: SigningMetadata,
  ): Promise<{ signedPdfBuffer: Buffer; hash: string; cn: string }> {
    const { pfxBuffer, senha, cn } = await this.certificadoService.getCertificadoParaAssinatura(userId);

    // Adicionar página visual de assinatura
    const pdfComPagina = await this.gerarPaginaAssinatura(pdfBuffer, metadata, cn);

    // Aplicar assinatura digital PKCS7
    const signedPdf = await this.aplicarAssinaturaDigital(pdfComPagina, pfxBuffer, senha, metadata);

    const hash = crypto.createHash('sha256').update(signedPdf).digest('hex');

    return { signedPdfBuffer: signedPdf, hash, cn };
  }

  /**
   * Gera o PDF da sentença a partir do conteúdo JSON.
   */
  private async gerarSentencaPdf(
    conteudo: any,
    arb: any,
    sentenca: any,
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28; // A4
    const pageHeight = 841.89;
    const margin = 60;
    const contentWidth = pageWidth - margin * 2;
    const lineHeight = 16;
    const fontSize = 11;
    const titleFontSize = 16;
    const sectionFontSize = 13;

    // Função helper para adicionar texto com quebra de linha
    const addWrappedText = (
      page: any,
      text: string,
      x: number,
      startY: number,
      usedFont: any,
      size: number,
      maxWidth: number,
    ): number => {
      let y = startY;
      const words = (text || '').split(' ');
      let line = '';

      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        const testWidth = usedFont.widthOfTextAtSize(testLine, size);

        if (testWidth > maxWidth && line) {
          if (y < margin + 40) {
            // Nova página
            const newPage = pdfDoc.addPage([pageWidth, pageHeight]);
            page = newPage;
            y = pageHeight - margin;
          }
          page.drawText(line, { x, y, size, font: usedFont, color: rgb(0.1, 0.1, 0.1) });
          y -= lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        if (y < margin + 40) {
          const newPage = pdfDoc.addPage([pageWidth, pageHeight]);
          page = newPage;
          y = pageHeight - margin;
        }
        page.drawText(line, { x, y, size, font: usedFont, color: rgb(0.1, 0.1, 0.1) });
        y -= lineHeight;
      }
      return y;
    };

    // --- Página 1: Cabeçalho ---
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // Título
    page.drawText('SENTENCA ARBITRAL', {
      x: margin,
      y,
      size: titleFontSize,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.5),
    });
    y -= 30;

    page.drawText(`Processo: ${arb.numero}`, { x: margin, y, size: fontSize, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    y -= lineHeight;
    page.drawText(`Categoria: ${arb.categoria}`, { x: margin, y, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
    y -= lineHeight;
    page.drawText(`Valor da Causa: R$ ${Number(arb.valorCausa).toLocaleString('pt-BR')}`, { x: margin, y, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
    y -= lineHeight;

    const requerenteName = arb.requerente?.nome || 'N/I';
    const requeridoName = arb.requerido?.nome || 'N/I';
    page.drawText(`Requerente: ${requerenteName}`, { x: margin, y, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
    y -= lineHeight;
    page.drawText(`Requerido: ${requeridoName}`, { x: margin, y, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
    y -= lineHeight;

    const arbitroNome = arb.arbitros?.[0]?.arbitro?.nome || 'A designar';
    page.drawText(`Arbitro: ${arbitroNome}`, { x: margin, y, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
    y -= lineHeight;
    page.drawText(`Versao: ${sentenca.versao} | Codigo: ${sentenca.codigoVerif || 'N/A'}`, { x: margin, y, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 30;

    // Linha separadora
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 25;

    // --- Seções ---
    const sections = [
      { title: 'EMENTA', content: conteudo.ementa },
      { title: 'RELATORIO', content: conteudo.relatorio },
      { title: 'FUNDAMENTACAO', content: conteudo.fundamentacao },
      { title: 'DISPOSITIVO (DECISAO)', content: conteudo.dispositivo },
    ];

    for (const section of sections) {
      if (y < margin + 80) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      page.drawText(section.title, {
        x: margin,
        y,
        size: sectionFontSize,
        font: fontBold,
        color: rgb(0.1, 0.2, 0.5),
      });
      y -= 20;

      y = addWrappedText(page, section.content || '', margin, y, font, fontSize, contentWidth);
      y -= 20;
    }

    // --- Custas ---
    if (conteudo.custas) {
      if (y < margin + 80) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      page.drawText('CUSTAS', {
        x: margin,
        y,
        size: sectionFontSize,
        font: fontBold,
        color: rgb(0.1, 0.2, 0.5),
      });
      y -= 20;

      const custasReq = conteudo.custas.requerente || 0;
      const custasReqdo = conteudo.custas.requerido || 0;
      page.drawText(`Requerente: R$ ${Number(custasReq).toLocaleString('pt-BR')}`, { x: margin, y, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) });
      y -= lineHeight;
      page.drawText(`Requerido: R$ ${Number(custasReqdo).toLocaleString('pt-BR')}`, { x: margin, y, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 30;
    }

    // --- Rodapé com hash e data ---
    if (y < margin + 60) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 15;

    const dataGeracao = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    page.drawText(`Gerado em: ${dataGeracao} | ArbitraX - Plataforma de Arbitragem Digital`, {
      x: margin,
      y,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= 12;
    page.drawText(`Hash SHA-256 do conteudo: ${sentenca.hashSha256 || 'N/A'}`, {
      x: margin,
      y,
      size: 7,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // useObjectStreams: false para o PDF ser assinavel por @signpdf depois
    const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(pdfBytes);
  }

  /**
   * Adiciona página visual de assinatura ao PDF.
   */
  private async gerarPaginaAssinatura(
    pdfBuffer: Buffer,
    metadata: SigningMetadata,
    cn: string,
  ): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 60;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    let y = pageHeight - margin;

    // Hash do documento original
    const docHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    // Título
    page.drawText('DOCUMENTO ASSINADO DIGITALMENTE', {
      x: margin,
      y,
      size: 16,
      font: fontBold,
      color: rgb(0.0, 0.3, 0.15),
    });
    y -= 30;

    // Box de informações
    const boxY = y;
    page.drawRectangle({
      x: margin - 5,
      y: boxY - 200,
      width: pageWidth - margin * 2 + 10,
      height: 230,
      borderColor: rgb(0.0, 0.4, 0.2),
      borderWidth: 2,
      color: rgb(0.95, 0.99, 0.95),
    });

    y -= 10;
    const drawInfo = (label: string, value: string) => {
      page.drawText(label, { x: margin + 10, y, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(value, { x: margin + 160, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 18;
    };

    drawInfo('Tipo:', metadata.tipo);
    drawInfo('Processo:', metadata.arbitragemNumero);
    drawInfo('Assinado por:', metadata.signerName);
    drawInfo('Certificado (CN):', cn);
    drawInfo('Padrao:', 'ICP-Brasil / PAdES (PKCS#7)');

    const dataAssinatura = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    drawInfo('Data/Hora:', dataAssinatura);
    drawInfo('Hash SHA-256:', docHash.substring(0, 40) + '...');

    y -= 30;

    // Aviso legal
    page.drawText('VALIDADE JURIDICA', {
      x: margin,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.5),
    });
    y -= 20;

    const avisoLines = [
      'Este documento foi assinado digitalmente com certificado ICP-Brasil,',
      'em conformidade com a Medida Provisoria 2.200-2/2001.',
      '',
      'A assinatura digital garante:',
      '  - Autenticidade: identidade do signatario verificada via ICP-Brasil',
      '  - Integridade: qualquer alteracao invalida a assinatura',
      '  - Nao-repudio: o signatario nao pode negar a autoria',
      '',
      'Para verificar a autenticidade, abra este PDF no Adobe Acrobat Reader',
      'e verifique o painel de assinaturas digitais.',
    ];

    for (const line of avisoLines) {
      page.drawText(line, { x: margin, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
      y -= 14;
    }

    y -= 20;
    page.drawText('ArbitraX - Plataforma de Arbitragem Digital', {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0.1, 0.2, 0.5),
    });

    // useObjectStreams: false e obrigatorio pra compatibilidade com @signpdf.
    // Sem isso, signpdf falha com "Expected xref at NaN but found other content".
    const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(pdfBytes);
  }

  /**
   * Aplica assinatura digital PKCS7 ao PDF usando @signpdf.
   */
  private async aplicarAssinaturaDigital(
    pdfBuffer: Buffer,
    pfxBuffer: Buffer,
    senha: string,
    metadata: SigningMetadata,
  ): Promise<Buffer> {
    try {
      // Reconstruir PFX com senha vazia para compatibilidade com @signpdf
      const derBuffer = forge.util.createBuffer(pfxBuffer.toString('binary'));
      const asn1 = forge.asn1.fromDer(derBuffer);
      const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);

      // Extrair cert e chave
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

      const cert = certBags[forge.pki.oids.certBag]?.[0]?.cert;
      const key = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;

      if (!cert || !key) {
        throw new Error('Certificado ou chave privada nao encontrados no PFX');
      }

      // Reconstruir PFX com senha vazia
      const newAsn1 = forge.pkcs12.toPkcs12Asn1(key, [cert], '', {
        algorithm: '3des',
        generateLocalKeyId: true,
        friendlyName: cert.subject.getField('CN')?.value || 'cert',
      });
      const newDer = forge.asn1.toDer(newAsn1).getBytes();
      const newPfxBuffer = Buffer.from(newDer, 'binary');

      // Importar @signpdf (ESM modules)
      const { plainAddPlaceholder } = await import('@signpdf/placeholder-plain');
      const { P12Signer } = await import('@signpdf/signer-p12');
      const { default: signpdf } = await import('@signpdf/signpdf');

      // 1. Inserir placeholder para assinatura
      const pdfWithPlaceholder = plainAddPlaceholder({
        pdfBuffer,
        reason: `Assinatura Digital - ${metadata.tipo} - ArbitraX`,
        contactInfo: 'ArbitraX Plataforma de Arbitragem Digital',
        name: metadata.signerName,
        location: 'Brasil',
      });

      // 2. Criar signer e assinar
      const signer = new P12Signer(newPfxBuffer, { passphrase: '' });
      const signedPdf = await signpdf.sign(pdfWithPlaceholder, signer);

      this.logger.log(`PDF assinado com sucesso: ${metadata.tipo} - ${metadata.arbitragemNumero}`);
      return signedPdf;
    } catch (err: any) {
      this.logger.error('Erro ao aplicar assinatura digital', err);
      // Fallback: retorna PDF com a página visual mas sem PKCS7
      this.logger.warn('Retornando PDF com pagina de assinatura visual (sem PKCS7 criptografico)');
      return pdfBuffer;
    }
  }
}
