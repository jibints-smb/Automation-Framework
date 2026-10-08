import { createHmac } from 'node:crypto';

/**
 * Authenticator-app code (TOTP, RFC 6238) for apps with two-factor login: the QA account's secret (the text
 * behind its QR code) lives in the app .env, never in code.
 *
 * @example await act.fill(LoginFields.code, totp(requireEnv('ADMIN_TOTP_SECRET')));
 */
export function totp(secret: string, options: { digits?: number; period?: number; at?: number } = {}): string {
  const { digits = 6, period = 30, at = Date.now() } = options;
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / period)));
  const hmac = createHmac('sha1', base32(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(code).padStart(digits, '0');
}

/** Base32 (RFC 4648), the format authenticator secrets are shown in; spaces and padding are ignored. */
function base32(text: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = text.replace(/[\s=-]/g, '').toUpperCase();
  let bits = '';
  for (const c of clean) {
    const value = alphabet.indexOf(c);
    if (value < 0) throw new Error('TOTP secret is not valid base32 (A-Z, 2-7)');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}
