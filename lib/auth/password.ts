import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 64;

function scryptDerive(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptDerive(password, salt, KEYLEN, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N0 = Number(parts[1]);
  const r0 = Number(parts[2]);
  const p0 = Number(parts[3]);
  if (!Number.isFinite(N0) || !Number.isFinite(r0) || !Number.isFinite(p0)) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], 'base64url');
    expected = Buffer.from(parts[5], 'base64url');
  } catch {
    return false;
  }
  const actual = await scryptDerive(password, salt, expected.length, { N: N0, r: r0, p: p0 });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
