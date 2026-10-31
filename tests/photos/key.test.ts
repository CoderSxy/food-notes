import { describe, expect, it } from 'vitest';
import { assertKeyOwned, buildObjectKey, coverUrlFromPhotos } from '@/lib/photos';

describe('buildObjectKey', () => {
  it('uses webp extension for image/webp', () => {
    expect(buildObjectKey('u1', 'e1', 'p1', 'image/webp')).toBe(
      'entries/u1/e1/p1.webp',
    );
  });
  it('uses jpg for image/jpeg', () => {
    expect(buildObjectKey('u1', 'e1', 'p1', 'image/jpeg')).toBe(
      'entries/u1/e1/p1.jpg',
    );
  });
  it('uses png for image/png', () => {
    expect(buildObjectKey('u1', 'e1', 'p1', 'image/png')).toBe(
      'entries/u1/e1/p1.png',
    );
  });
});

describe('assertKeyOwned', () => {
  it('accepts a key that matches the owner prefix and extension', () => {
    expect(() =>
      assertKeyOwned('u1', 'e1', 'p1', 'entries/u1/e1/p1.webp'),
    ).not.toThrow();
  });
  it('rejects a key for another user or entry', () => {
    expect(() =>
      assertKeyOwned('u1', 'e1', 'p1', 'entries/other/e1/p1.webp'),
    ).toThrow();
  });
});

describe('coverUrlFromPhotos', () => {
  it('prefers sort 0 and falls back to the first photo', () => {
    expect(coverUrlFromPhotos([])).toBeNull();
    expect(
      coverUrlFromPhotos([
        {
          id: 'p2',
          entry_id: 'e',
          user_id: 'u',
          r2_key: 'k2',
          public_url: 'https://cdn.example/2.webp',
          sort: 1,
          width: null,
          height: null,
          bytes: null,
          content_type: 'image/webp',
          created_at: '',
        },
        {
          id: 'p0',
          entry_id: 'e',
          user_id: 'u',
          r2_key: 'k0',
          public_url: 'https://cdn.example/0.webp',
          sort: 0,
          width: null,
          height: null,
          bytes: null,
          content_type: 'image/webp',
          created_at: '',
        },
      ]),
    ).toBe('https://cdn.example/0.webp');
  });
});
