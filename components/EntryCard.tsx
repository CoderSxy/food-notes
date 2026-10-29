import Link from 'next/link';
import type { Entry } from '@/lib/entries';
export default function EntryCard({ entry }: { entry: Entry }) {
  const location = entry.address_text || (entry.lat !== null && entry.lng !== null ? `${entry.lat.toFixed(4)}, ${entry.lng.toFixed(4)}` : '未记录地点');
  return <article className="panel"><div className="row" style={{ justifyContent: 'space-between' }}><h2><Link href={`/entries/${entry.id}`}>{entry.name}</Link></h2>
    <span aria-label={`评分 ${entry.rating} 分`} style={{ color: '#aa7622' }}>{'★'.repeat(entry.rating)} <small>{entry.rating} 分</small></span></div>
    <span className="pill">{entry.kind === 'place' ? '餐饮' : '物品'}</span>
    <p className="muted">{location}{entry.distanceKm !== undefined && ` · ${entry.distanceKm.toFixed(2)} 公里`}</p>
    <div>{entry.kind === 'place' ? entry.cuisines.map(c => <span className="pill" key={c.id}>{c.name}</span>) : entry.categories.map(c => <span className="pill" key={c.id}>{c.parent ? `${c.parent.name} / ` : ''}{c.name}</span>)}
      {entry.tags.map(t => <span className="pill" key={t.id}>#{t.name}</span>)}</div>
    {entry.note && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{entry.note.slice(0, 160)}{entry.note.length > 160 ? '…' : ''}</p>}
  </article>;
}
