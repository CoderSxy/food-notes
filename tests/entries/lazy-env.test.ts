import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => vi.unstubAllEnvs());
it('loads entry and category helpers without environment configuration and validates only on use', async () => {
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET']) vi.stubEnv(key, '');
  const entries = await import('@/lib/entries');
  const categories = await import('@/lib/categories');
  expect(entries.hydrateEntry).toBeTypeOf('function');
  await expect(categories.listRootCategories()).rejects.toThrow('服务配置不完整');
});
