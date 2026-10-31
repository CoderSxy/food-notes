import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

// Only expose the message/code in local diagnostics, never details or hints.
function redactSecrets(message: string) {
  let safe = message;
  for (const [name, value] of Object.entries(process.env)) {
    if (value && /KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL/i.test(name)) {
      safe = safe.split(value).join('[已隐藏]');
    }
  }
  return safe
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[已隐藏]')
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/g, '[已隐藏]');
}

export function apiError(error: unknown) {
  console.error('[apiError]', error);
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: '输入格式不正确，请检查填写内容' }, { status: 400 });
  const object = typeof error === 'object' && error !== null ? error : null;
  const message = object && 'message' in object && typeof object.message === 'string' ? object.message : '';
  const known = ['验证码错误，请重新输入', '验证码已过期，请重新发送', '验证码已使用或过期，请重新发送', '请稍后再发送验证码', '短信通道尚未启用，请启用测试模式', '用户名或密码错误'];
  if (known.includes(message)) return Response.json({ error: message }, { status: 400 });
  const isDatabaseError = object && message && ('code' in object || 'details' in object || 'hint' in object);
  if (process.env.NODE_ENV !== 'production' && isDatabaseError) {
    const code = 'code' in object && typeof object.code === 'string' ? object.code : '未知代码';
    return Response.json({ error: `数据库请求失败（${redactSecrets(`${code}: ${message}`)}），请运行 npm run check:setup 检查本地配置` }, { status: 500 });
  }
  return Response.json({ error: '服务暂时不可用，请稍后重试或联系管理员' }, { status: 500 });
}
