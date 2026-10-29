import Link from 'next/link';
import FoodCard from './FoodCard';
import type { Recommendation } from '@/lib/ai/client';
export default function RecommendResult({recommendations,message}:{recommendations:Recommendation[];message?:string}){
 if(!recommendations.length)return <section className="panel empty"><h2>再收集一些好味道吧</h2><p>{message||'附近暂无足够样本，先去登记几家美食吧'}</p><Link className="button" href="/foods/new">去记一笔</Link></section>;
 return <div className="grid">{recommendations.map(r=><section key={r.foodId}><FoodCard food={r.food}/><p className="reason"><strong>推荐理由：</strong>{r.reason}</p></section>)}</div>;
}
