import { NextRequest } from "next/server";
import { media, users } from "@famerace/core";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Serves uploaded media. Avatars are public; paywalled media (Backstage
 * posts, drops) is authorized per viewer — the blurred tease lives at
 * /img/:id/blur. Video/audio lives on disk and streams with Range support
 * so players can seek. Cache stays private on paywalled assets so a shared
 * cache can never serve a member's copy to a non-member.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await media.getAsset(id);
  if (!asset) return new Response("Not found", { status: 404 });

  const isPublic = asset.kind === "AVATAR";
  if (!isPublic) {
    const viewer = await users.getSessionUser(req.cookies.get(SESSION_COOKIE)?.value);
    if (!(await media.canViewSharp(asset, viewer?.id ?? null))) {
      return new Response("Locked", { status: 403 });
    }
  }

  const total = asset.sizeBytes > 0 ? asset.sizeBytes : (asset.bytes?.length ?? 0);
  if (total === 0) return new Response("Gone", { status: 410 });

  const baseHeaders: Record<string, string> = {
    "Content-Type": asset.mime,
    "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, max-age=3600",
    "Accept-Ranges": "bytes",
  };

  // Range requests: video seeking reads ONLY the requested slice from disk —
  // never the whole 64MB file per seek.
  const range = req.headers.get("range");
  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
      if (start <= end && start < total) {
        const slice = await media.readAssetRange(asset, start, end);
        if (!slice) return new Response("Gone", { status: 410 });
        return new Response(new Uint8Array(slice), {
          status: 206,
          headers: {
            ...baseHeaders,
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Content-Length": String(slice.length),
          },
        });
      }
      return new Response("Range not satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${total}` },
      });
    }
  }

  const bytes = await media.readAssetBytes(asset);
  if (!bytes) return new Response("Gone", { status: 410 });
  return new Response(new Uint8Array(bytes), {
    headers: { ...baseHeaders, "Content-Length": String(bytes.length) },
  });
}
