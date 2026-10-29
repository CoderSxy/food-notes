import { describe, it, expect } from 'vitest';
import { loginBodySchema } from '@/lib/validations/auth';

describe('loginBodySchema', () => {
  it('accepts and lowercases username', () => {
    expect(loginBodySchema.parse({ username: 'Nero_01', password: 'password1' })).toEqual({
      username: 'nero_01',
      password: 'password1',
    });
  });
  it('rejects short username', () => {
    expect(loginBodySchema.safeParse({ username: 'ab', password: 'password1' }).success).toBe(false);
  });
  it('rejects empty password', () => {
    expect(loginBodySchema.safeParse({ username: 'abc', password: '' }).success).toBe(false);
  });
});
