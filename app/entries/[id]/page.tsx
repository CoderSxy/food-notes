'use client';
import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Entry } from '@/lib/entries';
import { requestJson } from '@/lib/browser';
export default function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params), router = useRouter();
  const [entry, setEntry] = useState<Entry | null>(null), [userId, setUserId] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setEntry(null); setError('');
    Promise.all([requestJson<{ entry: Entry }>(`/api/entries/${encodeURIComponent(id)}`), requestJson<{ user: { userId: string } }>('/api/auth/me')])
      .then(([e, u]) => { if (active) { setEntry(e.entry); setUserId(u.user.userId); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id]);
  async function remove() {
    if (!window.confirm('确定删除这条记录吗？')) return;
    setBusy(true);
    try { await requestJson(`/api/entries/${encodeURIComponent(id)}`, { method: 'DELETE' }); router.push('/'); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="narrow"><p><Link href="/">← 返回美食地图</Link></p>{error && <p className="error" role="alert">{error}</p>}
    {entry ? <article className="panel"><span className="pill">{entry.kind === 'place' ? '餐饮' : '物品'}</span><h1>{entry.name}</h1>
      <p style={{ color: '#aa7622' }}>{'★'.repeat(entry.rating)} · {entry.rating} 分</p><p>{entry.address_text || '未填写详细地址'}</p>
      <p className="muted">{entry.lat !== null && entry.lng !== null ? `纬度 ${entry.lat} / 经度 ${entry.lng}` : '未记录地点'}</p>
      <div>{entry.kind === 'place' ? entry.cuisines.map(c => <span className="pill" key={c.id}>{c.name}</span>) : entry.categories.map(c => <span className="pill" key={c.id}>{c.parent ? `${c.parent.name} / ` : ''}{c.name}</span>)}
        {entry.tags.map(t => <span className="pill" key={t.id}>#{t.name}</span>)}</div>
      <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{entry.note || '暂时没有备注'}</p>
      <p className="muted">记录于 {new Date(entry.created_at).toLocaleDateString('zh-CN')}</p>
      {entry.user_id === userId && <button disabled={busy} onClick={() => void remove()}>{busy ? '正在删除…' : '删除我的记录'}</button>}
    </article> : !error && <p>正在加载记录…</p>}
  </section>;
}
