import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TextExtractorService {
  private readonly logger = new Logger(TextExtractorService.name);

  async extractFromFile(buffer: Buffer, mimeType: string): Promise<string | null> {
    try {
      if (mimeType === 'application/pdf') return this.extractFromPdf(buffer);
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return this.extractFromDocx(buffer);
      if (mimeType === 'text/plain') return buffer.toString('utf-8');
      return null;
    } catch (err: any) {
      this.logger.warn(`Erro na extracao de texto: ${err.message}`);
      return null;
    }
  }

  private async extractFromPdf(buffer: Buffer): Promise<string> {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text?.trim() || '';
  }

  private async extractFromDocx(buffer: Buffer): Promise<string> {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value?.trim() || '';
  }
}
