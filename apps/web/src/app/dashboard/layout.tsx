import Link from "next/link";

const TABS = [
  { href: "/dashboard", label: "Launch" },
  { href: "/dashboard/missions", label: "Missions" },
  { href: "/dashboard/backstage", label: "Backstage" },
  { href: "/dashboard/street-team", label: "Street Team" },
  { href: "/dashboard/earnings", label: "Earnings" },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="mb-6 flex gap-2 overflow-x-auto border-b border-edge pb-2 text-sm font-bold uppercase tracking-wide">
        {TABS.map((tab) => (
          <Link key={tab.href} href={tab.href} className="rounded px-3 py-1.5 text-muted transition hover:bg-panel hover:text-chalk">
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
