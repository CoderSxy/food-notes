import { describe,it,expect } from 'vitest';
import { foodCreateSchema,nearbySchema } from '@/lib/validations/food';
const valid={name:'小笼包',rating:5,lat:31.2,lng:121.5,cuisineIds:['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'],tagNames:[' 夜宵 ','夜宵','聚餐']};
describe('food schema',()=>{
 it('accepts multiple cuisines and normalizes tags',()=>{const v=foodCreateSchema.parse(valid);expect(v.cuisineIds).toHaveLength(2);expect(v.tagNames).toEqual(['夜宵','聚餐']);});
 it.each([1,1.5,2,2.5,3,3.5,4,4.5,5])('accepts whole and half-star rating %s',rating=>expect(foodCreateSchema.parse({...valid,rating}).rating).toBe(rating));
 it.each([0,0.5,5.5,6,1.25,4.75,NaN,Infinity,-Infinity])('rejects invalid rating %s',rating=>expect(foodCreateSchema.safeParse({...valid,rating}).success).toBe(false));
 it('rejects invalid coordinates',()=>expect(foodCreateSchema.safeParse({...valid,lat:91}).success).toBe(false));
 it('requires actual location',()=>expect(nearbySchema.safeParse({lat:null,lng:''}).success).toBe(false));
});
