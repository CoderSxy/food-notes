// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import EntryCard from '@/components/EntryCard';
import FoodCard from '@/components/FoodCard';
import type { Entry } from '@/lib/entries';
import type { Food } from '@/lib/foods';

afterEach(cleanup);
const food: Food = {
  id: 'entry', user_id: 'user', name: '面馆', note: null, rating: 4.5,
  lat: 31, lng: 121, address_text: null, created_at: '2026-10-30T00:00:00Z',
  cuisines: [], tags: [],
};
const entry: Entry = { ...food, kind: 'place', categories: [] };

describe('rating displays', () => {
  it.each(['entry', 'food'])('renders four full stars and one half star for a 4.5 %s rating', kind => {
    const { container } = render(kind === 'entry'
      ? createElement(EntryCard, { entry }) : createElement(FoodCard, { food }));
    expect(screen.getByLabelText('评分 4.5 分')).toBeTruthy();
    expect(screen.getByText('4.5 分')).toBeTruthy();
    const fills = [...container.querySelectorAll<HTMLElement>('.rating-star-fill')];
    expect(fills.map(fill => fill.style.width)).toEqual(['100%', '100%', '100%', '100%', '50%']);
  });
  it('shows a cover image when the entry has cover_photo_url', () => {
    const { container } = render(createElement(EntryCard, {
      entry: { ...entry, cover_photo_url: 'https://cdn.example/cover.webp' },
    }));
    expect(container.querySelector('.entry-cover img')?.getAttribute('src')).toBe(
      'https://cdn.example/cover.webp',
    );
  });
});
