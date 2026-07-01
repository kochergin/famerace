import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { admin as adminMod, auction, claim, draft, market as marketMod, missions as missionsMod, payouts as payoutsMod } from "@famerace/core";
import { prisma } from "@famerace/db";
import { FormError } from "@/components/form-error";
import { SectionTitle, Stat, StatusChip } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { money, num, timeAgo } from "@/lib/format";
import { requireCurrentAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

// ── actions (all requireCurrentAdmin) ──

async function act(formData: FormData) {
  "use server";
  const admin = await requireCurrentAdmin();
  const action = String(formData.get("action"));
  const id = String(formData.get("id"));
  await withErrorRedirect("/admin", async () => {
    switch (action) {
      case "draft_approve":
        return draft.moderateDraft(admin.id, id, "APPROVED");
      case "draft_reject":
        return draft.moderateDraft(admin.id, id, "REJECTED");
      case "verify_approve":
        return void (await claim.approveVerification(admin.id, id));
      case "verify_reject":
        return void (await claim.rejectVerification(admin.id, id));
      case "kit_approve":
        return claim.approveLaunchKit(admin.id, id);
      case "schedule_launch": {
        const hours = Number(formData.get("hours") || 24);
        return claim.scheduleLaunch(admin.id, id, new Date(Date.now() + hours * 3600 * 1000));
      }
      case "launch_now":
        return auction.launchNow(admin.id, id);
      case "mission_approve":
        return void (await missionsMod.approveMission(admin.id, id));
      case "payout_approve": {
        await payoutsMod.approvePayout(admin.id, id);
        return void (await payoutsMod.sendPayout(admin.id, id, "ADMIN"));
      }
      case "takedown_action":
        return adminMod.actionTakedown(admin.id, id, "ACTIONED");
      case "takedown_reject":
        return adminMod.actionTakedown(admin.id, id, "REJECTED");
      case "report_resolve":
        return adminMod.resolveReport(admin.id, id, "RESOLVED");
      case "report_dismiss":
        return adminMod.resolveReport(admin.id, id, "DISMISSED");
      case "fraud_confirm":
        return adminMod.resolveFraudSignal(admin.id, id, "CONFIRMED");
      case "fraud_dismiss":
        return adminMod.resolveFraudSignal(admin.id, id, "DISMISSED");
      case "market_pause":
        return marketMod.pauseMarket(admin.id, id, String(formData.get("reason") || "admin action"));
      case "market_resume":
        return marketMod.resumeMarket(admin.id, id);
      case "creator_suspend":
        return adminMod.suspendCreator(admin.id, id, String(formData.get("reason") || "policy"));
      case "run_sweeps":
        return void (await adminMod.runSweeps());
      default:
        throw new Error(`Unknown action ${action}`);
    }
  });
  revalidatePath("/admin");
  redirect("/admin");
}

function ActionButton({
  action,
  id,
  label,
  tone = "lime",
  extra,
}: {
  action: string;
  id: string;
  label: string;
  tone?: "lime" | "pink" | "volt" | "muted";
  extra?: React.ReactNode;
}) {
  const tones = {
    lime: "bg-lime text-ink",
    pink: "border border-pink/60 text-pink hover:bg-pink/10",
    volt: "bg-volt text-chalk",
    muted: "border border-edge text-muted hover:border-chalk hover:text-chalk",
  } as const;
  return (
    <form action={act} className="inline-flex items-center gap-1">
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="id" value={id} />
      {extra}
      <button className={`rounded px-3 py-1 text-xs font-bold uppercase tracking-wide ${tones[tone]}`}>
        {label}
      </button>
    </form>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  await requireCurrentAdmin().catch(() => redirect("/login"));

  const [counts, drafts, verifications, missions, payoutsList, takedowns, reports, fraud, liveMarkets, auditLog] =
    await Promise.all([
      adminMod.queueCounts(),
      adminMod.draftQueue(),
      adminMod.verificationQueue(),
      adminMod.missionQueue(),
      adminMod.payoutQueue(),
      adminMod.takedownQueue(),
      adminMod.openReports(),
      adminMod.openFraudSignals(),
      prisma.creatorMarket.findMany({
        where: { status: { in: ["GENESIS_CURVE", "GRADUATION", "MATURE", "PAUSED"] } },
        include: { creator: { select: { displayName: true, handle: true } } },
      }),
      adminMod.recentAuditLog(15),
    ]);
  const schedulable = await prisma.creator.findMany({
    where: { launchThreshold: { status: "THRESHOLD_MET" }, status: "APPROVED" },
    select: { id: true, displayName: true },
  });
  const collecting = await prisma.creator.findMany({
    where: { status: "LAUNCHING_SOON" },
    select: { id: true, displayName: true, launchAt: true },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-4xl">Trust &amp; Safety</h1>
        <ActionButton action="run_sweeps" id="-" label="Run sweeps" tone="volt" />
      </div>
      <FormError error={error} />

      <div className="card mt-4 grid grid-cols-3 gap-4 p-4 sm:grid-cols-7">
        <Stat label="Drafts" value={counts.DRAFT_MOD ?? 0} />
        <Stat label="Verify" value={counts.VERIFICATION ?? 0} />
        <Stat label="Missions" value={counts.MISSION_REVIEW ?? 0} />
        <Stat label="Payouts" value={num(payoutsList.length)} />
        <Stat label="Takedowns" value={counts.takedowns ?? 0} accent="text-pink" />
        <Stat label="Reports" value={counts.reports ?? 0} accent="text-pink" />
        <Stat label="Fraud" value={counts.fraud ?? 0} accent="text-pink" />
      </div>

      {drafts.length > 0 ? (
        <section className="mt-8">
          <SectionTitle>Draft moderation</SectionTitle>
          <div className="card divide-y divide-edge">
            {drafts.map((profile) => (
              <div key={profile.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <Link href={`/draft/${profile.id}`} className="font-semibold text-volt">
                    {profile.nameOrHandle}
                  </Link>{" "}
                  <span className="text-muted">
                    · {profile.category.toLowerCase()} ·{" "}
                    {profile.nominations[0] ? `"${profile.nominations[0].thesis.slice(0, 80)}…" —@${profile.nominations[0].scout.username}` : ""}
                  </span>
                </span>
                <span className="flex gap-2">
                  <ActionButton action="draft_approve" id={profile.id} label="Approve" />
                  <ActionButton action="draft_reject" id={profile.id} label="Reject" tone="pink" />
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {verifications.length > 0 ? (
        <section className="mt-8">
          <SectionTitle>Creator verification</SectionTitle>
          <div className="card divide-y divide-edge">
            {verifications.map((creator) => (
              <div key={creator.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-semibold text-chalk">{creator.displayName}</span>{" "}
                    <span className="text-muted">
                      @{creator.handle} · {creator.draftProfile ? `${creator.draftProfile.fanCount} fans, ${money(creator.draftProfile.pledgedDemandTotal, { compact: true })} pledged` : ""}
                      {creator.followerCount > 0 ? ` · claims ${num(creator.followerCount)} followers` : " · no follower claim"}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <ActionButton action="verify_approve" id={creator.id} label="Verify" />
                    <ActionButton action="verify_reject" id={creator.id} label="Reject" tone="pink" />
                  </span>
                </div>
                {Array.isArray(creator.socialLinks) ? (
                  <p className="mt-1 text-xs text-muted">
                    {(creator.socialLinks as string[]).map((link) => (
                      <a key={link} href={link} target="_blank" rel="noreferrer nofollow" className="mr-3 text-volt underline">
                        {link}
                      </a>
                    ))}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {(schedulable.length > 0 || collecting.length > 0) ? (
        <section className="mt-8">
          <SectionTitle>Launch calendar</SectionTitle>
          <div className="card divide-y divide-edge">
            {schedulable.map((creator) => (
              <div key={creator.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-semibold text-chalk">{creator.displayName} — threshold met</span>
                <span className="flex items-center gap-2">
                  <ActionButton action="kit_approve" id={creator.id} label="Approve kit" tone="muted" />
                  <ActionButton
                    action="schedule_launch"
                    id={creator.id}
                    label="Schedule"
                    tone="volt"
                    extra={
                      <input
                        name="hours"
                        type="number"
                        min={1}
                        defaultValue={24}
                        className="w-16 rounded border border-edge bg-ink px-2 py-1 text-xs text-chalk"
                        title="Hours from now"
                      />
                    }
                  />
                </span>
              </div>
            ))}
            {collecting.map((creator) => (
              <div key={creator.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold text-lime">{creator.displayName}</span>{" "}
                  <span className="text-muted">launching {creator.launchAt ? timeAgo(creator.launchAt).replace(" ago", "") : "soon"}</span>
                </span>
                <ActionButton action="launch_now" id={creator.id} label="Launch now" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {missions.length > 0 ? (
        <section className="mt-8">
          <SectionTitle>Mission review</SectionTitle>
          <div className="card divide-y divide-edge">
            {missions.map((mission) => (
              <div key={mission.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold text-chalk">{mission.title}</span>{" "}
                  <span className="text-muted">
                    · {mission.creator.displayName} · goal {money(mission.goalCents)} · {mission.useOfFunds.slice(0, 60)}
                  </span>
                </span>
                <ActionButton action="mission_approve" id={mission.id} label="Approve" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {payoutsList.length > 0 ? (
        <section className="mt-8">
          <SectionTitle>Payout compliance review</SectionTitle>
          <div className="card divide-y divide-edge">
            {payoutsList.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <span className="stat font-bold text-chalk">{money(payout.amountCents)}</span>{" "}
                  <span className="text-muted">· {payout.creator.displayName} · {timeAgo(payout.createdAt)}</span>
                </span>
                <ActionButton action="payout_approve" id={payout.id} label="Approve + send" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {takedowns.length > 0 ? (
        <section className="mt-8">
          <SectionTitle>Takedown requests</SectionTitle>
          <div className="card divide-y divide-edge">
            {takedowns.map((request) => (
              <div key={request.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-pink">{request.draftProfile?.nameOrHandle ?? request.creatorId}</span>
                  <span className="flex gap-2">
                    <ActionButton action="takedown_action" id={request.id} label="Remove profile" tone="pink" />
                    <ActionButton action="takedown_reject" id={request.id} label="Keep" tone="muted" />
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {request.reason} — <span className="text-chrome">{request.requesterContact}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {(reports.length > 0 || fraud.length > 0) ? (
        <section className="mt-8">
          <SectionTitle>Reports &amp; fraud signals</SectionTitle>
          <div className="card divide-y divide-edge">
            {reports.map((report) => (
              <div key={report.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="chip bg-pink/15 text-pink">{report.reason}</span>{" "}
                  <span className="text-muted">
                    {report.objectType} · by @{report.reporter.username} · {report.detail?.slice(0, 80)}
                  </span>
                </span>
                <span className="flex gap-2">
                  <ActionButton action="report_resolve" id={report.id} label="Resolve" />
                  <ActionButton action="report_dismiss" id={report.id} label="Dismiss" tone="muted" />
                </span>
              </div>
            ))}
            {fraud.map((signal) => (
              <div key={signal.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <span className="chip bg-pink/15 text-pink">{signal.signal}</span>{" "}
                  <span className="stat text-muted">score {signal.score.toFixed(2)} · {signal.objectType}</span>
                </span>
                <span className="flex gap-2">
                  <ActionButton action="fraud_confirm" id={signal.id} label="Confirm" tone="pink" />
                  <ActionButton action="fraud_dismiss" id={signal.id} label="Dismiss" tone="muted" />
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {liveMarkets.length > 0 ? (
        <section className="mt-8">
          <SectionTitle>Markets</SectionTitle>
          <div className="card divide-y divide-edge">
            {liveMarkets.map((market) => (
              <div key={market.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  <Link href={`/c/${market.creator.handle}`} className="font-semibold text-volt">
                    ${market.ticker}
                  </Link>{" "}
                  <span className="text-muted">
                    {market.creator.displayName} · {money(market.priceCents)} · {num(market.holderCount)} holders
                  </span>{" "}
                  <StatusChip status={market.status} />
                </span>
                {market.status === "PAUSED" ? (
                  <ActionButton action="market_resume" id={market.id} label="Resume" />
                ) : (
                  <ActionButton action="market_pause" id={market.id} label="Pause" tone="pink" />
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <SectionTitle>Audit log</SectionTitle>
        <ul className="card divide-y divide-edge text-xs">
          {auditLog.map((entry) => (
            <li key={entry.id} className="flex justify-between px-4 py-2">
              <span className="text-chrome">
                {entry.action} <span className="text-muted">— {entry.objectType}</span>
              </span>
              <span className="stat text-muted">
                {entry.actorType} · {timeAgo(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
