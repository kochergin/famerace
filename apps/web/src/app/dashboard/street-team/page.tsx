import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { claim, streetteam } from "@famerace/core";
import { prisma } from "@famerace/db";
import { FormError } from "@/components/form-error";
import { SectionTitle } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { timeAgo } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

const BACK = "/dashboard/street-team";

async function createQuestAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect(BACK, async () => {
    const deadlineDays = Number(formData.get("deadlineDays") || 0);
    const maxCompletions = Number(formData.get("maxCompletions") || 0);
    await streetteam.createQuest(user.id, {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      type: String(formData.get("type") ?? "SHARE") as never,
      proofType: "LINK",
      rewardType: String(formData.get("rewardType") ?? "XP") as never,
      rewardAmount: Number(formData.get("rewardAmount") || 25),
      deadlineDays: deadlineDays > 0 ? deadlineDays : undefined,
      maxCompletions: maxCompletions > 0 ? maxCompletions : undefined,
    });
  });
  revalidatePath(BACK);
  redirect(BACK);
}

async function reviewAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect(BACK, async () => {
    await streetteam.reviewCompletion(
      user.id,
      String(formData.get("completionId")),
      String(formData.get("decision")) as "APPROVED" | "REJECTED",
    );
  });
  revalidatePath(BACK);
  redirect(BACK);
}

const QUEST_TYPES = [
  "SHARE",
  "INVITE",
  "CONTENT",
  "PLAYLIST",
  "ENGAGEMENT",
  "MEME",
  "TRANSLATION",
  "FEEDBACK",
  "LAUNCH_SUPPORT",
  "BRAND_INTRO",
  "EVENT",
] as const;

const inputClass =
  "w-full rounded border border-edge bg-ink px-3 py-2.5 text-sm text-chalk placeholder:text-muted focus:border-volt focus:outline-none";

export default async function StreetTeamDashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const creator = await claim.creatorForUser(user.id);
  if (!creator) redirect("/dashboard");

  const [quests, pending] = await Promise.all([
    prisma.quest.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.questCompletion.findMany({
      where: { quest: { creatorId: creator.id }, status: "SUBMITTED" },
      include: { quest: { select: { title: true } }, user: { select: { username: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <FormError error={error} />
      <SectionTitle>Create a quest</SectionTitle>
      <form action={createQuestAction} className="card space-y-3 p-6">
        <input name="title" placeholder="Quest title (e.g. Clip my new video for TikTok)" required className={inputClass} />
        <textarea name="description" placeholder="What exactly should the Street Team do?" required minLength={10} rows={2} className={inputClass} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <select name="type" className={inputClass} defaultValue="SHARE">
            {QUEST_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.toLowerCase().replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <select name="rewardType" className={inputClass} defaultValue="XP">
            <option value="XP">XP</option>
            <option value="POINTS">Points</option>
            <option value="BADGE">Badge</option>
          </select>
          <input name="rewardAmount" type="number" min={1} max={1000} defaultValue={25} className={inputClass} />
          <input name="maxCompletions" type="number" min={1} placeholder="Max (opt.)" className={inputClass} />
        </div>
        <SubmitButton pendingLabel="Working…" className="rounded bg-volt px-4 py-2 text-sm font-bold uppercase tracking-wide text-chalk hover:brightness-110">
          Post quest
        </SubmitButton>
      </form>

      <SectionTitle>Review submissions ({pending.length})</SectionTitle>
      {pending.length === 0 ? (
        <p className="card p-5 text-sm text-muted">Nothing waiting for review.</p>
      ) : (
        <div className="card divide-y divide-edge">
          {pending.map((completion) => (
            <div key={completion.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <span>
                <span className="font-semibold text-volt">@{completion.user.username}</span>{" "}
                <span className="text-muted">
                  · {completion.quest.title} · {timeAgo(completion.createdAt)}
                </span>
                {completion.proofRef ? (
                  <>
                    {" "}
                    ·{" "}
                    <a href={completion.proofRef} target="_blank" rel="noreferrer nofollow" className="text-lime underline">
                      proof ↗
                    </a>
                  </>
                ) : null}
              </span>
              <span className="flex gap-2">
                <form action={reviewAction}>
                  <input type="hidden" name="completionId" value={completion.id} />
                  <input type="hidden" name="decision" value="APPROVED" />
                  <SubmitButton pendingLabel="Working…" className="rounded bg-lime px-3 py-1.5 text-xs font-bold uppercase text-ink">Approve</SubmitButton>
                </form>
                <form action={reviewAction}>
                  <input type="hidden" name="completionId" value={completion.id} />
                  <input type="hidden" name="decision" value="REJECTED" />
                  <SubmitButton pendingLabel="Working…" className="rounded border border-edge px-3 py-1 text-xs font-bold uppercase text-muted hover:border-pink hover:text-pink">
                    Reject
                  </SubmitButton>
                </form>
              </span>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>Your quests</SectionTitle>
      <ul className="card divide-y divide-edge text-sm">
        {quests.length === 0 ? (
          <li className="px-5 py-3 text-muted">No quests yet.</li>
        ) : (
          quests.map((quest) => (
            <li key={quest.id} className="flex justify-between px-5 py-3">
              <span className="text-chalk">{quest.title}</span>
              <span className="stat text-muted">
                {quest.completionCount}
                {quest.maxCompletions ? `/${quest.maxCompletions}` : ""} done · {quest.status.toLowerCase()}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
