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
import Home from '@/app/page';
import Login from '@/app/login/page';
import Recommend from '@/app/recommend/page';
import CategoryPicker from '@/components/CategoryPicker';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/dynamic', () => ({
  default: () => {
    const Stub = () => null;
    Stub.displayName = 'DynamicStub';
    return Stub;
  },
}));
// Next's compiler supplies these static classes in production; Vite does not
// transform next/font calls. The production build verifies the real font loader.
vi.mock('next/font/google', () => ({
  Noto_Sans_SC: () => ({ variable: 'noto-sans-variable' }),
  ZCOOL_XiaoWei: () => ({ variable: 'xiaowei-variable' }),
}));

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
    const slider = container.querySelector('input')!;
    expect(slider.getAttribute('value')).toBe(String(value));
    expect(slider.valueAsNumber).toBe(value);
    expect(slider.step).toBe('0.5');
    expect(error).not.toHaveBeenCalled();
    expect(recoverableError).not.toHaveBeenCalled();
    if (value === 4.5) {
      expect([...container.querySelectorAll<HTMLElement>('.rating-star-fill')].map(fill => fill.style.width))
        .toEqual(['100%', '100%', '100%', '100%', '50%']);
    }
  } finally { await act(async () => root.unmount()); }
});

it.each([
  ['entry form', createElement(EntryForm)],
  ['home page', createElement(Home)],
  ['login page', createElement(Login)],
  ['recommendation page', createElement(Recommend)],
  ['category picker', createElement(CategoryPicker, { value: [], onChange: () => {} })],
])('hydrates the %s before browser data has loaded', async (_name, ui) => {
  // Keep requests pending to exercise the initial server/client render boundary.
  vi.stubGlobal('fetch', () => new Promise(() => {}));
  const container = document.createElement('div');
  container.innerHTML = renderToString(ui);
  const serverMarkup = container.innerHTML;
  const error = vi.spyOn(console, 'error');
  const recoverableError = vi.fn();
  const root = hydrateRoot(container, ui, { onRecoverableError: recoverableError });
  try {
    await act(async () => {});
    expect(container.innerHTML).toBe(serverMarkup);
    if (_name === 'entry form') {
      expect(container.querySelector<HTMLInputElement>('input[type="range"]')?.valueAsNumber).toBe(4);
    }
    expect(error).not.toHaveBeenCalled();
    expect(recoverableError).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); }
});

it('hydrates stable document attributes without manually managed font links', async () => {
  const ui = createElement(RootLayout, null, createElement(RatingStars, { value: 4.5 }));
  document.open();
  document.write('<!doctype html>' + renderToString(ui));
  document.close();
  const serverMarkup = document.documentElement.outerHTML;
  expect(document.head.querySelector('link')).toBeNull();
  expect(document.documentElement.className).toBe('noto-sans-variable xiaowei-variable');
  expect(document.body.attributes.length).toBe(0);
  const error = vi.spyOn(console, 'error');
  const recoverableError = vi.fn();
  const root = hydrateRoot(document, ui, { onRecoverableError: recoverableError });
  try {
    await act(async () => {});
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(document.documentElement.outerHTML).toBe(serverMarkup);
    expect(document.querySelector('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]')).toBeNull();
    expect(error).not.toHaveBeenCalled();
    expect(recoverableError).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); }
});
