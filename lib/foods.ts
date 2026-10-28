import { createAdminClient } from '@/lib/supabase/admin';
import { haversineKm,type LatLng } from '@/lib/geo/haversine';
export type DictionaryItem={id:string;name:string};
export type Food={id:string;user_id:string;name:string;note:string|null;rating:number;lat:number;lng:number;address_text:string|null;created_at:string;cuisines:DictionaryItem[];tags:DictionaryItem[];distanceKm?:number};
export const foodSelect='*, food_cuisines(cuisines(id,name)), food_tags(tags(id,name))';
type RawFood=Omit<Food,'cuisines'|'tags'> & {food_cuisines:{cuisines:DictionaryItem}[];food_tags:{tags:DictionaryItem}[]};
export function hydrateFood(raw:RawFood):Food {
 const {food_cuisines,food_tags,...food}=raw;
 return {...food,cuisines:food_cuisines.map(v=>v.cuisines),tags:food_tags.map(v=>v.tags)};
}
export async function listFoods(limit=100) {
 const {data,error}=await createAdminClient().from('foods').select(foodSelect).order('created_at',{ascending:false}).limit(limit);
 if(error)throw error;
 return (data as unknown as RawFood[]).map(hydrateFood);
}
export async function getFood(id:string) {
 const {data,error}=await createAdminClient().from('foods').select(foodSelect).eq('id',id).maybeSingle();
 if(error)throw error;
 return data ? hydrateFood(data as unknown as RawFood) : null;
}
export async function nearbyFoods(point:LatLng,radiusKm=5) {
 return (await listFoods(500)).map(food=>({...food,distanceKm:haversineKm(point,food)})).filter(food=>food.distanceKm<=radiusKm).sort((a,b)=>a.distanceKm-b.distanceKm);
}
