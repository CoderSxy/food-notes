import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeUsername, verifyPassword } from '@/lib/auth/password';

const FAIL = '用户名或密码错误';

export async function loginWithPassword(usernameRaw: string, password: string) {
  const username = normalizeUsername(usernameRaw);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('users')
    .select('id, username, password_hash, phone')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  if (!data?.password_hash || !data.username) throw new Error(FAIL);
  const ok = await verifyPassword(password, data.password_hash as string);
  if (!ok) throw new Error(FAIL);
  return {
    userId: data.id as string,
    username: data.username as string,
    phone: (data.phone as string | null) ?? null,
  };
}
