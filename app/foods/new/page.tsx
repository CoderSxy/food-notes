import { redirect } from 'next/navigation';
import { getUserFromCookies } from '@/lib/auth/requestUser';
import FoodForm from '@/components/FoodForm';
export default async function NewFood(){if(!await getUserFromCookies())redirect('/login');return <><div className="narrow"><h1>记一笔美食</h1><p className="muted">把值得再来的味道，留在地图上。</p></div><FoodForm/></>;}
