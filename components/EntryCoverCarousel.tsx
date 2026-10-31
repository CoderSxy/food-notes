"use client";
import { useRef, useState } from "react";
import type { EntryPhotoThumb } from "@/lib/photo-constants";

export default function EntryCoverCarousel({
  photos,
}: {
  photos: EntryPhotoThumb[];
}) {
  const sorted = [...photos].sort((a, b) => a.sort - b.sort);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  if (!sorted.length) return null;

  function onScroll() {
    const el = track.current;
    if (!el?.clientWidth) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function go(next: number) {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="entry-cover" role="region" aria-label="照片">
      <div className="entry-cover-track" ref={track} onScroll={onScroll}>
        {sorted.map((photo, i) => (
          <div className="entry-cover-slide" key={photo.id}>
            <img src={photo.public_url} alt={i === 0 ? "封面照片" : ""} />
          </div>
        ))}
      </div>
      {sorted.length > 1 && (
        <div className="entry-cover-dots">
          {sorted.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              className="entry-cover-dot"
              aria-label={`第 ${i + 1} 张`}
              aria-current={i === index}
              onClick={() => go(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
