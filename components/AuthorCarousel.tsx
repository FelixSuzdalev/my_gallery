'use client'

import { useCallback, useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  images: string[]
}

export default function AuthorCarousel({ images }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  })
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const updateButtons = useCallback(() => {
    if (!emblaApi) return
    setCanPrev(emblaApi.canScrollPrev())
    setCanNext(emblaApi.canScrollNext())
  }, [emblaApi])

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (!emblaApi) return

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      emblaApi.scrollPrev()
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      emblaApi.scrollNext()
    }

    if (event.key === 'Home') {
      event.preventDefault()
      emblaApi.scrollTo(0)
    }

    if (event.key === 'End') {
      event.preventDefault()
      emblaApi.scrollTo(images.length - 1)
    }
  }, [emblaApi, images.length])

  useEffect(() => {
    if (!emblaApi) return

    const frame = window.requestAnimationFrame(updateButtons)
    emblaApi.on('select', updateButtons)
    emblaApi.on('reInit', updateButtons)

    return () => {
      window.cancelAnimationFrame(frame)
      emblaApi.off('select', updateButtons)
      emblaApi.off('reInit', updateButtons)
    }
  }, [emblaApi, updateButtons])

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/7] min-h-40 items-center justify-center rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50 text-sm font-medium text-zinc-400">
        Работы скоро появятся
      </div>
    )
  }

  return (
    <div className="relative">
      <div
        className="overflow-hidden rounded-[28px] border border-zinc-200 bg-zinc-100 outline-none ring-black/0 transition focus-visible:ring-4"
        ref={emblaRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label="Работы автора. Используйте стрелки влево и вправо для пролистывания."
      >
        <div className="flex gap-2 p-2">
          {images.map((src, index) => (
            <div
              className="relative aspect-[16/9] min-w-0 flex-[0_0_88%] overflow-hidden rounded-3xl sm:flex-[0_0_62%] lg:flex-[0_0_48%]"
              key={`${src}-${index}`}
            >
              <img
                src={src}
                alt="Работа автора"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
          ))}
        </div>
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs font-medium text-zinc-500">{images.length} работ</div>
          <div className="flex gap-2">
            <button
              onClick={scrollPrev}
              disabled={!canPrev}
              className="rounded-full border border-zinc-200 p-2 text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-35"
              aria-label="Предыдущие работы"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={scrollNext}
              disabled={!canNext}
              className="rounded-full border border-zinc-200 p-2 text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-35"
              aria-label="Следующие работы"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
