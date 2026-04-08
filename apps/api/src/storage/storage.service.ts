import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3: any = null;
  private bucket: string;
  private useLocal: boolean;
  private localPath: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get('S3_BUCKET', 'arbitrax-documents');
    this.useLocal = !this.config.get('S3_ENDPOINT');
    this.localPath = path.join(process.cwd(), 'uploads');
  }

  async onModuleInit() {
    if (this.useLocal) {
      this.logger.warn('S3_ENDPOINT nao configurado - usando armazenamento local em /uploads');
      if (!fs.existsSync(this.localPath)) {
        fs.mkdirSync(this.localPath, { recursive: true });
      }
      return;
    }

    // S3/MinIO mode
    try {
      const { S3Client, HeadBucketCommand, CreateBucketCommand } = await import('@aws-sdk/client-s3');
      this.s3 = new S3Client({
        endpoint: this.config.get('S3_ENDPOINT'),
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
    } catch {
      this.logger.warn('Falha ao conectar S3 - fallback para armazenamento local');
      this.useLocal = true;
      if (!fs.existsSync(this.localPath)) {
        fs.mkdirSync(this.localPath, { recursive: true });
      }
    }
  }

  async upload(
    file: Buffer,
    key: string,
    contentType: string,
  ): Promise<{ url: string; hash: string }> {
    const hash = crypto.createHash('sha256').update(file).digest('hex');

    if (this.useLocal) {
      const filePath = path.join(this.localPath, key);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, file);
      return { url: `/uploads/${key}`, hash };
    }

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

  /** Baixa um arquivo (por key ou URL armazenada) e retorna como Buffer */
  async getBuffer(urlOrKey: string): Promise<Buffer> {
    // Normalize: aceita tanto "arquivoUrl" (/bucket/key ou /uploads/key) quanto key pura
    let key = urlOrKey;
    if (key.startsWith(`/${this.bucket}/`)) key = key.slice(this.bucket.length + 2);
    else if (key.startsWith('/uploads/')) key = key.slice('/uploads/'.length);

    if (this.useLocal) {
      const filePath = path.join(this.localPath, key);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo nao encontrado: ${filePath}`);
      }
      return fs.readFileSync(filePath);
    }

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

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    if (this.useLocal) {
      return `/uploads/${key}`;
    }

    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn });
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
