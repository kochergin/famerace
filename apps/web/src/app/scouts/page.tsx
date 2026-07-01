import Link from "next/link";
import { scores } from "@famerace/core";
import { EmptyState, SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ScoutsPage() {
  const scouts = await scores.topScouts(50);
  return (
    <div className="mx-auto max-w-2xl">
      <SectionTitle
        right={
          <Link href="/nominate" className="rounded bg-volt px-4 py-2 text-xs font-bold uppercase tracking-wide text-chalk">
            Nominate
          </Link>
        }
      >
        Top Scouts
      </SectionTitle>
      <p className="mb-6 text-sm text-muted">
        Internet talent scouts — they nominate rising creators, collect the demand, and get permanent
        credit when the claim lands.
      </p>
      {scouts.length === 0 ? (
        <EmptyState title="No scouts yet" hint="Nominate a creator to open the leaderboard." />
      ) : (
        <ol className="card divide-y divide-edge">
          {scouts.map((scout, index) => (
            <li key={scout.user!.id} className="flex items-center justify-between px-5 py-3">
              <span>
                <span className="stat mr-3 text-muted">#{index + 1}</span>
                <Link href={`/u/${scout.user!.username}`} className="font-semibold text-volt">
                  @{scout.user!.username}
                </Link>
              </span>
              <span className="stat text-sm text-muted">
                <span className="text-lime">{scout.claimed} claimed</span> · {scout.nominations} nominated
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
