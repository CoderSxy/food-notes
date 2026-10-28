'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import FoodCard from '@/components/FoodCard';
import LocationField from '@/components/LocationField';
import { requestJson } from '@/lib/browser';
import type { Food } from '@/lib/foods';
export default function Home(){
 const [foods,setFoods]=useState<Food[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[signedIn,setSignedIn]=useState(false),[location,setLocation]=useState({lat:'',lng:''});
 async function load(url='/api/foods'){setLoading(true);setError('');try{const data=await requestJson<{foods:Food[]}>(url);setFoods(data.foods);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{fetch('/api/auth/me').then(async r=>{if(r.status===401){setLoading(false);return;}if(!r.ok)throw new Error('无法读取登录状态，请重试');setSignedIn(true);await load();}).catch(e=>{setError(e.message);setLoading(false);});},[]);
 return <><section className="hero"><p className="muted">属于大家的好味道收藏夹</p><h1>美食地图</h1><p>从街角小店到念念不忘的一道菜，记下美味，也发现下一餐。</p><div className="row"><Link className="button" href="/foods/new">＋ 记一笔</Link><Link href="/recommend">探索附近 · AI 推荐 →</Link></div></section>{signedIn?<><section className="panel"><h2>发现美食</h2><form onSubmit={e=>{e.preventDefault();void load(`/api/foods/nearby?lat=${encodeURIComponent(location.lat)}&lng=${encodeURIComponent(location.lng)}`);}}><LocationField value={location} onChange={setLocation}/><div className="row"><button disabled={loading}>查看附近 5 公里</button><button disabled={loading} type="button" onClick={()=>void load()}>查看最新记录</button></div></form></section>{loading?<p role="status">正在寻找好味道…</p>:<><p className="error" role="alert">{error}</p>{error&&<button onClick={()=>void load()}>重新加载</button>}<div className="grid">{foods.map(food=><FoodCard key={food.id} food={food}/>)}</div>{!error&&!foods.length&&<div className="panel"><h2>这里还没有美食记录</h2><p>第一份美味，等你来发现。</p><Link href="/foods/new">去记一笔 →</Link></div>}</>}</>:<section className="panel"><h2>{loading?'正在加载…':'登录后，发现更多美味'}</h2><p>使用手机号验证码登录，查看大家的记录，收藏自己的味觉记忆。</p>{error&&<p className="error">{error}</p>}<Link className="button" href="/login">前往登录</Link></section>}</>;
}
