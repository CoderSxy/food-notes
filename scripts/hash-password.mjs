import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
const scryptAsync = promisify(scrypt);
const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Usage: node scripts/hash-password.mjs <password-min-8-chars>');
  process.exit(1);
}
const N = 16384,
  r = 8,
  p = 1,
  KEYLEN = 64;
const salt = randomBytes(16);
const hash = await scryptAsync(password, salt, KEYLEN, { N, r, p });
console.log(`scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${hash.toString('base64url')}`);
