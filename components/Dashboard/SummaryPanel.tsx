import type { AnalysisResult } from '@/types/analysis'

interface Props {
  result: AnalysisResult
  // Kept for API compatibility — currently unused since the deterministic
  // summary from the result is shown directly.
  address?: string | null
}

export function SummaryPanel({ result }: Props) {
  return (
    <div className="summary-card surface p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-semibold text-foreground">Summary</h3>
      </div>
      <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground/80">
        {result.summary}
      </pre>
    </div>
  )
}
