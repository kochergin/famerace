import { createHmac, timingSafeEqual } from "node:crypto";
import { wallet } from "@famerace/core";
import { prisma } from "@famerace/db";

export const dynamic = "force-dynamic";

/**
 * On-chain USDC deposit webhook (the seam a chain indexer / custody provider
 * posts to). Auth: HMAC-SHA256 of the raw body with USDC_WEBHOOK_SECRET in
 * the x-famerace-signature header. Crediting is idempotent by tx hash —
 * indexers retry, users must not be double-credited.
 *
 * Payload: { "address": "0x…", "amountCents": 2500, "txHash": "0x…" }
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.USDC_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "webhook not configured" }, { status: 503 });

  const raw = await request.text();
  const signature = request.headers.get("x-famerace-signature") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: { address?: string; amountCents?: number; txHash?: string };
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const { address, amountCents, txHash } = payload;
  if (!address || !txHash || !Number.isInteger(amountCents) || amountCents! <= 0) {
    return Response.json({ error: "bad payload" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { depositAddress: address }, select: { id: true } });
  if (!user) return Response.json({ error: "unknown address" }, { status: 404 });

  const entry = await wallet.creditDeposit(user.id, amountCents!, `chain_${txHash}`, "On-chain USDC deposit");
  return Response.json({ ok: true, entryId: entry.id });
}
