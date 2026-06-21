'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const WORDS = ['НЕ ЛЕНТА.', 'НЕ СОЦСЕТЬ.', 'ГАЛЕРЕЯ.']

type PreviewWork = {
  id: string
  title: string
  image_url: string
}

const FALLBACK_WORKS: PreviewWork[] = [
  {
    id: 'fallback-1',
    title: 'Digital Form',
    image_url: 'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=900',
  },
  {
    id: 'fallback-2',
    title: 'Soft Geometry',
    image_url: 'https://images.unsplash.com/photo-1545989253-02cc26577f88?w=900',
  },
  {
    id: 'fallback-3',
    title: 'Light Study',
    image_url: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=900',
  },
  {
    id: 'fallback-4',
    title: 'Archive Room',
    image_url: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?w=900',
  },
  {
    id: 'fallback-5',
    title: 'Visual Memory',
    image_url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900',
  },
  {
    id: 'fallback-6',
    title: 'Nocturne',
    image_url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=900',
  },
]

export default function Hero() {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 500], [0, 120])
  const [index, setIndex] = useState(0)
  const [works, setWorks] = useState<PreviewWork[]>(FALLBACK_WORKS)

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % WORDS.length), 2400)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadPreviewWorks() {
      const { data, error } = await supabase
        .from('artworks')
        .select('id, title, image_url')
        .order('created_at', { ascending: false })
        .limit(9)

      if (!mounted || error || !data?.length) return
      setWorks((data as PreviewWork[]).filter((work) => Boolean(work.image_url)))
    }

    loadPreviewWorks()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!wrapperRef.current) return
    const el = wrapperRef.current
    const onMove = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const px = ((event.clientX - rect.left) / rect.width - 0.5).toFixed(3)
      const py = ((event.clientY - rect.top) / rect.height - 0.5).toFixed(3)
      el.style.setProperty('--px', String(px))
      el.style.setProperty('--py', String(py))
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const previewWorks = useMemo(() => [...works, ...FALLBACK_WORKS].slice(0, 8), [works])

  return (
    <section ref={wrapperRef} className="hero-bg relative flex min-h-[88vh] items-center overflow-hidden bg-black text-white">
      <div className="absolute inset-y-8 right-0 hidden w-[58vw] grid-cols-4 gap-3 pr-8 opacity-65 md:grid">
        {previewWorks.map((work, itemIndex) => (
          <motion.div
            key={`${work.id}-${itemIndex}`}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: itemIndex * 0.06, duration: 0.5 }}
            className={`relative overflow-hidden rounded-3xl bg-zinc-900 ${
              itemIndex === 0 || itemIndex === 5 ? 'row-span-2' : ''
            } ${itemIndex === 1 ? 'mt-16' : ''} ${itemIndex === 6 ? 'mb-12' : ''}`}
            style={{
              transform: `translate3d(calc(var(--px) * ${itemIndex % 2 ? -10 : 10}px), calc(var(--py) * ${
                itemIndex % 2 ? 8 : -8
              }px), 0)`,
            }}
          >
            <div
              className="h-full min-h-36 bg-cover bg-center grayscale-[0.25] saturate-[0.9]"
              style={{ backgroundImage: `url(${work.image_url})` }}
              aria-label={work.title}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          </motion.div>
        ))}
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_0%,rgba(0,0,0,0.94)_42%,rgba(0,0,0,0.58)_72%,rgba(0,0,0,0.82)_100%)]" />

      <div
        className="blob"
        style={{
          width: 340,
          height: 340,
          background: 'radial-gradient(circle at 30% 30%, rgba(255,120,80,0.12), transparent 30%)',
          left: -60,
          top: -40,
          transform: 'translate3d(calc(var(--px) * 18px), calc(var(--py) * 12px),0)',
        }}
      />
      <div
        className="blob"
        style={{
          width: 420,
          height: 420,
          background: 'radial-gradient(circle at 70% 70%, rgba(80,140,255,0.08), transparent 30%)',
          right: -100,
          bottom: -60,
          transform: 'translate3d(calc(var(--px) * -22px), calc(var(--py) * -16px),0)',
        }}
      />

      <div className="z-10 mx-auto w-full max-w-[1400px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl"
        >
          <div className="mb-6 text-[11px] uppercase tracking-[0.28em] text-zinc-400">Creative Archive</div>

          <h1 className="mb-6 font-black leading-[0.85] tracking-tight">
            <motion.span
              key={index}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span style={{ fontSize: 'clamp(58px, 10vw, 126px)' }}>{WORDS[index]}</span>
            </motion.span>
          </h1>

          <p className="secondary-copy mb-8 max-w-lg text-zinc-300">
            Кураторская платформа для фотографов и художников. Без алгоритмов - только ценность.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/feed"
              className="inline-flex items-center gap-3 rounded-full bg-white px-5 py-3 font-semibold text-black transition hover:scale-[1.02]"
            >
              Смотреть архив <ArrowUpRight size={14} />
            </Link>

            <Link
              href="/authors"
              className="inline-flex items-center gap-3 rounded-full border border-white/10 px-4 py-2 text-white transition hover:bg-white/5"
            >
              Авторы
            </Link>
          </div>
        </motion.div>
      </div>

      <motion.div style={{ y }} className="big-bg-word absolute bottom-4 left-0 w-full text-center text-[12rem] font-black">
        ARCHIVE
      </motion.div>
    </section>
  )
}
