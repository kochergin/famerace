"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FormError } from "@/components/form-error";
import { LogoMark } from "@/components/logo";
import { Monogram } from "@/components/monogram";
import { SubmitButton } from "@/components/submit-button";
import { TiltCard } from "@/components/tilt-card";

/* Joining is a game, not a form: your rookie card literally builds itself
   while you type — name on the card, deterministic colors from your handle,
   a shuffle for the undecided, and a password meter that books you bigger
   venues as it gets stronger. */

const inputClass =
  "w-full rounded border border-edge bg-ink px-3 py-2.5 text-chalk placeholder:text-muted focus:border-lime focus:outline-none";

const HANDLE_SEEDS: [string[], string[]] = [
  ["early", "front", "first", "deep", "loud", "night", "neon", "rare", "wild", "gold"],
  ["eyes", "row", "call", "cut", "signal", "shift", "taste", "wave", "scout", "pulse"],
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

/* Live username sanitizer: keeps interior AND trailing underscores so you can
   actually type "cool_cat", drops only characters the server rejects, and
   never falls back to raw invalid input (server allows [a-z0-9_]). */
function sanitizeHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+/, "")
    .slice(0, 20);
}

/* Venue tour: the password meter. Same checks as the server minimum, the
   labels just make you want to reach the stadium. */
function venue(password: string): { stage: number; label: string } {
  if (password.length === 0) return { stage: 0, label: "" };
  let stage = 0;
  if (password.length >= 8) stage = 1;
  if (password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password)) stage += 1;
  if (password.length >= 8 && /\d/.test(password)) stage += 1;
  if (password.length >= 12 || /[^a-zA-Z0-9]/.test(password)) stage += 1;
  stage = Math.min(4, stage);
  const labels = ["Garage set", "Open mic", "Club night", "Headliner", "Stadium tour"];
  return { stage, label: labels[stage]! };
}

const METER_TONES = ["bg-velvet", "bg-pink", "bg-gold", "bg-lime", "bg-lime"];

function RookieCard({ displayName, username }: { displayName: string; username: string }) {
  const cardName = username || displayName;
  const empty = !displayName && !username;
  return (
    <TiltCard>
      <div
        className={`card relative overflow-hidden p-5 transition-colors ${empty ? "border-dashed" : "border-lime/40"}`}
        style={{ "--glow": "rgb(201 247 58 / 0.25)" } as React.CSSProperties}
      >
        <div className="flex items-center justify-between">
          <span className="stat text-[10px] uppercase tracking-[0.3em] text-muted">
            Season 1 · rookie card
          </span>
          <LogoMark className="h-5 w-5" />
        </div>
        <div className="mt-4 flex items-center gap-4">
          {cardName ? (
            <Monogram name={cardName} size="lg" ring="live" />
          ) : (
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-edge text-xl text-muted">
              ?
            </span>
          )}
          <div className="min-w-0">
            <p className={`display truncate text-3xl leading-none ${displayName ? "text-chalk" : "text-muted/60"}`}>
              {displayName || "Your name"}
            </p>
            <p className={`stat mt-1 truncate text-sm ${username ? "text-lime" : "text-muted/60"}`}>
              @{username || "your_handle"}
            </p>
          </div>
        </div>
        <p className="stat mt-4 text-[10px] uppercase tracking-widest text-muted">
          {empty ? "The card builds as you type →" : "Genesis number reserved at signup"}
        </p>
      </div>
    </TiltCard>
  );
}

