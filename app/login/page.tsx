'use client';
import { useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestJson,jsonBody } from '@/lib/browser';
export default function Login(){
 const router=useRouter(),[phone,setPhone]=useState(''),[code,setCode]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[signedIn,setSignedIn]=useState(false);
 useEffect(()=>{fetch('/api/auth/me').then(r=>{if(r.ok)setSignedIn(true);}).catch(()=>{});},[]);
 async function action(send:boolean){setBusy(true);setMessage('');try{await requestJson(`/api/auth/${send?'send-otp':'verify-otp'}`,jsonBody({phone,code}));if(send)setMessage('验证码已发送，请查看服务端日志');else{router.push('/');router.refresh();}}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel narrow"><h1>登录美食地图</h1><p className="muted">测试模式：验证码见服务端日志。验证码十分钟内有效。</p>{signedIn?<><p>你已登录，可以继续记录美食。</p><button onClick={async()=>{await requestJson('/api/auth/logout',jsonBody({}));setSignedIn(false);setMessage('已退出登录');}}>退出登录</button></>:<form onSubmit={e=>{e.preventDefault();void action(false);}}><label htmlFor="phone">手机号</label><input id="phone" type="tel" autoComplete="tel" required value={phone} onChange={e=>setPhone(e.target.value)}/><p><button type="button" disabled={busy||!phone} onClick={()=>void action(true)}>发送验证码</button></p><label htmlFor="code">验证码</label><input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/><p><button disabled={busy}>登录 / 注册</button></p></form>}<p role="status">{message}</p></section>;
}
