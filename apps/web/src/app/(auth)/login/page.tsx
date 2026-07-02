import Link from "next/link";
import { redirect } from "next/navigation";
import { users } from "@famerace/core";
import { withErrorRedirect } from "@/lib/action";
import { FormError } from "@/components/form-error";
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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="display text-4xl">Welcome back</h1>
      <form action={loginAction} className="mt-6 space-y-3">
        <FormError error={params.error} />
        <input name="identifier" placeholder="Username or email" required className={inputClass} />
        <input name="password" type="password" placeholder="Password" required className={inputClass} />
        <SubmitButton
          pendingLabel="Signing in…"
          className="w-full rounded bg-lime px-4 py-3 font-bold uppercase tracking-wide text-ink hover:brightness-110"
        >
          Sign in
        </SubmitButton>
      </form>
      <p className="mt-4 text-sm text-muted">
        New here?{" "}
        <Link href="/join" className="text-lime">
          Join the draft
        </Link>
      </p>
    </div>
  );
}
