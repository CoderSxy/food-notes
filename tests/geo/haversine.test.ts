import { describe, it, expect } from 'vitest';
import { haversineKm } from '@/lib/geo/haversine';
describe('haversineKm', () => {
 it('same point', () => expect(haversineKm({lat:31.23,lng:121.47},{lat:31.23,lng:121.47})).toBeLessThan(.001));
 it('latitude distance', () => expect(haversineKm({lat:0,lng:0},{lat:.01,lng:0})).toBeCloseTo(1.112,2));
 it('crosses date line', () => expect(haversineKm({lat:0,lng:179.99},{lat:0,lng:-179.99})).toBeCloseTo(2.224,2));
});
