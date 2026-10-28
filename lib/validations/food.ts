import { z } from 'zod';
export const foodCreateSchema=z.object({
 name:z.string().trim().min(1).max(100),note:z.string().trim().max(2000).optional(),rating:z.number().int().min(1).max(5),
 lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180),address_text:z.string().trim().max(300).optional(),
 cuisineIds:z.array(z.uuid()).max(20).transform(v=>[...new Set(v)]),
 tagNames:z.array(z.string().trim().min(1).max(30).transform(v=>v.replace(/\s+/g,' ').toLowerCase())).max(20).transform(v=>[...new Set(v)]),
});
const coordinate=z.union([z.number(),z.string().trim().min(1)]).pipe(z.coerce.number());
export const nearbySchema=z.object({lat:coordinate.pipe(z.number().min(-90).max(90)),lng:coordinate.pipe(z.number().min(-180).max(180)),radiusKm:coordinate.pipe(z.number().positive().max(100)).optional().default(5)});
