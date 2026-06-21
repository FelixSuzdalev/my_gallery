'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Heart, Search, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import FavoriteCard, { type FavoriteArtwork } from '@/components/FavoriteCard'

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

type FavoriteRow = {
  favId: string
  artwork: FavoriteArtwork
  user?: Profile
}

type FavoriteSort = 'recent' | 'title'

const inputClass =
  'w-full rounded-full border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm font-medium text-black outline-none transition placeholder:text-zinc-400 focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5'

function getAuthorName(artwork: FavoriteArtwork) {
  return artwork.profiles?.full_name || artwork.profiles?.username || artwork.author_id || 'Автор'
}

export default function FavoritesPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [rows, setRows] = useState<FavoriteRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<FavoriteSort>('recent')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadFavorites() {
      setLoading(true)
      setError(null)

      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr || !userData?.user) {
        if (!mounted) return
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
        if (!mounted) return
        setError('Ошибка загрузки профиля.')
        setLoading(false)
        return
      }

      if (!mounted) return
      setProfile(prof as Profile)

      const { data: favRowsData, error: favErr } = await supabase
        .from('favorites')
        .select('id, user_id, artwork_id')
        .eq('user_id', uid)

      if (favErr) {
        if (!mounted) return
        setError('Ошибка загрузки избранного.')
        setLoading(false)
        return
      }

      if (!favRowsData || favRowsData.length === 0) {
        if (!mounted) return
        setRows([])
        setLoading(false)
        return
      }

      const favRows = favRowsData as FavRow[]
      const artworkIds = Array.from(new Set(favRows.map((row) => row.artwork_id)))

      let artworksData: FavoriteArtwork[] = []
      const artworkQuery = await supabase
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
        .in('id', artworkIds)

      if (artworkQuery.error) {
        const fallbackQuery = await supabase
          .from('artworks')
          .select('id, title, image_url, description, author_id')
          .in('id', artworkIds)

        if (fallbackQuery.error) {
          if (!mounted) return
          setError('Не удалось загрузить работы.')
          setLoading(false)
          return
        }

        artworksData = (fallbackQuery.data ?? []) as FavoriteArtwork[]
      } else {
        artworksData = (artworkQuery.data ?? []) as FavoriteArtwork[]
      }

      const artMap = new Map<string, FavoriteArtwork>()
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

      if (!mounted) return
      setRows(combined)
      setLoading(false)
    }

    const timer = window.setTimeout(() => {
      void loadFavorites()
    }, 0)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [])

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
    setDeleting((state) => ({ ...state, [favId]: true }))
    const prevRows = rows
    setRows((state) => state.filter((row) => row.favId !== favId))

    const { error } = await supabase.from('favorites').delete().eq('id', favId)
    if (error) {
      setRows(prevRows)
      alert(`Не удалось удалить: ${error.message}`)
    }

    setDeleting((state) => {
      const next = { ...state }
      delete next[favId]
      return next
    })
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
          <div className="py-20 text-center text-zinc-500">Загрузка избранного...</div>
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
              {rows.length === 0 ? 'Здесь пока нет сохраненных работ.' : 'По выбранным параметрам ничего не найдено.'}
            </p>
            <Link href="/feed" className="mt-6 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition hover:bg-zinc-800">
              Смотреть работы
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRows.map((row, index) => (
              <FavoriteCard
                key={row.favId}
                artwork={row.artwork}
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
                src={activeRow.artwork.image_url}
                alt={activeRow.artwork.title}
                className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain"
              />
              <div className="mt-3 text-center text-white">
                <div className="font-semibold">{activeRow.artwork.title}</div>
                <div className="secondary-copy text-sm text-white/75">{getAuthorName(activeRow.artwork)}</div>
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
