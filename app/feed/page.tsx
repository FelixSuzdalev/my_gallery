'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Heart, Image as ImageIcon, Loader2, MessageCircle, ThumbsUp, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import FeedFilters from '@/components/FeedFilters'
import NagModal from '@/components/NagModal'
import ArtworkComments from '@/components/ArtworkComments'
import { SortByEnum } from '@/app/core/models/types'
import type { ArtworkStatsCounts, ArtworkStatsMap } from '@/lib/artwork-stats'
import { searchArtworks, type ArtworkRow } from '@/lib/search'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'
import {
  createOwnAction,
  deleteOwnAction,
  emptyStats,
  getCurrentUserId,
  getStats,
  loadOwnActionMap,
  loadV2Engagement,
  refreshV2ArtworkStats,
} from '@/lib/v2-content'

interface Artwork {
  id: string
  title: string
  image_url?: string | null
  description?: string | null
  tags?: string[]
  created_at?: string
  author_id?: string
  comments_enabled?: boolean
  profiles?: {
    username?: string | null
    full_name?: string | null
  } | null
  liked?: boolean
  likedByCurrentUser?: boolean
}

type SearchResult = Awaited<ReturnType<typeof searchArtworks>>
type FavoriteRow = {
  id: string
  artwork_id: string
  user_id?: string
}

const ALL_TAG = 'Все'

function getAuthorName(work: Artwork) {
  return work.profiles?.full_name || work.profiles?.username || work.author_id || 'Автор'
}

function shuffleArtworks<T>(items: T[]) {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const item = shuffled[index]
    shuffled[index] = shuffled[randomIndex]
    shuffled[randomIndex] = item
  }

  return shuffled
}

