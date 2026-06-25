'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Filter, Search, SlidersHorizontal, X } from 'lucide-react'
import { SortByEnum } from '@/app/core/models/types'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

interface Props {
  activeTag: string
  setActiveTag: (tag: string) => void
  setSearchQuery: (query: string) => void
  sortBy: SortByEnum
  setSortBy: (value: SortByEnum) => void
  totalResults: number
  availableTags?: string[]
  tagCounts?: Record<string, number>
  showClear?: boolean
  onFiltersChange?: (filters: {
    tag: string
    search: string
    sortBy: SortByEnum
  }) => void
}

const ALL_TAG = 'Все'
const FALLBACK_TAGS = ['Фотография', 'Digital', 'Минимализм', '3D', 'Архитектура', 'Портрет', 'Street Art']

export default function FeedFilters({
  activeTag,
  setActiveTag,
  setSearchQuery,
  sortBy,
  setSortBy,
  totalResults,
  availableTags,
  tagCounts,
  showClear = true,
  onFiltersChange,
}: Props) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debounceRef = useRef<number | null>(null)

  const tags = useMemo(() => {
    const source = availableTags && availableTags.length > 0 ? availableTags : FALLBACK_TAGS
    return [ALL_TAG, ...Array.from(new Set(source)).filter(Boolean)]
  }, [availableTags])

  const defaultSort = isSupabaseV2 ? SortByEnum.Random : SortByEnum.Newest
  const hasActiveFilters = Boolean(query.trim()) || activeTag !== ALL_TAG || sortBy !== defaultSort

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)

    debounceRef.current = window.setTimeout(() => {
      const search = query.trim()
      setSearchQuery(search)
      onFiltersChange?.({ tag: activeTag, search, sortBy })
    }, 260)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [activeTag, onFiltersChange, query, setSearchQuery, sortBy])

  function notify(next: { tag?: string; search?: string; sortBy?: SortByEnum }) {
    onFiltersChange?.({
      tag: next.tag ?? activeTag,
      search: next.search ?? query.trim(),
      sortBy: next.sortBy ?? sortBy,
    })
  }

  function clearFilters() {
    setQuery('')
    setSearchQuery('')
    setActiveTag(ALL_TAG)
    setSortBy(defaultSort)
    notify({ tag: ALL_TAG, search: '', sortBy: defaultSort })
  }

  function handleTagClick(tag: string) {
    setActiveTag(tag)
    notify({ tag })
  }

  return (
    <section className="pointer-events-none fixed right-4 top-[92px] z-40 max-w-[calc(100vw-2rem)] text-black md:right-6">
      <div className="flex flex-col items-end gap-3">
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-zinc-200 bg-white/92 p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] backdrop-blur-xl">
          <div className="hidden rounded-full px-3 py-2 text-xs font-semibold text-zinc-500 sm:block">
            <span className="text-black">{totalResults}</span> работ
            {activeTag !== ALL_TAG && <span className="ml-1 text-zinc-500">/ {activeTag}</span>}
          </div>
          <div className="flex items-center gap-1">
            {showClear && hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="rounded-full px-3 py-2 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-black"
              >
                Сбросить
              </button>
            )}
            <button
              onClick={() => setPanelOpen((value) => !value)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${
                panelOpen ? 'bg-black text-white' : 'bg-zinc-100 text-black hover:bg-zinc-200'
              }`}
              aria-expanded={panelOpen}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Поиск и фильтры</span>
            </button>
          </div>
        </div>

        {panelOpen && (
          <div className="pointer-events-auto w-[min(640px,calc(100vw-2rem))] space-y-4 rounded-[28px] border border-zinc-200 bg-white/96 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  type="text"
                  placeholder="Поиск работ, авторов, тегов..."
                  className="w-full rounded-full border border-zinc-200 bg-zinc-100 py-3 pl-12 pr-10 text-sm font-medium text-black outline-none transition placeholder:text-zinc-400 focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5"
                  aria-label="Поиск работ"
                />
                {query && (
                  <button
                    onClick={() => {
                      setQuery('')
                      setSearchQuery('')
                      notify({ search: '' })
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 transition hover:bg-zinc-200 hover:text-black"
                    aria-label="Очистить поиск"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="relative">
                <label htmlFor="sort-select" className="sr-only">
                  Сортировать
                </label>
                <select
                  id="sort-select"
                  value={sortBy}
                  onChange={(event) => {
                    const nextSort = event.target.value as SortByEnum
                    setSortBy(nextSort)
                    notify({ sortBy: nextSort })
                  }}
                  className="appearance-none rounded-full border border-zinc-200 bg-white py-3 pl-4 pr-10 text-sm font-semibold text-black outline-none transition hover:bg-zinc-100 focus:border-black"
                >
                  {isSupabaseV2 && <option value={SortByEnum.Random}>Случайный порядок</option>}
                  <option value={SortByEnum.Newest}>Сначала новые</option>
                  <option value={SortByEnum.Popular}>По популярности</option>
                  <option value={SortByEnum.Trending}>В тренде</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Filter size={15} />
              <span>{activeTag === ALL_TAG ? 'Без ограничения по тегу' : `Тег: ${activeTag}`}</span>
            </div>

            <div className="flex gap-2 overflow-x-auto border-t border-zinc-100 pt-4">
              {tags.map((tag) => {
                const isActive = activeTag === tag
                const count = tagCounts?.[tag] ?? null

                return (
                  <button
                    key={tag}
                    onClick={() => handleTagClick(tag)}
                    className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      isActive ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-black'
                    }`}
                    aria-pressed={isActive}
                  >
                    <span>{tag}</span>
                    {count !== null && <span className="text-xs opacity-70">{count}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
