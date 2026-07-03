/* The backer arena: your supporters as lit seats in a venue that grows with
   you. Five arced rows facing the stage; every backer lights one seat from
   the front row out. Milestone rooms give the next target a name. */

const ROWS = [8, 12, 17, 27, 36] as const; // 100 seats total
const MILESTONES = [
  { at: 10, label: "Bedroom show" },
  { at: 25, label: "Club night" },
  { at: 50, label: "The Hall" },
  { at: 100, label: "The Arena" },
] as const;

export function nextRoom(lit: number) {
  return MILESTONES.find((m) => lit < m.at) ?? null;
}

export function Arena({ lit, className = "" }: { lit: number; className?: string }) {
  const seats: { x: number; y: number; on: boolean }[] = [];
  let index = 0;
  ROWS.forEach((count, row) => {
    const radius = 34 + row * 13;
    for (let i = 0; i < count; i++) {
      // 200° → -20°: a wide arc wrapping the stage
      const angle = Math.PI * (1.11 - (1.22 * (i + 0.5)) / count);
      seats.push({
        x: 130 + radius * Math.cos(angle),
        y: 96 - radius * Math.sin(angle) * 0.72,
        on: index < lit,
      });
      index += 1;
    }
  });

  return (
    <svg viewBox="0 0 260 110" className={className} aria-hidden>
      {/* the stage you're playing */}
      <rect x="105" y="88" width="50" height="7" rx="3.5" fill="#2a2a33" />
      <rect x="105" y="88" width="50" height="2.5" rx="1.25" fill="#c9f73a" opacity="0.7" />
      {seats.map((seat, i) => (
        <circle
          key={i}
          cx={seat.x.toFixed(1)}
          cy={seat.y.toFixed(1)}
          r="3.1"
          fill={seat.on ? "#c9f73a" : "#22222a"}
          style={seat.on ? { filter: "drop-shadow(0 0 3px rgb(201 247 58 / 0.8))" } : undefined}
        />
      ))}
    </svg>
  );
}
