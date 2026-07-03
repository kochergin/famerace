"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Monogram } from "@/components/monogram";

/* ⌘K — the whole product one keystroke away. Creators, the board, people,
   pages; arrows + enter; esc closes. The search button in the header opens
   the same palette on touch. */

type Result = { group: string; label: string; sub: string; href: string; avatarUrl?: string | null; name: string };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const onOpen = () => setOpen(true);
    window.addEventListener("famerace:search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("famerace:search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([]);
      return;
    }
    const mySeq = ++seq.current;
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`).then((r) => r.json()).catch(() => null);
      if (res && seq.current === mySeq) {
        setResults(res.results as Result[]);
        setActive(0);
      }
    }, 140);
    return () => clearTimeout(t);
  }, [query, open]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-ink/70 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="story-in w-full max-w-lg overflow-hidden rounded-lg border border-edge bg-graphite shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-edge px-4">
          <span aria-hidden className="text-muted">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                go(results[active]!.href);
              }
            }}
            placeholder="Search creators, the board, people…"
            className="w-full bg-transparent py-3.5 text-sm text-chalk placeholder:text-muted focus:outline-none"
          />
          <kbd className="stat rounded border border-edge px-1.5 py-0.5 text-[10px] text-muted">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim() === "" ? (
            <p className="px-3 py-6 text-center text-xs text-muted">
              Type a name, a handle, a page — the race is one keystroke away.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted">Nothing on the board for “{query}” yet.</p>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.href}-${index}`}
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => go(result.href)}
                className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left transition ${
                  index === active ? "bg-panel" : ""
                }`}
              >
                {result.group === "Go to" ? (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-edge text-muted">→</span>
                ) : (
                  <Monogram name={result.name} src={result.avatarUrl} size="sm" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-chalk">{result.label}</span>
                  <span className="block truncate text-xs text-muted">{result.sub}</span>
                </span>
                <span className="stat shrink-0 text-[10px] uppercase tracking-widest text-muted">{result.group}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Header search button — opens the palette (mobile + mouse users). */
export function SearchButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("famerace:search"))}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition hover:bg-panel hover:text-chalk"
      title="Search (⌘K)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
    </button>
  );
}
