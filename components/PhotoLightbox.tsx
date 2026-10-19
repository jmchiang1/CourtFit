'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X, ExternalLink } from 'lucide-react'

interface Props {
  images: string[]
  initialIndex: number
  open: boolean
  onClose: () => void
  /** Optional — shows a "View source" link in the header. */
  sourceUrl?: string | null
}

export function PhotoLightbox({ images, initialIndex, open, onClose, sourceUrl }: Props) {
  const [index, setIndex] = useState(initialIndex)

  // Reset to initial index whenever the lightbox is reopened.
  useEffect(() => {
    if (open) setIndex(initialIndex)
  }, [open, initialIndex])

  // Keyboard navigation while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(images.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, images.length])

  const hasPrev = index > 0
  const hasNext = index < images.length - 1
  const current = images[index]

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="photo-lightbox sm:max-w-6xl max-h-[95vh] p-0 overflow-hidden bg-black/95 ring-0"
      >
        <DialogTitle className="sr-only">Property photo {index + 1} of {images.length}</DialogTitle>

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-3 py-2.5">
          <div className="text-xs text-white/80 tabular-nums">
            {index + 1} / {images.length}
          </div>
          <div className="flex items-center gap-1">
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open source listing"
                className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="size-3.5" />
                View source
              </a>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="size-8 p-0 text-white/80 hover:text-white hover:bg-white/10 dark:hover:bg-white/10"
              aria-label="Close"
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        {/* Image */}
        <div className="flex items-center justify-center min-h-[60vh] max-h-[90vh] p-6 pt-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={current}
            src={current}
            alt={`Property photo ${index + 1}`}
            className="max-w-full max-h-[80vh] object-contain select-none"
            draggable={false}
          />
        </div>

        {/* Prev */}
        {hasPrev && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="absolute left-3 top-1/2 -translate-y-1/2 size-11 p-0 rounded-full bg-black/40 hover:bg-black/60 dark:hover:bg-black/60 text-white/90 hover:text-white"
            aria-label="Previous photo"
          >
            <ChevronLeft className="size-6" />
          </Button>
        )}

        {/* Next */}
        {hasNext && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIndex((i) => Math.min(images.length - 1, i + 1))}
            className="absolute right-3 top-1/2 -translate-y-1/2 size-11 p-0 rounded-full bg-black/40 hover:bg-black/60 dark:hover:bg-black/60 text-white/90 hover:text-white"
            aria-label="Next photo"
          >
            <ChevronRight className="size-6" />
          </Button>
        )}

        {/* Thumbnail strip on bottom */}
        {images.length > 1 && (
          <div className="absolute bottom-0 inset-x-0 z-10 flex gap-1.5 overflow-x-auto px-3 py-2 bg-black/60 justify-center">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index ? 'true' : undefined}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-md transition outline-none focus-visible:ring-2 focus-visible:ring-white ${
                  i === index ? 'opacity-100' : 'opacity-50 hover:opacity-90'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-12 w-16 rounded-md object-cover" loading="lazy" />
                {/* Selected marker: a filled bar under the active thumbnail. */}
                <span
                  className={`h-1 w-6 rounded-full ${i === index ? 'bg-white' : 'bg-transparent'}`}
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
