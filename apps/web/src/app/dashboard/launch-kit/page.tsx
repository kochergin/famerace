import { redirect } from "next/navigation";
import { launchkit } from "@famerace/core";
import { SectionTitle } from "@/components/ui";
import { requireCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Creator Launch Kit (PRD §9.18): copy-ready launch content with built-in
 *  disclosures. Distribution is a product feature, not an afterthought. */
export default async function LaunchKitPage() {
  const user = await requireCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  const kit = await launchkit.kitForUser(user.id).catch(() => null);
  if (!kit) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-3xl">
      <SectionTitle>Launch kit</SectionTitle>
      <p className="mb-2 max-w-2xl text-sm text-muted">
        Auto-generated from your live profile and first mission — copy, personalize, post. The
        disclosure line is part of every earning template; keep it on anything that promotes your
        launch.
      </p>
      <p className="mb-6 text-xs text-muted">
        Admin approval of this kit is one of your launch gates{kit.creator.launchKitApproved ? " — approved ✓" : "."}
      </p>
      <div className="space-y-4">
        {kit.blocks.map((block) => (
          <section key={block.id} className="card p-5">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-lime">{block.label}</h2>
            <pre className="whitespace-pre-wrap rounded border border-edge bg-ink/60 p-4 font-sans text-sm leading-relaxed text-chrome">
              {block.content}
            </pre>
          </section>
        ))}
      </div>
    </div>
  );
}
