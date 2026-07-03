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
  // Titles and bodies carry user-controlled strings (display names, call
  // questions) — escape them or the email becomes an HTML injection sink.
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const safeLink = payload.link && payload.link.startsWith("/") ? payload.link : null;
  const html = `<div style="font-family:sans-serif"><h2>${esc(payload.title)}</h2><p>${esc(payload.body ?? "")}</p>${
    safeLink ? `<p><a href="${base}${esc(safeLink)}">Open FameRace →</a></p>` : ""
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
