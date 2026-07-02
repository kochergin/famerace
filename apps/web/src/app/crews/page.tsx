import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { streetteam } from "@famerace/core";
import { FormError } from "@/components/form-error";
import { EmptyState, SectionTitle } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { num } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

async function createCrewAction(formData: FormData) {
  "use server";
  const user = await currentUser();
  if (!user) redirect("/join");
  let crewId = "";
  await withErrorRedirect("/crews", async () => {
    const crew = await streetteam.createCrew(user.id, {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
    });
    crewId = crew.id;
  });
  redirect(`/crews/${crewId}`);
}

export default async function CrewsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  await streetteam.rankCrews();
  const [crews, user] = await Promise.all([streetteam.crewLeaderboard(50), currentUser()]);

  return (
    <div className="mx-auto max-w-2xl">
      <SectionTitle>Backer Crews</SectionTitle>
      <p className="mb-4 text-sm text-muted">
        Back as a team. Crews compete on missions funded, creators claimed and Street Team quests —
        weekly league rankings, permanent bragging rights.
      </p>
      <FormError error={error} />

      {user ? (
        <form action={createCrewAction} className="card mb-6 flex flex-wrap items-center gap-2 p-4">
          <input
            name="name"
            placeholder="Crew name (e.g. Tokyo Angels)"
            required
            minLength={3}
            className="min-w-44 flex-1 rounded border border-edge bg-ink px-3 py-2 text-sm text-chalk placeholder:text-muted focus:border-volt focus:outline-none"
          />
          <input
            name="description"
            placeholder="What does your crew back?"
            className="min-w-44 flex-1 rounded border border-edge bg-ink px-3 py-2 text-sm text-chalk placeholder:text-muted focus:border-volt focus:outline-none"
          />
          <SubmitButton pendingLabel="Creating…" className="rounded bg-volt px-4 py-2 text-sm font-bold uppercase tracking-wide text-chalk hover:brightness-110">
            Found a crew
          </SubmitButton>
        </form>
      ) : null}

      {crews.length === 0 ? (
        <EmptyState title="No crews yet" hint="Found the first one and pick your colors." />
      ) : (
        <ol className="card divide-y divide-edge">
          {crews.map((crew) => (
            <li key={crew.id} className="flex items-center justify-between px-5 py-3">
              <span>
                <span className="stat mr-3 text-muted">#{crew.rank ?? "—"}</span>
                <Link href={`/crews/${crew.id}`} className="font-semibold text-volt">
                  {crew.name}
                </Link>
                <span className="ml-2 text-xs text-muted">{crew._count.members} members</span>
              </span>
              <span className="stat text-sm text-lime">{num(crew.score)} pts</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
