import { NextRequest } from "next/server";
import { media, users } from "@famerace/core";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Serves uploaded media bytes. Avatars are public; paywalled media (Backstage
 * posts, drops) is authorized per viewer — the blurred tease lives at
 * /img/:id/blur. Asset ids are immutable, but the cache header stays private
 * so a shared cache can never serve a member's copy to a non-member.
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
  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      "Content-Type": asset.mime,
      "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, max-age=3600",
    },
  });
}
