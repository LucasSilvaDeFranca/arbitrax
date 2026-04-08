import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

type StorageMode = 'supabase' | 's3' | 'local';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private mode: StorageMode = 'local';
  private s3: any = null;
  private supabase: any = null;
  private bucket: string;
  private localPath: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get('S3_BUCKET', 'arbitrax-documents');
    this.localPath = path.join(process.cwd(), 'uploads');
  }

  async onModuleInit() {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const supabaseKey = this.config.get<string>('SUPABASE_SERVICE_KEY');
    const s3Endpoint = this.config.get<string>('S3_ENDPOINT');

    // Prioridade 1: Supabase Storage (recomendado - persistente + integrado)
    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        // Garante bucket (idempotente)
        const { data: buckets } = await this.supabase.storage.listBuckets();
        const exists = buckets?.some((b: any) => b.name === this.bucket);
        if (!exists) {
          const { error } = await this.supabase.storage.createBucket(this.bucket, {
            public: false,
            fileSizeLimit: 52428800, // 50MB
          });
          if (error && !error.message?.includes('already exists')) {
            throw error;
          }
          this.logger.log(`Bucket Supabase '${this.bucket}' criado`);
        }
        this.mode = 'supabase';
        this.logger.log(`Storage: Supabase Storage (bucket: ${this.bucket})`);
        return;
      } catch (err: any) {
        this.logger.warn(`Supabase Storage falhou: ${err.message} - tentando proximo provider`);
        this.supabase = null;
      }
    }

    // Prioridade 2: S3/MinIO (se configurado)
    if (s3Endpoint) {
      try {
        const { S3Client, HeadBucketCommand, CreateBucketCommand } = await import('@aws-sdk/client-s3');
        this.s3 = new S3Client({
          endpoint: s3Endpoint,
          region: this.config.get('S3_REGION', 'us-east-1'),
          credentials: {
            accessKeyId: this.config.get('S3_ACCESS_KEY', 'minioadmin'),
            secretAccessKey: this.config.get('S3_SECRET_KEY', 'minioadmin123'),
          },
          forcePathStyle: true,
        });

        try {
          await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
        } catch {
          await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket })).catch(() => {});
        }
        this.mode = 's3';
        this.logger.log(`Storage: S3/MinIO (${s3Endpoint})`);
        return;
      } catch (err: any) {
        this.logger.warn(`S3/MinIO falhou: ${err.message} - fallback para local`);
        this.s3 = null;
      }
    }

    // Prioridade 3: Filesystem local (fallback - efemero em containers!)
    this.mode = 'local';
    this.logger.warn('Storage: filesystem LOCAL em /uploads - ATENCAO: efemero em containers, arquivos perdidos no rebuild!');
    if (!fs.existsSync(this.localPath)) {
      fs.mkdirSync(this.localPath, { recursive: true });
    }
  }

  async upload(
    file: Buffer,
    key: string,
    contentType: string,
  ): Promise<{ url: string; hash: string }> {
    const hash = crypto.createHash('sha256').update(file).digest('hex');

    if (this.mode === 'supabase') {
      // Remove o objeto existente primeiro para invalidar o cache do CDN do Supabase.
      // Sem isso, mesmo com upsert:true, o CDN serve a versao antiga por ate 1h (TTL default)
      // ate expirar - vimos isso acontecer com compromissos assinados (pdf gravado mas CDN
      // retorna versao stale pre-assinatura). A remocao explicita limpa o cache CDN.
      // Ignoramos erro se o objeto nao existir (primeira upload).
      await this.supabase.storage.from(this.bucket).remove([key]).catch(() => {});

      // cacheControl: '0' garante que objetos re-uploadados nao sao cacheados
      // (documentos legais/assinados devem sempre ser servidos frescos)
      const { error } = await this.supabase.storage
        .from(this.bucket)
        .upload(key, file, { contentType, upsert: true, cacheControl: '0' });
      if (error) throw new Error(`Supabase upload falhou: ${error.message}`);
      return { url: `supabase://${key}`, hash };
    }

    if (this.mode === 's3') {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file,
          ContentType: contentType,
        }),
      );
      return { url: `/${this.bucket}/${key}`, hash };
    }

    // local
    const filePath = path.join(this.localPath, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, file);
    return { url: `/uploads/${key}`, hash };
  }

  /** Baixa um arquivo (por URL/key) e retorna como Buffer */
  async getBuffer(urlOrKey: string): Promise<Buffer> {
    const key = this.extractKey(urlOrKey);

    // Routing baseado no prefixo da URL + mode atual
    if (urlOrKey.startsWith('supabase://') || this.mode === 'supabase') {
      if (!this.supabase) throw new Error('Supabase Storage nao inicializado mas URL indica supabase://');

      // Usa signed URL + fetch para bypassar o CDN do Supabase Storage.
      // O .download() do SDK passa pelo CDN edge que tem eventual consistency
      // (downloads logo apos upload podem retornar versao stale por alguns segundos).
      // createSignedUrl gera um token unico a cada call, bypass garantido do cache.
      // Tambem appendamos um query param _cb para ter certeza absoluta.
      const { data: signed, error: signError } = await this.supabase.storage
        .from(this.bucket)
        .createSignedUrl(key, 60);
      if (signError) throw new Error(`Supabase signed URL falhou: ${signError.message}`);

      const bustUrl = `${signed.signedUrl}${signed.signedUrl.includes('?') ? '&' : '?'}_cb=${Date.now()}`;
      const response = await fetch(bustUrl, {
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      if (!response.ok) {
        throw new Error(`Supabase fetch falhou: HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    if (this.mode === 's3') {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const stream = response.Body;
      const chunks: Buffer[] = [];
      for await (const chunk of stream as any) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    // local
    const filePath = path.join(this.localPath, key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo nao encontrado: ${filePath}`);
    }
    return fs.readFileSync(filePath);
  }

  async getSignedDownloadUrl(urlOrKey: string, expiresIn = 3600): Promise<string> {
    const key = this.extractKey(urlOrKey);

    if (urlOrKey.startsWith('supabase://') || this.mode === 'supabase') {
      if (!this.supabase) throw new Error('Supabase Storage nao inicializado');
      const { data, error } = await this.supabase.storage
        .from(this.bucket)
        .createSignedUrl(key, expiresIn);
      if (error) throw new Error(`Supabase signed URL falhou: ${error.message}`);
      return data.signedUrl;
    }

    if (this.mode === 's3') {
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      return getSignedUrl(this.s3, command, { expiresIn });
    }

    // local - retorna path estatico (so funciona se frontend mesma origem ou proxy reverso)
    return `/uploads/${key}`;
  }

  /** Converte URL/URL-ish em key pura (sem prefixos) */
  private extractKey(urlOrKey: string): string {
    let key = urlOrKey;
    if (key.startsWith('supabase://')) return key.slice('supabase://'.length);
    if (key.startsWith(`/${this.bucket}/`)) return key.slice(this.bucket.length + 2);
    if (key.startsWith('/uploads/')) return key.slice('/uploads/'.length);
    return key;
  }

  generateKey(arbitragemId: string, folder: string, filename: string): string {
    const timestamp = Date.now();
    const safe = filename.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 100);
    return `arbitragens/${arbitragemId}/${folder}/${timestamp}-${safe}`;
  }

  static hashBuffer(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  static detectProvaTipo(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'IMAGEM';
    if (mimeType.startsWith('video/')) return 'VIDEO';
    if (mimeType.startsWith('audio/')) return 'AUDIO';
    return 'DOCUMENTO';
  }
}
