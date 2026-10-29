import { redirect } from 'next/navigation';
import { getUserFromCookies } from '@/lib/auth/requestUser';
import EntryForm from '@/components/EntryForm';
export default async function NewEntry() {
  if (!await getUserFromCookies()) redirect('/login');
  return <><div className="narrow page-intro"><h1>记一笔美味</h1><p className="muted">收藏餐饮店，也记下喜欢的物品。</p></div><EntryForm/></>;
}
