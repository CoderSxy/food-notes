'use client';
export default function StarRating({value,onChange}:{value:number;onChange:(value:number)=>void}) {
 return <fieldset><legend>评分 · {value} 分</legend><div className="stars" role="group" aria-label="五分评分">{[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={`${n} 分`} aria-pressed={value===n} onClick={()=>onChange(n)}>{n<=value?'★':'☆'}</button>)}</div></fieldset>;
}
