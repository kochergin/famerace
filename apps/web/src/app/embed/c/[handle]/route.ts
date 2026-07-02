import { calls as callsMod } from "@famerace/core";
import { prisma } from "@famerace/db";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Embeddable creator widget (iframe): price + the internet's number.
 *  Polymarket's distribution trick — the odds card lives everywhere. */
export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const creator = await prisma.creator.findUnique({
    where: { handle },
    include: { market: { select: { ticker: true, priceCents: true, holderCount: true } } },
  });
  if (!creator || !["LAUNCHING_SOON", "LIVE", "PAUSED"].includes(creator.status)) {
    return new Response("Not found", { status: 404 });
  }
  const [call] = await callsMod.callsForCreator(creator.id, 1);
  const yes = call ? callsMod.yesShare(call) : null;
  const price = creator.market ? `$${(creator.market.priceCents / 100).toFixed(2)}` : "—";

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(creator.displayName)} — FameRace</title>
<style>
  body{margin:0;font-family:ui-monospace,Menlo,monospace;background:#0a0a0d;color:#f4f4f0}
  a{color:inherit;text-decoration:none}
  .card{display:block;padding:16px 18px;border:1px solid #26262e;border-radius:12px;margin:8px;background:radial-gradient(120% 90% at 50% 0%,rgba(201,247,58,.08),transparent 60%),#101014}
  .k{font-size:10px;letter-spacing:.25em;text-transform:uppercase;color:#8b8b96}
  .n{font-size:26px;font-weight:800;margin:2px 0 8px;color:#f4f4f0;font-family:Arial Black,Arial,sans-serif}
  .row{display:flex;justify-content:space-between;font-size:13px;margin-top:6px}
  .lime{color:#c9f73a}.pink{color:#ff3d8d}
  .bar{display:flex;height:8px;border-radius:99px;overflow:hidden;background:#26262e;margin-top:6px}
  .bar b{background:#c9f73a}.bar i{background:#ff3d8d}
  .q{font-size:12px;color:#d9dbe3;margin-top:10px}
  .f{font-size:10px;color:#8b8b96;margin-top:10px;text-transform:uppercase;letter-spacing:.2em}
</style></head><body>
<a class="card" href="${esc(process.env.NEXT_PUBLIC_BASE_URL ?? "https://famerace.fun")}/c/${esc(handle)}" target="_blank" rel="noreferrer">
  <div class="k">$${esc(creator.market?.ticker ?? "")} · FameRace</div>
  <div class="n">${esc(creator.displayName)}</div>
  <div class="row"><span>Price</span><span class="lime">${price}</span></div>
  <div class="row"><span>Backers</span><span>${creator.market?.holderCount ?? 0}</span></div>
  ${
    call
      ? `<div class="q">“${esc(call.question)}”</div>
  <div class="bar"><b style="width:${Math.round((yes ?? 0.5) * 100)}%"></b><i style="flex:1"></i></div>
  <div class="row"><span class="lime">${yes === null ? "—" : `${Math.round(yes * 100)}% yes`}</span><span class="pink">${yes === null ? "—" : `${100 - Math.round(yes * 100)}% no`}</span></div>`
      : ""
  }
  <div class="f">Back the rise → famerace.fun</div>
</a>
</body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}
