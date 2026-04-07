import { Injectable } from '@nestjs/common';

@Injectable()
export class ChunkService {
  splitText(text: string, chunkSize: number = 800, overlap: number = 200): string[] {
    if (!text || text.length === 0) return [];

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;

      // Try to break at sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastPeriod, lastNewline);
        if (breakPoint > start + chunkSize / 2) {
          end = breakPoint + 1;
        }
      }

      const chunk = text.substring(start, end).trim();
      if (chunk.length > 0) chunks.push(chunk);

      start = end - overlap;
      if (start >= text.length) break;
    }

    return chunks;
  }
}
