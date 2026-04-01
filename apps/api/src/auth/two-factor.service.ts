import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { generateSecret, generateURI, verifySync } from 'otplib';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  async generateTotpSecret(email: string): Promise<{
    secret: string;
    otpauthUrl: string;
    qrCodeDataUrl: string;
  }> {
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      secret,
      label: email,
      issuer: 'ArbitraX',
    } as any);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    this.logger.log(`2FA secret generated for ${email}`);
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  verifyToken(secret: string, token: string): boolean {
    try {
      const result = verifySync({ token, secret });
      return result.valid === true;
    } catch (err) {
      this.logger.error('Error verifying 2FA token', err);
      return false;
    }
  }
}
