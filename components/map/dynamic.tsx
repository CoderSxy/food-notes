'use client';

import dynamic from 'next/dynamic';

const loading = () => <p className="muted map-panel map-panel--loading">地图加载中…</p>;

export const DynamicEntriesMap = dynamic(() => import('@/components/map/EntriesMap'), {
  ssr: false,
  loading,
});

export const DynamicEntryMiniMap = dynamic(() => import('@/components/map/EntryMiniMap'), {
  ssr: false,
  loading,
});

export const DynamicLocationPickerMap = dynamic(
  () => import('@/components/map/LocationPickerMap'),
  { ssr: false, loading },
);
