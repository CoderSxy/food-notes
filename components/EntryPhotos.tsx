"use client";
import { useState } from "react";
import { requestJson } from "@/lib/browser";
import { uploadEntryPhoto } from "@/lib/browser-photos";
import {
  MAX_PHOTOS,
  nextPhotoSort,
  type EntryPhoto,
} from "@/lib/photo-constants";
import PhotoPicker, {
  revokePickerPreviews,
  type PickerPhoto,
} from "./PhotoPicker";

export default function EntryPhotos({
  entryId,
  photos,
  isOwner,
  storageReady = true,
  onChange,
}: {
  entryId: string;
  photos: EntryPhoto[];
  isOwner: boolean;
  storageReady?: boolean;
  onChange: (photos: EntryPhoto[]) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending: PickerPhoto[] = [];

  async function remove(id: string) {
    if (!window.confirm("确定删除这张照片吗？")) return;
    setBusy(true);
    setError("");
    try {
      await requestJson(`/api/photos/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      onChange(photos.filter((photo) => photo.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addPending(next: PickerPhoto[]) {
    const files = next.filter((photo) => photo.file).map((photo) => photo.file!);
    if (!files.length) return;
    revokePickerPreviews(next);
    setBusy(true);
    setError("");
    let current = photos;
    try {
      for (const file of files) {
        const photo = await uploadEntryPhoto(
          entryId,
          file,
          nextPhotoSort(current),
        );
        current = [...current, photo];
      }
      onChange(current);
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
                    onClick={() => void remove(photo.id)}
                  >
                    删除
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {isOwner && photos.length < MAX_PHOTOS && (
        <PhotoPicker
          value={pending}
          onChange={(next) => void addPending(next)}
          disabled={busy}
          storageReady={storageReady}
          allowReorder={false}
        />
      )}
      <p className="error" role="alert">
        {error}
      </p>
    </section>
  );
}
