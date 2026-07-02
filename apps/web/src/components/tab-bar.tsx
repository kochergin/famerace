"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/logo";

/* Bottom tab bar (mobile): the app-feel layer. Five thumb-reach destinations,
   the mark in the middle as home. Hidden on desktop; safe-area aware. */

const TABS = [
  {
    href: "/draft",
    label: "Draft",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" strokeDasharray="2.4 3" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/calls",
    label: "Calls",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M13 3L5 13h5l-1 8 8-10h-5z" strokeLinejoin="round" />
      </svg>
    ),
  },
  { href: "/", label: "Home", icon: null }, // center mark
  {
    href: "/roster",
    label: "Roster",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3l2.4 5.4 5.6.6-4.2 3.9 1.2 5.6L12 15.6 7 18.5l1.2-5.6L4 9l5.6-.6z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/wallet",
    label: "Wallet",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="6" width="18" height="13" rx="2.5" />
        <path d="M16 12.5h2.5M3 10h18" />
      </svg>
    ),
  },
] as const;

export function TabBar({ homeHref = "/", homeLabel = "Home" }: { homeHref?: string; homeLabel?: string }) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-edge bg-ink/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      {TABS.map((tab) => {
        // Center tab is the mark: fans go home, creators go to their HQ.
        const href = tab.icon === null ? homeHref : tab.href;
        const label = tab.icon === null ? homeLabel : tab.label;
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={tab.label}
            href={href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold uppercase tracking-wider transition ${
              active ? "text-lime" : "text-muted"
            }`}
          >
            {tab.icon ?? <LogoMark className={`h-5 w-5 ${active ? "" : "opacity-60 grayscale"}`} />}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
