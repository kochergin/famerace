import Link from "next/link";
import { redirect } from "next/navigation";
import { recap as recapMod } from "@famerace/core";
import { RecapStory, type RecapSlide } from "@/components/recap-story";
import { EmptyState } from "@/components/ui";
import { money } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Season Recap — FameRace" };

function whenLabel(at: Date): string {
  const days = Math.floor((Date.now() - at.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** Season Recap (PRD §0B: Spotify Wrapped pillar) — your season as a story. */
export default async function RecapPage() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const data = await recapMod.seasonRecap(user.id);

  if (!data.hasStory) {
    return (
      <div className="mx-auto max-w-md py-12">
        <EmptyState
          title="Your story has no first scene yet"
          hint="Back one rising creator and your Season Recap unlocks."
        />
        <Link
          href="/draft"
          className="mt-4 block rounded bg-lime px-4 py-3 text-center font-bold uppercase tracking-wide text-ink hover:brightness-110"
        >
          Open the Draft Board
        </Link>
      </div>
    );
  }

  const slides: RecapSlide[] = [
    { kind: "cover", name: data.user.displayName, username: data.user.username, avatarUrl: data.user.avatarUrl },
  ];
  if (data.firstMove) {
    slides.push({
      kind: "first",
      name: data.firstMove.name,
      avatarUrl: data.firstMove.avatarUrl,
      whenLabel: whenLabel(data.firstMove.at),
      amountLabel: `${money(data.firstMove.amountCents)} pledged`,
    });
  }
  slides.push({
    kind: "numbers",
    items: [
      { label: "Creators backed", value: data.stats.backedCount, accent: "text-lime" },
      { label: "Genesis passes", value: data.stats.passCount, accent: "text-gold" },
      { label: "Missions funded", value: data.stats.missionsFunded, accent: "text-volt" },
      { label: "Quests done", value: data.stats.questsDone, accent: "text-pink" },
    ],
  });
  if (data.topHolding) {
    slides.push({
      kind: "call",
      name: data.topHolding.name,
      avatarUrl: data.topHolding.avatarUrl,
      ticker: data.topHolding.ticker,
      backerRank: data.topHolding.backerRank,
      holderCount: data.topHolding.holderCount,
      fameScore: data.topHolding.fameScore,
    });
  }
  if (data.crew || data.stats.questsDone > 0 || data.stats.xp > 0) {
    slides.push({
      kind: "crowd",
      crewName: data.crew?.name ?? null,
      crewRank: data.crew?.rank ?? null,
      xp: data.stats.xp,
      quests: data.stats.questsDone,
    });
  }
  if (data.taste) {
    slides.push({
      kind: "taste",
      score: data.taste.score,
      rank: data.taste.rank,
      ofUsers: data.taste.ofUsers,
      drivers: Array.isArray(data.taste.drivers) ? (data.taste.drivers as { label: string; points: number }[]) : [],
    });
  }
  slides.push({ kind: "outro", username: data.user.username });

  return <RecapStory slides={slides} username={data.user.username} />;
}
