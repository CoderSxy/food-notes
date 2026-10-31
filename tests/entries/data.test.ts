import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ queries: [] as { table: string; ops: [string, ...unknown[]][] }[], results: [] as unknown[] }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from(table: string) {
  const query = { table, ops: [] as [string, ...unknown[]][] }; db.queries.push(query);
  const result = db.results.shift() ?? { data: [], error: null };
  const builder: Record<string, unknown> = { then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve) };
  for (const op of ['select', 'eq', 'not', 'in', 'is', 'order', 'limit', 'insert', 'upsert', 'delete', 'single', 'maybeSingle']) {
    builder[op] = (...args: unknown[]) => { query.ops.push([op, ...args]); return builder; };
  }
  return builder;
} }) }));
import { createEntry, entrySelect, nearbyPlaceEntries } from '@/lib/entries';
import { assertLeafCategoryIds } from '@/lib/categories';
const id = '11111111-1111-4111-8111-111111111111';
const item = { kind: 'item' as const, name: 'IPA', rating: 5, categoryIds: [id], tagNames: [] };
const raw = { id: 'e', user_id: 'u', kind: 'place', name: '面馆', rating: 4, note: null, address_text: null, created_at: '', lat: 31, lng: 121, entry_cuisines: [], entry_categories: [], entry_tags: [] };
beforeEach(() => { db.queries = []; db.results = []; });
describe('entry data boundaries', () => {
  it('embeds category parents by parent_id because PostgREST has no named self-FK', () => {
    expect(entrySelect).toContain('parent:parent_id(name)');
    expect(entrySelect).not.toContain('categories_parent_id_fkey');
  });
  it.each([{ rows: [{ id, parent_id: null }] }, { rows: [] }])('rejects root or unknown category before creating an entry', async ({ rows }) => {
    db.results.push({ data: rows, error: null });
    await expect(createEntry('u', item)).rejects.toMatchObject({ status: 400 });
    expect(db.queries.map(q => q.table)).toEqual(['categories']);
  });
  it('requires every selected category to exist and be a leaf', async () => {
    db.results.push({ data: [{ id, parent_id: 'root' }], error: null });
    await expect(assertLeafCategoryIds([id, 'missing'])).rejects.toMatchObject({ status: 400 });
  });
  it('creates an item without coordinates and writes its leaf association', async () => {
    db.results.push({ data: [{ id, parent_id: 'root' }], error: null }, { data: { id: 'e' }, error: null }, { error: null }, { data: { ...raw, kind: 'item', lat: null, lng: null, entry_categories: [{ categories: { id, name: '啤酒', parent_id: 'root' } }] }, error: null });
    const entry = await createEntry('u', item);
    expect(entry?.kind).toBe('item');
    expect(entry?.lat).toBeNull();
    expect(db.queries[1].ops).toContainEqual(['insert', { kind: 'item', name: 'IPA', rating: 5, user_id: 'u' }]);
    expect(db.queries[2]).toEqual({ table: 'entry_categories', ops: [['insert', [{ entry_id: 'e', category_id: id }]]] });
  });
  it('removes the entry when association creation fails', async () => {
    db.results.push({ data: [{ id, parent_id: 'root' }], error: null }, { data: { id: 'e' }, error: null }, { error: new Error('join failed') }, { error: null });
    await expect(createEntry('u', item)).rejects.toThrow('join failed');
    expect(db.queries.at(-1)).toEqual({ table: 'entries', ops: [['delete'], ['eq', 'id', 'e'], ['eq', 'user_id', 'u']] });
  });
  it('nearby excludes items, missing coordinates and out-of-range places', async () => {
    db.results.push({ data: [raw, { ...raw, id: 'item', kind: 'item' }, { ...raw, id: 'null', lat: null }, { ...raw, id: 'far', lat: 40 }], error: null });
    expect((await nearbyPlaceEntries({ lat: 31, lng: 121 }, 5)).map(e => e.id)).toEqual(['e']);
    expect(db.queries[0].ops).toContainEqual(['eq', 'kind', 'place']);
    expect(db.queries[0].ops).toContainEqual(['not', 'lat', 'is', null]);
    expect(db.queries[0].ops).toContainEqual(['not', 'lng', 'is', null]);
  });
});
