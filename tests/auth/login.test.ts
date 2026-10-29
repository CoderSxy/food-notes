import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword } from '@/lib/auth/password';

const from = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from }),
}));

import { loginWithPassword } from '@/lib/auth/login';

describe('loginWithPassword', () => {
  beforeEach(() => {
    from.mockReset();
  });

  it('returns user on correct password', async () => {
    const password_hash = await hashPassword('password1');
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: 'u1', username: 'demo', password_hash, phone: null },
            error: null,
          }),
        }),
      }),
    });
    await expect(loginWithPassword('Demo', 'password1')).resolves.toEqual({
      userId: 'u1',
      username: 'demo',
      phone: null,
    });
  });

  it('throws same error for missing user or bad password', async () => {
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    });
    await expect(loginWithPassword('nope', 'password1')).rejects.toThrow('用户名或密码错误');
  });
});
