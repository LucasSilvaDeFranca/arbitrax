import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

interface CacheEntry {
  data: any;
  expiresAt: number;
}

/**
 * Cache em memoria simples para endpoints GET frequentes.
 * TTL padrao: 30 segundos.
 * Chave: userId + URL (cada usuario tem seu cache).
 */
@Injectable()
export class MemoryCacheInterceptor implements NestInterceptor {
  private cache = new Map<string, CacheEntry>();
  private readonly ttl: number;

  constructor(ttlSeconds = 30) {
    this.ttl = ttlSeconds * 1000;

    // Limpar cache expirado a cada 60s
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache) {
        if (entry.expiresAt < now) this.cache.delete(key);
      }
    }, 60000);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    // So cachear GET
    if (req.method !== 'GET') {
      return next.handle();
    }

    const userId = req.user?.sub || 'anon';
    const key = `${userId}:${req.originalUrl}`;

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.data);
    }

    return next.handle().pipe(
      tap((data) => {
        this.cache.set(key, {
          data,
          expiresAt: Date.now() + this.ttl,
        });
      }),
    );
  }
}
