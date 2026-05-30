import { cn } from '@/lib/utils'

/**
 * CourtFit brand mark — a top-down court tile (net + center line quartering the
 * court, with a service box and a focal "sweet-spot" dot at center). The dot is
 * the visual pun: the right property is the one that *fits* the court.
 *
 * Colors are pulled from the global brand CSS variables so the mark always
 * tracks the theme (cyan-teal → indigo gradient over the deep-ink background).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="CourtFit"
    >
      <defs>
        <linearGradient
          id="courtfit-mark"
          x1="3"
          y1="3"
          x2="29"
          y2="29"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--chart-3)" />
        </linearGradient>
      </defs>

      {/* court tile */}
      <rect x="2.5" y="2.5" width="27" height="27" rx="8.5" fill="url(#courtfit-mark)" />

      {/* court lines drawn in the page ink so they read as cut-outs */}
      <g stroke="var(--bg-base)" strokeLinecap="round">
        <path d="M16 5.5 V26.5" strokeWidth="1.6" opacity="0.92" />
        <path d="M5.5 16 H26.5" strokeWidth="1.6" opacity="0.5" />
        <rect
          x="9.5"
          y="9.5"
          width="13"
          height="13"
          rx="3.5"
          fill="none"
          strokeWidth="1.3"
          opacity="0.45"
        />
      </g>

      {/* sweet-spot / "fit" dot */}
      <circle cx="16" cy="16" r="2.6" fill="var(--bg-base)" />
    </svg>
  )
}

/** Mark + "CourtFit" wordmark. Used in the header and splash. */
export function Logo({
  className,
  markClassName,
  showWordmark = true,
}: {
  className?: string
  markClassName?: string
  showWordmark?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={cn('size-7', markClassName)} />
      {showWordmark && (
        <span className="text-[0.975rem] font-semibold tracking-tight text-foreground">
          Court<span className="text-primary">Fit</span>
        </span>
      )}
    </span>
  )
}
