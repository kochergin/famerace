import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@famerace/db";
import * as auctionMod from "../src/modules/auction";
import * as cardsMod from "../src/modules/cards";
import * as claimMod from "../src/modules/claim";
import * as demandMod from "../src/modules/demand";
import * as draftMod from "../src/modules/draft";
import * as rosterMod from "../src/modules/roster";
import * as scoresMod from "../src/modules/scores";
import * as streetteamMod from "../src/modules/streetteam";
import { makeUser, resetDb } from "./helpers";

async function liveCreatorWithBackers() {
  const [scout, admin, fan1, fan2, mira] = await Promise.all([
    makeUser(),
    makeUser({ roles: ["ADMIN"] }),
    makeUser(),
    makeUser(),
    makeUser(),
  ]);
  const { profile } = await draftMod.nominate(scout.id, {
    nameOrHandle: "MIRA",
    category: "MUSICIAN",
    thesis: "Indie singer with insane hooks, about to break out.",
  });
  await draftMod.moderateDraft(admin.id, profile.id, "APPROVED");
  await demandMod.placeDemandOrder(fan1.id, {
    draftProfileId: profile.id,
    intentType: "GENESIS_PASS",
    amountCents: 10_000,
    binding: true,
  });
  await demandMod.placeDemandOrder(fan2.id, {
    draftProfileId: profile.id,
    intentType: "MARKET_BUY",
    amountCents: 10_000,
    binding: true,
  });
  const creator = await claimMod.startClaim(mira.id, profile.id);
  await claimMod.submitVerification(mira.id, creator.id, {
    bio: "Indie singer from the draft board.",
    story: "Fans put me here — let's make the first video happen.",
    socialLinks: ["https://tiktok.com/@mira"],
    termsAccepted: true,
  });
  await claimMod.approveVerification(admin.id, creator.id);
  await claimMod.configurePerks(mira.id, creator.id, {
    perks: ["Early drops", "Backstage Q&A", "Genesis wall spot"],
  });
  await claimMod.configurePayout(mira.id, creator.id);
  await prisma.mission.create({
    data: {
      creatorId: creator.id,
      title: "First Music Video",
      goalCents: 50_000,
      deadline: new Date(Date.now() + 14 * 86_400_000),
      useOfFunds: "Video",
      rewardTiers: [],
      status: "LIVE",
    },
  });
  await claimMod.approveLaunchKit(admin.id, creator.id);
  await claimMod.scheduleLaunch(admin.id, creator.id, new Date(Date.now() + 3_600_000));
  await auctionMod.launchNow(admin.id, creator.id);
  return { scout, admin, fan1, fan2, mira, creator, profile };
}

describe("scores", () => {
  beforeEach(resetDb);

  it("taste score rewards early backing and successful scouting, with drivers", async () => {
    const { scout, fan1 } = await liveCreatorWithBackers();
    await scoresMod.computeAllTasteScores();

    const scoutScore = await scoresMod.latestTasteScore(scout.id);
    const fanScore = await scoresMod.latestTasteScore(fan1.id);
    expect(scoutScore!.score).toBeGreaterThan(0);
    expect(fanScore!.score).toBeGreaterThan(0);
    const scoutDrivers = scoutScore!.drivers as { label: string }[];
    expect(scoutDrivers.some((d) => d.label.includes("Nominations"))).toBe(true);
    const fanDrivers = fanScore!.drivers as { label: string }[];
    expect(fanDrivers.some((d) => d.label.includes("early"))).toBe(true);
    expect(scoutScore!.rank).toBeGreaterThanOrEqual(1);
  });

  it("fame score reflects backers and mission progress, explainably", async () => {
    const { creator } = await liveCreatorWithBackers();
    await scoresMod.computeAllFameScores();
    const fame = await scoresMod.latestFameScore(creator.id);
    expect(fame!.score).toBeGreaterThan(0);
    expect((fame!.drivers as { label: string }[]).length).toBeGreaterThan(0);
    const updated = await prisma.creator.findUniqueOrThrow({ where: { id: creator.id } });
    expect(updated.fameScore).toBe(fame!.score);
  });
});

