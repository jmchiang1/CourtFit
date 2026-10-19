import type { Rating } from '@/types/analysis'

/**
 * One place for how each rating looks. Classes use the semantic theme colors
 * (good / info / caution / risk) so they work in light and dark.
 */
export const RATING_STYLE: Record<
  Rating,
  { label: string; chip: string; dot: string; text: string }
> = {
  'Strong Candidate': {
    label: 'Strong candidate',
    chip: 'bg-good/10 text-good',
    dot: 'bg-good',
    text: 'text-good',
  },
  'Worth Investigating': {
    label: 'Worth investigating',
    chip: 'bg-info/10 text-info',
    dot: 'bg-info',
    text: 'text-info',
  },
  Risky: {
    label: 'Risky',
    chip: 'bg-caution/10 text-caution',
    dot: 'bg-caution',
    text: 'text-caution',
  },
  'Do Not Pursue': {
    label: 'Do not pursue',
    chip: 'bg-risk/10 text-risk',
    dot: 'bg-risk',
    text: 'text-risk',
  },
  Incomplete: {
    label: 'Incomplete',
    chip: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
  },
}
