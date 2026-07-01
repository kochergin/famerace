import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DomainError, streetteam } from "@famerace/core";
import { FormError } from "@/components/form-error";
import { SectionTitle, Stat } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { num } from "@/lib/format";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

async function joinAction(formData: FormData) {
  "use server";
  const crewId = String(formData.get("crewId"));
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect(`/crews/${crewId}`, async () => {
    await streetteam.joinCrew(user.id, crewId);
  });
  revalidatePath(`/crews/${crewId}`);
  redirect(`/crews/${crewId}`);
}

async function leaveAction(formData: FormData) {
  "use server";
  const crewId = String(formData.get("crewId"));
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect(`/crews/${crewId}`, async () => {
    await streetteam.leaveCrew(user.id);
  });
  revalidatePath(`/crews/${crewId}`);
  redirect(`/crews/${crewId}`);
}

export default async function CrewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [crew, user] = await Promise.all([
    streetteam.crewDetail(id).catch((e) => {
      if (e instanceof DomainError) return null;
      throw e;
    }),
    currentUser(),
  ]);
  if (!crew) notFound();
  const isMember = user ? crew.members.some((member) => member.userId === user.id) : false;

  return (
    <div className="mx-auto max-w-2xl">
      <FormError error={error} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="stat text-sm text-muted">Crew rank #{crew.rank ?? "—"}</p>
          <h1 className="display text-5xl">{crew.name}</h1>
          {crew.description ? <p className="mt-2 text-muted">{crew.description}</p> : null}
        </div>
        <a
          href={`/card/crew/${crew.id}`}
          target="_blank"
          className="rounded border border-volt px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-volt hover:bg-volt/10"
        >
          Crew card
        </a>
      </div>

      <div className="card mt-6 grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Stat label="Score" value={num(crew.score)} accent="text-lime" />
        <Stat label="Members" value={num(crew.members.length)} />
        <Stat label="Quests done" value={num(crew.questsCompleted)} />
        <Stat label="Missions funded" value={num(crew.missionsFunded)} accent="text-gold" />
      </div>

      {user ? (
        <form action={isMember ? leaveAction : joinAction} className="mt-4">
          <input type="hidden" name="crewId" value={crew.id} />
          <button
            className={`rounded px-4 py-2 text-sm font-bold uppercase tracking-wide ${
              isMember ? "border border-edge text-muted hover:border-pink hover:text-pink" : "bg-volt text-chalk hover:brightness-110"
            }`}
          >
            {isMember ? "Leave crew" : "Join crew"}
          </button>
        </form>
      ) : null}

      <SectionTitle>Members</SectionTitle>
      <ol className="card divide-y divide-edge">
        {crew.members.map((member) => (
          <li key={member.id} className="flex items-center justify-between px-5 py-3 text-sm">
            <span>
              <Link href={`/u/${member.user.username}`} className="font-semibold text-volt">
                @{member.user.username}
              </Link>
              {member.role === "FOUNDER" ? <span className="chip ml-2 bg-gold/15 text-gold">Founder</span> : null}
            </span>
            <span className="stat text-muted">{num(member.points)} pts</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
