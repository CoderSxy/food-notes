// @vitest-environment jsdom
import { createElement, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import StarRating from '@/components/StarRating';

afterEach(cleanup);
function RatingForm() {
  const [value, onChange] = useState(4);
  return createElement('form', {}, createElement(StarRating, { value, onChange }));
}

describe('StarRating', () => {
  it('provides a labelled slider bounded to 1–5 in half-star steps', () => {
    render(createElement(RatingForm));
    const slider = screen.getByRole('slider', { name: '评分' });
    expect(slider.getAttribute('min')).toBe('1');
    expect(slider.getAttribute('max')).toBe('5');
    expect(slider.getAttribute('step')).toBe('0.5');
  });
  it.each([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5])('selects and announces %s without rounding', value => {
    render(createElement(RatingForm));
    const slider = screen.getByRole('slider', { name: '评分' });
    fireEvent.change(slider, { target: { value: String(value) } });
    expect(screen.getByText(`评分 · ${value} 分`)).toBeTruthy();
    expect(slider.getAttribute('aria-valuetext')).toBe(`${value} 分`);
  });
});
