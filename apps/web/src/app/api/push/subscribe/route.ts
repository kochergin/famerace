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
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh, auth },
    update: { userId: user.id, p256dh, auth },
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
