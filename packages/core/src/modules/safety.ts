import { prisma, type ReportReason } from "@famerace/db";
import { z } from "zod";
import { DomainError, notFound } from "../errors";
import { audit } from "../statemachine";

// Prohibited-content guardrails (PRD §15.4) + user-facing reporting and
// blocking (§15.9). FameRace must never host markets or content about
// personal tragedy, private life, allegations or minors.

/**
 * Hard terms: submission is refused outright with a policy message.
 * Soft terms: submission is accepted but flagged for human review — heuristics
 * must not silently censor legitimate use (e.g. an anti-harassment charity).
 */
const HARD_TERMS = [
  // tragedy / integrity markets (§15.4)
  "death of",
  "dies before",
  "dies by",
  "overdose",
  "relapse",
  "suicide",
  "self-harm",
  "assassinat",
  // allegations / cancellation markets
  "arrest", // stem: arrested, arrest of…
  "gets cancelled",
  "gets canceled",
  "cancellation market",
  "divorce",
  "cheating scandal",
  // minors
  "under 18",
  "underage",
  "minor child",
  "middle school",
] as const;

const SOFT_TERMS = [
  "injury",
  "illness",
  "lawsuit",
  "allegation",
  "scandal",
  "harass",
  "teen",
  "high school",
] as const;

export type ProhibitedCheck =
  | { verdict: "OK" }
  | { verdict: "FLAG"; term: string }
  | { verdict: "BLOCK"; term: string };

export function checkProhibited(...texts: (string | null | undefined)[]): ProhibitedCheck {
  const haystack = texts.filter(Boolean).join(" \n ").toLowerCase();
  for (const term of HARD_TERMS) {
    if (haystack.includes(term)) return { verdict: "BLOCK", term };
  }
  for (const term of SOFT_TERMS) {
    if (haystack.includes(term)) return { verdict: "FLAG", term };
  }
  return { verdict: "OK" };
}

/**
 * Enforce the blocklist for a submission. BLOCK throws (§15.4 prohibited
 * categories never enter the system); FLAG returns true so the caller can
 * mark its moderation item FLAGGED for priority human review.
 */
export function enforceProhibited(context: string, ...texts: (string | null | undefined)[]): boolean {
  const result = checkProhibited(...texts);
  if (result.verdict === "BLOCK") {
    throw new DomainError(
      "PROHIBITED_CONTENT",
      `This ${context} touches a prohibited category (personal tragedy, private life, allegations or minors) and cannot be posted.`,
    );
  }
  return result.verdict === "FLAG";
}

// ── Reporting (§15.9) ──

export const reportSchema = z.object({
  objectType: z.enum(["DraftProfile", "Creator", "User", "Mission", "BackstagePost", "Drop"]),
  objectId: z.string().min(1),
  reason: z.enum(["IMPERSONATION", "HARASSMENT", "PROHIBITED_CATEGORY", "FRAUD", "OTHER"]),
  detail: z.string().max(1000).optional().or(z.literal("")),
});

export async function fileReport(reporterUserId: string, input: z.input<typeof reportSchema>) {
  const data = reportSchema.parse(input);
  // One open report per reporter+object keeps the queue de-duplicated.
  const existing = await prisma.report.findFirst({
    where: {
      reporterUserId,
      objectType: data.objectType,
      objectId: data.objectId,
      status: { in: ["OPEN", "UNDER_REVIEW"] },
    },
  });
  if (existing) throw new DomainError("ALREADY_REPORTED", "You already reported this — our team is on it");
  const report = await prisma.report.create({
    data: {
      reporterUserId,
      objectType: data.objectType,
      objectId: data.objectId,
      reason: data.reason as ReportReason,
      detail: data.detail || null,
    },
  });
  await audit(prisma, {
    actorId: reporterUserId,
    action: "REPORT_FILED",
    objectType: data.objectType,
    objectId: data.objectId,
  });
  return report;
}

// ── Blocking (§15.9, §9.1) ──

export async function blockUser(blockerUserId: string, blockedUsername: string) {
  const blocked = await prisma.user.findUnique({ where: { username: blockedUsername } });
  if (!blocked) throw notFound("User");
  if (blocked.id === blockerUserId) throw new DomainError("SELF_BLOCK", "You cannot block yourself");
  await prisma.userBlock.upsert({
    where: { blockerUserId_blockedUserId: { blockerUserId, blockedUserId: blocked.id } },
    create: { blockerUserId, blockedUserId: blocked.id },
    update: {},
  });
}

export async function unblockUser(blockerUserId: string, blockedUsername: string) {
  const blocked = await prisma.user.findUnique({ where: { username: blockedUsername } });
  if (!blocked) throw notFound("User");
  await prisma.userBlock.deleteMany({
    where: { blockerUserId, blockedUserId: blocked.id },
  });
}

export async function isBlocked(blockerUserId: string, blockedUserId: string): Promise<boolean> {
  const block = await prisma.userBlock.findUnique({
    where: { blockerUserId_blockedUserId: { blockerUserId, blockedUserId } },
  });
  return block !== null;
}
