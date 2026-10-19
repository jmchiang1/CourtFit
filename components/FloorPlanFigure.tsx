/**
 * Top-down plan of an 8,000 SF (125 × 64 ft) warehouse laid out to scale as a
 * five-court badminton club: five 24 × 50 ft court bays (a 20 × 44 ft court plus
 * buffer) along the back wall, and a lobby strip along the front. Used on the
 * home page to show what "measuring a listing" means.
 *
 * Drawn at 3.84 px per foot. All colors come from theme tokens.
 */

const FT = 3.84
const X0 = 40 // building origin (px)
const Y0 = 40
const W = 125 * FT
const H = 64 * FT

const BAY_W = 24 * FT
const BAY_L = 50 * FT
const BAYS_X0 = X0 + 2.5 * FT // 5 × 24 ft = 120 ft, centred in 125 ft
const LOBBY_Y = Y0 + BAY_L

const bays = [0, 1, 2, 3, 4].map((i) => BAYS_X0 + i * BAY_W)

export function FloorPlanFigure({ className }: { className?: string }) {
  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${X0 * 2 + W} ${Y0 + H + 16}`}
        className="h-auto w-full text-foreground"
        role="img"
        aria-label="Floor plan of a 125 by 64 foot warehouse fitting five badminton courts and a lobby"
      >
        <defs>
          <pattern id="fp-grid" width={5 * FT} height={5 * FT} patternUnits="userSpaceOnUse" x={X0} y={Y0}>
            <path d={`M ${5 * FT} 0 H 0 V ${5 * FT}`} fill="none" stroke="var(--border)" strokeWidth="1" />
          </pattern>
        </defs>

        {/* building slab */}
        <rect x={X0} y={Y0} width={W} height={H} fill="var(--panel)" />
        <rect x={X0} y={Y0} width={W} height={H} fill="url(#fp-grid)" />

        {/* courts */}
        {bays.map((x) => (
          <Court key={x} x={x + 2 * FT} y={Y0 + 3 * FT} />
        ))}

        {/* bay dividers */}
        {bays.slice(1).map((x) => (
          <path
            key={x}
            d={`M ${x} ${Y0 + 2 * FT} V ${LOBBY_Y - 2 * FT}`}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="3 4"
            opacity="0.35"
          />
        ))}

        {/* lobby wall with an opening, and label */}
        <path
          d={`M ${X0} ${LOBBY_Y} H ${X0 + 52 * FT} M ${X0 + 64 * FT} ${LOBBY_Y} H ${X0 + W}`}
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.55"
        />
        <text
          x={X0 + W / 2}
          y={LOBBY_Y + 7 * FT}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground"
          style={{ fontSize: 12 }}
        >
          Lobby, lounge &amp; restrooms
        </text>

        {/* exterior walls + front door */}
        <rect x={X0} y={Y0} width={W} height={H} fill="none" stroke="currentColor" strokeWidth="3" />
        <path d={`M ${X0 + 18 * FT} ${Y0 + H} h ${8 * FT}`} stroke="var(--paper)" strokeWidth="5" />

        {/* dimension lines */}
        <Dimension x1={X0} y1={Y0 - 20} x2={X0 + W} y2={Y0 - 20} label="125 ft" />
        <Dimension x1={X0 - 20} y1={Y0} x2={X0 - 20} y2={Y0 + H} label="64 ft" vertical />
      </svg>
    </figure>
  )
}

/** A 20 × 44 ft badminton doubles court, drawn lengthwise (net across). */
function Court({ x, y }: { x: number; y: number }) {
  const w = 20 * FT
  const l = 44 * FT
  const net = y + l / 2
  const short = 6.5 * FT // short service line, from the net
  const long = 2.5 * FT // doubles long service line, from the back
  const cx = x + w / 2
  return (
    <g>
      <rect x={x} y={y} width={w} height={l} fill="var(--court-fill)" />
      <g stroke="#fff" strokeWidth="0.9" fill="none" opacity="0.6">
        <path d={`M ${x + 1.5 * FT} ${y} V ${y + l} M ${x + w - 1.5 * FT} ${y} V ${y + l}`} />
        <path d={`M ${x} ${net - short} H ${x + w} M ${x} ${net + short} H ${x + w}`} />
        <path d={`M ${x} ${y + long} H ${x + w} M ${x} ${y + l - long} H ${x + w}`} />
        <path d={`M ${cx} ${y} V ${net - short} M ${cx} ${net + short} V ${y + l}`} />
      </g>
      <path d={`M ${x - 1.5} ${net} H ${x + w + 1.5}`} stroke="#fff" strokeWidth="1.75" />
    </g>
  )
}

function Dimension({
  x1,
  y1,
  x2,
  y2,
  label,
  vertical = false,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  label: string
  vertical?: boolean
}) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const t = 5
  return (
    <g className="text-muted-foreground" stroke="currentColor" strokeWidth="1">
      <path d={`M ${x1} ${y1} L ${x2} ${y2}`} />
      {vertical ? (
        <path d={`M ${x1 - t} ${y1} h ${t * 2} M ${x2 - t} ${y2} h ${t * 2}`} />
      ) : (
        <path d={`M ${x1} ${y1 - t} v ${t * 2} M ${x2} ${y2 - t} v ${t * 2}`} />
      )}
      <rect
        x={vertical ? mx - 10 : mx - 24}
        y={vertical ? my - 24 : my - 8}
        width={vertical ? 20 : 48}
        height={vertical ? 48 : 16}
        fill="var(--paper)"
        stroke="none"
      />
      <text
        x={mx}
        y={my}
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        stroke="none"
        transform={vertical ? `rotate(-90 ${mx} ${my})` : undefined}
        style={{ fontSize: 12 }}
      >
        {label}
      </text>
    </g>
  )
}
