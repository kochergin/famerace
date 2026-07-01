export function money(cents: number | bigint, opts: { compact?: boolean } = {}): string {
  const dollars = Number(cents) / 100;
  if (opts.compact && Math.abs(dollars) >= 1000) {
    return `$${Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(dollars)}`;
  }
  return Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: dollars % 1 === 0 ? 0 : 2,
  }).format(dollars);
}

export function num(raw: number | bigint): string {
  const n = Number(raw);
  return Intl.NumberFormat("en-US", { notation: n >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
}

export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function countdown(to: Date): string {
  const ms = to.getTime() - Date.now();
  if (ms <= 0) return "now";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export const CATEGORY_LABELS: Record<string, string> = {
  MUSICIAN: "Musician",
  INTERNET_CREATOR: "Creator",
  BUILDER_FOUNDER: "Builder",
  ARTIST_DESIGNER: "Artist",
};
