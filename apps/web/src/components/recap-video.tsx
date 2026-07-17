"use client";

import { useState } from "react";
import type { RecapSlide } from "@/components/recap-story";
import { gradientPair } from "@/components/monogram";

/* Recap video export: renders the story to a vertical 1080×1920 WebM in the
   browser (canvas.captureStream + MediaRecorder) — the TikTok-ready receipt.
   No servers, no ffmpeg; ~10s render for a ~10s clip. */

const W = 1080;
const H = 1920;
const SCENE_MS = 2300;
const FPS = 30;

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

type Scene = (ctx: CanvasRenderingContext2D, t: number) => void;

function display(ctx: CanvasRenderingContext2D, size: number) {
  ctx.font = `800 ${size}px "Big Shoulders", "Arial Narrow", "Arial Black", sans-serif`;
}
function mono(ctx: CanvasRenderingContext2D, size: number) {
  ctx.font = `${size}px "JetBrains Mono", monospace`;
}

function bg(ctx: CanvasRenderingContext2D, accent: string, from: string, to: string) {
  ctx.fillStyle = "#0a0a0d";
  ctx.fillRect(0, 0, W, H);
  const top = ctx.createRadialGradient(W / 2, -200, 100, W / 2, -200, 1400);
  top.addColorStop(0, `${accent}30`);
  top.addColorStop(1, "transparent");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H);
  const corner = ctx.createRadialGradient(W, H, 100, W, H, 1200);
  corner.addColorStop(0, `${to}22`);
  corner.addColorStop(1, "transparent");
  ctx.fillStyle = corner;
  ctx.fillRect(0, 0, W, H);
  const corner2 = ctx.createRadialGradient(0, H, 100, 0, H, 1000);
  corner2.addColorStop(0, `${from}1c`);
  corner2.addColorStop(1, "transparent");
  ctx.fillStyle = corner2;
  ctx.fillRect(0, 0, W, H);
}

function eyebrow(ctx: CanvasRenderingContext2D, text: string, y: number, t: number) {
  ctx.globalAlpha = ease(t * 2);
  mono(ctx, 34);
  ctx.fillStyle = "#8b8b96";
  ctx.textAlign = "center";
  ctx.fillText(text.toUpperCase().split("").join(" "), W / 2, y);
  ctx.globalAlpha = 1;
}

function bigLines(ctx: CanvasRenderingContext2D, lines: { text: string; color?: string }[], y0: number, t: number, size = 120) {
  ctx.textAlign = "center";
  lines.forEach((line, index) => {
    const lt = ease(t * 2.2 - index * 0.25);
    if (lt <= 0) return;
    ctx.globalAlpha = lt;
    display(ctx, size);
    ctx.fillStyle = line.color ?? "#f4f4f0";
    ctx.fillText(line.text, W / 2, y0 + index * (size * 1.12) + (1 - lt) * 40);
  });
  ctx.globalAlpha = 1;
}

