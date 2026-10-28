'use client';
import { use,useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Food } from '@/lib/foods';
import { requestJson } from '@/lib/browser';
export default function Detail({params}:{params:Promise<{id:string}>}){
 const {id}=use(params),router=useRouter(),[food,setFood]=useState<Food|null>(null),[userId,setUserId]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{Promise.all([requestJson<{food:Food}>(`/api/foods/${id}`),requestJson<{user:{userId:string}}>('/api/auth/me')]).then(([f,u])=>{setFood(f.food);setUserId(u.user.userId);}).catch(e=>setError(e.message));},[id]);
 async function remove(){if(!window.confirm('确定删除这条美食记录吗？'))return;setBusy(true);try{await requestJson(`/api/foods/${id}`,{method:'DELETE'});router.push('/');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="narrow"><p><Link href="/">← 返回美食地图</Link></p>{error&&<p className="error" role="alert">{error}</p>}{food?<article className="panel"><h1>{food.name}</h1><p style={{color:'#aa7622'}}>{'★'.repeat(food.rating)} · {food.rating} 分</p><p>{food.address_text||'未填写详细地址'}</p><p className="muted">纬度 {food.lat} / 经度 {food.lng}</p><div>{food.cuisines.map(c=><span className="pill" key={c.id}>{c.name}</span>)}{food.tags.map(t=><span className="pill" key={t.id}>#{t.name}</span>)}</div><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{food.note||'暂时没有备注'}</p><p className="muted">记录于 {new Date(food.created_at).toLocaleDateString('zh-CN')}</p>{food.user_id===userId&&<button disabled={busy} onClick={()=>void remove()}>{busy?'正在删除…':'删除我的记录'}</button>}</article>:!error&&<p>正在加载美食记录…</p>}</section>;
}
