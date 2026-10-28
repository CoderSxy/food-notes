import { requireUser } from '@/lib/auth/requestUser';
import { foodCreateSchema } from '@/lib/validations/food';
import { createAdminClient } from '@/lib/supabase/admin';
import { listFoods,getFood } from '@/lib/foods';
import { apiError } from '@/lib/http';
export async function GET(){try{await requireUser();return Response.json({foods:await listFoods()});}catch(e){return apiError(e);}}
export async function POST(req:Request){
 try {
 const user=await requireUser();const {cuisineIds,tagNames,...fields}=foodCreateSchema.parse(await req.json());const admin=createAdminClient();
 const {data:food,error}=await admin.from('foods').insert({...fields,user_id:user.userId}).select('id').single();if(error)throw error;
 try {
 if(cuisineIds.length){const {error}=await admin.from('food_cuisines').insert(cuisineIds.map(cuisine_id=>({food_id:food.id,cuisine_id})));if(error)throw error;}
 if(tagNames.length){const {data:tags,error}=await admin.from('tags').upsert(tagNames.map(name=>({name})),{onConflict:'name'}).select('id');if(error)throw error;const {error:joinError}=await admin.from('food_tags').insert(tags.map(tag=>({food_id:food.id,tag_id:tag.id})));if(joinError)throw joinError;}
 return Response.json({food:await getFood(food.id)},{status:201});
 }catch(e){const {error:cleanupError}=await admin.from('foods').delete().eq('id',food.id).eq('user_id',user.userId);if(cleanupError)throw cleanupError;throw e;}
 }catch(e){return apiError(e);}
}
