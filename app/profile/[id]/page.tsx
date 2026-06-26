'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Edit3, Heart, Image as ImageIcon, Loader2, MessageCircle, ThumbsUp, UserPlus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import NagModal from '@/components/NagModal'
import ProfileEditor from '@/components/ProfileEditor'
import CreatorApplicationPanel from '@/components/CreatorApplicationPanel'
import { PublicCollectionsBlock, V2CollectionManager } from '@/components/V2Collections'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'
import {
  createOwnAction,
  deleteOwnAction,
  getCurrentUserId,
  getStats,
  loadOwnActionMap,
  loadV2Engagement,
  refreshV2ArtworkStats,
} from '@/lib/v2-content'
import type { ArtworkStatsCounts, ArtworkStatsMap } from '@/lib/artwork-stats'

type Profile = {
  id: string
  full_name?: string | null
  username?: string | null
  bio?: string | null
  avatar_url?: string | null
  role?: string | null
  is_public?: boolean | null
  deleted_at?: string | null
}

type Artwork = {
  id: string
  title: string
  image_url?: string | null
  description?: string | null
  author_id?: string | null
  created_at?: string | null
  tags?: string[] | null
  comments_enabled?: boolean | null
  profiles?: {
    username?: string | null
    full_name?: string | null
  } | null
  liked?: boolean
  likedByCurrentUser?: boolean
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
  const [stats, setStats] = useState<ArtworkStatsMap>({})
  const [favMap, setFavMap] = useState<Record<string, string>>({})
  const [likeMap, setLikeMap] = useState<Record<string, string>>({})
  const [togglingFavoriteIds, setTogglingFavoriteIds] = useState<Record<string, boolean>>({})
  const [togglingLikeIds, setTogglingLikeIds] = useState<Record<string, boolean>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followingBusy, setFollowingBusy] = useState(false)
  const [showNag, setShowNag] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const applyStatsUpdate = useCallback((artworkId: string, nextStats: ArtworkStatsCounts) => {
    setStats((state) => ({ ...state, [artworkId]: nextStats }))
  }, [])

  const loadProfile = useCallback(async () => {
    if (!profileKey) return

    setLoading(true)
    setError(null)

    const userId = await getCurrentUserId()
    setCurrentUserId(userId)
    const isOwnIdLookup = Boolean(userId && isUuid(profileKey) && profileKey === userId)

    const profileSelect = isSupabaseV2
      ? 'id, full_name, username, bio, avatar_url, role, is_public, deleted_at'
      : 'id, full_name, username, bio, avatar_url, role'

    let profileQuery = supabase.from('profiles').select(profileSelect)
    if (isSupabaseV2 && !isOwnIdLookup) {
      profileQuery = profileQuery.eq('is_public', true).is('deleted_at', null)
    }

    const { data: profileData, error: profileError } = isUuid(profileKey)
      ? await profileQuery.eq('id', profileKey).maybeSingle()
      : await profileQuery.eq('username', profileKey).maybeSingle()

    if (profileError || !profileData) {
      setProfile(null)
      setWorks([])
      setCounts({})
      setStats({})
      setFavMap({})
      setLikeMap({})
      setError('Профиль не найден.')
      setLoading(false)
      return
    }

    const nextProfile = profileData as unknown as Profile
    setProfile(nextProfile)

    if (isSupabaseV2 && userId && userId !== nextProfile.id) {
      const { data: followRow } = await supabase
        .from('follows')
        .select('follower_id, following_id')
        .eq('follower_id', userId)
        .eq('following_id', nextProfile.id)
        .maybeSingle()
      setIsFollowing(Boolean(followRow))
    } else {
      setIsFollowing(false)
    }

    const artworkSelect = isSupabaseV2
      ? `
        id,
        title,
        image_url,
        description,
        author_id,
        created_at,
        tags,
        comments_enabled,
        profiles (
          username,
          full_name
        )
      `
      : `
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
      `

    let artworksQuery = supabase
      .from('artworks')
      .select(artworkSelect)
      .eq('author_id', nextProfile.id)

    if (isSupabaseV2) {
      artworksQuery = artworksQuery
        .eq('status', 'published')
        .eq('visibility', 'public')
        .is('deleted_at', null)
    }

    const richArtworkQuery = await artworksQuery.order('created_at', { ascending: false })

    if (richArtworkQuery.error) {
      setWorks([])
      setCounts({})
      setStats({})
      setFavMap({})
      setLikeMap({})
      setLoading(false)
      return
    }

    const artworksData = (richArtworkQuery.data ?? []) as unknown as Artwork[]
    const artworkIds = artworksData.map((work) => work.id)
    const countsMap: Record<string, number> = {}
    let favMapObj: Record<string, string> = {}
    let likeMapObj: Record<string, string> = {}
    let statsMap: ArtworkStatsMap = {}

    if (artworkIds.length > 0) {
      if (isSupabaseV2) {
        const engagement = await loadV2Engagement(artworkIds, userId)
        statsMap = engagement.stats
        favMapObj = engagement.favorites
        likeMapObj = engagement.likes
      } else {
        const { data: favoriteRows } = await supabase
          .from('favorites')
          .select('id, artwork_id, user_id')
          .in('artwork_id', artworkIds)

        ;((favoriteRows ?? []) as FavoriteRow[]).forEach((row) => {
          countsMap[row.artwork_id] = (countsMap[row.artwork_id] ?? 0) + 1
          if (userId && row.user_id === userId) favMapObj[row.artwork_id] = row.id
        })

        favMapObj = { ...favMapObj, ...(await loadOwnActionMap('favorites', userId, artworkIds)) }
        Object.keys(favMapObj).forEach((artworkId) => {
          countsMap[artworkId] = Math.max(countsMap[artworkId] ?? 0, 1)
        })
      }
    }

    setCounts(countsMap)
    setStats(statsMap)
    setFavMap(favMapObj)
    setLikeMap(likeMapObj)
    setWorks(
      artworksData.map((work) => ({
        ...work,
        liked: Boolean(favMapObj[work.id]),
        likedByCurrentUser: Boolean(likeMapObj[work.id]),
      }))
    )
    setLoading(false)
  }, [profileKey])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfile()
    }, 0)
    window.addEventListener('profile:updated', loadProfile)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('profile:updated', loadProfile)
    }
  }, [loadProfile])

  const totalLikes = useMemo(() => {
    if (isSupabaseV2) return Object.values(stats).reduce((sum, item) => sum + item.likes_count, 0)
    return Object.values(counts).reduce((sum, count) => sum + count, 0)
  }, [counts, stats])

  const displayRole = profile?.role ?? null
  const isOwner = Boolean(currentUserId && profile?.id === currentUserId)
  const canShowFollow = Boolean(isSupabaseV2 && currentUserId && profile && !isOwner && profile.is_public !== false && !profile.deleted_at)
  const canShowCreatorApplication = Boolean(
    isSupabaseV2 && isOwner && displayRole !== 'creator' && displayRole !== 'admin'
  )

  async function refreshCount(artworkId: string) {
    if (isSupabaseV2) {
      const nextStats = await refreshV2ArtworkStats(artworkId)
      applyStatsUpdate(artworkId, nextStats)
      return
    }

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
    if (togglingFavoriteIds[artworkId]) return

    setTogglingFavoriteIds((state) => ({ ...state, [artworkId]: true }))

    try {
      const userId = await getCurrentUserId()
      if (!userId) {
        setShowNag(true)
        return
      }

      const existingFavId = favMap[artworkId]
      const previousCount = counts[artworkId] ?? 0
      const previousStats = getStats(stats, artworkId)

      if (existingFavId) {
        setFavMap((state) => {
          const next = { ...state }
          delete next[artworkId]
          return next
        })
        setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, liked: false } : work)))
        if (isSupabaseV2) applyStatsUpdate(artworkId, { ...previousStats, favorites_count: Math.max(0, previousStats.favorites_count - 1) })
        else setCounts((state) => ({ ...state, [artworkId]: Math.max(0, previousCount - 1) }))

        const { error: deleteError } = await supabase.from('favorites').delete().eq('id', existingFavId)
        if (deleteError) {
          setFavMap((state) => ({ ...state, [artworkId]: existingFavId }))
          setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, liked: true } : work)))
          if (isSupabaseV2) applyStatsUpdate(artworkId, previousStats)
          else setCounts((state) => ({ ...state, [artworkId]: previousCount }))
          alert(`Не удалось удалить из избранного: ${deleteError.message}`)
          return
        }

        void refreshCount(artworkId)
        return
      }

      setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, liked: true } : work)))
      if (isSupabaseV2) applyStatsUpdate(artworkId, { ...previousStats, favorites_count: previousStats.favorites_count + 1 })
      else setCounts((state) => ({ ...state, [artworkId]: previousCount + 1 }))

      const row = await createOwnAction('favorites', userId, artworkId)
      setFavMap((state) => ({ ...state, [artworkId]: row.id }))
      void refreshCount(artworkId)
    } catch (err) {
      alert(`Не удалось обновить избранное: ${err instanceof Error ? err.message : 'ошибка'}`)
    } finally {
      setTogglingFavoriteIds((state) => {
        const next = { ...state }
        delete next[artworkId]
        return next
      })
    }
  }

  async function toggleLike(artworkId: string) {
    if (!isSupabaseV2 || togglingLikeIds[artworkId]) return

    setTogglingLikeIds((state) => ({ ...state, [artworkId]: true }))

    try {
      const userId = await getCurrentUserId()
      if (!userId) {
        setShowNag(true)
        return
      }

      const existingLikeId = likeMap[artworkId]
      const previousStats = getStats(stats, artworkId)

      if (existingLikeId) {
        setLikeMap((state) => {
          const next = { ...state }
          delete next[artworkId]
          return next
        })
        setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, likedByCurrentUser: false } : work)))
        applyStatsUpdate(artworkId, { ...previousStats, likes_count: Math.max(0, previousStats.likes_count - 1) })
        await deleteOwnAction('artwork_likes', existingLikeId)
        void refreshCount(artworkId)
        return
      }

      setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, likedByCurrentUser: true } : work)))
      applyStatsUpdate(artworkId, { ...previousStats, likes_count: previousStats.likes_count + 1 })
      const row = await createOwnAction('artwork_likes', userId, artworkId)
      setLikeMap((state) => ({ ...state, [artworkId]: row.id }))
      void refreshCount(artworkId)
    } catch (err) {
      alert(`Не удалось обновить лайк: ${err instanceof Error ? err.message : 'ошибка'}`)
      await loadProfile()
    } finally {
      setTogglingLikeIds((state) => {
        const next = { ...state }
        delete next[artworkId]
        return next
      })
    }
  }

  async function toggleFollow() {
    if (!profile || !currentUserId || followingBusy || isOwner) return

    setFollowingBusy(true)
    if (isFollowing) {
      const { error: deleteError } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', profile.id)

      if (deleteError) alert('Не удалось отменить подписку: ' + deleteError.message)
      else setIsFollowing(false)
    } else {
      const { error: insertError } = await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: profile.id })

      if (insertError) alert('Не удалось подписаться: ' + insertError.message)
      else setIsFollowing(true)
    }
    setFollowingBusy(false)
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
              <div className="mt-5 flex flex-wrap gap-3">
                {canShowFollow && (
                  <button
                    onClick={() => void toggleFollow()}
                    disabled={followingBusy}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition disabled:opacity-50 ${
                      isFollowing ? 'bg-white text-black hover:bg-zinc-200' : 'border border-white/20 text-white hover:bg-white hover:text-black'
                    }`}
                  >
                    {followingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus size={16} />}
                    {isFollowing ? 'Вы подписаны' : 'Подписаться'}
                  </button>
                )}
                {isOwner && isSupabaseV2 && (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-black"
                  >
                    <Edit3 size={16} />
                    Редактировать профиль
                  </button>
                )}
                {isOwner && isSupabaseV2 && (displayRole === 'creator' || displayRole === 'admin') && (
                  <Link href="/studio" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-zinc-200">
                    Открыть студию
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="lg:justify-self-end">
            <p className="secondary-copy max-w-xl text-zinc-300">
              {profile.bio || 'Автор пока не добавил описание, но его работы уже можно смотреть в архиве.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Stat label="работ" value={works.length} />
              <Stat label={isSupabaseV2 ? 'лайков' : 'избранного'} value={totalLikes} />
              <Stat label="роль" value={profile.role === 'admin' ? 'admin' : profile.role === 'creator' ? 'автор' : 'участник'} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {canShowCreatorApplication && (
          <div className="mb-8">
            <CreatorApplicationPanel profileId={profile.id} />
          </div>
        )}

        {isOwner && isSupabaseV2 && (displayRole === 'creator' || displayRole === 'admin') && (
          <div className="mb-8">
            <V2CollectionManager currentUserId={profile.id} role={displayRole} />
          </div>
        )}

        {!isOwner && isSupabaseV2 && (displayRole === 'creator' || displayRole === 'admin') && (
          <div className="mb-8">
            <PublicCollectionsBlock authorId={profile.id} title="Коллекции автора" />
          </div>
        )}

        {works.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
            У автора пока нет опубликованных работ.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {works.map((work) => {
              const workStats = getStats(stats, work.id)
              const favoriteCount = isSupabaseV2 ? workStats.favorites_count : counts[work.id] ?? 0
              const likeCount = isSupabaseV2 ? workStats.likes_count : counts[work.id] ?? 0

              return (
                <article key={work.id} className="group overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm transition hover:border-black hover:shadow-xl">
                  <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100">
                    {work.image_url ? (
                      <img
                        src={work.image_url}
                        alt={work.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-400">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                    {isSupabaseV2 && (
                      <button
                        onClick={() => void toggleLike(work.id)}
                        className={`absolute left-4 top-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold shadow-xl backdrop-blur-md transition ${
                          work.likedByCurrentUser ? 'bg-black text-white' : 'bg-white/90 text-black hover:bg-black hover:text-white'
                        }`}
                        aria-pressed={work.likedByCurrentUser ? 'true' : 'false'}
                        disabled={!!togglingLikeIds[work.id]}
                      >
                        <ThumbsUp size={16} className={work.likedByCurrentUser ? 'fill-current' : ''} />
                        {likeCount}
                      </button>
                    )}
                    <button
                      onClick={() => void toggleFavorite(work.id)}
                      className={`absolute right-4 top-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold shadow-xl backdrop-blur-md transition ${
                        work.liked ? 'bg-red-500 text-white' : 'bg-white/90 text-black hover:bg-red-500 hover:text-white'
                      }`}
                      aria-pressed={work.liked ? 'true' : 'false'}
                      disabled={!!togglingFavoriteIds[work.id]}
                    >
                      <Heart size={16} className={work.liked ? 'fill-current' : ''} />
                      {favoriteCount}
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
                    {isSupabaseV2 && (
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-zinc-500">
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1"><ThumbsUp size={13} />{workStats.likes_count}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1"><Heart size={13} />{workStats.favorites_count}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1"><MessageCircle size={13} />{workStats.comments_count}</span>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {editOpen && profile && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/55 p-4 backdrop-blur-sm md:p-8">
          <div className="w-full max-w-2xl rounded-[32px] bg-white p-5 text-black shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <p className="text-sm text-zinc-500">Мой профиль</p>
                <h2 className="text-2xl font-black tracking-tight">Редактирование профиля</h2>
              </div>
              <button
                onClick={() => setEditOpen(false)}
                className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-black"
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>
            <ProfileEditor
              profile={profile}
              onCancel={() => setEditOpen(false)}
              onSaved={(nextProfile) => {
                setProfile((current) => (current ? { ...current, ...nextProfile } : (nextProfile as Profile)))
                setEditOpen(false)
              }}
            />
          </div>
        </div>
      )}

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
