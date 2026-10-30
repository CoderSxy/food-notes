// @vitest-environment jsdom
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import EntryForm from '@/components/EntryForm';
import RatingStars from '@/components/RatingStars';
import StarRating from '@/components/StarRating';
import RootLayout from '@/app/layout';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5])('hydrates a %s rating with stable half-star fills', async value => {
  const ui = createElement(StarRating, { value, onChange: () => {} });
  const container = document.createElement('div');
  container.innerHTML = renderToString(ui);
  const serverMarkup = container.innerHTML;
  const error = vi.spyOn(console, 'error');
  const recoverableError = vi.fn();
  const root = hydrateRoot(container, ui, { onRecoverableError: recoverableError });
  try {
    await act(async () => {});
    expect(container.innerHTML).toBe(serverMarkup);
    expect(error).not.toHaveBeenCalled();
    expect(recoverableError).not.toHaveBeenCalled();
    if (value === 4.5) {
      expect([...container.querySelectorAll<HTMLElement>('.rating-star-fill')].map(fill => fill.style.width))
        .toEqual(['100%', '100%', '100%', '100%', '50%']);
    }
  } finally { await act(async () => root.unmount()); }
});

it('hydrates the entry form before browser data has loaded', async () => {
  // Keep requests pending to exercise the initial server/client render boundary.
  vi.stubGlobal('fetch', () => new Promise(() => {}));
  const ui = createElement(EntryForm);
  const container = document.createElement('div');
  container.innerHTML = renderToString(ui);
  const serverMarkup = container.innerHTML;
  const error = vi.spyOn(console, 'error');
  const recoverableError = vi.fn();
  const root = hydrateRoot(container, ui, { onRecoverableError: recoverableError });
  try {
    await act(async () => {});
    expect(container.innerHTML).toBe(serverMarkup);
    expect(error).not.toHaveBeenCalled();
    expect(recoverableError).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); }
});

it('hydrates the document layout, font links, and static rating markup', async () => {
  const ui = createElement(RootLayout, null, createElement(RatingStars, { value: 4.5 }));
  document.open();
  document.write('<!doctype html>' + renderToString(ui));
  document.close();
  const error = vi.spyOn(console, 'error');
  const recoverableError = vi.fn();
  const root = hydrateRoot(document, ui, { onRecoverableError: recoverableError });
  try {
    await act(async () => {});
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(document.querySelector('link[crossorigin="anonymous"]')).toBeTruthy();
    expect(error).not.toHaveBeenCalled();
    expect(recoverableError).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); }
});
