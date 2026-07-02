// Server-rendered price sparkline (PRD §15A.3: charts should be simple,
// story-first, never intimidating trading UI). Pure SVG, no client JS.

export function Sparkline({
  points,
  width = 220,
  height = 56,
  className = "",
}: {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);
  const pad = 4;
  const stepX = (width - pad * 2) / (points.length - 1);
  const y = (value: number) => height - pad - ((value - min) / range) * (height - pad * 2);
  const coords = points.map((value, index) => [pad + index * stepX, y(value)] as const);
  const path = coords.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const rising = points[points.length - 1]! >= points[0]!;
  const stroke = rising ? "#c9f73a" : "#ff3d8d";
  const last = coords[coords.length - 1]!;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Price history"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${last[0].toFixed(1)},${height - pad} L${pad},${height - pad} Z`} fill="url(#spark-fill)" />
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        className="spark-draw"
      />
      {/* launch point — where the story starts */}
      <circle cx={coords[0]![0]} cy={coords[0]![1]} r="2.5" fill="#3d7bff" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={stroke}>
        <animate attributeName="r" values="3;4.5;3" dur="1.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
