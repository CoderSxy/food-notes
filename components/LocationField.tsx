"use client";

import { useRef, useState } from "react";
import { DynamicLocationPickerMap } from "@/components/map/dynamic";
import { requestJson } from "@/lib/browser";

export type LocationValue = { lat: string; lng: string };

export default function LocationField({
  value,
  onChange,
  required = true,
  withPicker = true,
  onAddressResolved,
}: {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  required?: boolean;
  withPicker?: boolean;
  onAddressResolved?: (addressText: string) => void;
}) {
  const [message, setMessage] = useState(
    "可获取当前位置，也可手动输入经纬度。",
  );
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, string>());

  async function lookup(next: LocationValue) {
    if (!onAddressResolved) return;
    const lat = Number(next.lat);
    const lng = Number(next.lng);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return;
    }
    setMessage("正在查找地址…");
    abortRef.current?.abort();
    const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      onAddressResolved(cached);
      setMessage("已填入地址，可再修改");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await requestJson<{ address_text: string | null }>(
        `/api/geocode/reverse?lat=${lat}&lng=${lng}`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (data.address_text) {
        cacheRef.current.set(cacheKey, data.address_text);
        onAddressResolved(data.address_text);
        setMessage("已填入地址，可再修改");
        return;
      }
      setMessage("已定位，未能自动填入地址，可手动填写");
    } catch (error) {
      if (controller.signal.aborted) return;
      const name =
        typeof error === "object" && error && "name" in error
          ? String(error.name)
          : "";
      if (name === "AbortError") return;
      setMessage("已定位，未能自动填入地址，可手动填写");
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setMessage("浏览器不支持定位，请手动输入经纬度");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude),
        };
        onChange(next);
        setBusy(false);
        void lookup(next);
      },
      () => {
        setMessage("无法获取定位，请手动输入大致经纬度");
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <fieldset>
      <legend>地点{required ? "（必填）" : "（选填）"}</legend>
      <button
        type="button"
        className="secondary"
        disabled={busy}
        onClick={locate}
      >
        {busy ? "正在定位…" : "获取当前位置"}
      </button>
      <p className="muted" role="status">
        {message}
      </p>
      {withPicker && (
        <DynamicLocationPickerMap
          value={value}
          onChange={(next) => {
            onChange(next);
            void lookup(next);
          }}
        />
      )}
      <div className="row">
        <div>
          <label htmlFor="lat">纬度（-90 至 90）</label>
          <input
            id="lat"
            type="number"
            step="any"
            min={-90}
            max={90}
            required={required}
            value={value.lat}
            onChange={(e) => onChange({ ...value, lat: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="lng">经度（-180 至 180）</label>
          <input
            id="lng"
            type="number"
            step="any"
            min={-180}
            max={180}
            required={required}
            value={value.lng}
            onChange={(e) => onChange({ ...value, lng: e.target.value })}
          />
        </div>
      </div>
    </fieldset>
  );
}
