import { describe, it, expect, afterEach, vi } from 'vitest';
import { createSessionToken, verifySessionToken } from '@/lib/auth/session';

afterEach(() => vi.unstubAllEnvs());

describe('session', () => {
  it('roundtrips with phone', async () => {
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(32));
    const token = await createSessionToken('user-1', '13800138000');
    expect(await verifySessionToken(token)).toEqual({ userId: 'user-1', phone: '13800138000' });
  });

  it('roundtrips without phone', async () => {
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(32));
    const token = await createSessionToken('user-2', null);
    expect(await verifySessionToken(token)).toEqual({ userId: 'user-2', phone: null });
  });

  it('rejects forged token', async () => {
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(32));
    expect(await verifySessionToken('forged')).toBeNull();
  });

  it('rejects another signing key', async () => {
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(32));
    const token = await createSessionToken('u', '13800138000');
    vi.stubEnv('SESSION_SECRET', 'y'.repeat(32));
    expect(await verifySessionToken(token)).toBeNull();
  });
});
