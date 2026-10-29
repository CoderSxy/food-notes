'use client';
import { useEffect, useState } from 'react';
import { requestJson } from '@/lib/browser';
import type { Category } from '@/lib/categories';
export default function CategoryPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const [roots, setRoots] = useState<Category[]>([]), [rootId, setRootId] = useState('');
  const [children, setChildren] = useState<Category[]>([]), [known, setKnown] = useState<Record<string, Category>>({});
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const url = rootId ? `/api/categories?parent_id=${encodeURIComponent(rootId)}` : '/api/categories';
    requestJson<{ categories: Category[] }>(url).then(({ categories }) => {
      if (!active) return;
      if (rootId) {
        setChildren(categories.filter(c => c.parent_id !== null));
        setKnown(old => ({ ...old, ...Object.fromEntries(categories.map(c => [c.id, c])) }));
      } else setRoots(categories);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [rootId, retry]);
  return <fieldset><legend>物品分类（至少选择一个小类）</legend>
    <label htmlFor="category-root">大类</label><select id="category-root" value={rootId} onChange={e => { setRootId(e.target.value); setChildren([]); }}>
      <option value="">请选择大类</option>{roots.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
    {loading && <p role="status">正在加载分类…</p>}
    {error && <p className="error" role="alert">{error} <button type="button" className="secondary" onClick={() => setRetry(n => n + 1)}>重新加载分类</button></p>}
    {rootId && !loading && !error && !children.length && <p>此大类暂无小类，请选择其它大类。</p>}
    {children.map(c => <label className="choice" key={c.id}><input type="checkbox" checked={value.includes(c.id)} disabled={!value.includes(c.id) && value.length >= 20}
      onChange={e => onChange(e.target.checked ? [...value, c.id] : value.filter(id => id !== c.id))}/>{c.name}</label>)}
    {!!value.length && <div aria-label="已选小类">{value.map(id => <button type="button" className="pill" key={id} onClick={() => onChange(value.filter(v => v !== id))}>
      {roots.find(r => r.id === known[id]?.parent_id)?.name} / {known[id]?.name || '已选小类'} ×
    </button>)}</div>}
  </fieldset>;
}