function avatarTile(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, name: string, cx: number, cy: number, size: number, t: number) {
  const [from, to] = gradientPair(name);
  const s = size * (0.85 + 0.15 * ease(t * 2));
  ctx.save();
  ctx.globalAlpha = ease(t * 2);
  const r = s * 0.22;
  ctx.beginPath();
  ctx.roundRect(cx - s / 2, cy - s / 2, s, s, r);
  ctx.clip();
  if (img) {
    ctx.filter = "grayscale(1) contrast(1.1)";
    ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s);
    ctx.filter = "none";
    const tone = ctx.createLinearGradient(cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2);
    tone.addColorStop(0, `${from}80`);
    tone.addColorStop(1, `${to}80`);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = tone;
    ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    ctx.globalCompositeOperation = "source-over";
  } else {
    const grad = ctx.createLinearGradient(cx - s / 2, cy - s / 2, cx + s / 2, cy + s / 2);
    grad.addColorStop(0, from);
    grad.addColorStop(1, to);
    ctx.fillStyle = grad;
    ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
    display(ctx, s * 0.42);
    ctx.fillStyle = "#0a0a0d";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.slice(0, 2).toUpperCase(), cx, cy + s * 0.03);
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function buildScenes(slides: RecapSlide[], username: string, avatar: HTMLImageElement | null): Scene[] {
  const [from, to] = gradientPair(username);
  const scenes: Scene[] = [];
  for (const slide of slides) {
    if (slide.kind === "cover") {
      scenes.push((ctx, t) => {
        bg(ctx, "#c9f73a", from, to);
        avatarTile(ctx, avatar, slide.name, W / 2, 640, 380, t);
        eyebrow(ctx, `@${slide.username}`, 950, t);
        bigLines(ctx, [{ text: "YOUR SEASON" }, { text: "SO FAR.", color: "#c9f73a" }], 1150, t);
      });
    }
    if (slide.kind === "first") {
      scenes.push((ctx, t) => {
        bg(ctx, "#3d7bff", from, to);
        eyebrow(ctx, `It started ${slide.whenLabel}`, 560, t);
        bigLines(ctx, [{ text: "YOU CALLED" }, { text: slide.name.toUpperCase(), color: "#3d7bff" }, { text: "EARLY." }], 760, t, 110);
        ctx.globalAlpha = ease(t * 1.6 - 0.4);
        mono(ctx, 40);
        ctx.fillStyle = "#8b8b96";
        ctx.fillText(`${slide.amountLabel} — before the crowd`, W / 2, 1280);
        ctx.globalAlpha = 1;
      });
    }
    if (slide.kind === "numbers") {
      scenes.push((ctx, t) => {
        bg(ctx, "#f4f4f0", from, to);
        eyebrow(ctx, "The receipts", 480, t);
        const colors = ["#c9f73a", "#f0c33c", "#3d7bff", "#ff3d8d"];
        slide.items.slice(0, 4).forEach((item, index) => {
          const col = index % 2;
          const row = Math.floor(index / 2);
          const x = W / 4 + col * (W / 2);
          const y = 800 + row * 420;
          const it = ease(t * 2.4 - index * 0.18);
          if (it <= 0) return;
          ctx.globalAlpha = it;
          display(ctx, 150);
          ctx.fillStyle = colors[index]!;
          ctx.textAlign = "center";
          ctx.fillText(String(Math.round(item.value * it)), x, y);
          mono(ctx, 30);
          ctx.fillStyle = "#8b8b96";
          ctx.fillText(item.label.toUpperCase(), x, y + 70);
          ctx.globalAlpha = 1;
        });
      });
    }
    if (slide.kind === "call") {
      scenes.push((ctx, t) => {
        bg(ctx, "#f0c33c", from, to);
        eyebrow(ctx, "Your biggest call", 480, t);
        avatarTile(ctx, avatar && slide.avatarUrl ? avatar : null, slide.name, W / 2, 780, 340, t);
        bigLines(ctx, [{ text: slide.name.toUpperCase(), color: "#f0c33c" }], 1080, t, 120);
        if (slide.backerRank) {
          ctx.globalAlpha = ease(t * 1.6 - 0.4);
          mono(ctx, 42);
          ctx.fillStyle = "#f4f4f0";
          ctx.fillText(`Backer #${slide.backerRank} · forever`, W / 2, 1220);
          ctx.globalAlpha = 1;
        }
      });
    }
    if (slide.kind === "taste") {
      scenes.push((ctx, t) => {
        bg(ctx, "#c9f73a", from, to);
        eyebrow(ctx, "The reveal", 460, t);
        const cx = W / 2;
        const cy = 820;
        const radius = 230;
        ctx.lineWidth = 26;
        ctx.strokeStyle = "rgba(244,244,240,0.12)";
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
        const pct = Math.min(1, slide.score / 100) * ease(t * 1.4);
        ctx.strokeStyle = "#c9f73a";
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
        ctx.stroke();
        display(ctx, 170);
        ctx.fillStyle = "#c9f73a";
        ctx.textAlign = "center";
        ctx.fillText(String(Math.round(slide.score * ease(t * 1.4))), cx, cy + 55);
        bigLines(ctx, [{ text: `TASTE RANK #${slide.rank}`, color: "#f4f4f0" }], 1290, t, 96);
        ctx.globalAlpha = ease(t * 1.6 - 0.4);
        mono(ctx, 38);
        ctx.fillStyle = "#8b8b96";
        ctx.fillText(`of ${slide.ofUsers} scouts this season`, W / 2, 1400);
        ctx.globalAlpha = 1;
      });
    }
    if (slide.kind === "outro") {
      scenes.push((ctx, t) => {
        bg(ctx, "#ff3d8d", from, to);
        bigLines(ctx, [{ text: "BACK" }, { text: "THE RISE.", color: "#ff3d8d" }], 850, t, 150);
        ctx.globalAlpha = ease(t * 1.6 - 0.3);
        mono(ctx, 42);
        ctx.fillStyle = "#8b8b96";
        ctx.fillText(`famerace.fun · @${slide.username}`, W / 2, 1200);
        ctx.globalAlpha = 1;
      });
    }
  }
  return scenes;
}

async function renderVideo(slides: RecapSlide[], username: string): Promise<Blob> {
  await document.fonts.ready;
  const cover = slides.find((s) => s.kind === "cover");
  const avatar = cover?.avatarUrl ? await loadImage(cover.avatarUrl) : null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const scenes = buildScenes(slides, username, avatar);

  const stream = canvas.captureStream(FPS);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });
  recorder.start(250);

  const total = scenes.length * SCENE_MS;
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const frame = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= total) {
        resolve();
        return;
      }
      const index = Math.min(scenes.length - 1, Math.floor(elapsed / SCENE_MS));
      const t = (elapsed - index * SCENE_MS) / SCENE_MS;
      scenes[index]!(ctx, t);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  recorder.stop();
  await stopped;
  return new Blob(chunks, { type: "video/webm" });
}

export function RecapVideoButton({ slides, username }: { slides: RecapSlide[]; username: string }) {
  const [state, setState] = useState<"idle" | "rendering" | "done" | "unsupported">("idle");

  const make = async () => {
    if (typeof MediaRecorder === "undefined") {
      setState("unsupported");
      return;
    }
    setState("rendering");
    try {
      const blob = await renderVideo(slides, username);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `famerace-season-recap-${username}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState("done");
    } catch {
      setState("unsupported");
    }
  };

  return (
    <button
      type="button"
      onClick={make}
      disabled={state === "rendering"}
      className="rounded bg-pink px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-ink hover:brightness-110 disabled:opacity-60"
    >
      {state === "rendering"
        ? "Rendering your video…"
        : state === "done"
          ? "Saved ✓ — post it"
          : state === "unsupported"
            ? "Video not supported here"
            : "Download video ↓"}
    </button>
  );
}
