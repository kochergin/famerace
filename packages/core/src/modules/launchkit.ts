import { prisma, type Creator, type Mission } from "@famerace/db";
import { copy } from "../copy";
import { notFound } from "../errors";

// Creator Launch Kit (PRD §9.18, §0A.11): auto-generated, copy-ready launch
// content. Every template that involves creator earnings embeds the FTC
// disclosure line — compliance is built in, not left to memory (§15.6).

export type KitBlock = { id: string; label: string; content: string };

export function generateKit(
  creator: Pick<Creator, "displayName" | "handle">,
  mission: Pick<Mission, "title" | "goalCents"> | null,
): KitBlock[] {
  const name = creator.displayName;
  const url = `famerace.fun/c/${creator.handle}`;
  const missionLine = mission
    ? `My first mission: ${mission.title.toLowerCase().startsWith("fund") ? mission.title : `fund ${mission.title}`} — goal $${Math.round(mission.goalCents / 100).toLocaleString("en-US")}.`
    : "My first mission goes live with the launch.";
  const disclosure = copy.creatorDisclosure;

  return [
    {
      id: "x_post",
      label: "X / Twitter launch post",
      content: `I'm launching on FameRace.\n${missionLine}\nGenesis Backers get early access, backstage drops and permanent Day One status.\n\nBack the rise → ${url}\n\n${disclosure}`,
    },
    {
      id: "ig_story",
      label: "Instagram Story frames (3)",
      content: `Frame 1: "The internet drafted me." — dark background, your face, FameRace draft card screenshot.\nFrame 2: "${missionLine}" — mission progress bar screenshot.\nFrame 3: "Day One backers get proof forever." — link sticker → ${url}\nAdd to every frame: ${disclosure}`,
    },
    {
      id: "tiktok_script",
      label: "TikTok script (30s)",
      content: `Hook (0-3s): "Strangers on the internet just drafted me like an athlete."\nContext (3-12s): show the FameRace draft profile — fans waiting, demand pledged, scouts.\nStakes (12-22s): "${missionLine}"\nCTA (22-30s): "If you've ever said 'I found them first' — prove it. Link in bio."\nCaption: Back the rise → ${url} ${disclosure}`,
    },
    {
      id: "telegram",
      label: "Telegram / community announcement",
      content: `Big one: I'm launching on FameRace this week.\n\n${missionLine}\n\nWhat you get for backing early:\n• Genesis Backer badge + permanent wall spot\n• Backstage demos before anyone\n• Your name on the mission when it ships\n\n${url}\n\n${disclosure}`,
    },
    {
      id: "discord",
      label: "Discord announcement",
      content: `@everyone — the FameRace launch is real.\n\n${missionLine}\n\nGenesis window opens at launch: earliest backers get the lowest numbers, and those never change. Confirmation windows and refunds are built in — read the terms on the page.\n\n${url}\n\n${disclosure}`,
    },
    {
      id: "mission_announcement",
      label: "Mission announcement",
      content: mission
        ? `${mission.title} — LIVE.\nGoal: $${Math.round(mission.goalCents / 100).toLocaleString("en-US")}.\nEvery backer gets mission credit, tier rewards and proof they helped make it happen.\n${url}\n\n${disclosure}`
        : `Mission announcement unlocks once your first mission is configured.`,
    },
    {
      id: "thank_you",
      label: "Thank-you-backers post",
      content: `To my first backers: you didn't follow — you built.\n[NUMBER] of you funded this. Permanent Genesis credit is yours; the proof is on the wall.\nThis is what early belief can do.\n\n${disclosure}`,
    },
    {
      id: "weekly_prompt",
      label: "Weekly update prompts",
      content: `Week 1: What did backers make possible this week? (one concrete thing + photo)\nWeek 2: Show the mission money at work — receipts, sessions, drafts.\nWeek 3: Shout out the Street Team's best quest completions.\nWeek 4: Milestone recap + what's next. Every update = one Backstage post + one public teaser.`,
    },
    {
      id: "disclosure",
      label: "Disclosure language (required on earning posts)",
      content: disclosure,
    },
  ];
}

/** Kit for the signed-in creator, from live data. */
export async function kitForUser(userId: string): Promise<{ creator: Creator; blocks: KitBlock[] }> {
  const creator = await prisma.creator.findFirst({
    where: { userId },
    include: { missions: { where: { status: { in: ["UNDER_REVIEW", "LIVE", "FUNDED"] } }, take: 1 } },
  });
  if (!creator) throw notFound("Creator profile");
  return { creator, blocks: generateKit(creator, creator.missions[0] ?? null) };
}
