import { media } from "@famerace/core";

export const dynamic = "force-dynamic";

/**
 * Blurred preview of a media asset. Locked content (Backstage posts, drops)
 * must never ship the sharp URL to non-members — CSS blur is trivially
 * bypassed by opening the image directly. This renders a real gaussian blur
 * server-side, so the tease is all a locked viewer ever receives.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await media.getAsset(id);
  if (!asset) return new Response("Not found", { status: 404 });

  if (!asset.bytes || !asset.mime.startsWith("image/")) return new Response("No preview", { status: 404 });
  const base64 = Buffer.from(asset.bytes).toString("base64");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512">
  <filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="28"/></filter>
  <image href="data:${asset.mime};base64,${base64}" width="512" height="512" preserveAspectRatio="xMidYMid slice" filter="url(#b)"/>
  <rect width="512" height="512" fill="rgb(10 10 13 / 0.35)"/>
</svg>`;
  const { Resvg } = await import("@resvg/resvg-js");
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 512 } }).render().asPng();
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
