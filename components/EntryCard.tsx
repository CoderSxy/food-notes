import Link from "next/link";
import EntryCoverCarousel from "@/components/EntryCoverCarousel";
import RatingStars from "@/components/RatingStars";
import type { Entry } from "@/lib/entries";
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
}: {
  entry: Entry;
  source?: string;
}) {
  const location =
    entry.address_text ||
    (entry.lat !== null && entry.lng !== null
      ? `${entry.lat.toFixed(4)}, ${entry.lng.toFixed(4)}`
      : "未记录地点");
  return (
    <article className="panel entry-card">
      <EntryCoverCarousel photos={slidesForEntry(entry)} />
      <div className="row between">
        <h2>
          <Link
            href={`/entries/${entry.id}${source ? `?from=${encodeURIComponent(source)}` : ""}`}
          >
            {entry.name}
          </Link>
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
      </div>
      {entry.note && (
        <p className="note">
          {entry.note.slice(0, 160)}
          {entry.note.length > 160 ? "…" : ""}
        </p>
      )}
    </article>
  );
}
