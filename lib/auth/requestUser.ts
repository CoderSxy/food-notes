import { cookies } from 'next/headers';
import { SESSION_COOKIE,verifySessionToken } from './session';
export async function getUserFromCookies() {
 const token=(await cookies()).get(SESSION_COOKIE)?.value;
 return token ? verifySessionToken(token) : null;
}

export async function requireUser() {
 const user=await getUserFromCookies();
 if(!user) { const {HttpError}=await import('@/lib/http');throw new HttpError('请先登录',401); }
 return user;
}
