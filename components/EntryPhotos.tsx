"use client";
import { useState } from "react";
import { requestJson } from "@/lib/browser";
import { uploadEntryPhoto } from "@/lib/browser-photos";
import { nextPhotoSort, type EntryPhotoThumb } from "@/lib/photo-constants";
import ConfirmDialog from "./ConfirmDialog";
import PhotoPicker, { type PickerPhoto } from "./PhotoPicker";

export default function EntryPhotos({
  entryId,
  photos,
  isOwner,
  storageReady = true,
  onChange,
}: {
  entryId: string;
  photos: EntryPhotoThumb[];
  isOwner: boolean;
  storageReady?: boolean;
  onChange: (photos: EntryPhotoThumb[]) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PickerPhoto[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/photos/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setConfirmId(null);
      onChange(photos.filter((photo) => photo.id !== id));
    } catch (e) {
      setError((e as Error).message);
      setConfirmId(null);
    } finally {
      setBusy(false);
    }
  }

  async function handlePickerChange(next: PickerPhoto[]) {
    const previous = new Set(pending.map((photo) => photo.previewUrl));
    const added = next.filter(
      (photo) => photo.file && !previous.has(photo.previewUrl),
    );
    setPending(next);
    if (!added.length) return;
    setBusy(true);
    setError("");
    let current = photos;
    try {
      for (const item of added) {
        const photo = await uploadEntryPhoto(
          entryId,
          item.file!,
          nextPhotoSort(current),
        );
        current = [...current, photo];
        onChange(current);
        setPending((list) =>
          list.filter((row) => row.previewUrl !== item.previewUrl),
        );
        if (item.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
    } catch (e) {
      onChange(current);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!photos.length && !isOwner) return null;

  return (
    <section className="photo-gallery-block" aria-label="记录照片">
      {photos.length > 0 && (
        <ul className="photo-gallery">
          {photos.map((photo, index) => (
            <li key={photo.id} className="photo-frame">
              <img src={photo.public_url} alt={index === 0 ? "封面照片" : ""} />
              {index === 0 && <span className="photo-cover-badge">封面</span>}
              {isOwner && (
                <div className="photo-thumb-actions">
                  <button
                    type="button"
                    className="danger"
                    disabled={busy}
                    onClick={() => setConfirmId(photo.id)}
                  >
                    删除
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {isOwner && (
        <PhotoPicker
          value={pending}
          onChange={(next) => void handlePickerChange(next)}
          disabled={busy}
          storageReady={storageReady}
          allowReorder={false}
          existingCount={photos.length}
        />
      )}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <ConfirmDialog
        open={confirmId !== null}
        title="删除照片"
        message="确定删除这张照片吗？"
        confirmLabel="删除"
        busy={busy}
        onDismiss={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmId) void remove(confirmId);
        }}
      />
    </section>
  );
}
