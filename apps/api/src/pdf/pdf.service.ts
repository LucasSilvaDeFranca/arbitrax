import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as crypto from 'crypto';

interface CompromissoPdfData {
  numero: string;
  objeto: string;
  valorCausa: number;
  categoria: string;
  requerenteNome: string;
  requerenteCpfCnpj: string;
  requeridoNome: string;
  requeridoCpfCnpj: string;
  arbitroNome?: string;
  codigoVerif?: string;
}

interface SentencaPdfData {
  numero: string;
  versao: number;
  ementa: string;
  relatorio: string;
  fundamentacao: string;
  dispositivo: string;
  custas: { requerente: number; requerido: number };
  requerenteNome: string;
  requeridoNome: string;
  arbitroNome?: string;
  codigoVerif?: string;
  hashSha256?: string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async gerarCompromissoPdf(data: CompromissoPdfData): Promise<{ buffer: Buffer; hash: string }> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 60 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        resolve({ buffer, hash });
      });
      doc.on('error', reject);

      // ── Header ──
      doc.rect(0, 0, doc.page.width, 80).fill('#1e3a5f');
      doc.fontSize(24).fillColor('#ffffff').text('ArbitraX', 60, 25, { align: 'center' });
      doc.fontSize(9).fillColor('#94a3b8').text('A justica do futuro, hoje!', 60, 52, { align: 'center' });

      doc.moveDown(3);
      doc.fillColor('#1e3a5f').fontSize(16).text('TERMO DE COMPROMISSO ARBITRAL', { align: 'center' });
      doc.moveDown(0.5);
      doc.fillColor('#64748b').fontSize(9).text(`Caso ${data.numero} | ${new Date().toLocaleDateString('pt-BR')}`, { align: 'center' });

      doc.moveDown(1.5);
      doc.fillColor('#0f172a').fontSize(10);

      // ── Partes ──
      doc.text('Pelo presente instrumento, as partes abaixo qualificadas:');
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text(`Parte Requerente: ${data.requerenteNome}`);
      doc.font('Helvetica').text(`CPF/CNPJ: ${data.requerenteCpfCnpj}`);
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').text(`Parte Requerida: ${data.requeridoNome}`);
      doc.font('Helvetica').text(`CPF/CNPJ: ${data.requeridoCpfCnpj}`);
      doc.moveDown(0.5);
      doc.text(`Concordam em submeter a controversia identificada como "${data.objeto.substring(0, 200)}" ao procedimento de arbitragem digital da plataforma ArbitraX, nos seguintes termos:`);

      // ── Clausulas ──
      const clausulas = [
        {
          titulo: '1. Aceitacao da Arbitragem',
          texto: 'As partes aceitam e reconhecem a arbitragem como meio exclusivo de solucao da presente disputa, afastando a jurisdicao estatal, conforme os termos da Lei de Arbitragem (Lei 9.307/96). As partes concordam que a arbitragem sera realizada de forma totalmente digital, sem audiencias presenciais, por meio da plataforma ArbitraX, com envio de provas por documento, audio e video.',
        },
        {
          titulo: '2. Regras Aplicaveis',
          texto: 'A arbitragem sera conduzida com base nos seguintes criterios: Lei aplicavel (normas juridicas vigentes no Brasil), Equidade (podera ser aplicada a criterio do arbitro, caso as partes concordem), e Costumes do setor (consideracao das praticas comerciais usuais).',
        },
        {
          titulo: '3. Designacao do Arbitro',
          texto: `O arbitro sera escolhido pelas partes entre os cadastrados na plataforma ou sorteado automaticamente pela plataforma.${data.arbitroNome ? ` Arbitro designado: ${data.arbitroNome}.` : ''}`,
        },
        {
          titulo: '4. Procedimento e Prazos',
          texto: 'Prazo para adesao: 5 (cinco) dias a partir do recebimento deste compromisso. Prazo maximo para decisao: 6 (seis) meses, salvo atraso causado pelas partes.',
        },
        {
          titulo: '5. Taxas e Custos Administrativos',
          texto: 'As partes estao cientes de que a plataforma ArbitraX pode prever taxas administrativas, conforme o plano de assinatura de cada usuario. Os custos serao informados antes da adesao ao procedimento.',
        },
        {
          titulo: '6. Sentenca Arbitral',
          texto: 'A decisao final sera elaborada com o auxilio de inteligencia artificial, sendo editada e validada pelo arbitro designado. A sentenca arbitral sera final e obrigatoria para as partes, tendo os mesmos efeitos de uma decisao judicial definitiva.',
        },
        {
          titulo: '7. Foro de Execucao',
          texto: 'Para execucao da sentenca arbitral, as partes elegem o foro da Comarca competente, com renuncia expressa a qualquer outro.',
        },
      ];

      for (const c of clausulas) {
        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e3a5f').text(c.titulo);
        doc.moveDown(0.2);
        doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(c.texto, { lineGap: 2 });
      }

      // ── Rodape ──
      doc.moveDown(1.5);
      doc.font('Helvetica').fontSize(9).fillColor('#64748b');
      doc.text(`Valor da causa: R$ ${data.valorCausa.toLocaleString('pt-BR')} | Categoria: ${data.categoria}`);
      doc.moveDown(0.5);
      doc.text('E, por estarem de pleno acordo, firmam este Termo de Compromisso Arbitral digitalmente.');
      doc.moveDown(1);
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`);

      if (data.codigoVerif) {
        doc.moveDown(1);
        doc.rect(60, doc.y, doc.page.width - 120, 40).fill('#f0fdf4');
        doc.fillColor('#166534').fontSize(10).text(`Codigo de Verificacao: ${data.codigoVerif}`, 60, doc.y - 30, { align: 'center' });
      }

      // ── Footer ──
      doc.moveDown(2);
      doc.fontSize(8).fillColor('#94a3b8').text('ArbitraX - Arbitragem Virtual | Lei 9.307/96 | Lei 14.063/2020', { align: 'center' });
      doc.text('Este documento tem validade juridica como assinatura eletronica simples.', { align: 'center' });

      doc.end();
    });
  }

  async gerarSentencaPdf(data: SentencaPdfData): Promise<{ buffer: Buffer; hash: string }> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 60 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        resolve({ buffer, hash });
      });
      doc.on('error', reject);

      // ── Header ──
      doc.rect(0, 0, doc.page.width, 80).fill('#1e3a5f');
      doc.fontSize(24).fillColor('#ffffff').text('ArbitraX', 60, 25, { align: 'center' });
      doc.fontSize(9).fillColor('#94a3b8').text('Sentenca Arbitral', 60, 52, { align: 'center' });

      doc.moveDown(3);
      doc.fillColor('#1e3a5f').fontSize(14).text('SENTENCA ARBITRAL', { align: 'center' });
      doc.moveDown(0.3);
      doc.fillColor('#64748b').fontSize(9).text(`Caso ${data.numero} | Versao ${data.versao} | ${new Date().toLocaleDateString('pt-BR')}`, { align: 'center' });
      doc.moveDown(0.3);
      doc.text(`${data.requerenteNome} vs ${data.requeridoNome}`, { align: 'center' });

      // ── Ementa ──
      doc.moveDown(1.5);
      doc.rect(60, doc.y, doc.page.width - 120, 2).fill('#1e40af');
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e3a5f').text('EMENTA');
      doc.moveDown(0.3);
      doc.font('Helvetica-Oblique').fontSize(9).fillColor('#0f172a').text(data.ementa, { lineGap: 2 });

      // ── Relatorio ──
      doc.moveDown(1);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e3a5f').text('RELATORIO');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(data.relatorio, { lineGap: 2 });

      // ── Fundamentacao ──
      doc.moveDown(1);
      if (doc.y > 650) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e3a5f').text('FUNDAMENTACAO');
      doc.moveDown(0.3);
      doc.font('Helvetica').fontSize(9).fillColor('#0f172a').text(data.fundamentacao, { lineGap: 2 });

      // ── Dispositivo ──
      doc.moveDown(1);
      if (doc.y > 650) doc.addPage();
      doc.rect(55, doc.y - 5, 3, 60).fill('#1e40af');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e3a5f').text('DISPOSITIVO (DECISAO)', 65);
      doc.moveDown(0.3);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(data.dispositivo, 65, undefined, { lineGap: 2 });

      // ── Custas ──
      doc.moveDown(1);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e3a5f').text('CUSTAS');
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
      doc.text(`Requerente: R$ ${data.custas.requerente.toLocaleString('pt-BR')}`);
      doc.text(`Requerido: R$ ${data.custas.requerido.toLocaleString('pt-BR')}`);

      // ── Arbitro ──
      if (data.arbitroNome) {
        doc.moveDown(0.5);
        doc.text(`Arbitro: ${data.arbitroNome}`);
      }

      // ── Verificacao ──
      if (data.codigoVerif) {
        doc.moveDown(1);
        doc.rect(60, doc.y, doc.page.width - 120, 50).fill('#f0fdf4');
        const boxY = doc.y - 40;
        doc.fillColor('#166534').fontSize(10);
        doc.text(`Codigo de Verificacao: ${data.codigoVerif}`, 60, boxY, { align: 'center' });
        doc.fontSize(8).fillColor('#15803d');
        doc.text('Verifique em: arbitrax.com.br/verificar', 60, boxY + 18, { align: 'center' });
      }

      if (data.hashSha256) {
        doc.moveDown(1.5);
        doc.fontSize(7).fillColor('#94a3b8').text(`SHA-256: ${data.hashSha256}`, { align: 'center' });
      }

      // ── Footer ──
      doc.moveDown(1);
      doc.fontSize(8).fillColor('#94a3b8').text('ArbitraX - Arbitragem Virtual | Lei 9.307/96 | Lei 14.063/2020', { align: 'center' });
      doc.text('Sentenca arbitral com forca de titulo executivo judicial (art. 31, Lei 9.307/96).', { align: 'center' });

      doc.end();
    });
  }
}
