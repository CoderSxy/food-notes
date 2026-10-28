import { cookies } from 'next/headers';
import { SESSION_COOKIE,verifySessionToken } from './session';
export async function getUserFromCookies() {
 const token=(await cookies()).get(SESSION_COOKIE)?.value;
 return token ? verifySessionToken(token) : null;
}
