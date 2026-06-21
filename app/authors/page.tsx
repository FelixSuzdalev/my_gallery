'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Search, SlidersHorizontal, UsersRound, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import AuthorCard from '@/components/AuthorCard'

type AuthorArtwork = {
  image_url?: string | null
}

type AuthorProfile = {
  id: string
  full_name?: string | null
  bio?: string | null
  avatar_url?: string | null
  artworks?: AuthorArtwork[] | null
}

type AuthorCardData = {
  id: string
  name: string
  bio: string
  avatar: string
  works: string[]
}

type AuthorFilter = 'all' | 'with-works' | 'without-works'
type AuthorSort = 'random' | 'name' | 'works'

const inputClass =
  'w-full rounded-full border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm font-medium text-black outline-none transition placeholder:text-zinc-400 focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5'

function shuffleItems<T>(items: T[]) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]]
  }
  return copy
}

export default function AuthorsPage() {
  const [authors, setAuthors] = useState<AuthorCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<AuthorFilter>('all')
  const [sort, setSort] = useState<AuthorSort>('random')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const fetchAuthors = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        bio,
        avatar_url,
        artworks ( image_url )
      `)
      .eq('role', 'creator')

    if (error) {
      console.error('Authors load error:', error)
      setError(error.message)
    } else {
      const formattedAuthors = ((data ?? []) as AuthorProfile[]).map((auth) => ({
        id: auth.id,
        name: auth.full_name || 'Анонимный автор',
        bio: auth.bio || 'Описание отсутствует',
        avatar: auth.avatar_url || 'https://via.placeholder.com/150',
        works: (auth.artworks ?? [])
          .map((art) => art.image_url)
          .filter((url): url is string => Boolean(url)),
      }))
      setAuthors(shuffleItems(formattedAuthors))
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAuthors()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchAuthors])

  const previewWorks = useMemo(() => authors.flatMap((author) => author.works).slice(0, 8), [authors])

  const filteredAuthors = useMemo(() => {
    const search = query.trim().toLowerCase()

    return authors
      .filter((author) => {
        const matchesSearch =
          !search ||
          `${author.name} ${author.bio}`.toLowerCase().includes(search)

        const matchesFilter =
          filter === 'all' ||
          (filter === 'with-works' && author.works.length > 0) ||
          (filter === 'without-works' && author.works.length === 0)

        return matchesSearch && matchesFilter
      })
      .sort((a, b) => {
        if (sort === 'works') return b.works.length - a.works.length
        if (sort === 'name') return a.name.localeCompare(b.name)
        return 0
      })
  }, [authors, filter, query, sort])

  const hasActiveFilters = Boolean(query.trim()) || filter !== 'all' || sort !== 'random'

  const resetFilters = () => {
    setQuery('')
    setFilter('all')
    setSort('random')
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="relative overflow-hidden bg-black px-6 py-24 text-white">
        <div className="absolute inset-y-6 right-0 hidden w-1/2 grid-cols-4 gap-3 pr-8 opacity-40 lg:grid">
          {previewWorks.map((src, index) => (
            <div
              key={`${src}-${index}`}
              className={`rounded-3xl bg-cover bg-center ${index % 3 === 0 ? 'row-span-2' : ''}`}
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#000_0%,rgba(0,0,0,0.92)_48%,rgba(0,0,0,0.62)_100%)]" />

        <div className="relative mx-auto max-w-7xl">
          <div className="mb-4 text-[11px] uppercase tracking-[0.28em] text-zinc-500">Creative Archive</div>
          <h1 className="text-5xl font-black leading-none tracking-tight md:text-7xl">Авторы</h1>
          <p className="secondary-copy mt-5 max-w-xl text-zinc-300">
            Художники, фотографы и дизайнеры, чьи работы формируют визуальный архив платформы.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="mb-8 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-600">
                <UsersRound size={16} />
                {filteredAuthors.length} авторов
              </div>
              {filter !== 'all' && (
                <span className="rounded-full bg-black px-4 py-3 text-sm font-semibold text-white">
                  {filter === 'with-works' ? 'С работами' : 'Без работ'}
                </span>
              )}
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
            <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 lg:grid-cols-[1.5fr_1fr_1fr]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className={`${inputClass} pl-11 pr-10`}
                  placeholder="Поиск автора по имени или описанию..."
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
                <select value={filter} onChange={(event) => setFilter(event.target.value as AuthorFilter)} className={inputClass}>
                  <option value="all">Все авторы</option>
                  <option value="with-works">С работами</option>
                  <option value="without-works">Без работ</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              </div>

              <div className="relative">
                <select value={sort} onChange={(event) => setSort(event.target.value as AuthorSort)} className={inputClass}>
                  <option value="random">Случайный порядок</option>
                  <option value="name">По имени</option>
                  <option value="works">По количеству работ</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              </div>
            </div>
          )}
        </section>

        {loading && <p className="secondary-copy text-zinc-500">Загрузка авторов из базы...</p>}
        {error && <p className="text-red-500">Ошибка подключения: {error}</p>}

        {!loading && filteredAuthors.length === 0 && (
          <div className="rounded-[28px] border border-dashed border-zinc-300 p-10 text-center">
            <p className="text-zinc-500">По выбранным параметрам авторы не найдены.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {filteredAuthors.map((author) => (
            <AuthorCard key={author.id} {...author} />
          ))}
        </div>
      </div>
    </main>
  )
}
