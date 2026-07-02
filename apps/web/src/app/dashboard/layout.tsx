import { NavLink } from "@/components/nav-link";

const TABS = [
  { href: "/dashboard", label: "Launch" },
  { href: "/dashboard/missions", label: "Missions" },
  { href: "/dashboard/backstage", label: "Backstage" },
  { href: "/dashboard/street-team", label: "Street Team" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/launch-kit", label: "Launch Kit" },
  { href: "/dashboard/earnings", label: "Earnings" },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav
        className="mb-6 flex gap-2 overflow-x-auto border-b border-edge pb-2 text-xs font-bold uppercase tracking-wide"
        style={{ maskImage: "linear-gradient(90deg, black 90%, transparent)" }}
      >
        {TABS.map((tab) => (
          <NavLink key={tab.href} href={tab.href}>
            <span className="chip whitespace-nowrap border border-edge px-3 py-1.5 transition hover:border-chrome">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
      {children}
    </div>
  );
}
