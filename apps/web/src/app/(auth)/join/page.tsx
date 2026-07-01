import Link from "next/link";
import { redirect } from "next/navigation";
import { copy, users } from "@famerace/core";
import { withErrorRedirect } from "@/lib/action";
import { FormError } from "@/components/form-error";
import { setSessionCookie } from "@/lib/session";

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

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ref?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="display text-4xl">Join the draft</h1>
      <p className="mt-1 text-muted">{copy.heroLines.join(" ")}</p>
      <form action={joinAction} className="mt-6 space-y-3">
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
          className={inputClass}
        />
        {params.ref ? <input type="hidden" name="referralCode" value={params.ref} /> : null}
        <label className="flex items-start gap-2 text-sm text-muted">
          <input type="checkbox" name="dobAttested18" required className="mt-1 accent-lime" />
          I confirm I am 18 or older.
        </label>
        <button
          type="submit"
          className="w-full rounded bg-lime px-4 py-3 font-bold uppercase tracking-wide text-ink hover:brightness-110"
        >
          Create account
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already drafted?{" "}
        <Link href="/login" className="text-lime">
          Sign in
        </Link>
      </p>
    </div>
  );
}
