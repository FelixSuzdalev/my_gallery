'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Heart, Image as ImageIcon, Loader2, MessageCircle, Search, SlidersHorizontal, ThumbsUp, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import FavoriteCard, { type FavoriteArtwork } from '@/components/FavoriteCard'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'
import {
  createOwnAction,
  deleteOwnAction,
  getStats,
  loadOwnActionMap,
  refreshV2ArtworkStats,
} from '@/lib/v2-content'
import { fetchArtworkStats, type ArtworkStatsCounts, type ArtworkStatsMap } from '@/lib/artwork-stats'

type Profile = {
  id: string
  username?: string | null
  full_name?: string | null
  avatar_url?: string | null
  role?: string | null
}

type FavRow = {
  id: string
  user_id: string
  artwork_id: string
}

type FavoriteArtworkV2 = FavoriteArtwork & {
  image_url?: string | null
  comments_enabled?: boolean | null
}

type FavoriteRow = {
  favId: string
  artwork: FavoriteArtworkV2
  user?: Profile
}

type FavoriteSort = 'recent' | 'title'

const inputClass =
  'w-full rounded-full border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm font-medium text-black outline-none transition placeholder:text-zinc-400 focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5'

function getAuthorName(artwork: FavoriteArtworkV2) {
  return artwork.profiles?.full_name || artwork.profiles?.username || artwork.author_id || 'Автор'
}

