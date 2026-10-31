"use client";
import { use, useEffect, useState } from "react";
import { safeNext } from "@/lib/auth/redirect";
import { useRouter } from "next/navigation";
import Link from "next/link";
import RatingStars from "@/components/RatingStars";
import { DynamicEntryMiniMap } from "@/components/map/dynamic";
import type { Entry } from "@/lib/entries";
import { requestJson } from "@/lib/browser";
import { hasCoords } from "@/lib/geo/map";
import EntryPhotos from "@/components/EntryPhotos";
export default function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params),
    router = useRouter();
  const [source, setSource] = useState("/entries?scope=mine");
  const [entry, setEntry] = useState<Entry | null>(null),
    [userId, setUserId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSource(safeNext(params.get("from") || "/entries?scope=mine"));
    let active = true;
    setEntry(null);
    setError(
      params.get("photoError") === "1"
        ? "记录已保存，部分照片上传失败，可在本页重试"
        : "",
    );
    Promise.all([
      requestJson<{ entry: Entry }>(`/api/entries/${encodeURIComponent(id)}`),
      requestJson<{ user: { userId: string } }>("/api/auth/me"),
      requestJson<{ configured: boolean }>("/api/photos/status").catch(() => ({
        configured: false,
      })),
    ])
      .then(([e, u, storage]) => {
        if (active) {
          setEntry(e.entry);
          setUserId(u.user.userId);
          setStorageReady(storage.configured);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function remove() {
    if (!window.confirm("确定删除这条记录吗？")) return;
    setBusy(true);
    try {
      await requestJson(`/api/entries/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      router.push(source);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="narrow">
      <p>
        <Link href={source}>
          {source.startsWith("/entries") ? "返回记录" : "返回总览"}
        </Link>
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {entry ? (
        <article className="panel detail-card">
          <span className="pill">
            {entry.kind === "place" ? "餐饮" : "物品"}
          </span>
          <h1 className="headline">{entry.name}</h1>
          <p className="rating">
            <RatingStars value={entry.rating} /> · {entry.rating} 分
          </p>
          <p>{entry.address_text || "未填写详细地址"}</p>
          <p className="muted">
            {hasCoords(entry)
              ? `纬度 ${entry.lat} / 经度 ${entry.lng}`
              : "未记录地点"}
          </p>
          {hasCoords(entry) && (
            <DynamicEntryMiniMap
              lat={entry.lat}
              lng={entry.lng}
              name={entry.name}
            />
          )}
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
          <EntryPhotos
            entryId={entry.id}
            photos={entry.photos ?? []}
            isOwner={entry.user_id === userId}
            storageReady={storageReady}
            onChange={(photos) =>
              setEntry({
                ...entry,
                photos,
                cover_photo_url:
                  photos.find((photo) => photo.sort === 0)?.public_url ??
                  photos[0]?.public_url ??
                  null,
              })
            }
          />
          <p className="note">{entry.note || "暂时没有备注"}</p>
          {/* Use the UTC calendar date so rendering never depends on the host timezone or locale. */}
          <p className="muted">
            记录于{" "}
            <time dateTime={entry.created_at}>
              {new Date(entry.created_at).toISOString().slice(0, 10)}
            </time>
          </p>
          <p>
            <Link href="/entries/new">继续记录</Link>
          </p>
          {entry.user_id === userId && (
            <button
              className="danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? "正在删除…" : "删除我的记录"}
            </button>
          )}
        </article>
      ) : (
        !error && <p>正在加载记录…</p>
      )}
    </section>
  );
}
