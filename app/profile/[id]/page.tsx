'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Heart, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import NagModal from '@/components/NagModal'

type Profile = {
  id: string
  full_name?: string | null
  username?: string | null
  bio?: string | null
  avatar_url?: string | null
  role?: string | null
}

type Artwork = {
  id: string
  title: string
  image_url: string
  description?: string | null
  author_id?: string | null
  created_at?: string | null
  tags?: string[] | null
  profiles?: {
    username?: string | null
    full_name?: string | null
  } | null
  liked?: boolean
}

type FavoriteRow = {
  id: string
  artwork_id: string
  user_id?: string
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function getName(profile: Profile | null) {
  if (!profile) return 'Профиль'
  return profile.full_name || profile.username || 'Автор'
}

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>()
  const profileKey = String(params?.id ?? '')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [works, setWorks] = useState<Artwork[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [favMap, setFavMap] = useState<Record<string, string>>({})
  const [togglingIds, setTogglingIds] = useState<Record<string, boolean>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showNag, setShowNag] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    if (!profileKey) return

    setLoading(true)
    setError(null)

    const profileQuery = supabase
      .from('profiles')
      .select('id, full_name, username, bio, avatar_url, role')

    const { data: profileData, error: profileError } = isUuid(profileKey)
      ? await profileQuery.eq('id', profileKey).maybeSingle()
      : await profileQuery.eq('username', profileKey).maybeSingle()

    if (profileError || !profileData) {
      setProfile(null)
      setWorks([])
      setCounts({})
      setFavMap({})
      setError('Профиль не найден.')
      setLoading(false)
      return
    }

    const nextProfile = profileData as Profile
    setProfile(nextProfile)

    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData?.session?.user?.id ?? null
    setCurrentUserId(userId)

    let artworksData: Artwork[] = []
    const richArtworkQuery = await supabase
      .from('artworks')
      .select(`
        id,
        title,
        image_url,
        description,
        author_id,
        created_at,
        tags,
        profiles (
          username,
          full_name
        )
      `)
      .eq('author_id', nextProfile.id)
      .order('created_at', { ascending: false })

    if (richArtworkQuery.error) {
      const fallbackQuery = await supabase
        .from('artworks')
        .select('id, title, image_url, description, author_id, created_at')
        .eq('author_id', nextProfile.id)
        .order('created_at', { ascending: false })

      if (fallbackQuery.error) {
        setWorks([])
        setCounts({})
        setFavMap({})
        setLoading(false)
        return
      }

      artworksData = (fallbackQuery.data ?? []) as Artwork[]
    } else {
      artworksData = (richArtworkQuery.data ?? []) as Artwork[]
    }

    const artworkIds = artworksData.map((work) => work.id)
    const countsMap: Record<string, number> = {}
    const favMapObj: Record<string, string> = {}

    if (artworkIds.length > 0) {
      const { data: favoriteRows } = await supabase
        .from('favorites')
        .select('id, artwork_id, user_id')
        .in('artwork_id', artworkIds)

      ;((favoriteRows ?? []) as FavoriteRow[]).forEach((row) => {
        countsMap[row.artwork_id] = (countsMap[row.artwork_id] ?? 0) + 1
        if (userId && row.user_id === userId) favMapObj[row.artwork_id] = row.id
      })

      if (userId) {
        const { data: userFavoriteRows } = await supabase
          .from('favorites')
          .select('id, artwork_id')
          .eq('user_id', userId)
          .in('artwork_id', artworkIds)

        ;((userFavoriteRows ?? []) as FavoriteRow[]).forEach((row) => {
          favMapObj[row.artwork_id] = row.id
          countsMap[row.artwork_id] = Math.max(countsMap[row.artwork_id] ?? 0, 1)
        })
      }
    }

    setCounts(countsMap)
    setFavMap(favMapObj)
    setWorks(artworksData.map((work) => ({ ...work, liked: !!favMapObj[work.id] })))
    setLoading(false)
  }, [profileKey])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfile()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadProfile])

  const totalLikes = useMemo(() => {
    return Object.values(counts).reduce((sum, count) => sum + count, 0)
  }, [counts])

  const isOwner = Boolean(currentUserId && profile?.id === currentUserId)

  async function refreshCount(artworkId: string) {
    const { count, error } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('artwork_id', artworkId)

    if (!error) {
      setCounts((state) => ({
        ...state,
        [artworkId]: count ?? 0,
      }))
    }
  }

  async function toggleFavorite(artworkId: string) {
    if (togglingIds[artworkId]) return

    setTogglingIds((state) => ({ ...state, [artworkId]: true }))

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user ?? null

      if (!user) {
        setShowNag(true)
        return
      }

      const existingFavId = favMap[artworkId]
      const previousCount = counts[artworkId] ?? 0

      if (existingFavId) {
        setFavMap((state) => {
          const next = { ...state }
          delete next[artworkId]
          return next
        })
        setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, liked: false } : work)))
        setCounts((state) => ({
          ...state,
          [artworkId]: Math.max(0, previousCount - 1),
        }))

        const { error } = await supabase.from('favorites').delete().eq('id', existingFavId)
        if (error) {
          setFavMap((state) => ({ ...state, [artworkId]: existingFavId }))
          setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, liked: true } : work)))
          setCounts((state) => ({ ...state, [artworkId]: previousCount }))
          alert(`Не удалось удалить из избранного: ${error.message}`)
          return
        }

        void refreshCount(artworkId)
        return
      }

      setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, liked: true } : work)))
      setCounts((state) => ({
        ...state,
        [artworkId]: previousCount + 1,
      }))

      const { data, error } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, artwork_id: artworkId })
        .select('id, artwork_id')
        .single()

      if (error) {
        setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, liked: false } : work)))
        setCounts((state) => ({ ...state, [artworkId]: previousCount }))
        alert(`Не удалось добавить в избранное: ${error.message}`)
        return
      }

      setFavMap((state) => ({ ...state, [artworkId]: data.id }))
      void refreshCount(artworkId)
    } finally {
      setTogglingIds((state) => {
        const next = { ...state }
        delete next[artworkId]
        return next
      })
    }
  }

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
          <Link href="/authors" className="mt-6 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white">
            К авторам
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="bg-black px-6 py-24 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div className="flex items-end gap-6">
            <img
              src={profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(getName(profile))}`}
              alt={getName(profile)}
              className="h-32 w-32 rounded-full border border-white/20 bg-zinc-900 object-cover"
            />
            <div>
              <div className="mb-3 text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                {isOwner ? 'Мой профиль' : 'Creative Archive'}
              </div>
              <h1 className="text-5xl font-black leading-none tracking-tight md:text-7xl">{getName(profile)}</h1>
              {profile.username && <p className="secondary-copy mt-3 text-zinc-400">@{profile.username}</p>}
            </div>
          </div>

          <div className="lg:justify-self-end">
            <p className="secondary-copy max-w-xl text-zinc-300">
              {profile.bio || 'Автор пока не добавил описание, но его работы уже можно смотреть в архиве.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Stat label="работ" value={works.length} />
              <Stat label="лайков" value={totalLikes} />
              <Stat label="роль" value={profile.role === 'admin' ? 'admin' : profile.role === 'creator' ? 'автор' : 'участник'} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {works.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
            У автора пока нет опубликованных работ.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {works.map((work) => (
              <article key={work.id} className="group overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm transition hover:border-black hover:shadow-xl">
                <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100">
                  <img
                    src={work.image_url}
                    alt={work.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <button
                    onClick={() => void toggleFavorite(work.id)}
                    className={`absolute right-4 top-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold shadow-xl backdrop-blur-md transition ${
                      work.liked ? 'bg-red-500 text-white' : 'bg-white/90 text-black hover:bg-red-500 hover:text-white'
                    }`}
                    aria-pressed={work.liked ? 'true' : 'false'}
                    disabled={!!togglingIds[work.id]}
                  >
                    <Heart size={16} className={work.liked ? 'fill-current' : ''} />
                    {counts[work.id] ?? 0}
                  </button>
                </div>

                <div className="p-5">
                  <h2 className="line-clamp-2 text-xl font-black">{work.title}</h2>
                  {work.description && <p className="secondary-copy mt-2 line-clamp-3 text-sm text-zinc-500">{work.description}</p>}
                  {work.tags && work.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {work.tags.slice(0, 4).map((tag) => (
                        <span key={tag} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showNag && <NagModal forceOpen reason="like" onClose={() => setShowNag(false)} />}
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-full border border-white/15 bg-white/10 px-5 py-3 backdrop-blur">
      <span className="mr-2 text-lg font-black text-white">{value}</span>
      <span className="secondary-copy text-sm text-zinc-400">{label}</span>
    </div>
  )
}
