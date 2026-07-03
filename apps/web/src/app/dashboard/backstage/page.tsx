import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { backstage, claim, drops as dropsMod, media } from "@famerace/core";
import { prisma } from "@famerace/db";
import { FormError } from "@/components/form-error";
import { SectionTitle } from "@/components/ui";
import { withErrorRedirect } from "@/lib/action";
import { money, num, timeAgo } from "@/lib/format";
import { requireCurrentUser } from "@/lib/session";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";

const BACK = "/dashboard/backstage";

async function tierAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect(BACK, async () => {
    await backstage.configureTier(user.id, {
      name: String(formData.get("name") ?? ""),
      priceCents: Math.round(Number(formData.get("price") || 0) * 100),
      accessType: String(formData.get("accessType") ?? "PAID") as never,
      minHoldingUnits: Number(formData.get("minHoldingUnits") || 0),
      benefits: String(formData.get("benefits") ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  });
  revalidatePath(BACK);
  redirect(BACK);
}

async function postAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect(BACK, async () => {
    const file = formData.get("media");
    let mediaUrl = "";
    if (file instanceof File && file.size > 0) {
      const stored = await media.storeMedia(user.id, { bytes: new Uint8Array(await file.arrayBuffer()) }, "POST");
      mediaUrl = stored.url;
    }
    await backstage.createPost(user.id, {
      title: String(formData.get("title") ?? ""),
      body: String(formData.get("body") ?? ""),
      preview: String(formData.get("preview") ?? ""),
      mediaUrl,
      visibility: String(formData.get("visibility") ?? "MEMBERS") as never,
    });
  });
  revalidatePath(BACK);
  redirect(BACK);
}

async function dropAction(formData: FormData) {
  "use server";
  const user = await requireCurrentUser();
  await withErrorRedirect(BACK, async () => {
    const limit = Number(formData.get("quantityLimit") || 0);
    const file = formData.get("media");
    let mediaUrl = String(formData.get("mediaUrl") ?? "");
    if (file instanceof File && file.size > 0) {
      const stored = await media.storeMedia(user.id, { bytes: new Uint8Array(await file.arrayBuffer()) }, "DROP");
      mediaUrl = stored.url;
    }
    await dropsMod.createDrop(user.id, {
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? ""),
      previewText: String(formData.get("previewText") ?? ""),
      mediaUrl,
      priceCents: Math.round(Number(formData.get("price") || 0) * 100),
      quantityLimit: limit > 0 ? limit : undefined,
    });
  });
  revalidatePath(BACK);
  redirect(BACK);
}

const inputClass =
  "w-full rounded border border-edge bg-ink px-3 py-2.5 text-sm text-chalk placeholder:text-muted focus:border-lime focus:outline-none";

export default async function DashboardBackstagePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const creator = await claim.creatorForUser(user.id);
  if (!creator) redirect("/dashboard");

  const [tiers, posts, drops, memberCount] = await Promise.all([
    prisma.backstageTier.findMany({ where: { creatorId: creator.id }, orderBy: { priceCents: "asc" } }),
    prisma.backstagePost.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.drop.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.backstageMembership.count({ where: { creatorId: creator.id, status: "ACTIVE" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <FormError error={error} />
      <p className="mb-4 text-sm text-muted">
        <span className="stat font-bold text-chalk">{num(memberCount)}</span> active members
      </p>

      <SectionTitle>Membership tiers</SectionTitle>
      <div className="card mb-3 p-6">
        {tiers.length > 0 ? (
          <ul className="mb-4 space-y-1 text-sm">
            {tiers.map((tier) => (
              <li key={tier.id} className="flex justify-between">
                <span className="text-chalk">{tier.name}</span>
                <span className="stat text-muted">
                  {tier.accessType === "PAID"
                    ? `${money(tier.priceCents)}/mo`
                    : tier.accessType === "HOLDER_GATED"
                      ? `hold ${tier.minHoldingUnits}u`
                      : "free"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={tierAction} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input name="name" placeholder="Tier name" required className={inputClass} />
            <input name="price" type="number" min={1} step="0.01" placeholder="Price $/month" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select name="accessType" className={inputClass} defaultValue="PAID">
              <option value="PAID">Paid monthly</option>
              <option value="HOLDER_GATED">Holder-gated</option>
              <option value="FREE">Free</option>
            </select>
            <input name="minHoldingUnits" type="number" min={0} placeholder="Min units (holder-gated)" className={inputClass} />
          </div>
          <textarea name="benefits" placeholder={"Benefits, one per line"} rows={2} className={inputClass} />
          <SubmitButton pendingLabel="Working…" className="rounded bg-velvet px-4 py-2 text-sm font-bold uppercase tracking-wide text-chalk hover:brightness-125">
            Add tier
          </SubmitButton>
        </form>
      </div>

      <SectionTitle>Post to Backstage</SectionTitle>
      <form action={postAction} className="card mb-3 space-y-3 p-6">
        <input name="title" placeholder="Post title" required className={inputClass} />
        <textarea name="body" placeholder="The content members unlock" required rows={3} className={inputClass} />
        <input name="preview" placeholder="Public teaser (shown to non-members)" className={inputClass} />
        <label className="block text-xs uppercase tracking-wide text-muted">
          Photo (members see it sharp — everyone else sees the locked blur)
          <input name="media" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg" className={`mt-1 ${inputClass}`} />
        </label>
        <select name="visibility" className={inputClass} defaultValue="MEMBERS">
          <option value="MEMBERS">Members</option>
          <option value="HOLDERS">Holders only</option>
          <option value="PUBLIC_PREVIEW">Public</option>
        </select>
        <SubmitButton pendingLabel="Working…" className="rounded bg-velvet px-4 py-2 text-sm font-bold uppercase tracking-wide text-chalk hover:brightness-125">
          Publish post
        </SubmitButton>
      </form>
      {posts.length > 0 ? (
        <ul className="mb-6 space-y-1 text-sm text-muted">
          {posts.map((post) => (
            <li key={post.id}>
              {post.title} · {post.visibility.toLowerCase().replaceAll("_", " ")} · {timeAgo(post.createdAt)}
            </li>
          ))}
        </ul>
      ) : null}

      <SectionTitle>Paid drops</SectionTitle>
      <form action={dropAction} className="card space-y-3 p-6">
        <input name="title" placeholder="Drop title" required className={inputClass} />
        <textarea name="description" placeholder="What buyers unlock" required minLength={10} rows={2} className={inputClass} />
        <input name="previewText" placeholder="Public preview text" className={inputClass} />
        <input name="mediaUrl" type="url" placeholder="Media link (optional)" className={inputClass} />
        <label className="block text-xs uppercase tracking-wide text-muted">
          Cover image (buyers see it sharp — everyone else sees the locked blur)
          <input name="media" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg" className={`mt-1 ${inputClass}`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <input name="price" type="number" min={1} step="0.01" placeholder="Price $" required className={inputClass} />
          <input name="quantityLimit" type="number" min={1} placeholder="Quantity limit (optional)" className={inputClass} />
        </div>
        <SubmitButton pendingLabel="Working…" className="rounded bg-lime px-4 py-2 text-sm font-bold uppercase tracking-wide text-ink hover:brightness-110">
          Release drop
        </SubmitButton>
      </form>
      {drops.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {drops.map((drop) => (
            <li key={drop.id}>
              {drop.title} · {money(drop.priceCents)} · sold {drop.soldCount}
              {drop.quantityLimit ? `/${drop.quantityLimit}` : ""} · {money(drop.revenueCents)} revenue
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
