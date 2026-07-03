import { redirect } from "next/navigation";
import { copy, users } from "@famerace/core";
import { prisma } from "@famerace/db";
import { withErrorRedirect } from "@/lib/action";
import { JoinPlayground } from "@/components/join-playground";
import { money } from "@/lib/format";
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

/* Joining is being drafted into a season already in motion — the live rookie
   card and the interactive form live in JoinPlayground (client). */
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

  return (
    <JoinPlayground
      action={joinAction}
      refCode={params.ref}
      error={params.error}
      heroLine={copy.heroLines.join(" ")}
      stats={{
        pledgedLabel: money(pledged._sum.amountCents ?? 0, { compact: true }),
        backers,
        liveCount,
      }}
    />
  );
}
