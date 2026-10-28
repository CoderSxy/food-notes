'use client';
import { useState } from 'react';
export default function TagPicker({value,onChange,suggestions=[]}:{value:string[];onChange:(tags:string[])=>void;suggestions?:string[]}) {
 const [draft,setDraft]=useState('');
 function add(tag:string){const normalized=tag.trim().replace(/\s+/g,' ').toLowerCase();if(normalized&&!value.includes(normalized)&&value.length<20)onChange([...value,normalized]);setDraft('');}
 return <fieldset><legend>标签（可添加多个）</legend><div>{value.map(tag=><button className="pill" key={tag} type="button" aria-label={`移除标签 ${tag}`} onClick={()=>onChange(value.filter(t=>t!==tag))}>{tag} ×</button>)}</div><label htmlFor="tag">输入标签，按回车或点击添加</label><div className="row"><input id="tag" maxLength={30} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add(draft);}}}/><button type="button" disabled={!draft.trim()||value.length>=20} onClick={()=>add(draft)}>添加标签</button></div>{suggestions.filter(t=>!value.includes(t)).slice(0,12).map(tag=><button className="pill" type="button" key={tag} onClick={()=>add(tag)}>+ {tag}</button>)}</fieldset>;
}
