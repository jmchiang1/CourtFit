import type { Rating } from '@/types/analysis'
import { RATING_STYLE } from '@/lib/rating-style'

export function RatingBadge({ rating }: { rating: Rating }) {
  const s = RATING_STYLE[rating]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full py-0.5 pl-2 pr-2.5 text-xs font-medium whitespace-nowrap ${s.chip}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}
