'use client'

import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/Logo'
import { FloorPlanFigure } from '@/components/FloorPlanFigure'
import { SignInDialog } from '@/components/SignInDialog'
import { ThemeToggle } from '@/components/ThemeToggle'

/**
 * Home page for signed-out visitors. The hero *is* a badminton court: a green
 * field with white court lines, the net running down the middle of the layout.
 * The pitch sits on one side of the net, the product's answer on the other.
 * Below the court, the three steps from listing to verdict, each shown with a
 * real artifact rather than an icon.
 *
 * The court stays green in both themes; everything below it follows the theme.
 */

const COURT_GREEN = '#1f6a4e'

// Hooks for the shared Button so it reads on the green field in either theme.
const onCourtPrimary =
  'bg-line text-[#15201b] shadow-none hover:bg-line/85 focus-visible:ring-line/50'
const onCourtGhost =
  'border-white/35 bg-transparent text-white hover:bg-white/10 hover:text-white dark:border-white/35 dark:bg-transparent dark:hover:bg-white/10'

export function Splash({ onTry }: { onTry: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <CourtHero onTry={onTry} />
      <Steps />
      <Closing onTry={onTry} />
      <footer className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
        <Logo className="text-sm" markClassName="size-6" />
        <span>For badminton club operators.</span>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------------ */

function CourtHero({ onTry }: { onTry: () => void }) {
  return (
    <section
      className="relative isolate overflow-hidden text-white"
      style={{ background: COURT_GREEN } as CSSProperties}
    >
      <CourtLines />

      <header
        className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-5"
        style={{ '--logo-court': '#fff', '--logo-lines': COURT_GREEN } as CSSProperties}
      >
        <Logo className="text-white" />
        <div className="flex items-center gap-1">
          <ThemeToggle className="text-white hover:bg-white/10 hover:text-white dark:hover:bg-white/10" />
          <SignInDialog>
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 hover:text-white dark:hover:bg-white/10"
            >
              Sign in
            </Button>
          </SignInDialog>
        </div>
      </header>

      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-6 pt-16 pb-20 md:grid-cols-2 md:gap-0 md:pt-24 md:pb-28">
        {/* this side of the net: the question */}
        <div className="splashRise md:pr-14">
          <h1 className="font-display text-[3.25rem] leading-[0.95] font-extrabold text-balance sm:text-7xl lg:text-[5.5rem]">
            Will the courts fit?
          </h1>
          <p className="mt-7 max-w-[42ch] text-lg leading-relaxed text-pretty text-white/80">
            Paste any commercial listing. CourtFit lays out badminton courts in the building,
            prices the build-out, and tells you whether the club would pay for itself.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <SignInDialog>
              <Button size="lg" className={onCourtPrimary}>
                Get started free
              </Button>
            </SignInDialog>
            <Button size="lg" variant="outline" className={onCourtGhost} onClick={onTry}>
              Explore the demo
            </Button>
          </div>
        </div>

        {/* the other side: the answer */}
        <div className="md:pl-14">
          <Scorecard />
        </div>
      </div>
    </section>
  )
}

/** A badminton court to scale (44 × 20 ft), stretched edge to edge behind the
 *  hero. Strokes don't scale, so the lines stay crisp at any aspect ratio. */
function CourtLines() {
  const line = { vectorEffect: 'non-scaling-stroke' } as const
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-x-3 top-3 bottom-3 -z-10 hidden h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] text-white md:block"
      viewBox="0 0 44 20"
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
    >
      <g strokeWidth="2" opacity="0.17">
        <rect x="0" y="0" width="44" height="20" {...line} />
        <path d="M0 1.5H44M0 18.5H44" {...line} />
        <path d="M2.5 0V20M41.5 0V20" {...line} />
        <path d="M15.5 0V20M28.5 0V20" {...line} />
        <path d="M0 10H15.5M28.5 10H44" {...line} />
      </g>
      {/* the net */}
      <path d="M22 0V20" strokeWidth="3" opacity="0.45" {...line} />
    </svg>
  )
}

const CHECKS = [
  ['Clear height', '28 ft, needs 24'],
  ['Column spacing', 'Clear span'],
  ['Loading & parking', '2 docks, 30 spaces'],
]

