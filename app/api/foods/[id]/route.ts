import { z } from 'zod';
import { requireUser } from '@/lib/auth/requestUser';
import { getFood } from '@/lib/foods';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError,HttpError } from '@/lib/http';
type Context={params:Promise<{id:string}>};
export async function GET(_req:Request,ctx:Context){try{await requireUser();const id=z.uuid().parse((await ctx.params).id);const food=await getFood(id);if(!food)throw new HttpError('美食记录不存在',404);return Response.json({food});}catch(e){return apiError(e);}}
export async function DELETE(_req:Request,ctx:Context){try{const user=await requireUser();const id=z.uuid().parse((await ctx.params).id);const food=await getFood(id);if(!food)throw new HttpError('美食记录不存在',404);if(food.user_id!==user.userId)throw new HttpError('只能删除自己的记录',403);const {error}=await createAdminClient().from('entries').delete().eq('id',id).eq('kind','place').eq('user_id',user.userId);if(error)throw error;return Response.json({ok:true});}catch(e){return apiError(e);}}
