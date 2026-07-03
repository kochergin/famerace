"use client";

import { useEffect } from "react";
import { playSound } from "@/lib/sound";

const COLORS = ["#c9f73a", "#ff3d8d", "#f0c33c", "#3d7bff", "#f4f4f0"];

// One-shot brand-colored confetti burst for success moments (backed, pass
// secured, claimed, pledged). Dependency-free canvas; self-removes; skipped
// under prefers-reduced-motion.
export function Confetti({ fireKey }: { fireKey: string }) {
  useEffect(() => {
    if (!fireKey) return;
    playSound("pop");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:60";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }
    ctx.scale(dpr, dpr);

    const w = window.innerWidth;
    const particles = Array.from({ length: 90 }, () => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 7 + Math.random() * 9;
      return {
        x: w / 2 + (Math.random() - 0.5) * w * 0.3,
        y: window.innerHeight * 0.32,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 6,
        color: COLORS[(Math.random() * COLORS.length) | 0]!,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
      };
    });

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = (now - start) / 1600;
      ctx.clearRect(0, 0, w, window.innerHeight);
      if (t >= 1) {
        canvas.remove();
        return;
      }
      for (const p of particles) {
        p.vy += 0.32; // gravity
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t * t);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      canvas.remove();
    };
  }, [fireKey]);

  return null;
}
