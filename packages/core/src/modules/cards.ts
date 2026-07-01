import { prisma, type CardTemplate } from "@famerace/db";
import { notFound } from "../errors";

// Share Card Generator (PRD §0A.13, §9A.12): 12 templates rendered as
// self-contained 1200×630 SVGs (X/OG aspect). No font or image fetches —
// cards render identically everywhere and generate in microseconds.
// Distribution infrastructure, not a side feature.

const W = 1200;
const H = 630;
const COLORS = {
  ink: "#060608",
  panel: "#131318",
  edge: "#2a2a33",
  chalk: "#f2f1ec",
  muted: "#8f8fa0",
  lime: "#c9f73a",
  pink: "#ff3d8d",
  volt: "#3d7bff",
  gold: "#f0c33c",
} as const;

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type CardContent = {
  accent: string;
  kicker: string;
  headline: string;
  sub?: string;
  stats?: { label: string; value: string }[];
  footer?: string;
};

function renderSvg(content: CardContent): string {
  const { accent, kicker, headline, sub, stats = [], footer } = content;
  const statBlocks = stats
    .slice(0, 3)
    .map((stat, i) => {
      const x = 80 + i * 360;
      return `
    <text x="${x}" y="470" font-family="monospace" font-size="52" font-weight="bold" fill="${accent}">${esc(stat.value)}</text>
    <text x="${x}" y="505" font-family="Arial, sans-serif" font-size="20" letter-spacing="2" fill="${COLORS.muted}">${esc(stat.label.toUpperCase())}</text>`;
    })
    .join("");

  // Headline auto-shrink for long names.
  const headlineSize = headline.length > 18 ? (headline.length > 30 ? 64 : 84) : 110;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="0%" r="90%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.16"/>
      <stop offset="60%" stop-color="${COLORS.ink}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${COLORS.ink}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="none" stroke="${COLORS.edge}" stroke-width="2" rx="16"/>
  <rect x="24" y="24" width="${W - 48}" height="10" fill="${accent}" rx="5"/>
  <text x="80" y="130" font-family="Arial, sans-serif" font-size="26" font-weight="bold" letter-spacing="6" fill="${accent}">${esc(kicker.toUpperCase())}</text>
  <text x="80" y="${130 + headlineSize + 40}" font-family="Arial Narrow, Arial, sans-serif" font-size="${headlineSize}" font-weight="900" letter-spacing="1" fill="${COLORS.chalk}">${esc(headline.toUpperCase())}</text>
  ${sub ? `<text x="80" y="${130 + headlineSize + 100}" font-family="Arial, sans-serif" font-size="30" fill="${COLORS.muted}">${esc(sub)}</text>` : ""}
  ${statBlocks}
  <text x="80" y="${H - 56}" font-family="Arial Narrow, Arial, sans-serif" font-size="30" font-weight="900" letter-spacing="3" fill="${COLORS.chalk}">FAMERACE</text>
  <text x="245" y="${H - 56}" font-family="Arial, sans-serif" font-size="26" fill="${accent}">— ${esc(footer ?? "Back the rise.")}</text>
</svg>`;
}

const dollars = (raw: number | bigint) => {
  const cents = Number(raw);
  return `$${cents >= 100_000 ? `${Math.round(cents / 100_000) / 10}k` : (cents / 100).toLocaleString("en-US")}`;
};

/**
 * Build a card from live data. `subjectRef` semantics per template:
 * creator handle, draft id, mission id, username or crew id.
 */
export async function buildCard(template: CardTemplate, subjectRef: string, viewerUserId?: string): Promise<CardContent> {
  switch (template) {
    case "DRAFT_RANK": {
      const profile = await prisma.draftProfile.findUnique({ where: { id: subjectRef } });
      if (!profile) throw notFound("Draft profile");
      const higher = await prisma.draftProfile.count({
        where: {
          moderationStatus: "APPROVED",
          pledgedDemandTotal: { gt: profile.pledgedDemandTotal },
        },
      });
      return {
        accent: COLORS.volt,
        kicker: `Draft Rank #${higher + 1}`,
        headline: profile.nameOrHandle,
        sub: "The internet is drafting 100 future stars.",
        stats: [
          { label: "Fans waiting", value: String(profile.fanCount) },
          { label: "Pledged", value: dollars(profile.pledgedDemandTotal) },
          { label: "Invites", value: String(profile.inviteCount) },
        ],
      };
    }
    case "CLAIM": {
      const profile = await prisma.draftProfile.findUnique({ where: { id: subjectRef } });
      if (!profile) throw notFound("Draft profile");
      return {
        accent: COLORS.lime,
        kicker: "Claimed",
        headline: profile.nameOrHandle,
        sub: `We got ${profile.nameOrHandle} to claim FameRace.`,
        stats: [
          { label: "Fans waiting", value: String(profile.fanCount) },
          { label: "Demand", value: dollars(profile.pledgedDemandTotal) },
        ],
      };
    }
    case "MISSION": {
      const mission = await prisma.mission.findUnique({
        where: { id: subjectRef },
        include: { creator: { select: { displayName: true } } },
      });
      if (!mission) throw notFound("Mission");
      const pct = Math.min(100, Math.round((mission.fundedCents / mission.goalCents) * 100));
      return {
        accent: COLORS.gold,
        kicker: `${pct}% funded`,
        headline: mission.title,
        sub: `${mission.creator.displayName}'s mission — fans are making it happen.`,
        stats: [
          { label: "Raised", value: dollars(mission.fundedCents) },
          { label: "Goal", value: dollars(mission.goalCents) },
        ],
      };
    }
    case "BACKER": {
      const pass = await prisma.genesisPass.findFirst({
        where: { userId: viewerUserId, creator: { handle: subjectRef } },
        include: { creator: { select: { displayName: true } } },
      });
      if (!pass) throw notFound("Genesis Pass");
      return {
        accent: COLORS.lime,
        kicker: `Genesis Backer #${pass.backerNumber}`,
        headline: pass.creator.displayName,
        sub: `I backed ${pass.creator.displayName} before the world noticed.`,
      };
    }
    case "BACKER_WALL": {
      const holding = await prisma.holding.findFirst({
        where: { userId: viewerUserId, market: { creator: { handle: subjectRef } } },
        include: { market: { include: { creator: { select: { displayName: true } } } } },
      });
      if (!holding?.backerRank) throw notFound("Backer Wall spot");
      return {
        accent: COLORS.gold,
        kicker: `Backer #${holding.backerRank}`,
        headline: holding.market.creator.displayName,
        sub: `I'm on the Genesis Wall. Proof of early, forever.`,
      };
    }
    case "BREAKOUT": {
      const creator = await prisma.creator.findUnique({
        where: { handle: subjectRef },
        include: { market: true },
      });
      if (!creator) throw notFound("Creator");
      return {
        accent: COLORS.pink,
        kicker: "Breakout",
        headline: creator.displayName,
        sub: "Genesis Backers were early.",
        stats: [
          { label: "Fame Score", value: String(creator.fameScore) },
          { label: "Holders", value: String(creator.market?.holderCount ?? 0) },
          { label: "Volume", value: dollars(creator.market?.volumeTotalCents ?? 0) },
        ],
      };
    }
    case "BATTLE": {
      const [handleA, handleB] = subjectRef.split(":");
      const [a, b] = await Promise.all([
        prisma.creator.findUnique({ where: { handle: handleA ?? "" } }),
        prisma.creator.findUnique({ where: { handle: handleB ?? "" } }),
      ]);
      if (!a || !b) throw notFound("Creators");
      return {
        accent: COLORS.pink,
        kicker: "Who breaks out first?",
        headline: `${a.displayName} vs ${b.displayName}`,
        stats: [
          { label: `${a.displayName} fame`, value: String(a.fameScore) },
          { label: `${b.displayName} fame`, value: String(b.fameScore) },
        ],
      };
    }
    case "CREATOR_REVENUE": {
      const creator = await prisma.creator.findUnique({ where: { handle: subjectRef } });
      if (!creator) throw notFound("Creator");
      const [backerCount, funded] = await Promise.all([
        prisma.genesisPass.count({ where: { creatorId: creator.id } }),
        prisma.mission.aggregate({ where: { creatorId: creator.id }, _sum: { fundedCents: true } }),
      ]);
      return {
        accent: COLORS.gold,
        kicker: "Fans funded this",
        headline: creator.displayName,
        sub: `${backerCount} backers are funding the next move.`,
        stats: [
          { label: "Mission funding", value: dollars(funded._sum.fundedCents ?? 0) },
          { label: "Genesis backers", value: String(backerCount) },
        ],
      };
    }
    case "SCOUT": {
      const user = await prisma.user.findUnique({ where: { username: subjectRef } });
      if (!user) throw notFound("User");
      const claimed = await prisma.scoutNomination.count({
        where: { scoutUserId: user.id, claimResult: "CLAIMED" },
      });
      return {
        accent: COLORS.volt,
        kicker: "Genesis Scout",
        headline: `@${user.username}`,
        sub: "I find them before FameRace does.",
        stats: [{ label: "Creators claimed from my calls", value: String(claimed) }],
        footer: "Find them early.",
      };
    }
    case "TASTE_SCORE": {
      const user = await prisma.user.findUnique({ where: { username: subjectRef } });
      if (!user) throw notFound("User");
      const taste = await prisma.tasteScore.findFirst({
        where: { userId: user.id },
        orderBy: { computedAt: "desc" },
      });
      return {
        accent: COLORS.lime,
        kicker: "Taste Score",
        headline: String(taste?.score ?? 0),
        sub: `@${user.username} finds them early and can prove it.`,
        stats: [
          { label: "Rank", value: `#${taste?.rank ?? "—"}` },
          { label: "Percentile", value: `${Math.round(taste?.percentile ?? 0)}` },
        ],
        footer: "Prove your taste.",
      };
    }
    case "ROSTER": {
      const user = await prisma.user.findUnique({ where: { username: subjectRef } });
      if (!user) throw notFound("User");
      const [entries, passes, missions] = await Promise.all([
        prisma.rosterEntry.count({ where: { userId: user.id } }),
        prisma.genesisPass.count({ where: { userId: user.id } }),
        prisma.missionContribution.groupBy({ by: ["missionId"], where: { userId: user.id, refunded: false } }),
      ]);
      return {
        accent: COLORS.pink,
        kicker: "Season 1 Roster",
        headline: `@${user.username}`,
        stats: [
          { label: "On roster", value: String(entries) },
          { label: "Backed", value: String(passes) },
          { label: "Missions funded", value: String(missions.length) },
        ],
      };
    }
    case "CREW": {
      const crew = await prisma.crew.findUnique({
        where: { id: subjectRef },
        include: { _count: { select: { members: true } } },
      });
      if (!crew) throw notFound("Crew");
      return {
        accent: COLORS.volt,
        kicker: `Crew rank #${crew.rank ?? "—"}`,
        headline: crew.name,
        stats: [
          { label: "Members", value: String(crew._count.members) },
          { label: "Crew score", value: String(crew.score) },
          { label: "Quests done", value: String(crew.questsCompleted) },
        ],
      };
    }
    default:
      throw notFound("Card template");
  }
}

/** Render + record (moderation/deep-link record per §9A.12). */
export async function generateCard(
  template: CardTemplate,
  subjectRef: string,
  viewerUserId?: string,
): Promise<{ svg: string; deepLink: string }> {
  const content = await buildCard(template, subjectRef, viewerUserId);
  const deepLink = `/card/${template.toLowerCase()}/${encodeURIComponent(subjectRef)}`;
  await prisma.shareCard.create({
    data: {
      userId: viewerUserId ?? null,
      template,
      subjectRef,
      title: content.headline,
      subtitle: content.sub ?? null,
      stats: content.stats ?? [],
      deepLink,
    },
  });
  return { svg: renderSvg(content), deepLink };
}
