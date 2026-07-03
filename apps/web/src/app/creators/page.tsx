import Link from "next/link";
import { redirect } from "next/navigation";
import { claim, copy } from "@famerace/core";
import { prisma } from "@famerace/db";
import { LaunchRace } from "@/components/launch-race";
import { LogoMark } from "@/components/logo";
import { withErrorRedirect } from "@/lib/action";
import { money } from "@/lib/format";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "For creators — FameRace",
  description: "Money today. Zero new content. Your audience becomes your backers.",
};

async function launchAction(formData: FormData) {
  "use server";
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect("/creators", async () => {
    await claim.selfLaunch(user.id, {
      nameOrHandle: String(formData.get("nameOrHandle") ?? ""),
      category: String(formData.get("category") ?? ""),
      thesis: String(formData.get("thesis") ?? ""),
      externalLink: String(formData.get("externalLink") ?? "") || undefined,
    });
  });
  redirect("/dashboard?claimed=1");
}

/* The creator door. Everything the fan side never says out loud:
   money today, zero new content, status up — and the crowd does the work. */
export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [params, user, pledged, liveCount] = await Promise.all([
    searchParams,
    currentUser(),
    prisma.fanDemandOrder.aggregate({
      where: { paymentAuthStatus: { in: ["AUTHORIZED", "CAPTURED"] } },
      _sum: { amountCents: true },
    }),
    prisma.creator.count({ where: { status: "LIVE" } }),
  ]);
  const existing = user ? await claim.creatorForUser(user.id) : null;
  const pledgedLabel = money(pledged._sum.amountCents ?? 0, { compact: true });

  const PILLARS = [
    {
      title: "Money today",
      text: "An instant advance against your audience's pledged demand — repaid only from what you earn here. No masters, no contract, no recourse.",
      tone: "text-lime",
    },
    {
      title: "Zero new content",
      text: "Your crowd invests in your rise, not a content treadmill. Backstage runs on the demos and outtakes you already make.",
      tone: "text-gold",
    },
    {
      title: "Status up, not down",
      text: "This is a draft, not a paywall. Getting backed reads like getting signed — your fans become investors with receipts, and early ones thank you.",
      tone: "text-pink",
    },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl">
      <section className="relative overflow-x-clip py-10 text-center">
        <span aria-hidden className="beam beam-a left-[8%]" />
        <span aria-hidden className="beam beam-pink beam-b right-[8%]" />
        <LogoMark glow className="mx-auto h-11 w-11" />
        <p className="stat mt-5 text-[10px] uppercase tracking-[0.35em] text-muted">For creators · Season 1 open</p>
        <h1 className="display mx-auto mt-3 max-w-2xl text-5xl leading-tight sm:text-7xl">
          You sell nothing.
          <br />
          <span className="display-hot">They back your rise.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
          {pledgedLabel} already pledged this season · {liveCount} creator{liveCount === 1 ? "" : "s"} live on the curve
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {PILLARS.map((pillar) => (
          <div key={pillar.title} className="card p-5">
            <h3 className={`display text-2xl ${pillar.tone}`}>{pillar.title}</h3>
            <p className="mt-2 text-sm text-muted">{pillar.text}</p>
          </div>
        ))}
      </div>

      {/* The seven ways money reaches you */}
      <section className="card mt-8 p-6">
        <h2 className="display text-2xl">How the money works</h2>
        <ol className="mt-3 grid gap-x-8 gap-y-2 text-sm text-muted sm:grid-cols-2">
          {[
            ["Season advance", "instant cash against pledged demand"],
            ["Trading fees", "a cut of every trade on your name — passive"],
            ["Genesis passes", "day-one status your fans race to claim"],
            ["Backstage", "members pay for your process, not new work"],
            ["Drops", "one-off unlocks: demos, cuts, first listens"],
            ["Missions", "the crowd funds the video, the EP, the tour"],
          ].map(([title, text]) => (
            <li key={title} className="flex gap-2">
              <span aria-hidden className="text-lime">▸</span>
              <span>
                <span className="font-bold text-chalk">{title}</span> — {text}
              </span>
            </li>
          ))}
        </ol>
        <p className="stat mt-4 border-t border-edge pt-3 text-xs text-muted">
          0% platform fee for the founding season · {copy.footerLegal.split(".")[0]}.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="display text-3xl">Launch in one move</h2>
        <p className="mb-5 mt-1 text-sm text-muted">
          Your page builds itself while you type. Ship it, drop the link in bio, and the crowd takes it from there.
        </p>
        {existing ? (
          <div className="card border-lime/40 p-6 text-center">
            <p className="display text-2xl">Your race is already running.</p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block rounded bg-lime px-6 py-3 font-bold uppercase tracking-wide text-ink hover:brightness-110"
            >
              Open your command center →
            </Link>
          </div>
        ) : (
          <LaunchRace action={launchAction} signedIn={Boolean(user)} error={params.error} />
        )}
      </section>
    </div>
  );
}
