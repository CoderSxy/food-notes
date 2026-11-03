"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/context";
import { requestJson } from "@/lib/browser";
import ConfirmDialog from "@/components/ConfirmDialog";
import EntryCoverCarousel from "@/components/EntryCoverCarousel";
import RatingStars from "@/components/RatingStars";
import type { Entry } from "@/lib/entries";
import { formatPrice } from "@/lib/format-price";
import type { EntryPhotoThumb } from "@/lib/photo-constants";

export function slidesForEntry(
  entry: Pick<Entry, "photos" | "cover_photo_url">,
): EntryPhotoThumb[] {
  if (entry.photos?.length)
    return [...entry.photos].sort((a, b) => a.sort - b.sort);
  if (entry.cover_photo_url)
    return [{ id: "cover", public_url: entry.cover_photo_url, sort: 0 }];
  return [];
}

export default function EntryCard({
  entry,
  source,
  onDeleted,
}: {
  entry: Entry;
  source?: string;
  onDeleted?: (id: string) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const from = source ? `?from=${encodeURIComponent(source)}` : "";
  const mine = user?.userId === entry.user_id;
  const location =
    entry.address_text ||
    (entry.lat !== null && entry.lng !== null
      ? `${entry.lat.toFixed(4)}, ${entry.lng.toFixed(4)}`
      : "未记录地点");
  const priceLabel = formatPrice(entry.price);

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/entries/${encodeURIComponent(entry.id)}`, {
        method: "DELETE",
      });
      setConfirming(false);
      onDeleted?.(entry.id);
    } catch (e) {
      setError((e as Error).message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel entry-card">
      <EntryCoverCarousel photos={slidesForEntry(entry)} />
      <div className="row between">
        <h2>
          <Link href={`/entries/${entry.id}${from}`}>{entry.name}</Link>
        </h2>
        <span className="rating" aria-label={`评分 ${entry.rating} 分`}>
          <RatingStars value={entry.rating} /> <small>{entry.rating} 分</small>
        </span>
      </div>
      <span className="pill">{entry.kind === "place" ? "餐饮" : "物品"}</span>
      <p className="muted">
        {location}
        {entry.distanceKm !== undefined &&
          ` · ${entry.distanceKm.toFixed(2)} 公里`}
      </p>
      <div>
        {entry.kind === "place"
          ? entry.cuisines.map((c) => (
              <span className="pill" key={c.id}>
                {c.name}
              </span>
            ))
          : entry.categories.map((c) => (
              <span className="pill" key={c.id}>
                {c.parent ? `${c.parent.name} / ` : ""}
                {c.name}
              </span>
            ))}
        {entry.tags.map((t) => (
          <span className="pill" key={t.id}>
            #{t.name}
          </span>
        ))}
        {priceLabel ? <span className="pill">{priceLabel}</span> : null}
      </div>
      {entry.note && (
        <p className="note">
          {entry.note.slice(0, 160)}
          {entry.note.length > 160 ? "…" : ""}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {mine && (
        <div className="entry-card-toolbar">
          <Link
            className="icon-button"
            href={`/entries/${entry.id}/edit${from}`}
            aria-label="编辑"
            title="编辑"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                d="M4 20h4l10-10-4-4L4 16v4zm12-14 4 4"
              />
            </svg>
          </Link>
          <button
            type="button"
            className="icon-button icon-button-danger"
            disabled={busy}
            aria-label={busy ? "正在删除…" : "删除"}
            title="删除"
            onClick={() => setConfirming(true)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                d="M5 7h14M10 7V5h4v2m-7 0 1 12h8l1-12"
              />
            </svg>
          </button>
          <ConfirmDialog
            open={confirming}
            title="删除记录"
            message="确定删除这条记录吗？删除后无法恢复。"
            confirmLabel="删除"
            busy={busy}
            onDismiss={() => setConfirming(false)}
            onConfirm={() => void remove()}
          />
        </div>
      )}
    </article>
  );
}
