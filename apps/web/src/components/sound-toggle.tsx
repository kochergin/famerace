"use client";

import { useEffect, useState } from "react";
import { playSound, setSoundEnabled, soundEnabled } from "@/lib/sound";

/* Arena sound: synthesized clicks/chimes on actions. Off by default —
   turning it on plays the chime so you know exactly what you signed up for. */
export function SoundToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(soundEnabled()), []);
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setSoundEnabled(e.target.checked);
          setOn(e.target.checked);
          if (e.target.checked) playSound("chime");
        }}
        className="accent-lime"
      />
      Arena sound — soft clicks and chimes on backs, stakes and confetti
    </label>
  );
}