function Scorecard() {
  return (
    <article
      className="splashRise shadow-lift mx-auto max-w-md rounded-xl bg-panel p-6 text-foreground md:ml-0"
      style={{ animationDelay: '180ms' }}
      aria-label="Sample verdict"
    >
      <div className="flex flex-wrap-reverse items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Sample listing</p>
          <p className="mt-0.5 font-medium">8,000 sf warehouse, Queens NY</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-good/10 py-1 pr-2.5 pl-2 text-xs font-medium text-good ring-1 ring-good/25 ring-inset">
          <span aria-hidden className="size-1.5 rounded-full bg-good" />
          Strong candidate
        </span>
      </div>

      <div className="mt-6 flex items-baseline gap-3">
        <span className="font-display text-6xl leading-none font-bold tabular-nums">5</span>
        <span className="text-sm leading-snug text-muted-foreground">
          badminton courts fit
          <br />with a lobby and lounge
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-3 border-y py-4">
        {[
          ['Net income', '$422K'],
          ['Payback', '2.4 yr'],
          ['Rent burden', '30%'],
        ].map(([k, v], i) => (
          <div key={k} className={i > 0 ? 'border-l pl-4' : 'pr-4'}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-display mt-1 text-xl font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-4 space-y-2 text-sm">
        {CHECKS.map(([k, v], i) => (
          <li
            key={k}
            className="splashRise flex items-center gap-2.5"
            style={{ animationDelay: `${450 + i * 120}ms` }}
          >
            <span className="flex size-4 items-center justify-center rounded-full bg-good text-white">
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span className="text-foreground">{k}</span>
            <span className="ml-auto text-muted-foreground tabular-nums">{v}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

/* ------------------------------------------------------------------------ */

function Steps() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24">
      <h2 className="font-display max-w-[20ch] text-3xl leading-tight font-bold sm:text-4xl">
        From a listing to a yes or no in about a minute
      </h2>

      <ol className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
        <Step n={1} title="Paste the listing" body="A LoopNet or Crexi link, or the listing text. CourtFit pulls out the facts that matter for a court build.">
          <ListingSnippet />
        </Step>
        <Step n={2} title="See it measured" body="The building is laid out to scale with real court and buffer dimensions, leaving room for a lobby, lounge and restrooms.">
          <div className="rounded-lg border bg-background p-2">
            <FloorPlanFigure className="w-full" />
          </div>
        </Step>
        <Step n={3} title="Get the verdict" body="Cost to open, operating income and payback, plus nearby players and competing clubs, rolled into one rating.">
          <MiniVerdict />
        </Step>
      </ol>
    </section>
  )
}

function Step({
  n,
  title,
  body,
  children,
}: {
  n: number
  title: string
  body: string
  children: React.ReactNode
}) {
  return (
    <li className="flex flex-col">
      <div className="flex items-center gap-3">
        <span className="font-display flex size-8 items-center justify-center rounded-full border-2 border-foreground text-sm font-bold tabular-nums">
          {n}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
      <h3 className="font-display mt-5 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-6 flex-1">{children}</div>
    </li>
  )
}

/** Listing copy with the extracted facts highlighted, like a marker pass. */
function ListingSnippet() {
  const mark = 'rounded-[3px] bg-line/70 px-0.5 text-[#15201b] dark:bg-line/80'
  return (
    <div className="h-full rounded-lg border bg-panel p-4 text-sm leading-relaxed">
      <p className="font-medium">Industrial / flex for lease</p>
      <p className="mt-2 text-muted-foreground">
        Freestanding <mark className={mark}>8,000 SF</mark> warehouse with{' '}
        <mark className={mark}>28′ clear</mark> ceilings, <mark className={mark}>2 dock doors</mark>{' '}
        and a small office. Asking <mark className={mark}>$25.00/SF/yr NNN</mark>. Zoned{' '}
        <mark className={mark}>M1-1</mark>, ample parking.
      </p>
    </div>
  )
}

function MiniVerdict() {
  const rows = [
    ['Cost to open', '$1.01M'],
    ['Operating income', '$422K a year'],
    ['Payback', '2.4 years'],
    ['Demand score', '86 of 100'],
  ]
  return (
    <div className="h-full rounded-lg border bg-panel p-4 text-sm">
      <div className="flex items-center gap-2 font-medium text-good">
        <span aria-hidden className="size-2 rounded-full bg-good" />
        Strong candidate
      </div>
      <dl className="mt-3 divide-y">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-2">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ------------------------------------------------------------------------ */

function Closing({ onTry }: { onTry: () => void }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6">
      <div className="flex flex-col items-start justify-between gap-6 rounded-xl bg-[#15201b] px-8 py-10 text-white ring-1 ring-border md:flex-row dark:bg-panel-2 md:items-center">
        <div>
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            Start with a pipeline that’s already scored
          </h2>
          <p className="mt-2 max-w-[52ch] text-white/70">
            The demo is loaded with real New York listings, rated and mapped. No account needed.
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <Button size="lg" className={onCourtPrimary} onClick={onTry}>
            Explore the demo
          </Button>
        </div>
      </div>
    </section>
  )
}
