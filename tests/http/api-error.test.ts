import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { apiError, HttpError } from '@/lib/http';

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

const dbError = { message: "Could not find the 'kind' column of 'entries'", code: 'PGRST204', details: 'private details', hint: 'private hint' };

describe('apiError', () => {
  it('logs the original object and exposes code and message during local development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const response = apiError(dbError);
    expect(response.status).toBe(500);
    const { error } = await response.json();
    expect(error).toContain('数据库');
    expect(error).toContain('PGRST204');
    expect(error).toContain(dbError.message);
    expect(error).not.toContain(dbError.details);
    expect(error).not.toContain(dbError.hint);
    expect(console.error).toHaveBeenCalledWith('[apiError]', dbError);
  });

  it('maps known messages even when PostgREST returns a plain object', async () => {
    const response = apiError({ message: '用户名或密码错误', code: 'P0001' });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '用户名或密码错误' });
  });

  it('keeps unknown database and other errors generic in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    for (const error of [dbError, new Error('private failure'), null, 'private failure']) {
      const response = apiError(error);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: '服务暂时不可用，请稍后重试或联系管理员' });
      expect(console.error).toHaveBeenCalledWith('[apiError]', error);
    }
  });

  it('redacts configured secrets and JWTs from development database diagnostics', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'local-service-secret');
    vi.stubEnv('SESSION_SECRET', 'local-session-secret');
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signature';
    const response = apiError({ code: 'XX000', message: `bad local-service-secret local-session-secret ${token}` });
    const { error } = await response.json();
    expect(error).toContain('XX000');
    expect(error).not.toContain('local-service-secret');
    expect(error).not.toContain('local-session-secret');
    expect(error).not.toContain(token);
  });

  it('preserves and logs HTTP, input validation and known Error responses', async () => {
    for (const [error, status, message] of [
      [new HttpError('请先登录', 401), 401, '请先登录'],
      [new SyntaxError('bad JSON'), 400, '输入格式不正确，请检查填写内容'],
      [new ZodError([]), 400, '输入格式不正确，请检查填写内容'],
      [new Error('验证码错误，请重新输入'), 400, '验证码错误，请重新输入'],
    ] as const) {
      const response = apiError(error);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: message });
      expect(console.error).toHaveBeenCalledWith('[apiError]', error);
    }
  });
});
