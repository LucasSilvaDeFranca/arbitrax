import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private openai: OpenAI;

  constructor(private config: ConfigService) {
    this.openai = new OpenAI({ apiKey: this.config.get('OPENAI_API_KEY', '') });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.config.get('OPENAI_API_KEY')) {
      this.logger.warn('OPENAI_API_KEY nao configurada - embedding nao gerado');
      return [];
    }
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // limit input
      });
      return response.data[0].embedding;
    } catch (err: any) {
      this.logger.error(`Erro ao gerar embedding: ${err.message}`);
      return [];
    }
  }
}
