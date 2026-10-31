'use client';

export default function MapErrorFallback({
  message = '地图加载失败',
}: {
  message?: string;
}) {
  return (
    <div className="map-panel map-panel--error panel" role="status">
      <p className="muted">{message}</p>
      <p className="muted">列表、表单与手填经纬度仍可使用。</p>
    </div>
  );
}
