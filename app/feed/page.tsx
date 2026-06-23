'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Heart, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import FeedFilters from '@/components/FeedFilters'
import NagModal from '@/components/NagModal'
import { SortByEnum } from '@/app/core/models/types'
import { fetchArtworkStats } from '@/lib/artwork-stats'
import { searchArtworks, type ArtworkRow } from '@/lib/search'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

interface Artwork {
  id: string
  title: string
  image_url: string
  tags?: string[]
  created_at?: string
  author_id?: string
  profiles?: {
    username?: string | null
    full_name?: string | null
  } | null
  liked?: boolean
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

export default function FeedPage() {
  const [works, setWorks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [activeTag, setActiveTag] = useState(ALL_TAG)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortByEnum, setSortByEnum] = useState<SortByEnum>(SortByEnum.Newest)
  const [showNag, setShowNag] = useState(false)
  const [togglingIds, setTogglingIds] = useState<Record<string, boolean>>({})
  const [favMap, setFavMap] = useState<Record<string, string>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

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
        artworks = res.artworks.map((artwork: ArtworkRow) => ({
          id: artwork.id,
          title: artwork.title,
          image_url: artwork.image_url,
          tags: artwork.tags,
          created_at: artwork.created_at,
          author_id: artwork.author_id,
          profiles: artwork.profiles,
          liked: !!res?.favMap?.[artwork.id],
        }))
      } else {
        let fallbackQuery = supabase
          .from('artworks')
          .select(`
            *,
            profiles (
              username,
              full_name
            )
          `)

        if (isSupabaseV2) {
          fallbackQuery = fallbackQuery
            .eq('status', 'published')
            .eq('visibility', 'public')
            .is('deleted_at', null)
        }

        const { data, error } = await fallbackQuery
          .order('created_at', { ascending: false })
          .limit(500)

        if (error) {
          console.error('Artworks fallback load error:', error)
        } else {
          const all = (data ?? []) as Artwork[]
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
      const favMapObj: Record<string, string> = {}

      if (artworkIds.length > 0) {
        if (isSupabaseV2) {
          if (res?.counts) {
            artworkIds.forEach((artworkId) => {
              countsMap[artworkId] = res?.counts?.[artworkId] ?? 0
            })
          } else {
            const statsByArtworkId = await fetchArtworkStats(artworkIds)
            artworkIds.forEach((artworkId) => {
              countsMap[artworkId] = statsByArtworkId[artworkId]?.favorites_count ?? 0
            })
          }

          if (res?.favMap) {
            Object.assign(favMapObj, res.favMap)
          } else {
            const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
            if (sessionErr) console.warn('Session load warning:', sessionErr)

            const userId = sessionData?.session?.user?.id ?? null
            if (userId) {
              const { data: userFavRows, error: userFavErr } = await supabase
                .from('favorites')
                .select('artwork_id, id')
                .eq('user_id', userId)
                .in('artwork_id', artworkIds)

              if (userFavErr) {
                console.warn('User favorites load warning:', userFavErr)
              } else {
                ;((userFavRows ?? []) as FavoriteRow[]).forEach((row) => {
                  favMapObj[row.artwork_id] = row.id
                })
              }
            }
          }
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

          const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
          if (sessionErr) console.warn('Session load warning:', sessionErr)

          const userId = sessionData?.session?.user?.id ?? null
          if (userId) {
            const { data: userFavRows, error: userFavErr } = await supabase
              .from('favorites')
              .select('artwork_id, id')
              .eq('user_id', userId)
              .in('artwork_id', artworkIds)

            if (userFavErr) {
              console.warn('User favorites load warning:', userFavErr)
            } else {
              ;((userFavRows ?? []) as FavoriteRow[]).forEach((row) => {
                favMapObj[row.artwork_id] = row.id
              })
            }
          }
        }
      }

      if (!isSupabaseV2) {
        Object.keys(favMapObj).forEach((artworkId) => {
          countsMap[artworkId] = Math.max(countsMap[artworkId] ?? 0, 1)
        })
      }

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
      setWorks(artworks.map((work) => ({ ...work, liked: !!favMapObj[work.id] })))
    } catch (err) {
      console.error('fetchArtworks unexpected error', err)
      setWorks([])
      setCounts({})
      setFavMap({})
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

  const processedWorks = useMemo(() => {
    const sortedWorks = [...works]

    if (sortByEnum === SortByEnum.Newest) {
      sortedWorks.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    } else if (sortByEnum === SortByEnum.Popular) {
      sortedWorks.sort((a, b) => {
        const diff = (counts[b.id] ?? 0) - (counts[a.id] ?? 0)
        if (diff !== 0) return diff
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      })
    } else if (sortByEnum === SortByEnum.Trending) {
      const now = Date.now()
      const msPerDay = 1000 * 60 * 60 * 24

      sortedWorks.sort((a, b) => {
        const ageA = Math.max(1, (now - new Date(a.created_at ?? now).getTime()) / msPerDay)
        const ageB = Math.max(1, (now - new Date(b.created_at ?? now).getTime()) / msPerDay)
        const scoreA = (counts[a.id] ?? 0) / ageA
        const scoreB = (counts[b.id] ?? 0) / ageB
        if (scoreB !== scoreA) return scoreB - scoreA
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      })
    }

    return sortedWorks
  }, [counts, sortByEnum, works])

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
      const statsByArtworkId = await fetchArtworkStats([artworkId])
      setCounts((state) => ({
        ...state,
        [artworkId]: statsByArtworkId[artworkId]?.favorites_count ?? 0,
      }))
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
    if (togglingIds[artworkId]) return

    try {
      setTogglingIds((state) => ({ ...state, [artworkId]: true }))

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr) {
        alert('Ошибка авторизации. Попробуйте перезайти.')
        return
      }

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
        const message = String(error.message || '')
        const isDuplicate = error.code === '23505' || message.toLowerCase().includes('duplicate')

        if (isDuplicate) {
          const { data: refetchedFavorite } = await supabase
            .from('favorites')
            .select('id, artwork_id')
            .eq('user_id', user.id)
            .eq('artwork_id', artworkId)
            .maybeSingle()

          if (refetchedFavorite?.id) {
            setFavMap((state) => ({ ...state, [artworkId]: refetchedFavorite.id }))
            void refreshCount(artworkId)
            return
          }
        }

        setWorks((state) => state.map((work) => (work.id === artworkId ? { ...work, liked: false } : work)))
        setCounts((state) => ({ ...state, [artworkId]: previousCount }))
        alert(`Не удалось добавить в избранное: ${message}`)
        return
      }

      setFavMap((state) => ({ ...state, [artworkId]: data.id }))
      void refreshCount(artworkId)
    } catch (err) {
      console.error('Favorite toggle error:', err)
      alert('Ошибка при переключении избранного.')
    } finally {
      setTogglingIds((state) => {
        const next = { ...state }
        delete next[artworkId]
        return next
      })
    }
  }

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
                <img
                  src={work.image_url}
                  alt={work.title}
                  className="h-auto w-full transition-transform duration-700 group-hover:scale-105"
                />

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
                  disabled={!!togglingIds[work.id]}
                >
                  <Heart size={16} className={work.liked ? 'fill-current' : ''} />
                  <span>{counts[work.id] ?? 0}</span>
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
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showNag && <NagModal forceOpen reason="like" onClose={() => setShowNag(false)} />}

      {lightboxIndex !== null && processedWorks[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={closeLightbox}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-[90vw] items-center justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={closeLightbox}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-2 text-white backdrop-blur"
              aria-label="Закрыть"
            >
              <X />
            </button>

            <button
              onClick={showPrev}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur"
              aria-label="Предыдущая работа"
            >
              <ChevronLeft />
            </button>

            <div className="max-h-full max-w-full">
              <img
                src={processedWorks[lightboxIndex].image_url}
                alt={processedWorks[lightboxIndex].title}
                className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain"
              />
              <div className="mt-3 flex flex-col gap-3 text-center text-white sm:flex-row sm:items-center sm:justify-between sm:text-left">
                <div>
                  <div className="font-semibold">{processedWorks[lightboxIndex].title}</div>
                  {processedWorks[lightboxIndex].author_id ? (
                    <Link
                      href={`/profile/${processedWorks[lightboxIndex].author_id}`}
                      className="secondary-copy text-sm text-white/75 transition hover:text-white"
                    >
                      {getAuthorName(processedWorks[lightboxIndex])}
                    </Link>
                  ) : (
                    <div className="secondary-copy text-sm text-white/75">{getAuthorName(processedWorks[lightboxIndex])}</div>
                  )}
                </div>
                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    void toggleFavorite(processedWorks[lightboxIndex].id)
                  }}
                  className={`mx-auto inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition sm:mx-0 ${
                    processedWorks[lightboxIndex].liked
                      ? 'like-pop bg-red-500 text-white'
                      : 'bg-white text-black hover:bg-red-500 hover:text-white'
                  }`}
                  disabled={!!togglingIds[processedWorks[lightboxIndex].id]}
                  aria-pressed={processedWorks[lightboxIndex].liked ? 'true' : 'false'}
                >
                  <Heart size={16} className={processedWorks[lightboxIndex].liked ? 'fill-current' : ''} />
                  {counts[processedWorks[lightboxIndex].id] ?? 0}
                </button>
              </div>
            </div>

            <button
              onClick={showNext}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur"
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
