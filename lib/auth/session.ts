import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'food_session';

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('会话密钥未配置');
  return new TextEncoder().encode(s);
}

export async function createSessionToken(userId: string, phone?: string | null) {
  const jwt = new SignJWT(phone ? { phone } : {})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer('food-notes')
    .setAudience('food-notes')
    .setExpirationTime('30d');
  return jwt.sign(secretKey());
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ['HS256'],
      issuer: 'food-notes',
      audience: 'food-notes',
    });
    if (!payload.sub) return null;
    const phone = typeof payload.phone === 'string' ? payload.phone : null;
    return { userId: payload.sub, phone };
  } catch {
    return null;
  }
}
