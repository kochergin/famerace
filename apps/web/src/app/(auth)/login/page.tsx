import Link from "next/link";
import { redirect } from "next/navigation";
import { users } from "@famerace/core";
import { prisma } from "@famerace/db";
import { withErrorRedirect } from "@/lib/action";
import { FormError } from "@/components/form-error";
import { LogoMark } from "@/components/logo";
import { setSessionCookie } from "@/lib/session";
import { SubmitButton } from "@/components/submit-button";

async function loginAction(formData: FormData) {
  "use server";
  await withErrorRedirect("/login", async () => {
    const { token } = await users.login(
      String(formData.get("identifier") ?? ""),
      String(formData.get("password") ?? ""),
    );
    await setSessionCookie(token);
  });
  redirect("/");
}

const inputClass =
  "w-full rounded border border-edge bg-ink px-3 py-2.5 text-chalk placeholder:text-muted focus:border-lime focus:outline-none";

/* The stage door. Signing in should feel like walking back into the venue
   mid-show — beams on, the race already moving. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [params, liveCount, launchingCount] = await Promise.all([
    searchParams,
    prisma.creator.count({ where: { status: "LIVE" } }),
    prisma.creator.count({ where: { status: "LAUNCHING_SOON" } }),
  ]);
  const pulse =
    liveCount > 0
      ? `${liveCount} creator${liveCount === 1 ? " is" : "s are"} live on the curve right now.`
      : launchingCount > 0
        ? `${launchingCount} launch${launchingCount === 1 ? " is" : "es are"} counting down right now.`
        : "The board is filling up right now.";

  return (
    <div className="relative mx-auto max-w-md overflow-x-clip py-10 text-center">
      <span aria-hidden className="beam beam-a left-[6%]" />
      <span aria-hidden className="beam beam-pink beam-b right-[6%]" />
      <LogoMark glow className="mx-auto h-11 w-11" />
      <p className="stat mt-5 text-[10px] uppercase tracking-[0.35em] text-muted">Stage door</p>
      <h1 className="display mt-2 text-5xl">Welcome back.</h1>
      <p className="mt-2 text-sm text-muted">
        <span className="pulse-soft mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-lime align-middle" />
        {pulse}
      </p>
      <form action={loginAction} className="mt-8 space-y-3 text-left">
        <FormError error={params.error} />
        <input name="identifier" placeholder="Username or email" required className={inputClass} />
        <input name="password" type="password" placeholder="Password" required autoComplete="current-password" className={inputClass} />
        <SubmitButton
          pendingLabel="Signing in…"
          className="w-full rounded bg-lime px-4 py-3 font-bold uppercase tracking-wide text-ink shadow-[0_0_24px_rgba(201,247,58,0.25)] hover:brightness-110"
        >
          Back to the show
        </SubmitButton>
      </form>
      <p className="mt-5 text-sm text-muted">
        New here?{" "}
        <Link href="/join" className="font-semibold text-lime hover:brightness-110">
          Join the draft →
        </Link>
      </p>
    </div>
  );
}