describe("street team + crews", () => {
  beforeEach(resetDb);

  it("quest approval grants XP and crew points; leaderboard ranks crews", async () => {
    const { mira, fan1 } = await liveCreatorWithBackers();
    const crew = await streetteamMod.createCrew(fan1.id, { name: "Tokyo Angels" });
    const quest = await streetteamMod.createQuest(mira.id, {
      title: "Clip the new video",
      description: "Make a TikTok clip and post the link.",
      type: "CONTENT",
      proofType: "LINK",
      rewardType: "XP",
      rewardAmount: 40,
    });
    const completion = await streetteamMod.submitCompletion(fan1.id, quest.id, "https://tiktok.com/@fan/clip");
    // Duplicate submissions rejected by the unique constraint.
    await expect(
      streetteamMod.submitCompletion(fan1.id, quest.id, "https://again.example"),
    ).rejects.toThrow();

    // Random user cannot review.
    const rando = await makeUser();
    await expect(streetteamMod.reviewCompletion(rando.id, completion.id, "APPROVED")).rejects.toThrow(/only/i);

    await streetteamMod.reviewCompletion(mira.id, completion.id, "APPROVED");
    const fan = await prisma.user.findUniqueOrThrow({ where: { id: fan1.id } });
    expect(fan.xp).toBe(40);
    const crewAfter = await prisma.crew.findUniqueOrThrow({ where: { id: crew.id } });
    expect(crewAfter.score).toBe(40);
    expect(crewAfter.questsCompleted).toBe(1);

    await streetteamMod.rankCrews();
    const board = await streetteamMod.crewLeaderboard();
    expect(board[0]?.name).toBe("Tokyo Angels");
    expect(board[0]?.rank).toBe(1);
  });

  it("one crew per user", async () => {
    const [user] = await Promise.all([makeUser()]);
    await streetteamMod.createCrew(user.id, { name: "First Crew" });
    await expect(streetteamMod.createCrew(user.id, { name: "Second Crew" })).rejects.toThrow(/leave/i);
    await streetteamMod.leaveCrew(user.id);
    const crew2 = await streetteamMod.createCrew(user.id, { name: "Second Crew" });
    expect(crew2.name).toBe("Second Crew");
  });
});

describe("roster + share cards", () => {
  beforeEach(resetDb);

  it("roster aggregates backed status across passes and holdings", async () => {
    const { fan1, fan2 } = await liveCreatorWithBackers();
    const roster1 = await rosterMod.rosterFor(fan1.id); // genesis pass backer
    const roster2 = await rosterMod.rosterFor(fan2.id); // curve backer
    expect(roster1.stats.passCount).toBe(1);
    expect(roster1.entries.some((e) => e.backed)).toBe(true);
    expect(roster2.stats.holdingCount).toBe(1);
  });

  it("generates all applicable card templates as valid SVG", async () => {
    const { scout, fan1, creator, profile } = await liveCreatorWithBackers();
    await scoresMod.computeAllTasteScores();
    const scoutUser = await prisma.user.findUniqueOrThrow({ where: { id: scout.id } });
    const fanUser = await prisma.user.findUniqueOrThrow({ where: { id: fan1.id } });
    const mission = await prisma.mission.findFirstOrThrow({ where: { creatorId: creator.id } });

    const cases: [string, string, string | undefined][] = [
      ["DRAFT_RANK", profile.id, undefined],
      ["CLAIM", profile.id, undefined],
      ["MISSION", mission.id, undefined],
      ["BACKER", "mira", fan1.id],
      ["BREAKOUT", "mira", undefined],
      ["CREATOR_REVENUE", "mira", undefined],
      ["SCOUT", scoutUser.username, undefined],
      ["TASTE_SCORE", fanUser.username, undefined],
      ["ROSTER", fanUser.username, undefined],
    ];
    for (const [template, subject, viewer] of cases) {
      const { svg } = await cardsMod.generateCard(template as never, subject, viewer);
      expect(svg, template).toContain("<svg");
      expect(svg, template).toContain("FAMERACE");
    }
    expect(await prisma.shareCard.count()).toBe(cases.length);
  });
});
