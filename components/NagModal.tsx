'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface NagModalProps {
  onClose?: () => void
}

export default function NagModal({ onClose }: NagModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) return

      const dismissed = localStorage.getItem('nag-dismissed')
      if (dismissed === 'true') return

      timerRef.current = setTimeout(() => {
        setIsVisible(true)
      }, 5000)
    }

    checkUser()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    localStorage.setItem('nag-dismissed', 'true')
    onClose?.()
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white p-10 max-w-md w-full text-center shadow-2xl relative">
        <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter italic">
          Нравится контент?
        </h2>

        <p className="text-gray-500 mb-8 text-sm font-medium">
          Зарегистрируйтесь, чтобы сохранять работы в «Избранное», ставить лайки и общаться с авторами.
        </p>

        <button
          onClick={() => router.push('/login')}
          className="w-full py-4 bg-black text-white font-bold mb-4 hover:bg-gray-900 transition-colors uppercase tracking-widest text-xs"
        >
          СОЗДАТЬ АККАУНТ
        </button>

        <button
          onClick={handleClose}
          className="text-[10px] text-gray-400 underline uppercase tracking-[0.2em] hover:text-black transition-colors"
        >
          Продолжить просмотр
        </button>
      </div>
    </div>
  )
}
