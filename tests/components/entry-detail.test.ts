// @vitest-environment jsdom
import { createElement, Suspense } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import Detail from '@/app/entries/[id]/page';
import type { Entry } from '@/lib/entries';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/map/dynamic', () => ({
  DynamicEntryMiniMap: ({ name }: { name: string }) =>
    createElement('div', { 'data-testid': 'entry-mini-map' }, name),
}));

const entry: Entry = {
  id: 'entry', user_id: 'user', name: '面馆', note: null, rating: 4.5,
  lat: 31, lng: 121, address_text: null, created_at: '2026-10-30T00:30:00Z',
  kind: 'place', cuisines: [], categories: [], tags: [],
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it.each([
  ['2026-10-30T00:30:00Z', '2026-10-30'],
  ['2026-10-30T00:30:00+08:00', '2026-10-29'],
  ['2026-10-30T23:30:00-08:00', '2026-10-31'],
])('shows the UTC calendar date for %s after loading', async (created_at, expected) => {
  vi.stubGlobal('fetch', async (url: string) => Response.json(
    url === '/api/auth/me' ? { user: { userId: 'user' } } : { entry: { ...entry, created_at } },
  ));
  const params = Promise.resolve({ id: 'entry' });
  await act(async () => {
    render(createElement(Suspense, { fallback: '加载中' }, createElement(Detail, { params })));
  });
  const date = await screen.findByText(expected);
  expect(date.tagName).toBe('TIME');
  expect(date.getAttribute('datetime')).toBe(created_at);
  expect(date.parentElement?.textContent).toBe(`记录于 ${expected}`);
});

it('shows a mini-map when the entry has coordinates', async () => {
  vi.stubGlobal('fetch', async (url: string) => Response.json(
    url === '/api/auth/me' ? { user: { userId: 'user' } } : { entry },
  ));
  const params = Promise.resolve({ id: 'entry' });
  await act(async () => {
    render(createElement(Suspense, { fallback: '加载中' }, createElement(Detail, { params })));
  });
  expect(await screen.findByTestId('entry-mini-map')).toBeTruthy();
});

it('omits the mini-map when the entry has no coordinates', async () => {
  vi.stubGlobal('fetch', async (url: string) => Response.json(
    url === '/api/auth/me'
      ? { user: { userId: 'user' } }
      : { entry: { ...entry, lat: null, lng: null } },
  ));
  const params = Promise.resolve({ id: 'entry' });
  await act(async () => {
    render(createElement(Suspense, { fallback: '加载中' }, createElement(Detail, { params })));
  });
  await screen.findByText('未记录地点');
  expect(screen.queryByTestId('entry-mini-map')).toBeNull();
});
