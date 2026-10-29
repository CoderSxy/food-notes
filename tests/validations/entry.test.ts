import { describe, it, expect } from 'vitest';
import { entryCreateSchema, entryKindSchema } from '@/lib/validations/entry';
const id = '11111111-1111-4111-8111-111111111111';
const item = { kind: 'item', name: 'IPA', rating: 5, categoryIds: [id], tagNames: [] };
const place = { kind: 'place', name: '面馆', rating: 4, lat: 31, lng: 121, cuisineIds: [], tagNames: [] };
describe('entryCreateSchema', () => {
  it('requires coords for place', () => {
    expect(entryCreateSchema.safeParse({ ...place, lat: undefined, lng: undefined }).success).toBe(false);
  });
  it('allows item without coords when categoryIds present', () => {
    expect(entryCreateSchema.safeParse(item).success).toBe(true);
  });
  it('rejects item with empty categoryIds', () => {
    expect(entryCreateSchema.safeParse({ ...item, categoryIds: [] }).success).toBe(false);
  });
  it('accepts a place with cuisines and normalizes shared tags', () => {
    expect(entryCreateSchema.parse({ ...place, cuisineIds: [id, id], tagNames: [' 清爽 ', '清爽', 'A   B'] })).toMatchObject({ cuisineIds: [id], tagNames: ['清爽', 'a b'] });
  });
  it('strips cross-kind associations', () => {
    expect(entryCreateSchema.parse({ ...item, cuisineIds: [id] })).not.toHaveProperty('cuisineIds');
    expect(entryCreateSchema.parse({ ...place, categoryIds: [id] })).not.toHaveProperty('categoryIds');
  });
  it.each([0, 6, 2.5])('rejects invalid rating %s', rating => {
    expect(entryCreateSchema.safeParse({ ...item, rating }).success).toBe(false);
  });
  it('rejects invalid kinds, UUIDs and coordinates', () => {
    expect(entryKindSchema.safeParse('food').success).toBe(false);
    expect(entryCreateSchema.safeParse({ ...item, categoryIds: ['invalid'] }).success).toBe(false);
    expect(entryCreateSchema.safeParse({ ...item, lat: 91 }).success).toBe(false);
    expect(entryCreateSchema.safeParse({ ...place, lng: -181 }).success).toBe(false);
  });
});
