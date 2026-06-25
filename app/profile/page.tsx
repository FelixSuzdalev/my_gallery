'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getCurrentProfile, type CurrentProfile } from '@/lib/current-profile'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'
import ProfileEditor from '@/components/ProfileEditor'
import CreatorApplicationPanel from '@/components/CreatorApplicationPanel'
import { V2CollectionManager } from '@/components/V2Collections'

export default function MyProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function openCurrentProfile() {
      setLoading(true)
      setError(null)

      const { data, error: userError } = await supabase.auth.getUser()
      if (!mounted) return

      if (userError || !data.user) {
        setError('Войдите, чтобы открыть свой профиль.')
        setLoading(false)
        return
      }

      if (!isSupabaseV2) {
        router.replace(`/profile/${data.user.id}`)
        return
      }

      const result = await getCurrentProfile()
      if (!mounted) return

      if (result.error) {
        setError('Не удалось загрузить профиль: ' + result.error.message)
      } else if (!result.profile) {
        setError('Профиль не найден. Попробуйте обновить страницу через несколько секунд.')
      } else {
        setProfile(result.profile)
      }
      setLoading(false)
    }

    const timer = window.setTimeout(() => {
      void openCurrentProfile()
    }, 0)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [router])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    )
  }

  if (error || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-black">
        <div className="rounded-[28px] border border-zinc-200 p-8 text-center shadow-sm">
          <p className="secondary-copy text-zinc-500">{error ?? 'Профиль не найден.'}</p>
          <Link href="/login" className="mt-6 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white">
            Войти
          </Link>
        </div>
      </main>
    )
  }

  const canApplyForCreator = profile.role !== 'creator' && profile.role !== 'admin'

  return (
    <main className="min-h-screen bg-white px-6 py-10 text-black">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 border-b border-zinc-100 pb-5">
            <p className="text-sm text-zinc-500">Мой профиль</p>
            <h1 className="text-3xl font-black tracking-tight">Редактирование профиля</h1>
            <p className="secondary-copy mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Заполните отображаемое имя, уникальный username, описание и настройки публичности.
            </p>
          </div>

          <ProfileEditor
            profile={profile}
            onCancel={() => router.push(`/profile/${profile.id}`)}
            onSaved={(nextProfile) => {
              setProfile((current) => (current ? { ...current, ...nextProfile } : (nextProfile as CurrentProfile)))
            }}
          />
        </section>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-5">
            <p className="text-sm font-semibold text-zinc-500">Публичная страница</p>
            <h2 className="mt-1 text-xl font-black">{profile.full_name || profile.username || 'Профиль'}</h2>
            {profile.username && <p className="secondary-copy mt-1 text-sm text-zinc-500">@{profile.username}</p>}
            <Link
              href={`/profile/${profile.id}`}
              className="mt-5 inline-flex rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              Открыть профиль
            </Link>
          </section>

          {canApplyForCreator && <CreatorApplicationPanel profileId={profile.id} />}
        </div>

        {isSupabaseV2 && (
          <div className="lg:col-span-2">
            <V2CollectionManager currentUserId={profile.id} role={profile.role} />
          </div>
        )}
      </div>
    </main>
  )
}
