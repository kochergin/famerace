import type { Metadata } from "next";
import Link from "next/link";
import { unstable_ViewTransition as ViewTransition } from "react";
import { Archivo_Black, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { copy, draftday, notify } from "@famerace/core";
import { currentUser } from "@/lib/session";
import { Countdown } from "@/components/countdown";
import { Monogram } from "@/components/monogram";
import { NavLink } from "@/components/nav-link";
import "./globals.css";

const display = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-display-web" });
const body = Space_Grotesk({ subsets: ["latin"], variable: "--font-body-web" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-web" });

export const metadata: Metadata = {
  title: "FameRace — Back the rise.",
  description: copy.oneLiner,
};

const NAV = [
  { href: "/draft", label: "Draft" },
  { href: "/live", label: "Live" },
  { href: "/launching", label: "Launching" },
  { href: "/missions", label: "Missions" },
  { href: "/roster", label: "Roster" },
  { href: "/scouts", label: "Scouts" },
  { href: "/crews", label: "Crews" },
  { href: "/famerace-100", label: "100" },
] as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const isAdmin = user?.roles.some((r) => r === "ADMIN" || r === "MODERATOR");
  const [unread, draftDay] = await Promise.all([
    user ? notify.unreadCount(user.id) : 0,
    draftday.draftDayInfo(),
  ]);

  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-40 border-b border-edge bg-ink/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="display text-2xl text-lime">
              FameRace
            </Link>
            <nav className="hidden gap-4 text-sm font-semibold uppercase tracking-wide md:flex">
              {NAV.map((item) => (
                <NavLink key={item.href} href={item.href}>
                  {item.label}
                </NavLink>
              ))}
              {isAdmin ? (
                <Link href="/admin" className="text-pink transition hover:text-chalk">
                  Admin
                </Link>
              ) : null}
            </nav>
            <div className="ml-auto flex items-center gap-3 text-sm">
              {user ? (
                <>
                  {user.roles.includes("CREATOR") ? (
                    <Link href="/dashboard" className="font-semibold text-chrome hover:text-chalk">
                      Dashboard
                    </Link>
                  ) : null}
                  <Link
                    href="/notifications"
                    className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:bg-panel hover:text-chalk"
                    title="Notifications"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                    </svg>
                    {unread > 0 ? (
                      <span className="stat absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink px-1 text-[10px] font-bold leading-none text-ink">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    ) : null}
                  </Link>
                  <Link href={`/u/${user.username}`} className="flex items-center gap-2 font-semibold text-chalk transition hover:text-lime">
                    <Monogram name={user.username} src={user.avatarUrl} size="sm" />
                    <span className="hidden sm:inline">@{user.username}</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-muted hover:text-chalk">
                    Sign in
                  </Link>
                  <Link
                    href="/join"
                    className="rounded bg-lime px-3 py-1.5 font-bold uppercase tracking-wide text-ink hover:brightness-110"
                  >
                    Join
                  </Link>
                </>
              )}
            </div>
          </div>
          <nav className="flex gap-4 overflow-x-auto px-4 pb-2 text-xs font-semibold uppercase tracking-wide md:hidden" style={{ maskImage: "linear-gradient(90deg, black 88%, transparent)" }}>
            {NAV.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
        {/* Draft Day strip: the whole app counts down to the same moment */}
        {draftDay.state === "before" && draftDay.draftDayAt ? (
          <Link
            href="/draft-day"
            className="block border-b border-lime/30 bg-lime/10 px-4 py-1.5 text-center text-xs font-bold uppercase tracking-widest text-lime transition hover:bg-lime/15"
          >
            Draft Day — the Genesis reveal in{" "}
            <Countdown to={draftDay.draftDayAt.toISOString()} className="stat" /> · watch it live →
          </Link>
        ) : draftDay.state === "live" ? (
          <Link
            href="/draft-day"
            className="block border-b border-pink/40 bg-pink/15 px-4 py-1.5 text-center text-xs font-bold uppercase tracking-widest text-pink transition hover:bg-pink/20"
          >
            <span className="pulse-soft mr-1.5 inline-block h-2 w-2 rounded-full bg-pink align-middle" />
            Draft Day is live — the board is revealing now →
          </Link>
        ) : null}
        <main className="mx-auto max-w-6xl px-4 py-6">
          <ViewTransition>{children}</ViewTransition>
        </main>
        {/* The chant — giant outlined type rolling past like arena signage */}
        <div aria-hidden className="mt-20 overflow-hidden">
          <div className="marquee-slow chant">
            {[0, 1].map((i) => (
              <span key={i} className="pr-16">
                BACK THE RISE ✦ FIND THEM EARLY ✦ THE INTERNET DECIDES ✦ PROVE YOUR TASTE ✦{" "}
              </span>
            ))}
          </div>
        </div>
        <footer className="border-t border-edge py-8 text-center text-xs text-muted">
          <p className="display text-lg text-chrome">{copy.tagline}</p>
          <p className="mt-2 mx-auto max-w-lg">{copy.footerLegal}</p>
          <p className="mt-2">
            <Link href="/terms" className="underline hover:text-chalk">
              Terms, disclosures &amp; fees
            </Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
