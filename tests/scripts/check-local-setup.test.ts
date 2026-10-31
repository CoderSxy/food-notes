import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const exec = promisify(execFile);
const script = path.resolve('scripts/check-local-setup.mjs');
const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.test-signature`;

async function run(envFile: string) {
  const cwd = await mkdtemp(path.join(tmpdir(), 'food-setup-'));
  const env = { ...process.env };
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  delete env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    await writeFile(path.join(cwd, '.env.local'), envFile);
    try {
      const result = await exec(process.execPath, [script], { cwd, env });
      return { code: 0, output: result.stdout + result.stderr };
    } catch (error) {
      const result = error as { code: number; stdout: string; stderr: string };
      return { code: result.code, output: result.stdout + result.stderr };
    }
  } finally { await rm(cwd, { recursive: true, force: true }); }
}

describe('check-local-setup CLI', () => {
  it('fails with actionable configuration instructions without echoing an anon key', async () => {
    const key = jwt('anon');
    const result = await run(`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:1\nSUPABASE_SERVICE_ROLE_KEY="${key}"\n`);
    expect(result.code).toBe(1);
    expect(result.output).toContain('service_role');
    expect(result.output).toContain('anon');
    expect(result.output).not.toContain(key);
  });

  it('fails for missing environment variables', async () => {
    const result = await run('');
    expect(result.code).toBe(1);
    expect(result.output).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(result.output).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it.each(['ready', 'migrations', 'empty', 'denied'])('checks the public schema without writes (%s)', async (mode) => {
    const broken = mode === 'migrations';
    const requests: string[] = [];
    const key = jwt('service_role');
    const server = createServer((req, res) => {
      const url = new URL(req.url!, 'http://localhost');
      requests.push(`${req.method} ${url.pathname} ${url.search}`);
      expect(req.headers.authorization).toBe(`Bearer ${key}`);
      expect(req.headers['accept-profile']).toBe('public');
      const missing003 = broken && url.searchParams.get('select')?.includes('username');
      const missing004 = broken && url.searchParams.get('rating') === 'eq.4.5';
      const missing002 = broken && url.searchParams.get('select') === 'kind';
      res.setHeader('Content-Type', 'application/json');
      if (mode === 'denied' || missing003 || missing004 || missing002) {
        res.statusCode = mode === 'denied' ? 401 : 400;
        res.end(JSON.stringify({ code: missing004 ? '22P02' : '42703', message: 'missing migration' }));
      } else {
        res.setHeader('Content-Range', mode === 'empty' ? '*/0' : '*/2');
        res.end();
      }
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const port = (server.address() as { port: number }).port;
      const result = await run(`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${port}\nSUPABASE_SERVICE_ROLE_KEY=${key}\n`);
      expect(result.code, result.output).toBe(mode === 'ready' ? 0 : 1);
      expect(result.output).not.toContain(key);
      expect(requests.every(request => request.startsWith('HEAD '))).toBe(true);
      for (const column of ['kind', 'rating', 'lat', 'lng']) expect(requests.some(request => request.includes(`select=${column}`)), result.output).toBe(true);
      expect(result.output).toContain('users');
      expect(result.output).toContain('cuisines');
      if (mode === 'empty') {
        expect(result.output).toContain('seed.sql');
        expect(result.output).toContain('seed_users.example.sql');
        expect(result.output).toContain('0 条记录');
      }
      if (mode === 'denied') expect(result.output).toContain('数据库认证或权限失败');
      if (broken) for (const migration of ['002_entries_items.sql', '003_username_password.sql', '004_half_star_ratings.sql']) expect(result.output).toContain(migration);
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });
});
