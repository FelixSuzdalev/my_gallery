'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function MyProfilePage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function openCurrentProfile() {
      const { data, error } = await supabase.auth.getUser()
      if (!mounted) return

      if (error || !data.user) {
        setError('Войдите, чтобы открыть свой профиль.')
        return
      }

      router.replace(`/profile/${data.user.id}`)
    }

    const timer = window.setTimeout(() => {
      void openCurrentProfile()
    }, 0)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [router])

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-black">
        <div className="rounded-[28px] border border-zinc-200 p-8 text-center shadow-sm">
          <p className="secondary-copy text-zinc-500">{error}</p>
          <Link href="/login" className="mt-6 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white">
            Войти
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white text-zinc-500">
      <Loader2 className="h-5 w-5 animate-spin" />
    </main>
  )
}
