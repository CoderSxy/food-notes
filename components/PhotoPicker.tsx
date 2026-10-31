"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_PHOTOS } from "@/lib/photo-constants";

export type PickerPhoto = {
  id?: string;
  previewUrl: string;
  file?: File;
  sort: number;
};

export function revokePickerPreviews(photos: PickerPhoto[]) {
  for (const photo of photos) {
    if (photo.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(photo.previewUrl);
    }
  }
}

export default function PhotoPicker({
  value,
  onChange,
  disabled = false,
  storageReady = true,
  allowReorder = true,
}: {
  value: PickerPhoto[];
  onChange: (next: PickerPhoto[]) => void;
  disabled?: boolean;
  storageReady?: boolean;
  allowReorder?: boolean;
}) {
  const albumRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const blobUrls = useRef(new Set<string>());
  const [hint, setHint] = useState("");
  const full = value.length >= MAX_PHOTOS;
  const blocked = disabled || !storageReady || full;

  useEffect(() => {
    const next = new Set(
      value
        .filter((photo) => photo.previewUrl.startsWith("blob:"))
        .map((photo) => photo.previewUrl),
    );
    for (const url of blobUrls.current) {
      if (!next.has(url)) URL.revokeObjectURL(url);
    }
    blobUrls.current = next;
  }, [value]);
  useEffect(
    () => () => {
      for (const url of blobUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  function addFiles(files: FileList | File[] | null) {
    if (!files?.length) return;
    const incoming = [...files];
    const images = incoming.filter((file) => file.type.startsWith("image/"));
    if (!images.length) {
      setHint("请粘贴图片");
      return;
    }
    const room = MAX_PHOTOS - value.length;
    const added = images.slice(0, room).map((file, index) => ({
      previewUrl: URL.createObjectURL(file),
      file,
      sort: value.length + index,
    }));
    if (added.length) {
      setHint("");
      onChange([...value, ...added]);
    }
  }

  function removeAt(index: number) {
    const target = value[index];
    if (target?.file) URL.revokeObjectURL(target.previewUrl);
    onChange(
      value
        .filter((_, i) => i !== index)
        .map((photo, sort) => ({ ...photo, sort })),
    );
  }

  function makeCover(index: number) {
    if (!allowReorder || index === 0) return;
    const next = [...value];
    const [photo] = next.splice(index, 1);
    if (!photo) return;
    onChange([photo, ...next].map((item, sort) => ({ ...item, sort })));
  }

  return (
    <div
      className="photo-picker"
      onPaste={(event) => {
        if (blocked) return;
        addFiles(event.clipboardData?.files ?? null);
      }}
    >
      <div className="row between">
        <label>照片（选填，最多 3 张）</label>
        {!storageReady && (
          <small className="muted">图片存储未配置</small>
        )}
      </div>
      <div className="photo-actions">
        <input
          ref={albumRef}
          className="sr-only"
          type="file"
          accept="image/*"
          multiple
          disabled={blocked}
          aria-label="从相册选择"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          className="sr-only"
          type="file"
          accept="image/*"
          capture="environment"
          disabled={blocked}
          aria-label="拍照"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="secondary"
          disabled={blocked}
          onClick={() => albumRef.current?.click()}
        >
          相册
        </button>
        <button
          type="button"
          className="secondary"
          disabled={blocked}
          onClick={() => cameraRef.current?.click()}
        >
          拍照
        </button>
        <span className="muted">也可粘贴截图</span>
      </div>
      {value.length > 0 && (
        <ul className="photo-thumbs">
          {value.map((photo, index) => (
            <li key={photo.id ?? photo.previewUrl} className="photo-thumb">
              <img src={photo.previewUrl} alt="" />
              {index === 0 && <span className="photo-cover-badge">封面</span>}
              <div className="photo-thumb-actions">
                {allowReorder && index > 0 && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => makeCover(index)}
                  >
                    设为封面
                  </button>
                )}
                <button
                  type="button"
                  className="danger"
                  disabled={disabled}
                  onClick={() => removeAt(index)}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="error" role="alert">
        {hint}
      </p>
    </div>
  );
}
