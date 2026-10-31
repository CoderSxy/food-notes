import { describe, expect, it } from 'vitest';
import type { Entry } from '@/lib/entries';
import {
  DEFAULT_CENTER,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  filterByOwnerScope,
  filterMappableEntries,
  hasCoords,
} from '@/lib/geo/map';

function entry(partial: Partial<Entry> & Pick<Entry, 'id' | 'user_id'>): Entry {
  return {
    kind: 'place',
    name: '测试',
    note: null,
    rating: 4,
    lat: null,
    lng: null,
    address_text: null,
    created_at: '2026-01-01T00:00:00.000Z',
    cuisines: [],
    categories: [],
    tags: [],
    ...partial,
  };
}

describe('hasCoords', () => {
  it('true only when both lat and lng are numbers', () => {
    expect(hasCoords({ lat: 31.2, lng: 121.5 })).toBe(true);
    expect(hasCoords({ lat: 0, lng: 0 })).toBe(true);
    expect(hasCoords({ lat: null, lng: 121.5 })).toBe(false);
    expect(hasCoords({ lat: 31.2, lng: null })).toBe(false);
    expect(hasCoords({ lat: null, lng: null })).toBe(false);
  });
});

describe('filterMappableEntries', () => {
  it('keeps place and item entries that have both coordinates', () => {
    const rows = [
      entry({ id: '1', user_id: 'u1', kind: 'place', lat: 31, lng: 121, name: '店A' }),
      entry({ id: '2', user_id: 'u1', kind: 'item', lat: null, lng: null, name: '无坐标物品' }),
      entry({ id: '3', user_id: 'u2', kind: 'item', lat: 30, lng: 120, name: '有坐标物品' }),
      entry({ id: '4', user_id: 'u2', kind: 'place', lat: 29, lng: null, name: '半缺' }),
    ];
    expect(filterMappableEntries(rows).map((e) => e.id)).toEqual(['1', '3']);
  });
});

describe('filterByOwnerScope', () => {
  const rows = [
    entry({ id: '1', user_id: 'me', lat: 1, lng: 1 }),
    entry({ id: '2', user_id: 'other', lat: 2, lng: 2 }),
  ];
  it('mine keeps only current user', () => {
    expect(filterByOwnerScope(rows, 'mine', 'me').map((e) => e.id)).toEqual(['1']);
  });
  it('all keeps every entry', () => {
    expect(filterByOwnerScope(rows, 'all', 'me').map((e) => e.id)).toEqual(['1', '2']);
  });
});

describe('OSM constants', () => {
  it('exports standard OSM tile URL, attribution, and China default center', () => {
    expect(OSM_TILE_URL).toBe('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(OSM_ATTRIBUTION).toContain('OpenStreetMap');
    expect(DEFAULT_CENTER.lat).toBeCloseTo(35.8617, 3);
    expect(DEFAULT_CENTER.lng).toBeCloseTo(104.1954, 3);
  });
});
