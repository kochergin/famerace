import Link from "next/link";
import { draft } from "@famerace/core";
import type { CreatorCategory } from "@famerace/db";
import { DraftCard } from "@/components/draft-card";
import { EmptyState, SectionTitle } from "@/components/ui";
import { CATEGORY_LABELS } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { key: undefined, label: "All" },
  { key: "UNCLAIMED", label: "Unclaimed" },
  { key: "CLAIM_STARTED", label: "Claim in progress" },
  { key: "CLAIMED", label: "Claimed" },
] as const;

export default async function DraftBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string }>;
}) {
  const params = await searchParams;
  const category = params.category as CreatorCategory | undefined;
  const status = params.status as "UNCLAIMED" | "CLAIM_STARTED" | "CLAIMED" | undefined;
  const rows = await draft.draftBoard({ category, status });

  const filterLink = (c?: string, s?: string) => {
    const q = new URLSearchParams();
    if (c) q.set("category", c);
    if (s) q.set("status", s);
    const str = q.toString();
    return `/draft${str ? `?${str}` : ""}`;
  };

  return (
    <div>
      <SectionTitle
        right={
          <Link
            href="/nominate"
            className="rounded bg-volt px-4 py-2 text-sm font-bold uppercase tracking-wide text-chalk hover:brightness-110"
          >
            Nominate a creator
          </Link>
        }
      >
        Draft Board
      </SectionTitle>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        The internet is drafting the next generation of stars. Anyone can draft — only verified,
        claimed creators go live.
      </p>

      <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
        <Link
          href={filterLink(undefined, params.status)}
          className={`chip border ${!category ? "border-lime text-lime" : "border-edge text-muted"}`}
        >
          All categories
        </Link>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <Link
            key={key}
            href={filterLink(key, params.status)}
            className={`chip border ${category === key ? "border-lime text-lime" : "border-edge text-muted"}`}
          >
            {label}
          </Link>
        ))}
        <span className="mx-2 text-edge">|</span>
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.label}
            href={filterLink(params.category, f.key)}
            className={`chip border ${status === f.key ? "border-pink text-pink" : "border-edge text-muted"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No drafts here yet"
          hint="Be the scout who finds them first — nominate a rising creator."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((profile) => (
            <DraftCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}
