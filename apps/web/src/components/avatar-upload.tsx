"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadAvatarAction } from "@/app/actions/avatar";
import { Monogram } from "@/components/monogram";

// Drag-drop avatar upload with a live duotone-poster preview: you see your
// treated "poster self" (same .face pipeline as everywhere else) before
// saving. Images are center-cropped and downscaled to 512×512 WebP on the
// client so uploads stay small; the server re-validates magic bytes anyway.
async function toSquareWebp(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 512, 512);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
    return blob && blob.size > 0 ? blob : file;
  } catch {
    return file; // server-side validation still applies
  }
}

export function AvatarUpload({
  target,
  name,
  currentUrl,
  label = "Face",
}: {
  target: "user" | "creator";
  name: string;
  currentUrl?: string | null;
  label?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const pick = (file: File | undefined | null) => {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That is not an image");
      return;
    }
    void toSquareWebp(file).then((blob) => {
      setPending((old) => {
        if (old) URL.revokeObjectURL(old.previewUrl);
        return { blob, previewUrl: URL.createObjectURL(blob) };
      });
    });
  };

  const save = () => {
    if (!pending) return;
    startSaving(async () => {
      const formData = new FormData();
      formData.set("target", target);
      formData.set("file", new File([pending.blob], "avatar.webp", { type: pending.blob.type }));
      const result = await uploadAvatarAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      URL.revokeObjectURL(pending.previewUrl);
      setPending(null);
      router.refresh();
    });
  };

  return (
    <div>
      <p className="mb-1.5 text-xs uppercase tracking-wide text-muted">{label}</p>
      <div className="flex items-center gap-4">
        <Monogram name={name} src={pending?.previewUrl ?? currentUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pick(e.dataTransfer.files[0]);
            }}
            className={`w-full rounded border border-dashed px-4 py-3 text-left text-xs transition ${
              dragOver ? "border-lime bg-lime/5 text-lime" : "border-edge text-muted hover:border-chrome hover:text-chrome"
            }`}
          >
            Drop a photo or click to choose — it gets the poster treatment instantly. Hover the
            preview to see the true colors.
          </button>
          {pending ? (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded bg-lime px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink hover:brightness-110 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Make it the face"}
              </button>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(pending.previewUrl);
                  setPending(null);
                }}
                className="rounded border border-edge px-3 py-1.5 text-xs font-bold uppercase text-muted hover:text-chalk"
              >
                Cancel
              </button>
            </div>
          ) : null}
          {error ? <p className="mt-2 text-xs text-pink">{error}</p> : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