export default function FeedPage() {
  const [works, setWorks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [activeTag, setActiveTag] = useState(ALL_TAG)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortByEnum, setSortByEnum] = useState<SortByEnum>(SortByEnum.Newest)
  const [showNag, setShowNag] = useState(false)
  const [togglingFavoriteIds, setTogglingFavoriteIds] = useState<Record<string, boolean>>({})
  const [togglingLikeIds, setTogglingLikeIds] = useState<Record<string, boolean>>({})
  const [favMap, setFavMap] = useState<Record<string, string>>({})
  const [likeMap, setLikeMap] = useState<Record<string, string>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [stats, setStats] = useState<ArtworkStatsMap>({})
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const applyStatsUpdate = useCallback((artworkId: string, nextStats: ArtworkStatsCounts) => {
    setStats((state) => ({ ...state, [artworkId]: nextStats }))
  }, [])

  const fetchArtworks = useCallback(async (filters?: { tag?: string; search?: string; sortBy?: SortByEnum }) => {
    setLoading(true)

    try {
      const explicitTag = filters?.tag && filters.tag !== ALL_TAG ? filters.tag : undefined
      const search = filters?.search?.trim() ?? ''
      const sortBy = filters?.sortBy ?? SortByEnum.Newest
      const hasSearch = search.length > 0

      let res: SearchResult | null = null

      try {
        res = await searchArtworks({
          q: hasSearch ? search : undefined,
          tag: explicitTag,
          sortBy,
          limit: 500,
        })
      } catch (err) {
        console.warn('searchArtworks failed, using fallback fetch', err)
      }

      let artworks: Artwork[] = []

      if (res && Array.isArray(res.artworks) && res.artworks.length > 0) {
        artworks = res.artworks.map((artwork: ArtworkRow & { comments_enabled?: boolean; description?: string | null }) => ({
          id: artwork.id,
          title: artwork.title,
          image_url: artwork.image_url,
          description: artwork.description,
          tags: artwork.tags,
          created_at: artwork.created_at,
          author_id: artwork.author_id,
          comments_enabled: artwork.comments_enabled ?? true,
          profiles: artwork.profiles,
          liked: Boolean(res?.favMap?.[artwork.id]),
        }))
      } else {
        const artworkSelect = isSupabaseV2
          ? `
            id,
            title,
            image_url,
            description,
            tags,
            created_at,
            author_id,
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
            tags,
            created_at,
            author_id,
            profiles (
              username,
              full_name
            )
          `

        let fallbackQuery = supabase
          .from('artworks')
          .select(artworkSelect)

        if (isSupabaseV2) {
          fallbackQuery = fallbackQuery
            .eq('status', 'published')
            .eq('visibility', 'public')
            .is('deleted_at', null)
        }

        const { data, error } = await fallbackQuery.order('created_at', { ascending: false }).limit(500)

        if (error) {
          console.error('Artworks fallback load error:', error)
        } else {
          const all = (data ?? []) as unknown as Artwork[]
          const searchLower = search.toLowerCase()
          const tokens = hasSearch ? searchLower.split(/\s+/).filter(Boolean) : []

          artworks = all.filter((item) => {
            const tags = item.tags ?? []
            const matchesSearch =
              !hasSearch ||
              item.title?.toLowerCase().includes(searchLower) ||
              item.profiles?.username?.toLowerCase().includes(searchLower) ||
              item.profiles?.full_name?.toLowerCase().includes(searchLower) ||
              tags.some((tag) => {
                const tagLower = tag.toLowerCase()
                return tagLower.includes(searchLower) || tokens.some((token) => tagLower.includes(token))
              })

            const matchesTag = !explicitTag || tags.includes(explicitTag)
            return matchesSearch && matchesTag
          })
        }
      }

      const artworkIds = artworks.map((work) => work.id)
      const countsMap: Record<string, number> = {}
      let favMapObj: Record<string, string> = {}
      let likeMapObj: Record<string, string> = {}
      let statsMap: ArtworkStatsMap = {}

      if (artworkIds.length > 0) {
        if (isSupabaseV2) {
          const engagement = await loadV2Engagement(artworkIds)
          statsMap = engagement.stats
          favMapObj = engagement.favorites
          likeMapObj = engagement.likes
        } else {
          const { data: favRowsForCount, error: favCountErr } = await supabase
            .from('favorites')
            .select('id, artwork_id, user_id')
            .in('artwork_id', artworkIds)

          if (favCountErr) {
            console.warn('Favorite counts load error:', favCountErr)
          } else {
            ;((favRowsForCount ?? []) as FavoriteRow[]).forEach((row) => {
              countsMap[row.artwork_id] = (countsMap[row.artwork_id] ?? 0) + 1
            })
          }

          const userId = await getCurrentUserId()
          favMapObj = await loadOwnActionMap('favorites', userId, artworkIds)
        }
      }

      if (!isSupabaseV2) {
        Object.keys(favMapObj).forEach((artworkId) => {
          countsMap[artworkId] = Math.max(countsMap[artworkId] ?? 0, 1)
        })
      }

      setStats(statsMap)
      setLikeMap(likeMapObj)
      setCounts((previousCounts) => {
        const nextCounts = { ...countsMap }
        if (isSupabaseV2) return nextCounts

        artworkIds.forEach((artworkId) => {
          if ((nextCounts[artworkId] ?? 0) === 0 && (previousCounts[artworkId] ?? 0) > 0) {
            nextCounts[artworkId] = previousCounts[artworkId]
          }
        })
        return nextCounts
      })
      setFavMap(favMapObj)
      const orderedArtworks = isSupabaseV2 ? shuffleArtworks(artworks) : artworks

      setWorks(
        orderedArtworks.map((work) => ({
          ...work,
          liked: Boolean(favMapObj[work.id]),
          likedByCurrentUser: Boolean(likeMapObj[work.id]),
        }))
      )
    } catch (err) {
      console.error('fetchArtworks unexpected error', err)
      setWorks([])
      setCounts({})
      setStats({})
      setFavMap({})
      setLikeMap({})
    } finally {
      setLoading(false)
    }
  }, [])

  const onFiltersChange = useCallback((filters: { tag: string; search: string; sortBy: SortByEnum }) => {
    setSearchQuery(filters.search)
    setSortByEnum(filters.sortBy)
    setActiveTag(filters.tag || ALL_TAG)
  }, [])

  useEffect(() => {
    const tagToSend = activeTag && activeTag !== ALL_TAG ? activeTag : undefined
    void fetchArtworks({ tag: tagToSend, search: searchQuery, sortBy: sortByEnum })
  }, [activeTag, fetchArtworks, searchQuery, sortByEnum])

  useEffect(() => {
    let mounted = true

    async function loadTags() {
      let tagsQuery = supabase.from('artworks').select('tags')
      if (isSupabaseV2) {
        tagsQuery = tagsQuery
          .eq('status', 'published')
          .eq('visibility', 'public')
          .is('deleted_at', null)
      }

      const { data, error } = await tagsQuery.limit(500)
      if (!mounted || error || !data) return

      const tags = Array.from(
        new Set(
          (data as Array<{ tags?: string[] | null }>)
            .flatMap((row) => row.tags ?? [])
            .map((tag) => tag.trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b))

      setAvailableTags(tags)
    }

    const timer = window.setTimeout(() => {
      void loadTags()
    }, 0)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [])

  const getFavoriteCount = useCallback(
    (artworkId: string) => (isSupabaseV2 ? getStats(stats, artworkId).favorites_count : counts[artworkId] ?? 0),
    [counts, stats]
  )

  const getLikeCount = useCallback((artworkId: string) => getStats(stats, artworkId).likes_count, [stats])
  const getCommentCount = useCallback((artworkId: string) => getStats(stats, artworkId).comments_count, [stats])

  const processedWorks = useMemo(() => {
    if (isSupabaseV2) return works

    const sortedWorks = [...works]

    if (sortByEnum === SortByEnum.Newest) {
      sortedWorks.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    } else if (sortByEnum === SortByEnum.Popular) {
      sortedWorks.sort((a, b) => {
        const countA = isSupabaseV2 ? getStats(stats, a.id).likes_count : counts[a.id] ?? 0
        const countB = isSupabaseV2 ? getStats(stats, b.id).likes_count : counts[b.id] ?? 0
        const diff = countB - countA
        if (diff !== 0) return diff
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      })
    } else if (sortByEnum === SortByEnum.Trending) {
      const now = Date.now()
      const msPerDay = 1000 * 60 * 60 * 24

      sortedWorks.sort((a, b) => {
        const ageA = Math.max(1, (now - new Date(a.created_at ?? now).getTime()) / msPerDay)
        const ageB = Math.max(1, (now - new Date(b.created_at ?? now).getTime()) / msPerDay)
        const baseA = isSupabaseV2 ? getStats(stats, a.id).likes_count : counts[a.id] ?? 0
        const baseB = isSupabaseV2 ? getStats(stats, b.id).likes_count : counts[b.id] ?? 0
        const scoreA = baseA / ageA
        const scoreB = baseB / ageB
        if (scoreB !== scoreA) return scoreB - scoreA
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      })
    }

    return sortedWorks
  }, [counts, sortByEnum, stats, works])

  const tagCounts = useMemo(() => {
    return works.reduce((acc: Record<string, number>, work) => {
      ;(work.tags ?? []).forEach((tag) => {
        acc[tag] = (acc[tag] ?? 0) + 1
      })
      return acc
    }, {})
  }, [works])

  const openLightbox = useCallback((artworkId: string) => {
    const index = processedWorks.findIndex((work) => work.id === artworkId)
    if (index >= 0) setLightboxIndex(index)
  }, [processedWorks])

  const closeLightbox = useCallback(() => setLightboxIndex(null), [])

  const showPrev = useCallback(() => {
    setLightboxIndex((index) => {
      if (index === null) return null
      return (index - 1 + processedWorks.length) % processedWorks.length
    })
  }, [processedWorks.length])

  const showNext = useCallback(() => {
    setLightboxIndex((index) => {
      if (index === null) return null
      return (index + 1) % processedWorks.length
    })
  }, [processedWorks.length])

  useEffect(() => {
    if (lightboxIndex === null) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLightbox()
      if (event.key === 'ArrowLeft') showPrev()
      if (event.key === 'ArrowRight') showNext()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeLightbox, lightboxIndex, showNext, showPrev])

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

  const toggleFavorite = async (artworkId: string) => {
    if (togglingFavoriteIds[artworkId]) return

    try {
      setTogglingFavoriteIds((state) => ({ ...state, [artworkId]: true }))

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
        if (isSupabaseV2) {
          applyStatsUpdate(artworkId, {
            ...previousStats,
            favorites_count: Math.max(0, previousStats.favorites_count - 1),
          })
        } else {
          setCounts((state) => ({ ...state, [artworkId]: Math.max(0, previousCount - 1) }))
        }

        const { error } = await supabase.from('favorites').delete().eq('id', existingFavId)
        if (error) {
          setFavMap((state) => ({ ...state, [artworkId]: existingFavId }))
          setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, liked: true } : work)))
          if (isSupabaseV2) applyStatsUpdate(artworkId, previousStats)
          else setCounts((state) => ({ ...state, [artworkId]: previousCount }))
          alert(`Не удалось удалить из избранного: ${error.message}`)
          return
        }

        void refreshCount(artworkId)
        return
      }

      setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, liked: true } : work)))
      if (isSupabaseV2) {
        applyStatsUpdate(artworkId, { ...previousStats, favorites_count: previousStats.favorites_count + 1 })
      } else {
        setCounts((state) => ({ ...state, [artworkId]: previousCount + 1 }))
      }

      const { data, error } = await supabase
        .from('favorites')
        .insert({ user_id: userId, artwork_id: artworkId })
        .select('id, artwork_id')
        .single()

      if (error) {
        const message = String(error.message || '')
        const isDuplicate = error.code === '23505' || message.toLowerCase().includes('duplicate')

        if (isDuplicate) {
          const { data: refetchedFavorite } = await supabase
            .from('favorites')
            .select('id, artwork_id')
            .eq('user_id', userId)
            .eq('artwork_id', artworkId)
            .maybeSingle()

          if (refetchedFavorite?.id) {
            setFavMap((state) => ({ ...state, [artworkId]: refetchedFavorite.id }))
            void refreshCount(artworkId)
            return
          }
        }

        setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, liked: false } : work)))
        if (isSupabaseV2) applyStatsUpdate(artworkId, previousStats)
        else setCounts((state) => ({ ...state, [artworkId]: previousCount }))
        alert(`Не удалось добавить в избранное: ${message}`)
        return
      }

      setFavMap((state) => ({ ...state, [artworkId]: data.id }))
      void refreshCount(artworkId)
    } catch (err) {
      console.error('Favorite toggle error:', err)
      alert('Ошибка при переключении избранного.')
    } finally {
      setTogglingFavoriteIds((state) => {
        const next = { ...state }
        delete next[artworkId]
        return next
      })
    }
  }

  const toggleLike = async (artworkId: string) => {
    if (!isSupabaseV2 || togglingLikeIds[artworkId]) return

    try {
      setTogglingLikeIds((state) => ({ ...state, [artworkId]: true }))

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

        try {
          await deleteOwnAction('artwork_likes', existingLikeId)
          void refreshCount(artworkId)
        } catch (error) {
          setLikeMap((state) => ({ ...state, [artworkId]: existingLikeId }))
          setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, likedByCurrentUser: true } : work)))
          applyStatsUpdate(artworkId, previousStats)
          alert(`Не удалось убрать лайк: ${error instanceof Error ? error.message : 'ошибка'}`)
        }
        return
      }

      setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, likedByCurrentUser: true } : work)))
      applyStatsUpdate(artworkId, { ...previousStats, likes_count: previousStats.likes_count + 1 })

      try {
        const row = await createOwnAction('artwork_likes', userId, artworkId)
        setLikeMap((state) => ({ ...state, [artworkId]: row.id }))
        void refreshCount(artworkId)
      } catch (error) {
        setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, likedByCurrentUser: false } : work)))
        applyStatsUpdate(artworkId, previousStats)
        alert(`Не удалось поставить лайк: ${error instanceof Error ? error.message : 'ошибка'}`)
      }
    } finally {
      setTogglingLikeIds((state) => {
        const next = { ...state }
        delete next[artworkId]
        return next
      })
    }
  }

  const activeWork = lightboxIndex !== null ? processedWorks[lightboxIndex] : null
  const activeStats = activeWork ? getStats(stats, activeWork.id) : emptyStats

  return (
    <main className="min-h-screen bg-white">
      <FeedFilters
        activeTag={activeTag}
        setActiveTag={setActiveTag}
        setSearchQuery={setSearchQuery}
        sortBy={sortByEnum}
        setSortBy={setSortByEnum}
        totalResults={processedWorks.length}
        availableTags={availableTags}
        tagCounts={tagCounts}
        onFiltersChange={onFiltersChange}
      />

      <div className="mx-auto max-w-[1800px] px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-20 text-zinc-500">
            <Loader2 className="animate-spin" />
          </div>
        ) : processedWorks.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-zinc-300 py-20 text-center text-zinc-500">
            Работы не найдены.
          </div>
        ) : (
          <div className="columns-1 gap-8 space-y-8 sm:columns-2 md:columns-3 lg:columns-4">
            {processedWorks.map((work) => (
              <article
                key={work.id}
                className="gallery-card-motion archive-card-reveal group relative break-inside-avoid cursor-pointer overflow-hidden rounded-[24px] bg-zinc-100 shadow-sm"
                onClick={() => openLightbox(work.id)}
              >
                {work.image_url ? (
                  <img
                    src={work.image_url}
                    alt={work.title}
                    className="h-auto w-full transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex aspect-[4/5] w-full items-center justify-center text-zinc-400">
                    <ImageIcon />
                  </div>
                )}

                {isSupabaseV2 && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      void toggleLike(work.id)
                    }}
                    className={`absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold shadow-xl backdrop-blur-md transition ${
                      work.likedByCurrentUser
                        ? 'bg-black text-white'
                        : 'bg-white/90 text-black hover:bg-black hover:text-white'
                    }`}
                    title={work.likedByCurrentUser ? 'Убрать лайк' : 'Поставить лайк'}
                    aria-pressed={work.likedByCurrentUser ? 'true' : 'false'}
                    disabled={!!togglingLikeIds[work.id]}
                  >
                    <ThumbsUp size={16} className={work.likedByCurrentUser ? 'fill-current' : ''} />
                    <span>{getLikeCount(work.id)}</span>
                  </button>
                )}

                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    void toggleFavorite(work.id)
                  }}
                  className={`absolute right-3 top-3 z-10 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold shadow-xl backdrop-blur-md transition ${
                    work.liked
                      ? 'like-pop bg-red-500 text-white'
                      : 'bg-white/90 text-black hover:bg-red-500 hover:text-white'
                  }`}
                  title={work.liked ? 'Убрать из избранного' : 'Добавить в избранное'}
                  aria-pressed={work.liked ? 'true' : 'false'}
                  disabled={!!togglingFavoriteIds[work.id]}
                >
                  <Heart size={16} className={work.liked ? 'fill-current' : ''} />
                  <span>{getFavoriteCount(work.id)}</span>
                </button>

                <div className="absolute inset-0 flex flex-col justify-end bg-black/45 p-6 opacity-0 transition-opacity group-hover:opacity-100">
                  <h3 className="text-lg font-black text-white">{work.title}</h3>
                  {work.author_id ? (
                    <Link
                      href={`/profile/${work.author_id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="secondary-copy mt-1 w-fit text-sm text-white/75 transition hover:text-white"
                    >
                      {getAuthorName(work)}
                    </Link>
                  ) : (
                    <p className="secondary-copy mt-1 text-sm text-white/75">{getAuthorName(work)}</p>
                  )}
                  {isSupabaseV2 && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-white/80">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                        <ThumbsUp size={13} /> {getLikeCount(work.id)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                        <Heart size={13} /> {getFavoriteCount(work.id)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1">
                        <MessageCircle size={13} /> {getCommentCount(work.id)}
                      </span>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showNag && <NagModal forceOpen reason="like" onClose={() => setShowNag(false)} />}

      {activeWork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={closeLightbox}>
          <div
            className="relative grid max-h-[92vh] w-full max-w-6xl gap-4 overflow-auto lg:grid-cols-[minmax(0,1fr)_360px]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={closeLightbox}
              className="absolute right-3 top-3 z-20 rounded-full bg-black/50 p-2 text-white backdrop-blur"
              aria-label="Закрыть"
            >
              <X />
            </button>

            <button
              onClick={showPrev}
              className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur"
              aria-label="Предыдущая работа"
            >
              <ChevronLeft />
            </button>

            <div className="flex min-h-[60vh] items-center justify-center">
              {activeWork.image_url ? (
                <img
                  src={activeWork.image_url}
                  alt={activeWork.title}
                  className="max-h-[86vh] max-w-full rounded-2xl object-contain"
                />
              ) : (
                <div className="flex h-[60vh] w-full items-center justify-center rounded-2xl bg-zinc-900 text-zinc-500">
                  <ImageIcon className="h-10 w-10" />
                </div>
              )}
            </div>

            <aside className="rounded-3xl bg-white p-5 text-black">
              <div className="pr-8">
                <div className="font-semibold">{activeWork.title}</div>
                {activeWork.author_id ? (
                  <Link href={`/profile/${activeWork.author_id}`} className="secondary-copy text-sm text-zinc-500 transition hover:text-black">
                    {getAuthorName(activeWork)}
                  </Link>
                ) : (
                  <div className="secondary-copy text-sm text-zinc-500">{getAuthorName(activeWork)}</div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {isSupabaseV2 && (
                  <button
                    onClick={() => void toggleLike(activeWork.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                      activeWork.likedByCurrentUser ? 'bg-black text-white' : 'bg-zinc-100 text-black hover:bg-black hover:text-white'
                    }`}
                    disabled={!!togglingLikeIds[activeWork.id]}
                    aria-pressed={activeWork.likedByCurrentUser ? 'true' : 'false'}
                  >
                    <ThumbsUp size={16} className={activeWork.likedByCurrentUser ? 'fill-current' : ''} />
                    {activeStats.likes_count}
                  </button>
                )}
                <button
                  onClick={() => void toggleFavorite(activeWork.id)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                    activeWork.liked ? 'like-pop bg-red-500 text-white' : 'bg-zinc-100 text-black hover:bg-red-500 hover:text-white'
                  }`}
                  disabled={!!togglingFavoriteIds[activeWork.id]}
                  aria-pressed={activeWork.liked ? 'true' : 'false'}
                >
                  <Heart size={16} className={activeWork.liked ? 'fill-current' : ''} />
                  {getFavoriteCount(activeWork.id)}
                </button>
                {isSupabaseV2 && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-bold text-zinc-600">
                    <MessageCircle size={16} />
                    {activeStats.comments_count}
                  </span>
                )}
              </div>

              {isSupabaseV2 && (
                <ArtworkComments
                  artworkId={activeWork.id}
                  commentsEnabled={activeWork.comments_enabled ?? true}
                  onStatsChange={(nextStats) => applyStatsUpdate(activeWork.id, nextStats)}
                  className="mt-6"
                />
              )}
            </aside>

            <button
              onClick={showNext}
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur lg:right-[384px]"
              aria-label="Следующая работа"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      )}
    </main>
  )
}