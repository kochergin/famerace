/**
 * Genesis Draft seed: a living demo of the full loop —
 * draft → demand → claim → threshold → launch → back → missions →
 * backstage → street team → scores. Uses the real domain modules so every
 * invariant (ledger balance, state machines, thresholds) holds.
 *
 * Run: npm run db:seed  (idempotent-ish: aborts if users already exist)
 */
import { prisma } from "../packages/db/src/index";
import * as users from "../packages/core/src/modules/users";
import * as draft from "../packages/core/src/modules/draft";
import * as demand from "../packages/core/src/modules/demand";
import * as claim from "../packages/core/src/modules/claim";
import * as auction from "../packages/core/src/modules/auction";
import * as market from "../packages/core/src/modules/market";
import * as missions from "../packages/core/src/modules/missions";
import * as backstage from "../packages/core/src/modules/backstage";
import * as drops from "../packages/core/src/modules/drops";
import * as streetteam from "../packages/core/src/modules/streetteam";
import * as scores from "../packages/core/src/modules/scores";
import * as messages from "../packages/core/src/modules/messages";
import * as requests from "../packages/core/src/modules/requests";
import { assertLedgerBalanced } from "../packages/core/src/modules/ledger";

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log("seed: database not empty — skipping (drop & migrate to reseed)");
    return;
  }

  console.log("seed: users…");
  const password = "famerace-demo-1";
  const mk = async (username: string, displayName: string) =>
    (await users.signup({ username, email: `${username}@demo.famerace.fun`, password, displayName, dobAttested18: true })).user;

  const admin = await mk("admin", "FameRace Ops");
  await prisma.user.update({ where: { id: admin.id }, data: { roles: ["BACKER", "ADMIN"] } });
  const scout1 = await mk("talentradar", "Talent Radar");
  const scout2 = await mk("earlyalex", "Alex Early");
  const fans = await Promise.all(
    ["novafan", "daydreamer", "cratedigger", "firstrow", "moonlit", "backer_bee", "chorusline", "hypecycle"].map(
      (name, i) => mk(name, `Fan ${i + 1}`),
    ),
  );
  const miraUser = await mk("mira_irl", "MIRA");
  const kaiUser = await mk("kai_builds", "KAI");

  console.log("seed: draft board…");
  const nominate = (scoutId: string, name: string, category: never, thesis: string, mission?: string, link?: string) =>
    draft.nominate(scoutId, { nameOrHandle: name, category, thesis, requestedMission: mission, externalLink: link });

  const { profile: miraDraft } = await nominate(
    scout1.id,
    "MIRA",
    "MUSICIAN" as never,
    "Indie singer whose hooks live rent-free in my head. 18k followers and growing 30% a month — she is one video away from everywhere.",
    "First Music Video",
    "https://tiktok.com/@mira",
  );
  const { profile: kaiDraft } = await nominate(
    scout2.id,
    "KAI",
    "BUILDER_FOUNDER" as never,
    "Ships an AI tool every single week. His build-in-public threads hit 100k views. The next launch deserves a crowd.",
    "Beta Launch Week",
    "https://x.com/kai",
  );
  const others: [string, string, string, string][] = [
    ["ARIA", "MUSICIAN", "Bedroom-pop voice with a cult Discord. Label scouts are already lurking.", "Debut EP"],
    ["JUNO", "ARTIST_DESIGNER", "Illustrator whose style is suddenly everywhere on my feed.", "First Gallery Show"],
    ["PIXEL PETE", "INTERNET_CREATOR", "Retro-gaming shorts with insane completion rates.", "New Series Budget"],
    ["VELA", "ARTIST_DESIGNER", "Generative artist bridging galleries and the timeline.", "Print Run"],
    ["ORBIT", "INTERNET_CREATOR", "Science explainers that make astrophysics feel like gossip.", "Studio Setup"],
    ["SABLE", "MUSICIAN", "Late-night R&B that soundtracks half my playlists.", "Studio Session"],
  ];
  const otherDrafts = [];
  for (const [i, [name, category, thesis, mission]] of others.entries()) {
    const { profile } = await nominate((i % 2 === 0 ? scout1 : scout2).id, name, category as never, thesis, mission);
    otherDrafts.push(profile);
  }
  // Cross-nominations: MIRA has multiple scouts inviting.
  await nominate(scout2.id, "MIRA", "MUSICIAN" as never, "Seconding this — her live set converted my whole group chat in one night.");

  for (const profile of [miraDraft, kaiDraft, ...otherDrafts]) {
    await draft.moderateDraft(admin.id, profile.id, "APPROVED");
  }

  console.log("seed: demand vault…");
  const intents = ["GENESIS_PASS", "MARKET_BUY", "MISSION_PLEDGE", "BACKSTAGE"] as const;
  // Heavy demand for MIRA (launches today) and KAI (launching soon).
  for (const [i, fan] of fans.entries()) {
    await demand.placeDemandOrder(fan.id, {
      draftProfileId: miraDraft.id,
      intentType: intents[i % intents.length]!,
      amountCents: [10_000, 25_000, 5_000, 2_500][i % 4]!,
      binding: true,
    });
    if (i < 6) {
      await demand.placeDemandOrder(fan.id, {
        draftProfileId: kaiDraft.id,
        intentType: intents[(i + 1) % intents.length]!,
        amountCents: [15_000, 20_000, 10_000][i % 3]!,
        binding: true,
      });
    }
  }
  // Scatter demand + watchers across the rest of the board.
  for (const [i, profile] of otherDrafts.entries()) {
    for (const fan of fans.slice(0, 2 + (i % 3))) {
      await demand.placeDemandOrder(fan.id, {
        draftProfileId: profile.id,
        intentType: intents[i % intents.length]!,
        amountCents: 500 + 2_500 * (i % 4),
        binding: true,
      });
    }
    await draft.watchDraft(scout1.id, profile.id);
    await draft.recordInvite(fans[i % fans.length]!.id, profile.id);
  }

  console.log("seed: Season 1 Match Fund…");
  await prisma.matchFund.create({
    data: { seasonName: "Genesis Season", totalCents: 50_000_000, matchRatio: 0.25, creatorCap: 500_000 },
  });

  console.log("seed: MIRA claims and launches…");
  const mira = await claim.startClaim(miraUser.id, miraDraft.id);
  await claim.submitVerification(miraUser.id, mira.id, {
    bio: "Indie singer. The internet drafted me — so let's make the first video together.",
    story:
      "I've been writing songs in my bedroom for three years. Last month one of them went places I never expected, and suddenly there were thousands of you. FameRace is where we make the next move together: fund the first real music video, get backstage demos before anyone, and prove you were here first.",
    socialLinks: ["https://tiktok.com/@mira", "https://instagram.com/mira.music"],
    followerCount: 18_200,
    termsAccepted: true,
  });
  await claim.approveVerification(admin.id, mira.id);
  await claim.configurePerks(miraUser.id, mira.id, {
    perks: [
      "Every demo before release",
      "Monthly backstage listening party",
      "Genesis wall credit in the video description",
      "Vote on the next single",
    ],
  });
  await claim.configurePayout(miraUser.id, mira.id);
  const miraMission = await missions.createMission(miraUser.id, {
    title: "First Music Video",
    goalCents: 1_200_000,
    deadlineDays: 14,
    useOfFunds: "Video production, editing, styling, one day of studio rental",
    rewardTiers: [
      { thresholdCents: 1_000, reward: "Mission Badge" },
      { thresholdCents: 5_000, reward: "Behind-the-scenes drop" },
      { thresholdCents: 10_000, reward: "Name in the credits" },
      { thresholdCents: 25_000, reward: "Private listening party invite" },
    ],
    refundRule: "ALL_OR_NOTHING",
    matchEligible: true,
  });
  await claim.approveLaunchKit(admin.id, mira.id);
  await claim.scheduleLaunch(admin.id, mira.id, new Date(Date.now() + 3600_000));
  // Everyone confirms in the window, then the opening clears.
  await prisma.fanDemandOrder.updateMany({
    where: { creatorId: mira.id, confirmationStatus: "CONFIRMATION_WINDOW" },
    data: { confirmationStatus: "CONFIRMED" },
  });
  await auction.launchNow(admin.id, mira.id);
  await missions.approveMission(admin.id, miraMission.id);

  console.log("seed: MIRA post-launch activity…");
  const miraMarket = await prisma.creatorMarket.findUniqueOrThrow({ where: { creatorId: mira.id } });
  await market.buy(fans[4]!.id, miraMarket.id, 7_500);
  await market.buy(fans[5]!.id, miraMarket.id, 12_000);
  await market.purchaseGenesisPass(fans[1]!.id, mira.id, 10_000);
  await missions.contribute(fans[2]!.id, miraMission.id, 40_000, "Name in the credits");
  await missions.contribute(fans[3]!.id, miraMission.id, 15_000);
  const tier = await backstage.configureTier(miraUser.id, {
    name: "Inner Circle",
    priceCents: 1_200,
    accessType: "PAID",
    minHoldingUnits: 0,
    benefits: ["Demos first", "Monthly Q&A", "Lyric breakdowns"],
  });
  await backstage.subscribe(fans[0]!.id, tier.id);
  await backstage.subscribe(fans[2]!.id, tier.id);
  await backstage.createPost(miraUser.id, {
    title: "Studio diary #1 — the video treatment",
    body: "Storyboard attached. We shoot the rooftop scene first. You funded this — every frame is yours too.",
    preview: "The treatment is done. Members see everything…",
    visibility: "MEMBERS",
  });
  await backstage.createPost(miraUser.id, {
    title: "Open thread: pick the b-side",
    body: "Two demos, one slot on the single. Members vote in the comments.",
    preview: "",
    visibility: "PUBLIC_PREVIEW",
  });
  await drops.createDrop(miraUser.id, {
    title: "Unreleased demo — 'Neon Rain'",
    description: "The song that started everything, rough mix, 92 seconds. Link inside.",
    previewText: "First listen of the demo that went viral.",
    priceCents: 2_000,
    quantityLimit: 100,
  });
  const miraDrop = await prisma.drop.findFirstOrThrow({ where: { creatorId: mira.id } });
  await drops.purchaseDrop(fans[0]!.id, miraDrop.id);
  await drops.purchaseDrop(fans[3]!.id, miraDrop.id);
  await drops.tip(fans[1]!.id, mira.id, 2_500, "That bridge. THAT BRIDGE.");
  const requestItem = await requests.configureItem(miraUser.id, {
    title: "Private listening party (video call)",
    priceCents: 25_000,
    deliveryDays: 14,
  });
  await requests.orderItem(fans[2]!.id, requestItem.id);
  const paidMsg = await messages.sendPaidMessage(fans[1]!.id, {
    creatorId: mira.id,
    priceCents: 1_500,
    body: "Would you ever do an acoustic version of Neon Rain? I'd fund a whole session for it.",
  });
  await messages.respondToMessage(miraUser.id, paidMsg.id, "Already recording it — backers hear it first next week.");
  const quest = await streetteam.createQuest(miraUser.id, {
    title: "Clip the chorus for TikTok",
    description: "Cut a 15s clip of the chorus from the live session and post it with #BackTheRise.",
    type: "CONTENT",
    proofType: "LINK",
    rewardType: "XP",
    rewardAmount: 40,
    maxCompletions: 100,
  });
  const completion = await streetteam.submitCompletion(fans[0]!.id, quest.id, "https://tiktok.com/@novafan/clip1");
  await streetteam.reviewCompletion(miraUser.id, completion.id, "APPROVED");
  await streetteam.submitCompletion(fans[5]!.id, quest.id, "https://tiktok.com/@moonlit/clip2");

  console.log("seed: KAI reaches Launching Soon…");
  const kai = await claim.startClaim(kaiUser.id, kaiDraft.id);
  await claim.submitVerification(kaiUser.id, kai.id, {
    bio: "I ship an AI tool every week. Next week, we ship together.",
    story:
      "Fifty-two weeks, fifty-two launches. The next one is the big one — a public beta with room for ten thousand users, and my backers run the launch war-room.",
    socialLinks: ["https://x.com/kai"],
    followerCount: 42_000,
    termsAccepted: true,
  });
  await claim.approveVerification(admin.id, kai.id);
  await claim.configurePerks(kaiUser.id, kai.id, {
    perks: ["Beta access before anyone", "Backer-only build logs", "Launch war-room Discord"],
  });
  await claim.configurePayout(kaiUser.id, kai.id);
  await missions.createMission(kaiUser.id, {
    title: "Beta Launch Week",
    goalCents: 800_000,
    deadlineDays: 21,
    useOfFunds: "Server costs for 10k beta users, launch video, Product Hunt push",
    rewardTiers: [
      { thresholdCents: 2_500, reward: "Beta seat, day one" },
      { thresholdCents: 10_000, reward: "Founding user badge in-app" },
    ],
    refundRule: "KEEP_WHAT_RAISED",
  });
  await claim.approveLaunchKit(admin.id, kai.id);
  await claim.scheduleLaunch(admin.id, kai.id, new Date(Date.now() + 36 * 3600_000));

  console.log("seed: crews + scores…");
  const crew1 = await streetteam.createCrew(fans[0]!.id, {
    name: "Tokyo Angels",
    description: "We fund first music videos. All of them.",
  });
  await streetteam.joinCrew(fans[1]!.id, crew1.id);
  await streetteam.joinCrew(fans[2]!.id, crew1.id);
  const crew2 = await streetteam.createCrew(fans[4]!.id, {
    name: "AI Builder Mafia",
    description: "Backing every builder who ships weekly.",
  });
  await streetteam.joinCrew(fans[5]!.id, crew2.id);
  await streetteam.rankCrews();
  await scores.computeAllTasteScores();
  await scores.computeAllFameScores();

  await assertLedgerBalanced();
  const [userCount, draftCount, eventCount] = await Promise.all([
    prisma.user.count(),
    prisma.draftProfile.count(),
    prisma.event.count(),
  ]);
  console.log(`seed: done — ${userCount} users, ${draftCount} draft profiles, ${eventCount} feed events, ledger balanced ✓`);
  console.log(`seed: sign in as admin / mira_irl / kai_builds / novafan — password: ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
