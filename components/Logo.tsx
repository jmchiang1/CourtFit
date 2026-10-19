import { cn } from '@/lib/utils'

/**
 * CourtFit brand mark — a court dropped inside four survey corner marks. The
 * corners are the building footprint being measured; the court is what has to
 * fit inside it.
 *
 * Corners use `currentColor` (so they follow the text color in either theme);
 * the court uses the brand `--court` token. On a green background, set
 * `--logo-court` / `--logo-lines` to invert the court (see the home page).
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
      {/* footprint corner marks */}
      <g stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9V3h6" />
        <path d="M23 3h6v6" />
        <path d="M29 23v6h-6" />
        <path d="M9 29H3v-6" />
      </g>

      {/* the court, seen from above: net down the middle, service lines either side */}
      <rect x="6.5" y="10" width="19" height="12" rx="1.25" fill="var(--logo-court, var(--court))" />
      <g stroke="var(--logo-lines, #fff)" strokeLinecap="butt">
        <path d="M16 8.75v14.5" strokeWidth="1.6" />
        <path d="M12 10v12M20 10v12M6.5 16H12M20 16h5.5" strokeWidth="0.9" opacity="0.75" />
      </g>
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
    <span className={cn('inline-flex items-center gap-2 text-foreground', className)}>
      <LogoMark className={cn('size-7', markClassName)} />
      {showWordmark && (
        <span className="font-display text-[1.05rem] font-bold leading-none">CourtFit</span>
      )}
    </span>
  )
}
