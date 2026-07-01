import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { claim, missions as missionsMod } from "@famerace/core";
import { FormError } from "@/components/form-error";
import { FuelBar, SectionTitle, StatusChip } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { money } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const BACK = "/dashboard/missions";

async function createMissionAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect(BACK, async () => {
    const tiers = String(formData.get("rewardTiers") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [amount, ...rest] = line.split(":");
        return { thresholdCents: Math.round(Number(amount) * 100) || 0, reward: rest.join(":").trim() };
      })
      .filter((tier) => tier.thresholdCents >= 100 && tier.reward.length >= 3);
    await missionsMod.createMission(user.id, {
      title: String(formData.get("title") ?? ""),
      goalCents: Math.round(Number(formData.get("goal") || 0) * 100),
      deadlineDays: Number(formData.get("deadlineDays") || 14),
      useOfFunds: String(formData.get("useOfFunds") ?? ""),
      rewardTiers: tiers,
      refundRule: String(formData.get("refundRule") ?? "ALL_OR_NOTHING") as never,
      proofRequirements: String(formData.get("proofRequirements") ?? ""),
      matchEligible: formData.get("matchEligible") === "on",
    });
  });
  revalidatePath(BACK);
  redirect(BACK);
}

async function startWorkAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect(BACK, async () => {
    await missionsMod.startWork(user.id, String(formData.get("missionId")));
  });
  revalidatePath(BACK);
  redirect(BACK);
}

async function postUpdateAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect(BACK, async () => {
    await missionsMod.postUpdate(user.id, String(formData.get("missionId")), {
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
      proofUrl: String(formData.get("proofUrl") ?? ""),
    });
  });
  revalidatePath(BACK);
  redirect(BACK);
}

async function completeAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect(BACK, async () => {
    await missionsMod.completeMission(user.id, String(formData.get("missionId")));
  });
  revalidatePath(BACK);
  redirect(BACK);
}

const inputClass =
  "w-full rounded border border-edge bg-ink px-3 py-2.5 text-sm text-chalk placeholder:text-muted focus:border-gold focus:outline-none";

export default async function DashboardMissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const creator = await claim.creatorForUser(user.id);
  if (!creator) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl">
      <FormError error={error} />
      <SectionTitle>Mission builder</SectionTitle>
      <form action={createMissionAction} className="card space-y-3 p-6">
        <input name="title" placeholder="Mission title (e.g. First Music Video)" required className={inputClass} />
        <div className="grid grid-cols-2 gap-3">
          <input name="goal" type="number" min={100} placeholder="Goal ($)" required className={inputClass} />
          <input name="deadlineDays" type="number" min={3} max={90} defaultValue={14} placeholder="Days" required className={inputClass} />
        </div>
        <textarea name="useOfFunds" placeholder="Use of funds — what exactly does this pay for?" required minLength={10} rows={2} className={inputClass} />
        <textarea
          name="rewardTiers"
          placeholder={"Reward tiers, one per line as amount: reward\n10: Mission Badge\n50: Behind-the-scenes drop\n100: Supporter page credit"}
          rows={3}
          className={inputClass}
        />
        <textarea name="proofRequirements" placeholder="Proof you'll post (video link, receipts…)" rows={2} className={inputClass} />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="matchEligible" defaultChecked className="accent-gold" />
          Apply for FameRace Match (season fund tops up eligible contributions)
        </label>
        <select name="refundRule" className={inputClass} defaultValue="ALL_OR_NOTHING">
          <option value="ALL_OR_NOTHING">All-or-nothing — full refund if the goal is missed</option>
          <option value="KEEP_WHAT_RAISED">Keep what's raised at the deadline</option>
        </select>
        <button className="w-full rounded bg-gold px-4 py-3 font-bold uppercase tracking-wide text-ink hover:brightness-110">
          Submit for review
        </button>
      </form>

      <SectionTitle>Your missions</SectionTitle>
      <div className="space-y-4">
        {creator.missions.length === 0 ? (
          <p className="text-sm text-muted">No missions yet — your launch gate needs one.</p>
        ) : (
          creator.missions.map((mission) => (
            <div key={mission.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="display text-2xl">{mission.title}</h3>
                <StatusChip status={mission.status} />
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="stat text-gold">
                    {money(mission.fundedCents)} / {money(mission.goalCents)}
                  </span>
                  <Link href={`/m/${mission.id}`} className="text-volt underline">
                    Public page →
                  </Link>
                </div>
                <FuelBar value={mission.fundedCents} max={mission.goalCents} />
              </div>
              {mission.status === "FUNDED" || mission.status === "PARTIALLY_FUNDED" ? (
                <form action={startWorkAction} className="mt-3">
                  <input type="hidden" name="missionId" value={mission.id} />
                  <button className="rounded bg-lime px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink">
                    Start the work — release escrow
                  </button>
                </form>
              ) : null}
              {mission.status === "IN_PROGRESS" ? (
                <div className="mt-3 space-y-3 border-t border-edge pt-3">
                  <form action={postUpdateAction} className="space-y-2">
                    <input type="hidden" name="missionId" value={mission.id} />
                    <input name="title" placeholder="Update title" required className={inputClass} />
                    <textarea name="body" placeholder="What happened? Backers see this." required minLength={10} rows={2} className={inputClass} />
                    <input name="proofUrl" type="url" placeholder="Proof link (required to complete the mission)" className={inputClass} />
                    <button className="rounded border border-edge px-4 py-2 text-sm font-bold uppercase tracking-wide text-chalk hover:border-gold">
                      Post update
                    </button>
                  </form>
                  <form action={completeAction}>
                    <input type="hidden" name="missionId" value={mission.id} />
                    <button className="rounded bg-gold px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink">
                      Mark completed
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
