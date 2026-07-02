import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { streetteam } from "@famerace/core";
import { prisma } from "@famerace/db";
import { SectionCard, SectionTitle } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { currentUser } from "@/lib/session";
import { SubmitButton } from "@/components/submit-button";

async function submitQuestAction(formData: FormData) {
  "use server";
  const handle = String(formData.get("handle"));
  const user = await currentUser();
  if (!user) redirect("/join");
  await withErrorRedirect(`/c/${handle}`, async () => {
    await streetteam.submitCompletion(user.id, String(formData.get("questId")), String(formData.get("proofRef") ?? ""));
  });
  revalidatePath(`/c/${handle}`);
  redirect(`/c/${handle}?quested=1`);
}

/** Street Team quests on the creator page (PRD §4.4, §7.6). */
export async function StreetTeamSection({ creatorId, handle }: { creatorId: string; handle: string }) {
  const user = await currentUser();
  const quests = await prisma.quest.findMany({
    where: { creatorId, status: "LIVE" },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  if (quests.length === 0) return null;
  const submissions = user
    ? new Map(
        (
          await prisma.questCompletion.findMany({
            where: { userId: user.id, questId: { in: quests.map((q) => q.id) } },
          })
        ).map((completion) => [completion.questId, completion.status]),
      )
    : new Map<string, string>();

  return (
    <SectionCard accent="volt">
      <SectionTitle>Street Team</SectionTitle>
      <p className="mb-3 text-xs text-muted">
        Backers do not just watch — they make the breakout happen. Complete quests, earn XP and crew
        points.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {quests.map((quest) => {
          const status = submissions.get(quest.id);
          return (
            <div key={quest.id} className="rounded border border-edge p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="font-bold text-chalk">{quest.title}</h3>
                <span className="chip bg-volt/15 text-volt">
                  +{quest.rewardAmount} {quest.rewardType.toLowerCase().replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">{quest.description}</p>
              {status ? (
                <p
                  className={`mt-2 text-xs font-bold uppercase tracking-wide ${
                    status === "APPROVED" ? "text-lime" : status === "REJECTED" ? "text-pink" : "text-chrome"
                  }`}
                >
                  {status === "SUBMITTED" ? "Awaiting review" : status.toLowerCase()}
                </p>
              ) : user ? (
                <form action={submitQuestAction} className="mt-2 flex gap-2">
                  <input type="hidden" name="handle" value={handle} />
                  <input type="hidden" name="questId" value={quest.id} />
                  <input
                    name="proofRef"
                    placeholder="Proof link"
                    required={quest.proofType !== "AUTO"}
                    className="min-w-0 flex-1 rounded border border-edge bg-ink px-3 py-1.5 text-xs text-chalk placeholder:text-muted focus:border-volt focus:outline-none"
                  />
                  <SubmitButton pendingLabel="…" className="rounded bg-volt px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-chalk">
                    Submit
                  </SubmitButton>
                </form>
              ) : (
                <Link href="/join" className="mt-2 inline-block text-xs text-volt underline">
                  Join to complete
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
