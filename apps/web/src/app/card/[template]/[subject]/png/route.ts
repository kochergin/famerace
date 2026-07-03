import { NextRequest } from "next/server";
import { cards, DomainError, users } from "@famerace/core";
import type { CardTemplate } from "@famerace/db";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

const TEMPLATES = new Set([
  "BACKER",
  "ROSTER",
  "SCOUT",
  "CLAIM",
  "MISSION",
  "BREAKOUT",
  "BATTLE",
  "BACKER_WALL",
  "DRAFT_RANK",
  "CREATOR_REVENUE",
  "TASTE_SCORE",
  "CREW",
  "CALLED_IT",
  "MOMENTUM",
]);

/**
 * PNG share cards for social scrapers (§0B.1 "design the screenshot"):
 * X/Telegram/Discord unfurl og:image PNGs, not SVG. Rendered from the same
 * SVG templates via resvg; falls back to SVG if the native renderer is
 * unavailable in the running environment.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ template: string; subject: string }> },
): Promise<Response> {
  const { template, subject } = await context.params;
  const upper = template.toUpperCase();
  if (!TEMPLATES.has(upper)) return new Response("Unknown template", { status: 404 });
  const viewer = await users.getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  try {
    const { svg } = await cards.generateCard(upper as CardTemplate, decodeURIComponent(subject), viewer?.id);
    try {
      const { Resvg } = await import("@resvg/resvg-js");
      const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
      return new Response(new Uint8Array(png), {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" },
      });
    } catch {
      return new Response(svg, {
        headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=60" },
      });
    }
  } catch (error) {
    if (error instanceof DomainError) return new Response(error.message, { status: error.status });
    throw error;
  }
}
