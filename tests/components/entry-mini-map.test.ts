import { describe, expect, it } from 'vitest';
import { hasCoords } from '@/lib/geo/map';

describe('detail mini-map gate', () => {
  it('renders only when both coordinates exist', () => {
    expect(hasCoords({ lat: 31.2, lng: 121.5 })).toBe(true);
    expect(hasCoords({ lat: null, lng: 121.5 })).toBe(false);
  });
});
