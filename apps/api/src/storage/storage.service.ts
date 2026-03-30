import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

@Injectable()
export class StorageService implements OnModuleInit {
  private s3: S3Client;
  private bucket: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get('S3_BUCKET', 'arbitrax-documents');

    this.s3 = new S3Client({
      endpoint: this.config.get('S3_ENDPOINT', 'http://localhost:9000'),
      region: this.config.get('S3_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.config.get('S3_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: this.config.get('S3_SECRET_KEY', 'minioadmin123'),
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch {
        // Bucket may already exist or S3 not available in dev
      }
    }
  }

  async upload(
    file: Buffer,
    key: string,
    contentType: string,
  ): Promise<{ url: string; hash: string }> {
    const hash = crypto.createHash('sha256').update(file).digest('hex');

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      }),
    );

    const url = `/${this.bucket}/${key}`;
    return { url, hash };
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  generateKey(arbitragemId: string, folder: string, filename: string): string {
    const timestamp = Date.now();
    const ext = filename.split('.').pop() || 'bin';
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