export function JoinPlayground({
  action,
  refCode,
  error,
  heroLine,
  stats,
}: {
  action: (formData: FormData) => Promise<void>;
  refCode?: string;
  error?: string;
  heroLine: string;
  stats: { pledgedLabel: string; backers: number; liveCount: number };
}) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [handleTouched, setHandleTouched] = useState(false);
  const [password, setPassword] = useState("");
  const meter = useMemo(() => venue(password), [password]);

  const shuffle = () => {
    const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)]!;
    setUsername(`${pick(HANDLE_SEEDS[0])}${pick(HANDLE_SEEDS[1])}${Math.floor(Math.random() * 90) + 10}`);
    setHandleTouched(true);
  };

  return (
    <div className="mx-auto grid max-w-4xl items-center gap-10 py-8 md:grid-cols-2">
      <div className="fade-up hidden md:block">
        <p className="chip border border-lime/40 bg-lime/10 text-lime">Genesis Draft · Season 1</p>
        <h2 className="display mt-4 text-6xl leading-none">
          Find them early.
          <br />
          Back their rise.
          <br />
          <span className="display-hot">Prove your taste.</span>
        </h2>
        <div className="stat mt-6 flex flex-wrap gap-2 text-xs font-bold">
          <span className="chip border border-lime/30 text-lime">{stats.pledgedLabel} pledged</span>
          <span className="chip border border-edge text-chalk">{stats.backers} early backers</span>
          <span className="chip border border-pink/30 text-pink">{stats.liveCount} live on the curve</span>
        </div>
        <div className="mt-6">
          <RookieCard displayName={displayName} username={username} />
        </div>
      </div>

      <div className="card border-t-2 border-t-lime p-6">
        <p className="stat text-[10px] uppercase tracking-[0.3em] text-muted">Season 1 · open call</p>
        <h1 className="display mt-1 text-4xl">Join the draft</h1>
        <p className="mt-1 text-sm text-muted">{heroLine}</p>
        {/* Mobile: the card rides above the form so typing still plays back */}
        <div className="mt-4 md:hidden">
          <RookieCard displayName={displayName} username={username} />
        </div>
        <form action={action} className="mt-5 space-y-3">
          <FormError error={error} />
          <input
            name="displayName"
            placeholder="Display name"
            required
            autoComplete="name"
            className={inputClass}
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (!handleTouched) setUsername(slugify(e.target.value));
            }}
          />
          <div>
            <div className="flex gap-2">
              <input
                name="username"
                placeholder="Username"
                required
                autoComplete="username"
                className={inputClass}
                value={username}
                onChange={(e) => {
                  setUsername(sanitizeHandle(e.target.value));
                  setHandleTouched(true);
                }}
              />
              <button
                type="button"
                onClick={shuffle}
                title="Deal me a handle"
                className="shrink-0 rounded border border-edge px-3 text-lg transition hover:border-lime hover:text-lime"
              >
                🎲
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Your handle picks your colors — watch the card.
            </p>
          </div>
          <input name="email" type="email" placeholder="Email" required autoComplete="email" className={inputClass} />
          <div>
            <input
              name="password"
              type="password"
              placeholder="Password (8+ characters)"
              required
              minLength={8}
              autoComplete="new-password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {password ? (
              <div className="mt-1.5">
                <div className="flex gap-1" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        meter.stage > i ? METER_TONES[meter.stage]! : "bg-edge"
                      }`}
                    />
                  ))}
                </div>
                <p className="stat mt-1 text-[10px] uppercase tracking-widest text-muted">
                  Booked venue: <span className={meter.stage >= 3 ? "text-lime" : "text-chrome"}>{meter.label}</span>
                </p>
              </div>
            ) : null}
          </div>
          {refCode ? <input type="hidden" name="referralCode" value={refCode} /> : null}
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" name="dobAttested18" required className="mt-1 accent-lime" />
            I confirm I am 18 or older.
          </label>
          <SubmitButton
            pendingLabel="Setting up your wallet…"
            className="w-full rounded bg-lime px-4 py-3 font-bold uppercase tracking-wide text-ink shadow-[0_0_24px_rgba(201,247,58,0.25)] hover:brightness-110"
          >
            Claim my seat
          </SubmitButton>
        </form>
        <p className="mt-4 text-sm text-muted">
          Already drafted?{" "}
          <Link href="/login" className="font-semibold text-lime hover:brightness-110">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
