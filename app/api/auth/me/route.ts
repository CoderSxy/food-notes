import { getUserFromCookies } from '@/lib/auth/requestUser';
export async function GET(){const user=await getUserFromCookies();return user ? Response.json({user}) : Response.json({error:'请先登录'},{status:401});}
