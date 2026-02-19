// components/Hero.tsx
'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

export default function Hero() {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const { scrollY } = useScroll()
  const y = useTransform(scrollY, [0, 500], [0, 120])
  const [mounted, setMounted] = useState(false)
  const [index, setIndex] = useState(0)
  const words = ['НЕ ЛЕНТА.', 'НЕ СОЦСЕТЬ.', 'ГАЛЕРЕЯ.']

  useEffect(() => {
    setMounted(true)
    const iv = setInterval(() => setIndex((p) => (p + 1) % words.length), 2400)
    return () => clearInterval(iv)
  }, [])

  // mouse parallax -> set CSS vars on wrapper
  useEffect(() => {
    if (!wrapperRef.current) return
    const el = wrapperRef.current
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      const px = ((e.clientX - r.left) / r.width - 0.5).toFixed(3)
      const py = ((e.clientY - r.top) / r.height - 0.5).toFixed(3)
      el.style.setProperty('--px', String(px))
      el.style.setProperty('--py', String(py))
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <section ref={wrapperRef} className="relative min-h-[88vh] flex items-center hero-bg text-white overflow-hidden">
      {/* blobs */}
      <div className="blob" style={{ width: 340, height: 340, background: 'radial-gradient(circle at 30% 30%, rgba(255,120,80,0.12), transparent 30%)', left: -60, top: -40, transform: 'translate3d(calc(var(--px) * 18px), calc(var(--py) * 12px),0)' }} />
      <div className="blob" style={{ width: 420, height: 420, background: 'radial-gradient(circle at 70% 70%, rgba(80,140,255,0.08), transparent 30%)', right: -100, bottom: -60, transform: 'translate3d(calc(var(--px) * -22px), calc(var(--py) * -16px),0)' }} />

      <div className="max-w-[1400px] mx-auto px-6 z-10">
        <motion.div initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-4xl">
          <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-400 mb-6">Creative Archive</div>

          <h1 className="leading-[0.85] font-black tracking-tight mb-6">
            <motion.span key={index} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span style={{ fontSize: 'clamp(46px, 10vw, 120px)' }}>{words[index]}</span>
            </motion.span>
          </h1>

          <p className="max-w-lg text-zinc-300 mb-8">
            Кураторская платформа для фотографов и художников. Без алгоритмов — только ценность.
          </p>

          <div className="flex gap-4 items-center">
            <Link href="/feed" className="inline-flex items-center gap-3 bg-white text-black px-5 py-3 rounded-full font-semibold hover:scale-[1.02] transition">
              Смотреть архив <ArrowUpRight size={14} />
            </Link>

            <Link href="/authors" className="inline-flex items-center gap-3 border border-white/10 text-white px-4 py-2 rounded-full hover:bg-white/5 transition">
              Авторы
            </Link>
          </div>
        </motion.div>
      </div>

      {/* huge background word */}
      <motion.div style={{ y }} className="absolute bottom-4 left-0 w-full big-bg-word text-center text-[12rem] font-black">
        ARCHIVE
      </motion.div>
    </section>
  )
}
