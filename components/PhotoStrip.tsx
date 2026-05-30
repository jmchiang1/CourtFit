'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PhotoLightbox } from './PhotoLightbox'

/**
 * Horizontally scrollable strip of listing photos with prev/next arrows and a
 * click-to-zoom lightbox. Shared by the verdict modal and the add/edit sheet.
 */
export function PhotoStrip({
  images,
  sourceUrl,
}: {
  images: string[]
  sourceUrl: string | null
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateArrows = () => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  // Recompute arrow visibility when images change, on mount, and on resize.
  useEffect(() => {
    updateArrows()
    const onResize = () => updateArrows()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [images.length])

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    // Move by ~80% of the visible width so the rightmost thumbnail becomes leftmost.
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <>
      <div className="photo-strip relative min-w-0 max-w-full">
        <div
          ref={scrollerRef}
          onScroll={updateArrows}
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide scroll-smooth min-w-0 max-w-full"
          style={{ scrollbarWidth: 'none' } as React.CSSProperties}
        >
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setLightboxIndex(i)}
              title="View larger"
              className="block shrink-0 h-32 w-44 rounded-lg overflow-hidden ring-1 ring-border bg-card hover:ring-foreground/30 transition focus:outline-none focus:ring-2 focus:ring-foreground/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Listing photo ${i + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={(e) => {
                  // Hide if the image fails to load (CDN sometimes rejects hot-link)
                  const target = e.currentTarget
                  target.parentElement?.classList.add('hidden')
                }}
              />
            </button>
          ))}
        </div>

        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="photo-strip-arrow absolute left-1 top-1/2 -translate-y-1/2 size-9 rounded-full bg-background/80 backdrop-blur ring-1 ring-border shadow flex items-center justify-center hover:bg-background transition"
            aria-label="Scroll photos left"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="photo-strip-arrow absolute right-1 top-1/2 -translate-y-1/2 size-9 rounded-full bg-background/80 backdrop-blur ring-1 ring-border shadow flex items-center justify-center hover:bg-background transition"
            aria-label="Scroll photos right"
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>

      <PhotoLightbox
        images={images}
        initialIndex={lightboxIndex ?? 0}
        open={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        sourceUrl={sourceUrl}
      />
    </>
  )
}
