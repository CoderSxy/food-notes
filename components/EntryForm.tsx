"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { safeNext } from "@/lib/auth/redirect";
import { requestJson, jsonBody } from "@/lib/browser";
import { uploadEntryPhoto } from "@/lib/browser-photos";
import type { DictionaryItem, Entry } from "@/lib/entries";
import CuisinePicker from "./CuisinePicker";
import CategoryPicker from "./CategoryPicker";
import TagPicker from "./TagPicker";
import StarRating from "./StarRating";
import LocationField from "./LocationField";
import EntryPhotos from "./EntryPhotos";
import PhotoPicker, {
  revokePickerPreviews,
  type PickerPhoto,
} from "./PhotoPicker";
export default function EntryForm({
  mode = "create",
  entry,
}: {
  mode?: "create" | "edit";
  entry?: Entry;
}) {
  const editing = mode === "edit" && entry;
  const router = useRouter();
  const [kind, setKind] = useState<"place" | "item">(entry?.kind ?? "place");
  const [name, setName] = useState(entry?.name ?? ""),
    [note, setNote] = useState(entry?.note ?? ""),
    [address, setAddress] = useState(entry?.address_text ?? "");
  const [rating, setRating] = useState(entry?.rating ?? 4),
    [location, setLocation] = useState({
      lat: entry?.lat != null ? String(entry.lat) : "",
      lng: entry?.lng != null ? String(entry.lng) : "",
    });
  const [cuisineIds, setCuisineIds] = useState<string[]>(
      entry?.cuisines.map((item) => item.id) ?? [],
    ),
    [categoryIds, setCategoryIds] = useState<string[]>(
      entry?.categories.map((item) => item.id) ?? [],
    );
  const [tags, setTags] = useState<string[]>(
      entry?.tags.map((item) => item.name) ?? [],
    ),
    [cuisines, setCuisines] = useState<DictionaryItem[]>([]),
    [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const [photos, setPhotos] = useState<PickerPhoto[]>([]);
  const [savedPhotos, setSavedPhotos] = useState(entry?.photos ?? []);
  const [storageReady, setStorageReady] = useState(false);
  const from = safeNext(
    typeof window === "undefined"
      ? "/entries?scope=mine"
      : new URLSearchParams(window.location.search).get("from") ||
          "/entries?scope=mine",
  );
  async function load() {
    try {
      const [c, t, storage] = await Promise.all([
        requestJson<{ cuisines: DictionaryItem[] }>("/api/cuisines"),
        requestJson<{ tags: DictionaryItem[] }>("/api/tags"),
        requestJson<{ configured: boolean }>("/api/photos/status").catch(
          () => ({ configured: false }),
        ),
      ]);
      setCuisines(c.cuisines);
      setSuggestions(t.tags.map((t) => t.name));
      setStorageReady(storage.configured);
      setReady(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (kind === "item" && !categoryIds.length)
        throw new Error("请至少选择一个物品小类");
      const coords = {
        ...(location.lat.trim() ? { lat: Number(location.lat) } : {}),
        ...(location.lng.trim() ? { lng: Number(location.lng) } : {}),
      };
      if (editing) {
        await requestJson<{ entry: Entry }>(
          `/api/entries/${encodeURIComponent(entry.id)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind,
              name,
              note,
              rating,
              ...coords,
              address_text: address,
              tagNames: tags,
              ...(kind === "place" ? { cuisineIds } : { categoryIds }),
            }),
          },
        );
        router.push(
          safeNext(
            new URLSearchParams(window.location.search).get("from") ||
              "/entries?scope=mine",
          ),
        );
        return;
      }
      const { entry: created } = await requestJson<{ entry: Entry }>(
        "/api/entries",
        jsonBody({
          kind,
          name,
          note,
          rating,
          ...coords,
          address_text: address,
          tagNames: tags,
          ...(kind === "place" ? { cuisineIds } : { categoryIds }),
        }),
      );
      let photoFailed = false;
      for (const [index, photo] of photos.entries()) {
        if (!photo.file) continue;
        try {
          await uploadEntryPhoto(created.id, photo.file, index);
        } catch {
          photoFailed = true;
        }
      }
      revokePickerPreviews(photos);
      const next = safeNext(
        new URLSearchParams(window.location.search).get("from") ||
          "/entries?scope=mine",
      );
      const query = new URLSearchParams({ from: next });
      if (photoFailed) query.set("photoError", "1");
      router.push(`/entries/${created.id}?${query.toString()}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel narrow" onSubmit={submit}>
      {editing ? (
        <p>
          <span className="pill">{kind === "place" ? "餐饮" : "物品"}</span>
        </p>
      ) : (
        <fieldset>
          <legend>记录类型</legend>
          {(
            [
              { value: "place", label: "餐饮店" },
              { value: "item", label: "物品" },
            ] as const
          ).map((option) => (
            <label className="choice" key={option.value}>
              <input
                type="radio"
                name="kind"
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      )}
      <label htmlFor="name">{kind === "place" ? "餐饮名称" : "物品名称"}</label>
      <input
        id="name"
        required
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={
          kind === "place" ? "例如：巷口的小笼包" : "例如：喜欢的啤酒或零食"
        }
      />
      <StarRating value={rating} onChange={setRating} />
      {kind === "place" ? (
        <CuisinePicker
          items={cuisines}
          value={cuisineIds}
          onChange={setCuisineIds}
        />
      ) : (
        <CategoryPicker value={categoryIds} onChange={setCategoryIds} />
      )}
      <LocationField
        value={location}
        onChange={setLocation}
        required={kind === "place"}
      />
      <label htmlFor="address">地址（选填）</label>
      <input
        id="address"
        maxLength={300}
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <TagPicker value={tags} onChange={setTags} suggestions={suggestions} />
      {editing ? (
        <EntryPhotos
          entryId={entry.id}
          photos={savedPhotos}
          isOwner
          storageReady={storageReady}
          onChange={setSavedPhotos}
        />
      ) : (
        <PhotoPicker
          value={photos}
          onChange={setPhotos}
          disabled={busy}
          storageReady={storageReady}
        />
      )}
      <label htmlFor="note">备注（选填）</label>
      <textarea
        id="note"
        maxLength={2000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="记下口味、感受和推荐理由……"
      />
      <p className="error" role="alert">
        {error}
      </p>
      {!ready && (
        <p>
          <button
            type="button"
            className="secondary"
            onClick={() => void load()}
          >
            重新加载菜系和标签
          </button>
        </p>
      )}
      <button disabled={busy || !ready}>
        {busy
          ? "正在保存…"
          : editing
            ? "保存修改"
            : "保存记录"}
      </button>
      {editing && (
        <Link className="secondary" href={from}>
          取消
        </Link>
      )}
    </form>
  );
}
