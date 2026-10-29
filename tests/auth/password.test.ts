import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, normalizeUsername } from '@/lib/auth/password';

describe('password', () => {
  it('hashes and verifies', async () => {
    const stored = await hashPassword('correct-horse');
    expect(stored.startsWith('scrypt$')).toBe(true);
    await expect(verifyPassword('correct-horse', stored)).resolves.toBe(true);
    await expect(verifyPassword('wrong', stored)).resolves.toBe(false);
  });

  it('rejects malformed stored hashes', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
  });

  it('normalizes username', () => {
    expect(normalizeUsername('  Nero_01 ')).toBe('nero_01');
  });
});
