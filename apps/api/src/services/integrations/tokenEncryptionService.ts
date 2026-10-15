import crypto from 'crypto';
import { env } from '../../config/env.js';

export interface EnvelopeEncryptedData {
  encryptedData: string; // Hex-encoded ciphertext
  encryptedDek: string;  // Hex-encoded DEK encrypted with Master Key
  iv: string;            // Hex-encoded 12-byte initialization vector
  authTag: string;       // Hex-encoded 16-byte GCM authentication tag
}

export class TokenEncryptionService {
  private static getMasterKey(): Buffer {
    // Spec §16 Envelope Encryption: Master Key (KEK) is 256 bits (32 bytes)
    const rawKey = (env as any).ENCRYPTION_MASTER_KEY || (env as any).JWT_ACCESS_SECRET || 'careergraph_default_master_kek_secret_key_32bytes!';
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts plaintext data using Envelope Encryption (AES-256-GCM).
   * 1. Generates a fresh random 256-bit Data Encryption Key (DEK).
   * 2. Encrypts plaintext using DEK with AES-256-GCM (authenticated encryption).
   * 3. Encrypts the DEK using the Master Key (KEK) with AES-256-GCM.
   */
  static encrypt(plaintext: string): EnvelopeEncryptedData {
    const masterKey = this.getMasterKey();

    // 1. Generate fresh DEK and IV
    const dek = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);

    // 2. Encrypt plaintext with DEK
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // 3. Encrypt DEK with Master KEK
    const dekIv = crypto.randomBytes(12);
    const dekCipher = crypto.createCipheriv('aes-256-gcm', masterKey, dekIv);
    let encryptedDek = dekCipher.update(dek.toString('hex'), 'utf8', 'hex');
    encryptedDek += dekCipher.final('hex');
    const dekAuthTag = dekCipher.getAuthTag();

    // Pack encrypted DEK bundle: dekIv (24 hex) + dekAuthTag (32 hex) + encryptedDek
    const packedEncryptedDek = `${dekIv.toString('hex')}:${dekAuthTag.toString('hex')}:${encryptedDek}`;

    return {
      encryptedData: encrypted,
      encryptedDek: packedEncryptedDek,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypts envelope-encrypted data using the Master Key (KEK).
   * Verifies GCM authentication tags at both levels to detect tampering.
   */
  static decrypt(payload: EnvelopeEncryptedData): string {
    const masterKey = this.getMasterKey();

    // 1. Unpack and decrypt DEK
    const [dekIvHex, dekAuthTagHex, encryptedDekHex] = payload.encryptedDek.split(':');
    if (!dekIvHex || !dekAuthTagHex || !encryptedDekHex) {
      throw new Error('Invalid envelope encryption payload: malformed encrypted DEK');
    }

    const dekDecipher = crypto.createDecipheriv(
      'aes-256-gcm',
      masterKey,
      Buffer.from(dekIvHex, 'hex')
    );
    dekDecipher.setAuthTag(Buffer.from(dekAuthTagHex, 'hex'));
    let dekHex = dekDecipher.update(encryptedDekHex, 'hex', 'utf8');
    dekHex += dekDecipher.final('utf8');

    const dek = Buffer.from(dekHex, 'hex');

    // 2. Decrypt data using DEK
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      dek,
      Buffer.from(payload.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
    let decrypted = decipher.update(payload.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
