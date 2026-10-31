import { loadEnvFile } from 'node:process';
import { PostgrestClient } from '@supabase/postgrest-js';

// Node >=20.19 (the application's supported version) parses dotenv quoting.
// Existing shell variables take precedence. Never print keys, URLs or raw errors.
let failures = 0;
function fail(message) { failures++; console.error(`[失败] ${message}`); }
function pass(message) { console.log(`[通过] ${message}`); }

try {
  loadEnvFile('.env.local');
} catch (error) {
  if (error.code !== 'ENOENT') fail('无法读取 .env.local，请检查文件权限与格式。');
  else console.log('[提示] 未找到 .env.local，将检查当前进程环境变量。');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url) fail('缺少 NEXT_PUBLIC_SUPABASE_URL，请按 .env.example 填写 .env.local。');
if (!key) fail('缺少 SUPABASE_SERVICE_ROLE_KEY，请填写同一 Supabase 项目的 service_role JWT 密钥。');
if (url) {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
  } catch { fail('NEXT_PUBLIC_SUPABASE_URL 格式不正确，请复制 Supabase 项目 URL。'); }
}
if (key) {
  try {
    if (key.split('.').length !== 3) throw new Error();
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
    if (payload.role !== 'service_role') {
      fail('SUPABASE_SERVICE_ROLE_KEY 的 JWT role 不是 service_role（可能误用了 anon key），请复制项目的 service_role JWT 密钥。');
    } else {
      pass('JWT role 为 service_role（仅解码；后续数据库请求验证密钥是否可用）。');
    }
  } catch { fail('SUPABASE_SERVICE_ROLE_KEY 不是可解码的 JWT，请复制项目的 legacy service_role JWT 密钥。'); }
}

if (!failures) {
  // Use the database SDK directly: this read-only tool needs neither Auth nor
  // Realtime (the latter requires a WebSocket implementation on Node 20).
  const client = new PostgrestClient(`${url.replace(/\/$/, '')}/rest/v1`, {
    schema: 'public',
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
  });
  const initial = '确认已执行 supabase/migrations/001_initial.sql；';
  const entries = '检查 supabase/migrations/002_entries_items.sql 是否完整执行；';
  const access = '核对 URL 与 service_role 密钥属于同一项目、密钥未失效、网络可达及 public schema 已开放。';

  async function check(label, query, action, requireRows = false) {
    try {
      const { error, count, status } = await query;
      if (error) {
        const denied = status === 401 || status === 403;
        fail(`${label}：${denied ? '数据库认证或权限失败；' : '查询失败；'}${action}${access}`);
      } else if (requireRows && (count === null || count === 0)) {
        fail(`${label}：${count === 0 ? '0 条记录' : '未取得计数'}；${action}`);
      } else {
        pass(`${label}${requireRows ? `：${count} 条记录` : ''}`);
      }
    } catch { fail(`${label}：请求失败或超时；${access}`); }
  }

  const head = { head: true, count: 'exact' };
  await check('public.entries 表存在', client.from('entries').select('id', head), initial + entries);
  await Promise.all([
    ...['kind', 'rating', 'lat', 'lng'].map(column => check(
      `public.entries.${column} 列存在`, client.from('entries').select(column, { head: true }),
      column === 'kind' ? entries : initial + entries,
    )),
    check('public.users 账号数', client.from('users').select('id', head),
      initial + '执行 003_username_password.sql，再按 README 使用 scripts/hash-password.mjs 与 supabase/seed_users.example.sql 预置账号。', true),
    check('public.users 用户名密码列', client.from('users').select('username,password_hash', { head: true }),
      '检查 supabase/migrations/003_username_password.sql 是否完整执行；'),
    check('public.cuisines 菜系数', client.from('cuisines').select('id', head),
      initial + '执行 supabase/seed.sql 初始化菜系。', true),
    // Read-only type probe: integer rating rejects 4.5 even on an empty table.
    // This checks fractional query support, not the full write constraint.
    check('public.entries.rating 支持半星查询', client.from('entries').select('rating', { head: true }).eq('rating', '4.5'),
      entries + '检查 supabase/migrations/004_half_star_ratings.sql 是否完整执行；'),
  ]);
}

if (failures) {
  console.error(`\n检查未通过（${failures} 项）。请按提示修复后重跑 npm run check:setup；迁移按 001 → 002 → 003 → 004 顺序核对，勿盲目重复执行。`);
  process.exitCode = 1;
} else {
  console.log('\n基础检查通过。此检查只读，不写入数据；不验证全部约束、关联表或实际保存流程。物品分类另需执行 supabase/seed_categories.sql。');
}
