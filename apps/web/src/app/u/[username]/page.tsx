import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { calls as callsMod, DomainError, roster as rosterMod, safety } from "@famerace/core";
import { prisma } from "@famerace/db";
import { ReportForm } from "@/components/report";
import { withErrorRedirect } from "@/lib/action";
import { Monogram } from "@/components/monogram";
import { TiltCard } from "@/components/tilt-card";
import { EmptyRow, SectionTitle, Stat } from "@/components/ui";
import { num, timeAgo } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { logoutAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const image = `/card/taste_score/${username}/png`;
  return {
    title: `@${username} — FameRace`,
    description: "Find them early. Back their rise. Prove your taste.",
    openGraph: { images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

async function blockAction(formData: FormData) {
  "use server";
  const username = String(formData.get("username"));
  const { requireCurrentUser } = await import("@/lib/session");
  const viewer = await requireCurrentUser().catch(() => null);
  if (!viewer) redirect("/join");
  await withErrorRedirect(`/u/${username}`, async () => {
    if (formData.get("unblock") === "1") await safety.unblockUser(viewer.id, username);
    else await safety.blockUser(viewer.id, username);
  });
  revalidatePath(`/u/${username}`);
  redirect(`/u/${username}`);
}

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
  const callRecord = await callsMod.callRecord(user.id);
  const isSelf = viewer?.id === user.id;
  const crew = user.crewMemberships[0]?.crew;
  const blocked =
    viewer && !isSelf
      ? (await prisma.userBlock.findUnique({
          where: { blockerUserId_blockedUserId: { blockerUserId: viewer.id, blockedUserId: user.id } },
        })) !== null
      : false;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <Monogram name={user.username} src={user.avatarUrl} size="xl" />
          <div className="min-w-0">
          <h1 className="display break-all text-3xl sm:text-5xl">@{user.username}</h1>
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
        </div>
        {isSelf ? (
          <div className="flex items-center gap-2">
            <Link
              href="/recap"
              className="rounded border border-pink/50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-pink hover:bg-pink/10"
            >
              ▶ Recap
            </Link>
            <Link
              href="/settings"
              className="rounded border border-edge px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted hover:border-lime hover:text-lime"
            >
              Settings
            </Link>
            <form action={logoutAction}>
              <button className="rounded border border-edge px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted hover:border-pink hover:text-pink">
                Sign out
              </button>
            </form>
          </div>
        ) : viewer ? (
          <div className="text-right">
            <form action={blockAction}>
              <input type="hidden" name="username" value={user.username} />
              {blocked ? <input type="hidden" name="unblock" value="1" /> : null}
              <button className="rounded border border-edge px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted hover:border-pink hover:text-pink">
                {blocked ? "Unblock" : "Block"}
              </button>
            </form>
            <ReportForm objectType="User" objectId={user.id} backTo={`/u/${user.username}`} />
          </div>
        ) : null}
      </div>

      <div className="card mt-6 grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Stat label="Taste Score" value={taste?.score ?? 0} accent="text-lime" />
        <Stat label="Nominations" value={num(nominations)} accent="text-volt" />
        <Stat label="Scout claims" value={num(claimed)} />
        <Stat
          label="Call record"
          value={callRecord.wins + callRecord.losses > 0 ? `${callRecord.wins}W–${callRecord.losses}L` : "—"}
          accent={callRecord.netPoints > 0 ? "text-lime" : undefined}
        />
      </div>

      {user.badges.length > 0 ? (
        <section className="mt-6">
          <SectionTitle>Badges — permanent proof</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {user.badges.map((badge) => (
              <TiltCard key={badge.id} max={10}>
                <span
                  className={`badge-card chip border px-3 py-1.5 ${
                    badge.badgeType === "GENESIS_BACKER"
                      ? "border-gold/50 bg-gold/10 text-gold"
                      : badge.badgeType === "GENESIS_SCOUT"
                        ? "border-volt/50 bg-volt/10 text-volt"
                        : "border-lime/50 bg-lime/10 text-lime"
                  }`}
                >
                  {badge.label}
                </span>
              </TiltCard>
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
          <div className="card p-5">
            <EmptyRow
              glyph="⭐"
              title="No one on the roster yet — the board is full of futures."
              action={<Link href="/draft" className="text-lime hover:brightness-110">Open the board →</Link>}
            />
          </div>
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
