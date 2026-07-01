import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@famerace/db";
import * as draft from "../src/modules/draft";
import { makeUser, resetDb } from "./helpers";

describe("draft layer", () => {
  beforeEach(resetDb);

  it("normalizes handles from names, @handles and URLs", () => {
    expect(draft.normalizeHandle("@MIRA")).toBe("mira");
    expect(draft.normalizeHandle("Mira Music")).toBe("mira_music");
    expect(draft.normalizeHandle("https://tiktok.com/@mira.music")).toBe("mira_music");
  });

  it("creates a draft profile in the moderation queue on first nomination", async () => {
    const scout = await makeUser();
    const { profile, isNew } = await draft.nominate(scout.id, {
      nameOrHandle: "MIRA",
      category: "MUSICIAN",
      thesis: "Indie singer with insane hooks, about to break out.",
      requestedMission: "First Music Video",
    });
    expect(isNew).toBe(true);
    expect(profile.moderationStatus).toBe("PENDING");

    const queueItem = await prisma.moderationItem.findFirst({
      where: { objectType: "DraftProfile", objectId: profile.id, queue: "DRAFT_MOD" },
    });
    expect(queueItem?.status).toBe("PENDING");

    const updatedScout = await prisma.user.findUniqueOrThrow({ where: { id: scout.id } });
    expect(updatedScout.roles).toContain("SCOUT");
  });

  it("attaches duplicate nominations to the existing profile", async () => {
    const [scout1, scout2] = await Promise.all([makeUser(), makeUser()]);
    const first = await draft.nominate(scout1.id, {
      nameOrHandle: "@KAI",
      category: "BUILDER_FOUNDER",
      thesis: "Shipping an AI tool every week, community growing fast.",
    });
    const second = await draft.nominate(scout2.id, {
      nameOrHandle: "https://x.com/@kai",
      category: "BUILDER_FOUNDER",
      thesis: "Same person, different scout — should attach not duplicate.",
    });
    expect(second.isNew).toBe(false);
    expect(second.profile.id).toBe(first.profile.id);
    const nominations = await prisma.scoutNomination.count({
      where: { draftProfileId: first.profile.id },
    });
    expect(nominations).toBe(2);
  });

  it("only shows approved profiles on the board, ranked by demand", async () => {
    const scout = await makeUser({ roles: ["ADMIN"] });
    const a = await draft.nominate(scout.id, {
      nameOrHandle: "LOW_DEMAND",
      category: "MUSICIAN",
      thesis: "Great artist but nobody pledged yet, sadly for them.",
    });
    const b = await draft.nominate(scout.id, {
      nameOrHandle: "HIGH_DEMAND",
      category: "MUSICIAN",
      thesis: "Everyone wants this launch to happen immediately.",
    });

    expect(await draft.draftBoard()).toHaveLength(0); // both pending

    await draft.moderateDraft(scout.id, a.profile.id, "APPROVED");
    await draft.moderateDraft(scout.id, b.profile.id, "APPROVED");
    await prisma.draftProfile.update({
      where: { id: b.profile.id },
      data: { pledgedDemandTotal: 50_000 },
    });

    const board = await draft.draftBoard();
    expect(board.map((r) => r.nameOrHandle)).toEqual(["HIGH_DEMAND", "LOW_DEMAND"]);
    expect(board[0]?.rank).toBe(1);

    await draft.moderateDraft(scout.id, a.profile.id, "REJECTED");
    expect(await draft.draftBoard()).toHaveLength(1);
  });

  it("watch increments fan count once per user; invites are attributed", async () => {
    const [scout, fan] = await Promise.all([makeUser({ roles: ["ADMIN"] }), makeUser()]);
    const { profile } = await draft.nominate(scout.id, {
      nameOrHandle: "ARIA",
      category: "ARTIST_DESIGNER",
      thesis: "Illustrator whose style is everywhere on my feed lately.",
    });
    await draft.watchDraft(fan.id, profile.id);
    await draft.watchDraft(fan.id, profile.id); // idempotent
    const after = await prisma.draftProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(after.fanCount).toBe(1);

    const link = await draft.recordInvite(fan.id, profile.id);
    expect(link).toContain(`/claim/${profile.id}?scout=`);
    const after2 = await prisma.draftProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(after2.inviteCount).toBe(1);
  });

  it("records takedown requests and flags the profile", async () => {
    const scout = await makeUser();
    const { profile } = await draft.nominate(scout.id, {
      nameOrHandle: "PRIVATE_PERSON",
      category: "INTERNET_CREATOR",
      thesis: "Somebody nominated a person who does not want this.",
    });
    await draft.requestTakedown(profile.id, {
      requesterContact: "legal@example.com",
      reason: "I am the subject of this profile and want it removed.",
    });
    const after = await prisma.draftProfile.findUniqueOrThrow({ where: { id: profile.id } });
    expect(after.takedownStatus).toBe("REQUESTED");
    expect(await prisma.takedownRequest.count({ where: { draftProfileId: profile.id } })).toBe(1);
  });
});
