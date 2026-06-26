'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type NagReason = 'default' | 'like' | 'favorite'

interface NagModalProps {
  onClose?: () => void
  forceOpen?: boolean
  reason?: NagReason
}

const copy: Record<NagReason, { title: string; text: string; cta: string }> = {
  default: {
    title: 'Нравится архив?',
    text: 'Создайте аккаунт, чтобы сохранять работы, ставить лайки и возвращаться к личной подборке.',
    cta: 'Создать аккаунт',
  },
  like: {
    title: 'Лайк сохраним после входа',
    text: 'Войдите или зарегистрируйтесь, чтобы отмечать работы и собирать свой визуальный архив.',
    cta: 'Зарегистрироваться',
  },
  favorite: {
    title: 'Избранное доступно с аккаунтом',
    text: 'Создайте профиль, чтобы сохранять понравившиеся работы и открывать их позже.',
    cta: 'Создать профиль',
  },
}

export default function NagModal({ onClose, forceOpen = false, reason = 'default' }: NagModalProps) {
  const [isVisible, setIsVisible] = useState(forceOpen)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const modalCopy = copy[reason]

  useEffect(() => {
    if (forceOpen) {
      return
    }

    async function checkUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) return
      if (localStorage.getItem('nag-dismissed') === 'true') return

      timerRef.current = setTimeout(() => {
        setIsVisible(true)
      }, 5000)
    }

    void checkUser()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [forceOpen])

  function handleClose() {
    setIsVisible(false)
    if (!forceOpen) localStorage.setItem('nag-dismissed', 'true')
    onClose?.()
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-[32px] bg-white p-8 text-center text-black shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-black"
          aria-label="Закрыть"
        >
          <X size={18} />
        </button>

        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
          <Heart size={22} className={reason !== 'default' ? 'fill-current' : ''} />
        </div>

        <h2 className="text-3xl font-black leading-none tracking-tight">{modalCopy.title}</h2>
        <p className="secondary-copy mx-auto mt-4 max-w-sm text-sm text-zinc-500">{modalCopy.text}</p>

        <button
          onClick={() => router.push('/register')}
          className="mt-7 w-full rounded-full bg-black px-6 py-4 text-sm font-black text-white transition hover:bg-zinc-800"
        >
          {modalCopy.cta}
        </button>

        <button
          onClick={handleClose}
          className="mt-4 text-xs font-semibold text-zinc-400 transition hover:text-black"
        >
          Продолжить просмотр
        </button>
      </div>
    </div>
  )
}
