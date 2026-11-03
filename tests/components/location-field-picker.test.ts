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

  it("reverse-geocodes after a map pin settle and after locate, but not when typing lat", async () => {
    const onChange = vi.fn();
    const onAddressResolved = vi.fn();
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toMatch(/\/api\/geocode\/reverse\?lat=31/);
      return Response.json({ address_text: "南京西路" });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({
            coords: { latitude: 31.2, longitude: 121.5, accuracy: 10 },
          } as GeolocationPosition),
      },
    });
    render(
      createElement(LocationField, {
        value: { lat: "", lng: "" },
        onChange,
        onAddressResolved,
      }),
    );
    fireEvent.click(screen.getByText("模拟点选"));
    await vi.waitFor(() =>
      expect(onAddressResolved).toHaveBeenCalledWith("南京西路"),
    );
    expect(onChange).toHaveBeenCalledWith({ lat: "31.2", lng: "121.5" });
    fetchMock.mockClear();
    onAddressResolved.mockClear();
    fireEvent.change(screen.getByLabelText("纬度（-90 至 90）"), {
      target: { value: "30" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "获取当前位置" }));
    await vi.waitFor(() =>
      expect(onAddressResolved).toHaveBeenCalledWith("南京西路"),
    );
  });

  it("keeps the form usable when reverse geocode fails", async () => {
    const onAddressResolved = vi.fn();
    vi.stubGlobal("fetch", async () =>
      Response.json({ error: "暂时无法解析地址" }, { status: 502 }),
    );
    render(
      createElement(LocationField, {
        value: { lat: "", lng: "" },
        onChange: () => {},
        onAddressResolved,
      }),
    );
    fireEvent.click(screen.getByText("模拟点选"));
    expect(
      await screen.findByText("已定位，未能自动填入地址，可手动填写"),
    ).toBeTruthy();
    expect(onAddressResolved).not.toHaveBeenCalled();
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
