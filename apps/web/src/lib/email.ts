import { prisma } from "@famerace/db";

/* Transactional email. With RESEND_API_KEY set, sends through Resend's plain
   HTTP API (no SDK); without it, logs to the server console so the pipeline
   is visible in development. Only high-signal notification types email —
   the inbox is sacred. */

const EMAIL_WORTHY = new Set([
  "PAYOUT_UPDATE",
  "CREATOR_CLAIMED",
  "LAUNCH_STARTING",
  "AUCTION_CONFIRMATION",
  "TRUST_SAFETY_ALERT",
]);

export function emailWorthy(type: string): boolean {
  return EMAIL_WORTHY.has(type);
}

export async function sendEmailToUser(
  userId: string,
  payload: { title: string; body?: string | null; link?: string | null },
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, notificationsMuted: true } });
  if (!user?.email || user.notificationsMuted) return;
  const key = process.env.RESEND_API_KEY;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://famerace.fun";
  const html = `<div style="font-family:sans-serif"><h2>${payload.title}</h2><p>${payload.body ?? ""}</p>${
    payload.link ? `<p><a href="${base}${payload.link}">Open FameRace →</a></p>` : ""
  }<p style="color:#888;font-size:12px">FameRace — Back the rise.</p></div>`;
  if (!key) {
    console.info(`[email:dev] to=${user.email} subject="${payload.title}"`);
    return;
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "FameRace <no-reply@famerace.fun>",
      to: user.email,
      subject: payload.title,
      html,
    }),
  }).catch(() => undefined);
}
