import { ZodError } from 'zod';
export class HttpError extends Error { constructor(message:string,public status=400){super(message);} }
export function apiError(error:unknown) {
 if(error instanceof HttpError) return Response.json({error:error.message},{status:error.status});
 if(error instanceof ZodError || error instanceof SyntaxError) return Response.json({error:'输入格式不正确，请检查填写内容'},{status:400});
 const message=error instanceof Error ? error.message : '';
 const known=['验证码错误，请重新输入','验证码已过期，请重新发送','验证码已使用或过期，请重新发送','请稍后再发送验证码','短信通道尚未启用，请启用测试模式','用户名或密码错误'];
 if(known.includes(message)) return Response.json({error:message},{status:400});
 return Response.json({error:'服务暂时不可用，请稍后重试或联系管理员'},{status:500});
}
