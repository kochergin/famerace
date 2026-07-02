import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { calls as callsMod } from "@famerace/core";
import type { CallSide } from "@famerace/db";
import { CallCard, OddsBar } from "@/components/call-card";
import { Confetti } from "@/components/confetti";
import { Monogram } from "@/components/monogram";
import { EmptyState, SectionTitle } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { num } from "@/lib/format";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Calls — FameRace" };

async function stakeAction(formData: FormData) {
  "use server";
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect("/calls", async () => {
    await callsMod.stake(
      user.id,
      String(formData.get("callId")),
      String(formData.get("side")) as CallSide,
      Math.round(Number(formData.get("points") || 0)),
    );
  });
  revalidatePath("/calls");
  redirect("/calls?called=1");
}

/** Calls board: time-boxed predictions on creators, staked with Taste Points.
 *  Skill, not money — the leaderboard currency is being right early. */
export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ called?: string; error?: string }>;
}) {
  const { called, error } = await searchParams;
  const [open, resolved, user] = await Promise.all([
    callsMod.openCalls(),
    callsMod.recentlyResolved(6),
    currentUser(),
  ]);
  const myStakes = user ? await callsMod.stakesFor(user.id, [...open, ...resolved].map((c) => c.id)) : new Map();
  const record = user ? await callsMod.callRecord(user.id) : null;

  return (
    <div className="mx-auto max-w-3xl">
      {called ? <Confetti fireKey="called" /> : null}
      {called ? (
        <p className="story-in mb-4 rounded border border-lime/40 bg-lime/10 px-3 py-2 text-sm text-lime">
          Call placed. It resolves automatically at the deadline — being right pays from the other
          side of the board.
        </p>
      ) : null}
      {error ? <p className="mb-4 rounded border border-pink/40 bg-pink/10 px-3 py-2 text-sm text-pink">{error}</p> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-5xl">Calls</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Public predictions on rising creators, staked with Taste Points — earned by backing,
            funding and quests, never bought. Every call resolves automatically from live platform
            numbers.
          </p>
        </div>
        {user ? (
          <div className="card px-4 py-3 text-right">
            <p className="stat text-2xl font-bold text-lime">{num(user.points)}</p>
            <p className="text-[10px] uppercase tracking-widest text-muted">Taste Points</p>
            {record && record.wins + record.losses > 0 ? (
              <p className="stat mt-1 text-xs text-muted">
                {record.wins}W–{record.losses}L · {record.netPoints >= 0 ? "+" : ""}
                {num(record.netPoints)} net
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6 space-y-4">
        {open.length === 0 ? (
          <EmptyState title="No open calls right now" hint="New calls open as creators hit milestones." />
        ) : (
          open.map((call) => (
            <CallCard
              key={call.id}
              call={call}
              stakeAction={stakeAction}
              myStake={myStakes.get(call.id)}
              signedIn={Boolean(user)}
              myPoints={user?.points}
            />
          ))
        )}
      </div>

      {resolved.length > 0 ? (
        <section className="mt-10">
          <SectionTitle>Recently resolved</SectionTitle>
          <div className="space-y-3">
            {resolved.map((call) => {
              const mine = myStakes.get(call.id);
              const won = mine && ((call.status === "RESOLVED_YES" && mine.side === "YES") || (call.status === "RESOLVED_NO" && mine.side === "NO"));
              return (
                <div key={call.id} className="card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/c/${call.creator.handle}`} className="flex min-w-0 items-center gap-2 hover:opacity-80">
                      <Monogram name={call.creator.displayName} src={call.creator.avatarUrl} size="sm" />
                      <span className="min-w-0 truncate text-sm text-chalk">{call.question}</span>
                    </Link>
                    <span className={`chip shrink-0 ${call.status === "RESOLVED_YES" ? "bg-lime/15 text-lime" : "bg-pink/15 text-pink"}`}>
                      {call.status === "RESOLVED_YES" ? "YES ✓" : "NO ✓"}
                    </span>
                  </div>
                  <div className="mt-2">
                    <OddsBar yesPoints={call.yesPoints} noPoints={call.noPoints} />
                  </div>
                  {won ? (
                    <a
                      href={`/card/called_it/${call.id}`}
                      target="_blank"
                      className="chip mt-2 inline-flex border border-lime/50 bg-lime/10 text-lime hover:bg-lime/20"
                    >
                      Called it ✓ — get the receipt ↓
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
