import { describe, it, expect } from 'vitest';
import { hydrateEntry } from '@/lib/entries';
describe('hydrateEntry', () => {
  it('maps item categories and tags while preserving absent coordinates', () => {
    const e = hydrateEntry({
      id: '1', user_id: 'u', kind: 'item', name: 'x', note: null, rating: 5,
      lat: null, lng: null, address_text: null, created_at: '',
      entry_cuisines: [],
      entry_categories: [{ categories: { id: 'c', name: '啤酒', parent_id: 'p', parent: { name: '酒水' } } }],
      entry_tags: [{ tags: { id: 't', name: '清爽' } }],
    });
    expect(e.categories).toEqual([{ id: 'c', name: '啤酒', parent_id: 'p', parent: { name: '酒水' } }]);
    expect(e.tags).toEqual([{ id: 't', name: '清爽' }]);
    expect(e.lat).toBeNull();
    expect(e.cuisines).toEqual([]);
    expect(e).not.toHaveProperty('entry_categories');
  });
});
