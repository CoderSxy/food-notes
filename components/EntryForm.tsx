'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestJson, jsonBody } from '@/lib/browser';
import type { DictionaryItem, Entry } from '@/lib/entries';
import CuisinePicker from './CuisinePicker';
import CategoryPicker from './CategoryPicker';
import TagPicker from './TagPicker';
import StarRating from './StarRating';
import LocationField from './LocationField';
export default function EntryForm() {
  const router = useRouter();
  const [kind, setKind] = useState<'place' | 'item'>('place');
  const [name, setName] = useState(''), [note, setNote] = useState(''), [address, setAddress] = useState('');
  const [rating, setRating] = useState(4), [location, setLocation] = useState({ lat: '', lng: '' });
  const [cuisineIds, setCuisineIds] = useState<string[]>([]), [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]), [cuisines, setCuisines] = useState<DictionaryItem[]>([]), [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(false);
  async function load() {
    try {
      const [c, t] = await Promise.all([requestJson<{ cuisines: DictionaryItem[] }>('/api/cuisines'), requestJson<{ tags: DictionaryItem[] }>('/api/tags')]);
      setCuisines(c.cuisines); setSuggestions(t.tags.map(t => t.name)); setReady(true); setError('');
    } catch (e) { setError((e as Error).message); }
  }
  useEffect(() => { void load(); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (kind === 'item' && !categoryIds.length) throw new Error('请至少选择一个物品小类');
      const coords = {
        ...(location.lat.trim() ? { lat: Number(location.lat) } : {}),
        ...(location.lng.trim() ? { lng: Number(location.lng) } : {}),
      };
      const { entry } = await requestJson<{ entry: Entry }>('/api/entries', jsonBody({
        kind, name, note, rating, ...coords, address_text: address, tagNames: tags,
        ...(kind === 'place' ? { cuisineIds } : { categoryIds }),
      }));
      router.push(`/entries/${entry.id}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <form className="panel narrow" onSubmit={submit}>
    <fieldset><legend>记录类型</legend>{([{ value: 'place', label: '餐饮店' }, { value: 'item', label: '物品' }] as const).map(option =>
      <label className="choice" key={option.value}><input type="radio" name="kind" value={option.value} checked={kind === option.value} onChange={() => setKind(option.value)}/>{option.label}</label>)}</fieldset>
    <label htmlFor="name">{kind === 'place' ? '店名或菜名' : '物品名称'}</label><input id="name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder={kind === 'place' ? '例如：巷口的小笼包' : '例如：喜欢的啤酒或零食'}/>
    <StarRating value={rating} onChange={setRating}/>
    {kind === 'place' ? <CuisinePicker items={cuisines} value={cuisineIds} onChange={setCuisineIds}/> : <CategoryPicker value={categoryIds} onChange={setCategoryIds}/>}
    <LocationField value={location} onChange={setLocation} required={kind === 'place'}/>
    <label htmlFor="address">地址（选填）</label><input id="address" maxLength={300} value={address} onChange={e => setAddress(e.target.value)}/>
    <TagPicker value={tags} onChange={setTags} suggestions={suggestions}/>
    <label htmlFor="note">备注（选填）</label><textarea id="note" maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="记下口味、感受和推荐理由……"/>
    <p className="error" role="alert">{error}</p>{!ready && <p><button type="button" onClick={() => void load()}>重新加载菜系和标签</button></p>}
    <button disabled={busy || !ready}>{busy ? '正在保存…' : '保存这份美味'}</button>
  </form>;
}
