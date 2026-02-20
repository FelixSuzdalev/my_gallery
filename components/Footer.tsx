// components/Footer.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Thumb = { id: string; title?: string; image_url?: string }

export default function Footer() {
  const router = useRouter()
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [loadingRandom, setLoadingRandom] = useState(false)
  const [thumbs, setThumbs] = useState<Thumb[]>([])
  const [loadingThumbs, setLoadingThumbs] = useState(false)

  // load last 4 artworks thumbnails (uses image_url)
  useEffect(() => {
    let mounted = true
    async function loadThumbs() {
      setLoadingThumbs(true)
      try {
        const { data, error } = await supabase
          .from('artworks')
          .select('id, title, image_url')
          .order('created_at', { ascending: false })
          .limit(4)

        if (error) {
          console.debug('Footer: failed to load thumbs', error)
          if (mounted) setThumbs([])
        } else {
          if (mounted) setThumbs((data as Thumb[]) || [])
        }
      } catch (err) {
        console.debug('Footer: unexpected', err)
        if (mounted) setThumbs([])
      } finally {
        if (mounted) setLoadingThumbs(false)
      }
    }
    loadThumbs()
    return () => { mounted = false }
  }, [])

  // navigate to a random artwork (sample up to 200 recent to avoid heavy count)
  async function goToRandom() {
    setStatusMsg(null)
    setLoadingRandom(true)
    try {
      const { data, error } = await supabase
        .from('artworks')
        .select('id')
        .order('created_at', { ascending: false })
        .range(0, 199) // sample window

      if (error || !data || (data as any[]).length === 0) {
        throw new Error('no works')
      }

      const arr = data as { id: string }[]
      const rand = arr[Math.floor(Math.random() * arr.length)]
      router.push(`/works/${rand.id}`)
    } catch (err) {
      console.error('Footer.goToRandom error', err)
      setStatusMsg('Не удалось загрузить случайную работу. Попробуйте позже.')
    } finally {
      setLoadingRandom(false)
    }
  }

  return (
    <footer className="bg-[#0b0b0f] text-white py-20 px-6">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-14">
          {/* LEFT: Brand + socials + thumbs */}
          <div>
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6 leading-none">
              <span className="gradient-text">Stay <br /> Curious.</span>
            </h2>

            <div className="flex items-center gap-3 mb-4">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-black transition-colors cursor-pointer text-[10px]"
                aria-label="Instagram"
              >
                IG
              </a>

              <a
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-black transition-colors cursor-pointer text-[10px]"
                aria-label="Twitter"
              >
                TW
              </a>

              <button
                onClick={goToRandom}
                disabled={loadingRandom}
                className="ml-4 inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-xs"
                aria-label="Перейти к случайной работе"
              >
                {loadingRandom ? 'Загрузка…' : 'Случайная работа'}
              </button>
            </div>

            <div>
              <p className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Недавние работы</p>
              <div className="flex gap-3">
                {loadingThumbs ? (
                  <div className="text-sm text-zinc-500">Загрузка...</div>
                ) : thumbs.length ? (
                  thumbs.map(t => (
                    <Link key={t.id} href={`/works/${t.id}`} className="block w-20 h-14 rounded-md overflow-hidden bg-white/5 border border-white/6 hover:scale-105 transform transition-transform">
                      {t.image_url ? (
                        // use simple img - matches how you render elsewhere
                        <img src={t.image_url} alt={t.title ?? 'work'} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-400">No image</div>
                      )}
                    </Link>
                  ))
                ) : (
                  <div className="text-sm text-zinc-500">Нет работ</div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: nav blocks */}
          <div className="grid grid-cols-2 gap-8 text-xs font-bold uppercase tracking-[0.15em] text-zinc-400">
            <div className="space-y-3">
              <p className="text-white">Навигация</p>
              <Link href="/gallery" className="footer-link">Галерея</Link>
              <Link href="/authors" className="footer-link">Авторы</Link>
              <Link href="/collections" className="footer-link">Подборки</Link>
              <Link href="/search" className="footer-link">Поиск</Link>
            </div>

            <div className="space-y-3">
              <p className="text-white">Инфо</p>
              <Link href="/faq" className="footer-link">FAQ</Link>
              <Link href="/contacts" className="footer-link">Контакты</Link>
              <Link href="/help" className="footer-link">Помощь</Link>
              <Link href="/about" className="footer-link">О проекте</Link>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between gap-4 text-[11px] font-mono text-zinc-500 uppercase">
          <p>© {new Date().getFullYear()} Digital Art Archive. Platform for creators.</p>
          <div className="flex items-center gap-4">
            <p>Built with Supabase & Next.js</p>
            <Link href="/privacy" className="footer-link-small">Privacy</Link>
            <Link href="/terms" className="footer-link-small">Terms</Link>
          </div>
        </div>

        {statusMsg && (
          <div className="mt-4 text-sm text-rose-400">
            {statusMsg}
          </div>
        )}
      </div>

      {/* local styles (keeps your aesthetic) */}
      <style jsx>{`
        .gradient-text {
          background: linear-gradient(90deg, #9b5cf6, #06b6d4, #f59e0b);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          background-size: 200% 200%;
          animation: gmove 6s ease infinite;
        }
        @keyframes gmove {
          0% { background-position: 0% 50% }
          50% { background-position: 100% 50% }
          100% { background-position: 0% 50% }
        }
        :global(.footer-link) {
          display: block;
          color: inherit;
          text-decoration: none;
          position: relative;
          padding-bottom: 2px;
        }
        :global(.footer-link)::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: 0;
          height: 2px;
          width: 100%;
          transform: scaleX(0);
          transform-origin: left;
          background: linear-gradient(90deg,#fff,#9b5cf6);
          transition: transform .28s ease;
          opacity: .9;
        }
        :global(.footer-link):hover::after,
        :global(.footer-link):focus::after {
          transform: scaleX(1);
        }
        :global(.footer-link-small) {
          color: rgba(148,163,184,0.9);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace;
          text-decoration: none;
          padding-left: 8px;
        }
        :global(.footer-link-small):hover { text-decoration: underline; color: #fff; }
      `}</style>
    </footer>
  )
}