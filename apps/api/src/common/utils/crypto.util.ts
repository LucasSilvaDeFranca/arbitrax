import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:v1:';

/**
 * Criptografa texto com AES-256-GCM.
 * Formato: enc:v1:{iv_hex}:{encrypted_base64}:{authTag_hex}
 */
export function encryptAes256Gcm(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY deve ter 32 bytes (64 caracteres hex)');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('hex')}:${encrypted.toString('base64')}:${authTag.toString('hex')}`;
}

/**
 * Decripta texto criptografado com AES-256-GCM.
 */
export function decryptAes256Gcm(ciphertext: string, keyHex: string): string {
  if (!isEncrypted(ciphertext)) {
    throw new Error('Valor nao esta no formato criptografado esperado (enc:v1:...)');
  }

  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY deve ter 32 bytes (64 caracteres hex)');
  }

  const withoutPrefix = ciphertext.slice(PREFIX.length);
  const parts = withoutPrefix.split(':');
  if (parts.length !== 3) {
    throw new Error('Formato de ciphertext invalido');
  }

  const [ivHex, encryptedBase64, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedBase64, 'base64');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Verifica se o valor está no formato criptografado.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}
