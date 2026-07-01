import type { Metadata } from "next";
import Link from "next/link";
import { copy } from "@famerace/core";
import { currentUser } from "@/lib/session";
import "./globals.css";

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
] as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const isAdmin = user?.roles.some((r) => r === "ADMIN" || r === "MODERATOR");

  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-40 border-b border-edge bg-ink/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="display text-2xl text-lime">
              FameRace
            </Link>
            <nav className="hidden gap-4 text-sm font-semibold uppercase tracking-wide text-muted md:flex">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="transition hover:text-chalk">
                  {item.label}
                </Link>
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
                  <Link href={`/u/${user.username}`} className="font-semibold text-chalk hover:text-lime">
                    @{user.username}
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
          <nav className="flex gap-4 overflow-x-auto px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted md:hidden">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mt-16 border-t border-edge py-8 text-center text-xs text-muted">
          <p className="display text-lg text-chrome">{copy.tagline}</p>
          <p className="mt-2 mx-auto max-w-lg">{copy.footerLegal}</p>
        </footer>
      </body>
    </html>
  );
}