export default function FavoritesPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [rows, setRows] = useState<FavoriteRow[]>([])
  const [stats, setStats] = useState<ArtworkStatsMap>({})
  const [likeMap, setLikeMap] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const [togglingLikeIds, setTogglingLikeIds] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<FavoriteSort>('recent')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const applyStatsUpdate = useCallback((artworkId: string, nextStats: ArtworkStatsCounts) => {
    setStats((state) => ({ ...state, [artworkId]: nextStats }))
  }, [])

  const loadFavorites = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData?.user) {
      setError('Пожалуйста, авторизуйтесь, чтобы видеть избранное.')
      setLoading(false)
      return
    }

    const uid = userData.user.id

    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, role')
      .eq('id', uid)
      .single()

    if (profErr) {
      setError('Ошибка загрузки профиля.')
      setLoading(false)
      return
    }

    setProfile(prof as unknown as Profile)

    const { data: favRowsData, error: favErr } = await supabase
      .from('favorites')
      .select('id, user_id, artwork_id')
      .eq('user_id', uid)

    if (favErr) {
      setError('Ошибка загрузки избранного.')
      setLoading(false)
      return
    }

    if (!favRowsData || favRowsData.length === 0) {
      setRows([])
      setStats({})
      setLikeMap({})
      setLoading(false)
      return
    }

    const favRows = favRowsData as FavRow[]
    const artworkIds = Array.from(new Set(favRows.map((row) => row.artwork_id)))

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

    let artworkRequest = supabase
      .from('artworks')
      .select(artworkSelect)
      .in('id', artworkIds)

    if (isSupabaseV2) {
      artworkRequest = artworkRequest
        .eq('status', 'published')
        .eq('visibility', 'public')
        .is('deleted_at', null)
    }

    const artworkQuery = await artworkRequest

    if (artworkQuery.error) {
      setError('Не удалось загрузить работы.')
      setLoading(false)
      return
    }

    const artworksData = (artworkQuery.data ?? []) as unknown as FavoriteArtworkV2[]
    const artMap = new Map<string, FavoriteArtworkV2>()
    artworksData.forEach((artwork) => artMap.set(artwork.id, artwork))

    const combined = favRows
      .map((row) => {
        const artwork = artMap.get(row.artwork_id)
        if (!artwork) return null
        return {
          favId: row.id,
          artwork,
        }
      })
      .filter((row): row is FavoriteRow => Boolean(row))

    if (isSupabaseV2) {
      const visibleArtworkIds = combined.map((row) => row.artwork.id)
      const [statsResult, likesResult] = await Promise.all([
        fetchArtworkStats(visibleArtworkIds),
        loadOwnActionMap('artwork_likes', uid, visibleArtworkIds),
      ])
      setStats(statsResult)
      setLikeMap(likesResult)
    } else {
      setStats({})
      setLikeMap({})
    }

    setRows(combined)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFavorites()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadFavorites])

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase()

    return rows
      .filter(({ artwork }) => {
        if (!search) return true
        const haystack = [
          artwork.title,
          artwork.description,
          artwork.author_id,
          artwork.profiles?.full_name,
          artwork.profiles?.username,
          ...(artwork.tags ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return haystack.includes(search)
      })
      .sort((a, b) => {
        if (sort === 'title') return a.artwork.title.localeCompare(b.artwork.title)
        return new Date(b.artwork.created_at ?? 0).getTime() - new Date(a.artwork.created_at ?? 0).getTime()
      })
  }, [query, rows, sort])

  const hasActiveFilters = Boolean(query.trim()) || sort !== 'recent'
  const activeRow = lightboxIndex !== null ? filteredRows[lightboxIndex] : null
  const activeStats = activeRow ? getStats(stats, activeRow.artwork.id) : null

  const resetFilters = () => {
    setQuery('')
    setSort('recent')
  }

  const closeLightbox = useCallback(() => setLightboxIndex(null), [])

  const showPrev = useCallback(() => {
    setLightboxIndex((index) => {
      if (index === null || filteredRows.length === 0) return null
      return (index - 1 + filteredRows.length) % filteredRows.length
    })
  }, [filteredRows.length])

  const showNext = useCallback(() => {
    setLightboxIndex((index) => {
      if (index === null || filteredRows.length === 0) return null
      return (index + 1) % filteredRows.length
    })
  }, [filteredRows.length])

  useEffect(() => {
    if (lightboxIndex === null) return

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeLightbox()
      if (event.key === 'ArrowLeft') showPrev()
      if (event.key === 'ArrowRight') showNext()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeLightbox, lightboxIndex, showNext, showPrev])

  async function handleRemove(favId: string) {
    const row = rows.find((item) => item.favId === favId)
    setDeleting((state) => ({ ...state, [favId]: true }))
    const prevRows = rows
    setRows((state) => state.filter((item) => item.favId !== favId))

    const { error: deleteError } = await supabase.from('favorites').delete().eq('id', favId)
    if (deleteError) {
      setRows(prevRows)
      alert(`Не удалось удалить: ${deleteError.message}`)
    } else if (isSupabaseV2 && row) {
      const nextStats = await refreshV2ArtworkStats(row.artwork.id)
      applyStatsUpdate(row.artwork.id, nextStats)
    }

    setDeleting((state) => {
      const next = { ...state }
      delete next[favId]
      return next
    })
  }

  async function toggleLike(artworkId: string) {
    if (!isSupabaseV2 || togglingLikeIds[artworkId]) return
    const uid = profile?.id
    if (!uid) return

    setTogglingLikeIds((state) => ({ ...state, [artworkId]: true }))
    const existingLikeId = likeMap[artworkId]
    const previousStats = getStats(stats, artworkId)

    try {
      if (existingLikeId) {
        setLikeMap((state) => {
          const next = { ...state }
          delete next[artworkId]
          return next
        })
        applyStatsUpdate(artworkId, { ...previousStats, likes_count: Math.max(0, previousStats.likes_count - 1) })
        await deleteOwnAction('artwork_likes', existingLikeId)
      } else {
        applyStatsUpdate(artworkId, { ...previousStats, likes_count: previousStats.likes_count + 1 })
        const row = await createOwnAction('artwork_likes', uid, artworkId)
        setLikeMap((state) => ({ ...state, [artworkId]: row.id }))
      }

      const nextStats = await refreshV2ArtworkStats(artworkId)
      applyStatsUpdate(artworkId, nextStats)
    } catch (err) {
      applyStatsUpdate(artworkId, previousStats)
      alert(`Не удалось обновить лайк: ${err instanceof Error ? err.message : 'ошибка'}`)
      await loadFavorites()
    } finally {
      setTogglingLikeIds((state) => {
        const next = { ...state }
        delete next[artworkId]
        return next
      })
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="bg-black px-6 py-24 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 text-[11px] uppercase tracking-[0.28em] text-zinc-500">Creative Archive</div>
          <h1 className="text-5xl font-black leading-none tracking-tight md:text-7xl">
            Избранное<span className="text-zinc-500">.</span>
          </h1>
          <p className="secondary-copy mt-5 max-w-xl text-zinc-300">
            Личная подборка работ, к которым хочется вернуться позже.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="mb-8 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-600">
                <Heart size={16} className="fill-red-500 text-red-500" />
                {filteredRows.length} работ
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="rounded-full px-4 py-3 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-black"
                >
                  Сбросить
                </button>
              )}
              <button
                onClick={() => setFiltersOpen((value) => !value)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition ${
                  filtersOpen ? 'bg-black text-white' : 'bg-zinc-100 text-black hover:bg-zinc-200'
                }`}
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal size={16} />
                Поиск и фильтры
              </button>
            </div>
          </div>

          {filtersOpen && (
            <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 lg:grid-cols-[1.5fr_1fr]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={`${inputClass} pl-11 pr-10`}
                  placeholder="Поиск по названию, автору или тегу..."
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-black"
                    aria-label="Очистить поиск"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="relative">
                <select value={sort} onChange={(event) => setSort(event.target.value as FavoriteSort)} className={inputClass}>
                  <option value="recent">Сначала новые</option>
                  <option value="title">По названию</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              </div>
            </div>
          )}
        </section>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка избранного...
          </div>
        ) : error ? (
          <div className="rounded-[28px] border border-dashed border-zinc-300 p-10 text-center">
            <p className="text-zinc-500">{error}</p>
            <Link href="/feed" className="mt-6 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition hover:bg-zinc-800">
              Смотреть работы
            </Link>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-zinc-300 p-10 text-center">
            <p className="text-zinc-500">
              {rows.length === 0 ? 'Здесь пока нет сохраненных публичных работ.' : 'По выбранным параметрам ничего не найдено.'}
            </p>
            <Link href="/feed" className="mt-6 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition hover:bg-zinc-800">
              Смотреть работы
            </Link>
          </div>
        ) : isSupabaseV2 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRows.map((row, index) => {
              const rowStats = getStats(stats, row.artwork.id)
              const isLiked = Boolean(likeMap[row.artwork.id])

              return (
                <article key={row.favId} className="gallery-card-motion archive-card-reveal group overflow-hidden rounded-[28px] border border-zinc-200 bg-white text-black shadow-sm transition hover:border-black hover:shadow-xl">
                  <button className="block w-full text-left" onClick={() => setLightboxIndex(index)}>
                    <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100">
                      {row.artwork.image_url ? (
                        <img
                          src={row.artwork.image_url}
                          alt={row.artwork.title}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-400">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                      <div className="like-pop absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-black shadow-lg backdrop-blur">
                        <Heart size={14} className="fill-red-500 text-red-500" />
                        В избранном
                      </div>
                    </div>
                  </button>

                  <div className="flex min-h-52 flex-col p-5">
                    <div className="flex-1">
                      <h3 className="line-clamp-2 text-xl font-black tracking-normal">{row.artwork.title}</h3>
                      {row.artwork.description && (
                        <p className="secondary-copy mt-2 line-clamp-3 text-sm text-zinc-500">{row.artwork.description}</p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-zinc-500">
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1"><ThumbsUp size={13} />{rowStats.likes_count}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1"><Heart size={13} />{rowStats.favorites_count}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1"><MessageCircle size={13} />{rowStats.comments_count}</span>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
                      <div className="min-w-0 text-xs font-semibold text-zinc-500">
                        <span className="block truncate">{getAuthorName(row.artwork)}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => void toggleLike(row.artwork.id)}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition disabled:opacity-50 ${
                            isLiked ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-black hover:text-white'
                          }`}
                          aria-label={isLiked ? 'Убрать лайк' : 'Поставить лайк'}
                          disabled={!!togglingLikeIds[row.artwork.id]}
                        >
                          <ThumbsUp size={16} className={isLiked ? 'fill-current' : ''} />
                        </button>
                        <button
                          onClick={() => void handleRemove(row.favId)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-black hover:text-white disabled:opacity-50"
                          aria-label="Убрать из избранного"
                          disabled={!!deleting[row.favId]}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRows.map((row, index) => (
              <FavoriteCard
                key={row.favId}
                artwork={row.artwork as FavoriteArtwork}
                favId={row.favId}
                showUser={!!profile && profile.role === 'admin'}
                userLabel={row.user ? row.user.full_name || row.user.username : null}
                onRemove={handleRemove}
                onOpen={() => setLightboxIndex(index)}
                isDeleting={!!deleting[row.favId]}
              />
            ))}
          </div>
        )}
      </div>

      {activeRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={closeLightbox}>
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
              {activeRow.artwork.image_url ? (
                <img
                  src={activeRow.artwork.image_url}
                  alt={activeRow.artwork.title}
                  className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain"
                />
              ) : (
                <div className="flex h-[70vh] w-[70vw] items-center justify-center rounded-2xl bg-zinc-900 text-zinc-500">
                  <ImageIcon className="h-10 w-10" />
                </div>
              )}
              <div className="mt-3 flex flex-col gap-3 text-center text-white sm:flex-row sm:items-center sm:justify-between sm:text-left">
                <div>
                  <div className="font-semibold">{activeRow.artwork.title}</div>
                  <div className="secondary-copy text-sm text-white/75">{getAuthorName(activeRow.artwork)}</div>
                </div>
                {isSupabaseV2 && activeStats && (
                  <div className="mx-auto flex flex-wrap gap-2 sm:mx-0">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black">
                      <ThumbsUp size={16} /> {activeStats.likes_count}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black">
                      <Heart size={16} /> {activeStats.favorites_count}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black">
                      <MessageCircle size={16} /> {activeStats.comments_count}
                    </span>
                  </div>
                )}
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