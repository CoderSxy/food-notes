import { requireUser } from '@/lib/auth/requestUser';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError } from '@/lib/http';
export async function GET(){try{await requireUser();const {data,error}=await createAdminClient().from('cuisines').select('id,name').order('name');if(error)throw error;return Response.json({cuisines:data});}catch(e){return apiError(e);}}
