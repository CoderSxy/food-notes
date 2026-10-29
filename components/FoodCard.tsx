import Link from 'next/link';
import type { Food } from '@/lib/foods';
export default function FoodCard({food}:{food:Food}){
 return <article className="panel entry-card"><div className="row between"><h2><Link href={`/foods/${food.id}`}>{food.name}</Link></h2><span className="rating" aria-label={`评分 ${food.rating} 分`}>{'★'.repeat(food.rating)} <small>{food.rating} 分</small></span></div><p className="muted">{food.address_text || `${food.lat.toFixed(4)}, ${food.lng.toFixed(4)}`}{food.distanceKm!==undefined&&` · ${food.distanceKm.toFixed(2)} 公里`}</p><div>{food.cuisines.map(c=><span className="pill" key={c.id}>{c.name}</span>)}{food.tags.map(t=><span className="pill" key={t.id}>#{t.name}</span>)}</div>{food.note&&<p className="note">{food.note.slice(0,160)}{food.note.length>160?'…':''}</p>}</article>;
}
