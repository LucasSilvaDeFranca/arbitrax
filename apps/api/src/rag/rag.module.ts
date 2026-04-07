import { Global, Module } from '@nestjs/common';
import { TextExtractorService } from './text-extractor.service';
import { EmbeddingsService } from './embeddings.service';
import { ChunkService } from './chunk.service';
import { RagService } from './rag.service';

@Global()
@Module({
  providers: [TextExtractorService, EmbeddingsService, ChunkService, RagService],
  exports: [RagService],
})
export class RagModule {}
