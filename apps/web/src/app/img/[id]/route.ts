import { media } from "@famerace/core";

// Serves uploaded avatar bytes. Asset ids are immutable (a new upload gets a
// new id), so far-future caching is safe.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await media.getAsset(id);
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
