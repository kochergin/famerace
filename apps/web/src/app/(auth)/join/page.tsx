import Link from "next/link";
import { redirect } from "next/navigation";
import { copy, users } from "@famerace/core";
import { prisma } from "@famerace/db";
import { withErrorRedirect } from "@/lib/action";
import { FormError } from "@/components/form-error";
import { LogoMark } from "@/components/logo";
import { money } from "@/lib/format";
import { setSessionCookie } from "@/lib/session";
import { SubmitButton } from "@/components/submit-button";

async function joinAction(formData: FormData) {
  "use server";
  await withErrorRedirect("/join", async () => {
    const { token } = await users.signup({
      username: String(formData.get("username") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      dobAttested18: formData.get("dobAttested18") === "on" ? true : (false as never),
      referralCode: String(formData.get("referralCode") ?? "") || undefined,
    });
    await setSessionCookie(token);
  });
  redirect("/");
}

const inputClass =
  "w-full rounded border border-edge bg-ink px-3 py-2.5 text-chalk placeholder:text-muted focus:border-lime focus:outline-none";

/* Joining is being drafted into a season already in motion — the left side
   is the live season, the right side is your entry form. */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ref?: string }>;
}) {
  const [params, pledged, backers, liveCount] = await Promise.all([
    searchParams,
    prisma.fanDemandOrder.aggregate({
      where: { paymentAuthStatus: { in: ["AUTHORIZED", "CAPTURED"] } },
      _sum: { amountCents: true },
    }),
    prisma.fanDemandOrder.groupBy({ by: ["userId"] }).then((rows) => rows.length),
    prisma.creator.count({ where: { status: "LIVE" } }),
  ]);
  const pledgedCents = pledged._sum.amountCents ?? 0;

  return (
    <div className="mx-auto grid max-w-4xl items-center gap-10 py-8 md:grid-cols-2">
      <div className="fade-up hidden md:block">
        <p className="chip border border-lime/40 bg-lime/10 text-lime">Genesis Draft · Season 1</p>
        <h2 className="display mt-4 text-6xl leading-none">
          Find them early.
          <br />
          Back their rise.
          <br />
          <span className="display-hot">Prove your taste.</span>
        </h2>
        {/* The season is already moving — real numbers, not promises */}
        <div className="stat mt-6 flex flex-wrap gap-2 text-xs font-bold">
          <span className="chip border border-lime/30 text-lime">{money(pledgedCents, { compact: true })} pledged</span>
          <span className="chip border border-edge text-chalk">{backers} early backers</span>
          <span className="chip border border-pink/30 text-pink">{liveCount} live on the curve</span>
        </div>
        <ul className="mt-6 space-y-2.5 text-sm text-muted">
          {[
            "Draft rising creators before the world notices",
            "Permanent Genesis numbers — proof you were early",
            "Fund missions that change careers, with receipts",
          ].map((line) => (
            <li key={line} className="flex items-center gap-2.5">
              <LogoMark className="h-4 w-4 shrink-0" />
              {line}
            </li>
          ))}
        </ul>
      </div>
      <div className="card border-t-2 border-t-lime p-6">
        <p className="stat text-[10px] uppercase tracking-[0.3em] text-muted">Season 1 · open call</p>
        <h1 className="display mt-1 text-4xl">Join the draft</h1>
        <p className="mt-1 text-sm text-muted">{copy.heroLines.join(" ")}</p>
        <form action={joinAction} className="mt-5 space-y-3">
          <FormError error={params.error} />
          <input name="displayName" placeholder="Display name" required className={inputClass} />
          <input name="username" placeholder="Username" required className={inputClass} />
          <input name="email" type="email" placeholder="Email" required className={inputClass} />
          <input
            name="password"
            type="password"
            placeholder="Password (8+ characters)"
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
          />
          {params.ref ? <input type="hidden" name="referralCode" value={params.ref} /> : null}
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" name="dobAttested18" required className="mt-1 accent-lime" />
            I confirm I am 18 or older.
          </label>
          <SubmitButton
            pendingLabel="Setting up your wallet…"
            className="w-full rounded bg-lime px-4 py-3 font-bold uppercase tracking-wide text-ink shadow-[0_0_24px_rgba(201,247,58,0.25)] hover:brightness-110"
          >
            Claim my seat
          </SubmitButton>
        </form>
        <p className="mt-4 text-sm text-muted">
          Already drafted?{" "}
          <Link href="/login" className="font-semibold text-lime hover:brightness-110">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
