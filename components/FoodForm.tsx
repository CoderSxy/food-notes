'use client';
import { useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestJson,jsonBody } from '@/lib/browser';
import type { DictionaryItem,Food } from '@/lib/foods';
import CuisinePicker from './CuisinePicker';
import TagPicker from './TagPicker';
import StarRating from './StarRating';
import LocationField from './LocationField';
export default function FoodForm(){
 const router=useRouter(),[name,setName]=useState(''),[note,setNote]=useState(''),[address,setAddress]=useState(''),[rating,setRating]=useState(4),[location,setLocation]=useState({lat:'',lng:''}),[cuisineIds,setCuisineIds]=useState<string[]>([]),[tags,setTags]=useState<string[]>([]),[cuisines,setCuisines]=useState<DictionaryItem[]>([]),[suggestions,setSuggestions]=useState<string[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false);
 async function load(){try{const [c,t]=await Promise.all([requestJson<{cuisines:DictionaryItem[]}>('/api/cuisines'),requestJson<{tags:DictionaryItem[]}>('/api/tags')]);setCuisines(c.cuisines);setSuggestions(t.tags.map(t=>t.name));setReady(true);setError('');}catch(e){setError((e as Error).message);}}
 useEffect(()=>{void load();},[]);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const {food}=await requestJson<{food:Food}>('/api/foods',jsonBody({name,note,rating,lat:Number(location.lat),lng:Number(location.lng),address_text:address,cuisineIds,tagNames:tags}));router.push(`/foods/${food.id}`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <form className="panel narrow" onSubmit={submit}><label htmlFor="name">店名或菜名</label><input id="name" required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="例如：巷口的小笼包"/><StarRating value={rating} onChange={setRating}/><LocationField value={location} onChange={setLocation}/><label htmlFor="address">地址（选填）</label><input id="address" maxLength={300} value={address} onChange={e=>setAddress(e.target.value)}/><CuisinePicker items={cuisines} value={cuisineIds} onChange={setCuisineIds}/><TagPicker value={tags} onChange={setTags} suggestions={suggestions}/><label htmlFor="note">备注（选填）</label><textarea id="note" maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="推荐菜、口味、人均消费……"/><p className="error" role="alert">{error}</p>{!ready&&<p><button type="button" onClick={()=>void load()}>重新加载菜系和标签</button></p>}<button disabled={busy||!ready}>{busy?'正在保存…':'保存这份美味'}</button></form>;
}
