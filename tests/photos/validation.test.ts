import { describe, expect, it } from 'vitest';
import { photoConfirmSchema, photoPresignSchema } from '@/lib/validations/photo';

const entryId = '11111111-1111-4111-8111-111111111111';
const photoId = '22222222-2222-4222-8222-222222222222';

describe('photoPresignSchema', () => {
  it('accepts valid body', () => {
    const v = photoPresignSchema.parse({
      entryId,
      contentType: 'image/webp',
      bytes: 900_000,
      width: 1600,
      height: 1200,
    });
    expect(v.bytes).toBe(900_000);
  });
  it('rejects oversized bytes', () => {
    expect(() =>
      photoPresignSchema.parse({
        entryId,
        contentType: 'image/jpeg',
        bytes: 2_000_000,
      }),
    ).toThrow();
  });
  it('rejects disallowed content type', () => {
    expect(() =>
      photoPresignSchema.parse({
        entryId,
        contentType: 'image/gif',
        bytes: 100,
      }),
    ).toThrow();
  });
});

describe('photoConfirmSchema', () => {
  it('accepts a complete confirm body', () => {
    const v = photoConfirmSchema.parse({
      entryId,
      photoId,
      r2Key: 'entries/u/e/p.webp',
      publicUrl: 'https://cdn.example/entries/u/e/p.webp',
      sort: 0,
      contentType: 'image/webp',
      bytes: 800_000,
    });
    expect(v.sort).toBe(0);
  });
  it('allows confirm without a client publicUrl', () => {
    const v = photoConfirmSchema.parse({
      entryId,
      photoId,
      r2Key: 'entries/u/e/p.webp',
      sort: 1,
      contentType: 'image/webp',
      bytes: 100,
    });
    expect(v.publicUrl).toBeUndefined();
  });
  it('rejects sort outside 0-2', () => {
    expect(() =>
      photoConfirmSchema.parse({
        entryId,
        photoId,
        r2Key: 'entries/u/e/p.webp',
        publicUrl: 'https://cdn.example/p.webp',
        sort: 3,
        contentType: 'image/webp',
      }),
    ).toThrow();
  });
});
