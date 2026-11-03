import { z } from 'zod';
export { nearbySchema } from './food';

export const entryKindSchema = z.enum(['place', 'item']);
const ids = z.array(z.uuid()).max(20).transform(v => [...new Set(v)]);
const common = {
  name: z.string().trim().min(1).max(100),
  note: z.string().trim().max(2000).optional(),
  rating: z.number().min(1).max(5).multipleOf(0.5),
  address_text: z.string().trim().max(300).optional(),
  tagNames: z.array(z.string().trim().min(1).max(30).transform(v => v.replace(/\s+/g, ' ').toLowerCase()))
    .max(20).transform(v => [...new Set(v)]),
};
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const itemPriceSchema = z
  .union([z.number(), z.string(), z.null()])
  .transform((value, ctx) => {
    if (value === null || value === "") return undefined;
    const raw = typeof value === "number" ? String(value) : value.trim();
    if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(raw)) {
      ctx.addIssue({ code: "custom", message: "invalid price" });
      return z.NEVER;
    }
    return Number(raw);
  })
  .optional();
export const placeCreateSchema = z.object({
  ...common, kind: z.literal('place'), lat, lng, cuisineIds: ids,
});
const itemCreateSchema = z.object({
  ...common, kind: z.literal('item'), lat: lat.optional(), lng: lng.optional(),
  categoryIds: z.array(z.uuid()).min(1).max(20).transform(v => [...new Set(v)]),
  price: itemPriceSchema,
});
export const entryCreateSchema = z.discriminatedUnion('kind', [placeCreateSchema, itemCreateSchema]);
export type EntryCreate = z.infer<typeof entryCreateSchema>;
export type EntryUpdate = EntryCreate;
