import { NextRequest } from "next/server";
import { users } from "@famerace/core";
import { prisma } from "@famerace/db";
import { SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Store/remove the caller's web-push subscription. */
export async function POST(request: NextRequest): Promise<Response> {
  const user = await users.getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return Response.json({ error: "sign in first" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;
  const p256dh = body?.keys?.p256dh as string | undefined;
  const auth = body?.keys?.auth as string | undefined;
  if (!endpoint || !p256dh || !auth) return Response.json({ error: "bad subscription" }, { status: 400 });
  // Don't reassign an endpoint already owned by someone else — a signed-in user
  // who learns another's endpoint must not steal (or hijack) their subscription.
  const existing = await prisma.pushSubscription.findUnique({ where: { endpoint }, select: { userId: true } });
  if (existing && existing.userId !== user.id) {
    return Response.json({ error: "endpoint in use" }, { status: 409 });
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh, auth },
    update: { p256dh, auth },
  });
  return Response.json({ ok: true });
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const user = await users.getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return Response.json({ error: "sign in first" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint } });
  }
  return Response.json({ ok: true });
}
