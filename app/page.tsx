'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import EntryCard from '@/components/EntryCard';
import LocationField, { type LocationValue } from '@/components/LocationField';
import { requestJson } from '@/lib/browser';
import type { Entry } from '@/lib/entries';
export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]), [kind, setKind] = useState<'' | 'place' | 'item'>('');
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [signedIn, setSignedIn] = useState(false);
  const [location, setLocation] = useState({ lat: '', lng: '' }), [nearbyPoint, setNearbyPoint] = useState<LocationValue | null>(null), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    fetch('/api/auth/me').then(async r => {
      if (!active) return;
      if (r.status === 401) { setLoading(false); return; }
      if (!r.ok) throw new Error('无法读取登录状态，请重试');
      setSignedIn(true);
    }).catch(e => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    setLoading(true); setError('');
    const url = nearbyPoint
      ? `/api/entries/nearby?lat=${encodeURIComponent(nearbyPoint.lat)}&lng=${encodeURIComponent(nearbyPoint.lng)}`
      : `/api/entries${kind ? `?kind=${kind}` : ''}`;
    requestJson<{ entries: Entry[] }>(url).then(data => { if (active) setEntries(data.entries); })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [signedIn, kind, nearbyPoint, retry]);
  return <><section className="hero"><p className="muted">属于大家的好味道收藏夹</p><h1>美食地图</h1><p>从街角小店到随手分享的零食，记下每一份喜欢的味道。</p>
    <div className="row"><Link className="button" href="/entries/new">＋ 记一笔</Link><Link href="/recommend">探索附近 · AI 推荐 →</Link></div></section>
    {signedIn ? <><section className="panel"><h2>发现美味</h2><div className="row" aria-label="记录类型筛选">
      {([{ value: '', label: '全部' }, { value: 'place', label: '餐饮' }, { value: 'item', label: '物品' }] as const).map(tab =>
        <button type="button" key={tab.value} aria-pressed={kind === tab.value} onClick={() => { setKind(tab.value); setNearbyPoint(null); }}>{tab.label}</button>)}
    </div><form onSubmit={e => { e.preventDefault(); setKind('place'); setNearbyPoint({ ...location }); }}>
      <LocationField value={location} onChange={setLocation}/><div className="row"><button disabled={loading}>查看附近餐饮（5 公里）</button>
        <button disabled={loading} type="button" onClick={() => { setNearbyPoint(null); setRetry(n => n + 1); }}>查看最新记录</button></div></form>
      {nearbyPoint && <p className="muted">正在展示附近餐饮，物品不参与附近查询。</p>}</section>
      {loading ? <p role="status">正在寻找好味道…</p> : <><p className="error" role="alert">{error}</p>{error ? <button onClick={() => setRetry(n => n + 1)}>重新加载</button> : <>
        <div className="grid">{entries.map(entry => <EntryCard key={entry.id} entry={entry}/>)}</div>
        {!entries.length && <div className="panel"><h2>这里还没有记录</h2><p>第一份美味，等你来发现。</p><Link href="/entries/new">去记一笔 →</Link></div>}</>}</>}
    </> : <section className="panel"><h2>{loading ? '正在加载…' : '登录后，发现更多美味'}</h2><p>使用手机号验证码登录，查看大家的记录，收藏自己的味觉记忆。</p>{error && <p className="error">{error}</p>}<Link className="button" href="/login">前往登录</Link></section>}
  </>;
}
