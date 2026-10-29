import { getUserFromCookies } from '@/lib/auth/requestUser';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError } from '@/lib/http';

export async function GET() {
  try {
    const session = await getUserFromCookies();
    if (!session) return Response.json({ error: '请先登录' }, { status: 401 });
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('users')
      .select('id, username, nickname, phone')
      .eq('id', session.userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: '请先登录' }, { status: 401 });
    return Response.json({
      user: {
        userId: data.id,
        username: data.username ?? null,
        nickname: data.nickname ?? null,
        phone: data.phone ?? null,
        hasPhone: Boolean(data.phone),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
