import Link from "next/link";
import { notFound } from "next/navigation";
import { DomainError, roster as rosterMod } from "@famerace/core";
import { SectionTitle, Stat } from "@/components/ui";
import { num, timeAgo } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { logoutAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [profile, viewer] = await Promise.all([
    rosterMod.publicProfile(username).catch((e) => {
      if (e instanceof DomainError) return null;
      throw e;
    }),
    currentUser(),
  ]);
  if (!profile) notFound();
  const { user, taste, nominations, claimed, roster } = profile;
  const isSelf = viewer?.id === user.id;
  const crew = user.crewMemberships[0]?.crew;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display text-5xl">@{user.username}</h1>
          <p className="mt-1 text-muted">
            {user.displayName} · joined {timeAgo(user.createdAt)}
            {crew ? (
              <>
                {" "}
                · crew{" "}
                <Link href={`/crews/${crew.id}`} className="text-volt underline">
                  {crew.name}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {isSelf ? (
          <form action={logoutAction}>
            <button className="rounded border border-edge px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted hover:border-pink hover:text-pink">
              Sign out
            </button>
          </form>
        ) : null}
      </div>

      <div className="card mt-6 grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Stat label="Taste Score" value={taste?.score ?? 0} accent="text-lime" />
        <Stat label="Nominations" value={num(nominations)} accent="text-volt" />
        <Stat label="Claimed from calls" value={num(claimed)} />
        <Stat label="XP" value={num(user.xp)} />
      </div>

      {user.badges.length > 0 ? (
        <section className="mt-6">
          <SectionTitle>Badges — permanent proof</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {user.badges.map((badge) => (
              <span
                key={badge.id}
                className={`chip border ${
                  badge.badgeType === "GENESIS_BACKER"
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : badge.badgeType === "GENESIS_SCOUT"
                      ? "border-volt/40 bg-volt/10 text-volt"
                      : "border-lime/40 bg-lime/10 text-lime"
                }`}
              >
                {badge.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <SectionTitle
          right={
            <a href={`/card/scout/${user.username}`} target="_blank" className="text-xs uppercase text-muted hover:text-volt">
              Scout card →
            </a>
          }
        >
          Roster ({roster.entries.length})
        </SectionTitle>
        {roster.entries.length === 0 ? (
          <p className="card p-5 text-sm text-muted">Nothing on the roster yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {roster.entries.map(({ entry, creator, draft }) => {
              const href = creator ? `/c/${creator.handle}` : draft ? `/draft/${draft.id}` : "#";
              const name = creator?.displayName ?? draft?.nameOrHandle ?? "?";
              return (
                <Link key={entry.id} href={href} className="chip border border-edge text-chrome hover:border-pink">
                  {name}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
