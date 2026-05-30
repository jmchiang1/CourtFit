import { cn } from '@/lib/utils'

export type CourtVariant = 'pickleball' | 'badminton' | 'tennis'

/**
 * A hand-built isometric racket court, rendered as inline SVG so it stays crisp
 * at any size and tracks the brand palette. Geometry is projected from flat court
 * coordinates through a 2:1 isometric transform, so lines, net and slab stay
 * consistent. The `variant` swaps proportions, surface color and line markings
 * between pickleball, badminton and tennis.
 */

// 2:1 isometric projection of a ground point (x along length, y across width,
// z up) to screen space. cos30/sin30 give the classic isometric tilt.
const COS = Math.cos(Math.PI / 6)
const SIN = Math.sin(Math.PI / 6)
const SCALE = 1.5
const OX = 150 // origin offset so the diamond sits inside the viewBox
const OY = 18
const WID = 100 // court width in local units (constant; length varies by sport)
const T = 16 // slab thickness (screen px, downward)
const NH = 44 // net height (screen px, upward)
const CY = WID / 2

type P2 = [number, number]
const proj = (x: number, y: number, z = 0): P2 => [
  OX + (x - y) * COS * SCALE,
  OY + (x + y) * SIN * SCALE - z,
]
const f = (v: number) => v.toFixed(1)
const poly = (pts: P2[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join(' ') + ' Z'
const seg = (a: P2, b: P2) => `M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])}`
const down = ([x, y]: P2): P2 => [x, y + T]

interface CourtSpec {
  len: number
  grad: [string, string]
  zones: { x0: number; x1: number; fill: string; opacity: number }[]
  /** Inner line markings as flat-coordinate point pairs. */
  lines: [P2, P2][]
}

function specFor(variant: CourtVariant): CourtSpec {
  if (variant === 'badminton') {
    const len = 220
    const NET = len / 2
    const SIDE = 7.5 // singles sideline inset
    const SVC = 32.5 // short service line distance from net
    const LONG = 12.5 // doubles long service line from back boundary
    return {
      len,
      grad: ['var(--brand)', 'var(--success)'],
      zones: [],
      lines: [
        [[0, SIDE], [len, SIDE]], // singles sidelines
        [[0, WID - SIDE], [len, WID - SIDE]],
        [[NET - SVC, 0], [NET - SVC, WID]], // short service lines
        [[NET + SVC, 0], [NET + SVC, WID]],
        [[LONG, 0], [LONG, WID]], // doubles long service lines
        [[len - LONG, 0], [len - LONG, WID]],
        [[0, CY], [NET - SVC, CY]], // center lines splitting service courts
        [[NET + SVC, CY], [len, CY]],
      ],
    }
  }

  if (variant === 'tennis') {
    const len = 217
    const NET = len / 2
    const ALLEY = 12.5 // singles sideline inset (doubles alley width)
    const SVC = 58.4 // service line distance from net
    return {
      len,
      grad: ['var(--chart-3)', 'var(--brand)'],
      zones: [],
      lines: [
        [[0, ALLEY], [len, ALLEY]], // singles sidelines (alleys)
        [[0, WID - ALLEY], [len, WID - ALLEY]],
        [[NET - SVC, ALLEY], [NET - SVC, WID - ALLEY]], // service lines
        [[NET + SVC, ALLEY], [NET + SVC, WID - ALLEY]],
        [[NET - SVC, CY], [NET + SVC, CY]], // center service line
      ],
    }
  }

  // pickleball
  const len = 220
  const NET = len / 2
  const K0 = NET - 35
  const K1 = NET + 35
  return {
    len,
    grad: ['var(--brand)', 'var(--chart-3)'],
    zones: [{ x0: K0, x1: K1, fill: 'var(--danger)', opacity: 0.8 }],
    lines: [
      [[K0, 0], [K0, WID]], // non-volley "kitchen" lines
      [[K1, 0], [K1, WID]],
      [[0, CY], [K0, CY]], // center service lines
      [[K1, CY], [len, CY]],
    ],
  }
}

export function CourtIllustration({
  variant = 'pickleball',
  className,
}: {
  variant?: CourtVariant
  className?: string
}) {
  const s = specFor(variant)
  const { len } = s
  const NET = len / 2

  const TL = proj(0, 0)
  const TR = proj(len, 0)
  const BL = proj(0, WID)
  const BR = proj(len, WID)

  const NB0 = proj(NET, 0)
  const NB1 = proj(NET, WID)
  const NT0 = proj(NET, 0, NH)
  const NT1 = proj(NET, WID, NH)

  const mesh: string[] = []
  for (let i = 0; i <= 12; i++) {
    const y = (WID * i) / 12
    mesh.push(seg(proj(NET, y), proj(NET, y, NH)))
  }
  for (let j = 1; j <= 3; j++) {
    const z = (NH * j) / 4
    mesh.push(seg(proj(NET, 0, z), proj(NET, WID, z)))
  }

  const gid = `ct-top-${variant}`
  const bid = `ct-blur-${variant}`

  return (
    <svg
      viewBox="0 0 460 310"
      fill="none"
      className={cn('h-auto w-full', className)}
      role="img"
      aria-label={`Isometric ${variant} court`}
    >
      <defs>
        <linearGradient id={gid} x1={TL[0]} y1={TL[1]} x2={BR[0]} y2={BR[1]} gradientUnits="userSpaceOnUse">
          <stop stopColor={s.grad[0]} />
          <stop offset="1" stopColor={s.grad[1]} />
        </linearGradient>
        <filter id={bid} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      {/* soft contact shadow */}
      <ellipse cx={proj(NET, CY)[0]} cy={BR[1] + 6} rx="168" ry="40" fill="black" opacity="0.4" filter={`url(#${bid})`} />

      {/* slab side faces (front-right lit, front-left in shadow) */}
      <path d={poly([TR, BR, down(BR), down(TR)])} fill="oklch(0.30 0.045 235)" />
      <path d={poly([BL, BR, down(BR), down(BL)])} fill="oklch(0.22 0.04 235)" />

      {/* playing surface */}
      <path d={poly([TL, TR, BR, BL])} fill={`url(#${gid})`} />
      {s.zones.map((z, i) => (
        <path
          key={i}
          d={poly([proj(z.x0, 0), proj(z.x1, 0), proj(z.x1, WID), proj(z.x0, WID)])}
          fill={z.fill}
          opacity={z.opacity}
        />
      ))}

      {/* court lines */}
      <g stroke="white" strokeWidth="2" strokeLinejoin="round" opacity="0.9" vectorEffect="non-scaling-stroke">
        <path d={poly([TL, TR, BR, BL])} />
        {s.lines.map(([a, b], i) => (
          <path key={i} d={seg(proj(a[0], a[1]), proj(b[0], b[1]))} />
        ))}
      </g>

      {/* net */}
      <path d={poly([NB0, NB1, NT1, NT0])} fill="white" opacity="0.1" />
      <g stroke="white" strokeWidth="1" opacity="0.4" vectorEffect="non-scaling-stroke">
        {mesh.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <path d={seg(NT0, NT1)} stroke="white" strokeWidth="3" opacity="0.85" vectorEffect="non-scaling-stroke" />
      <path d={seg(NB0, proj(NET, 0, NH + 5))} stroke="oklch(0.30 0.045 235)" strokeWidth="5" strokeLinecap="round" />
      <path d={seg(NB1, proj(NET, WID, NH + 5))} stroke="oklch(0.30 0.045 235)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}
