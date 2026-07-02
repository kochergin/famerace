import { beforeEach, describe, expect, it } from "vitest";
import * as recapMod from "../src/modules/recap";
import { makeUser, resetDb } from "./helpers";
import { prisma } from "@famerace/db";
import * as draftMod from "../src/modules/draft";
import * as demandMod from "../src/modules/demand";

describe("recap: season story data", () => {
  beforeEach(resetDb);

  it("has no story for a fresh user, and a story after the first pledge", async () => {
    const fan = await makeUser();
    const empty = await recapMod.seasonRecap(fan.id);
    expect(empty.hasStory).toBe(false);
    expect(empty.firstMove).toBeNull();

    const [scout, admin] = await Promise.all([makeUser(), makeUser({ roles: ["ADMIN"] })]);
    const { profile } = await draftMod.nominate(scout.id, {
      nameOrHandle: "MIRA",
      category: "MUSICIAN",
      thesis: "Hooks that live rent-free in your head. About to break out.",
    });
    await draftMod.moderateDraft(admin.id, profile.id, "APPROVED");
    await demandMod.placeDemandOrder(fan.id, {
      draftProfileId: profile.id,
      intentType: "MARKET_BUY",
      amountCents: 5_000,
      binding: true,
    });

    const story = await recapMod.seasonRecap(fan.id);
    expect(story.hasStory).toBe(true);
    expect(story.firstMove?.name).toBe("MIRA");
    expect(story.firstMove?.amountCents).toBe(5_000);
    expect(story.stats.backedCount).toBe(0); // pledge, not a live holding yet
    expect(story.topHolding).toBeNull();

    // Scout side: the nomination shows up as a call.
    const scoutStory = await recapMod.seasonRecap(scout.id);
    expect(scoutStory.stats.nominations).toBe(1);
    expect(scoutStory.hasStory).toBe(true);

    // Sanity: user select stays serializable (no bigint surprises for slides).
    expect(typeof story.stats.missionCents).toBe("number");
  });
});
