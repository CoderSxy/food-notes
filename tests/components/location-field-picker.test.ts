// @vitest-environment jsdom
import { createElement } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import LocationField from '@/components/LocationField';

vi.mock('@/components/map/dynamic', () => ({
  DynamicLocationPickerMap: ({
    value,
    onChange,
  }: {
    value: { lat: string; lng: string };
    onChange: (v: { lat: string; lng: string }) => void;
  }) =>
    createElement(
      'div',
      { 'data-testid': 'location-picker-stub' },
      createElement(
        'button',
        {
          type: 'button',
          onClick: () => onChange({ lat: '31.2', lng: '121.5' }),
        },
        '模拟点选',
      ),
      createElement('span', null, `${value.lat},${value.lng}`),
    ),
}));

describe('LocationField with picker', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      geolocation: undefined,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders picker by default and syncs click into lat/lng inputs', () => {
    const onChange = vi.fn();
    render(
      createElement(LocationField, {
        value: { lat: '', lng: '' },
        onChange,
      }),
    );
    expect(screen.getByTestId('location-picker-stub')).toBeTruthy();
    fireEvent.click(screen.getByText('模拟点选'));
    expect(onChange).toHaveBeenCalledWith({ lat: '31.2', lng: '121.5' });
  });

  it('hides picker when withPicker is false', () => {
    render(
      createElement(LocationField, {
        value: { lat: '', lng: '' },
        onChange: () => {},
        withPicker: false,
      }),
    );
    expect(screen.queryByTestId('location-picker-stub')).toBeNull();
  });
});
