'use client'
import React, { useEffect, useRef, useState } from 'react'
import { Search, SlidersHorizontal, ChevronDown, X } from 'lucide-react'
import { SortByEnum } from '@/app/core/models/types'

/**
 * Props:
 * - activeTag, setActiveTag: (совместимо с текущим кодом) single tag mode
 * - setSearchQuery: вызывается с задержкой (debounce)
 * - sortBy, setSortBy: используют SortByEnum
 * - totalResults: просто для показа
 *
 * Доп. (опционально):
 * - multiSelect: если true и вы передали setActiveTags, компонент работает в multi-select режиме
 * - setActiveTags: (tags: string[]) => void — вызывается в multi-select режиме
 * - tagCounts: Record<tag, number> — если хочешь показывать кол-во в скобках у тега
 */
interface Props {
  activeTag: string;
  setActiveTag: (tag: string) => void;
  setSearchQuery: (query: string) => void;
  sortBy: SortByEnum;
  setSortBy: (value: SortByEnum) => void;
  totalResults: number;

  // optional enhancements (backwards compatible)
  multiSelect?: boolean;
  setActiveTags?: (tags: string[]) => void;
  tagCounts?: Record<string, number>;
  showClear?: boolean; // показать кнопку "Сбросить"
}

const TAGS = ['Все', 'Фотография', 'Digital', 'Минимализм', '3D', 'Архитектура', 'Портрет', 'Street Art']

export default function FeedFilters({
  activeTag,
  setActiveTag,
  setSearchQuery,
  sortBy,
  setSortBy,
  totalResults,
  multiSelect = false,
  setActiveTags,
  tagCounts,
  showClear = true
}: Props) {
  const [showTags, setShowTags] = useState(false)
  const [query, setQuery] = useState('')
  const debounceRef = useRef<number | null>(null)

  // For multi-select mode we keep local selected tags state if caller provided setActiveTags
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  // keep local controlled select value in sync if parent changes sortBy externally
  useEffect(() => {
    // nothing to do — select uses sortBy directly
  }, [sortBy])

  // Debounce search input before calling parent setSearchQuery
  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
    }
    // delay 300ms
    debounceRef.current = window.setTimeout(() => {
      setSearchQuery(query.trim())
    }, 300)

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // helper: clear filters
  function clearFilters() {
    setQuery('')
    setSearchQuery('')
    setShowTags(false)
    if (multiSelect && setActiveTags) {
      setSelectedTags([])
      setActiveTags([])
    } else {
      setActiveTag('Все')
    }
  }

  // handle tag click (single or multi mode)
  function handleTagClick(tag: string) {
    if (multiSelect && setActiveTags) {
      // toggle tag in selectedTags
      setSelectedTags(prev => {
        const exists = prev.includes(tag)
        const next = exists ? prev.filter(t => t !== tag) : [...prev, tag]
        // if user selected 'Все' in multi mode, interpret as clearing all
        if (tag === 'Все') {
          setActiveTags([])
          return []
        }
        setActiveTags(next)
        return next
      })
    } else {
      // single-select mode uses setActiveTag (backward compatible)
      setActiveTag(tag)
      // close tags panel optionally
      // setShowTags(false)
    }
  }

  // keyboard support for tag buttons (Enter / Space)
  function onTagKey(e: React.KeyboardEvent, tag: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleTagClick(tag)
    }
  }

  return (
    <div className="w-full bg-white pt-4 pb-2 border-b border-gray-100 sticky top-0 z-40 px-6">
      <div className="max-w-[1800px] mx-auto space-y-4">
        {/* Search full-width */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-black transition-colors" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              placeholder="Поиск идей, авторов, тегов..."
              className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-white border-none rounded-full py-3 pl-12 pr-6 text-sm transition-all outline-none focus:ring-2 focus:ring-black"
              aria-label="Поиск по сайту"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setSearchQuery('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-500 hover:bg-gray-100"
                aria-label="Очистить поиск"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Controls: Filters button, Sort select and results count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTags(s => !s)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                showTags ? 'bg-black text-white' : 'hover:bg-gray-100 text-black'
              }`}
              aria-pressed={showTags}
              aria-expanded={showTags}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Фильтры
            </button>

            <div className="relative group">
              <label htmlFor="sort-select" className="sr-only">Сортировать</label>
              <select
                id="sort-select"
                value={sortBy}
                onChange={(e) => {
                  // e.target.value is string but SortByEnum is string enum — TypeScript ok if cast safely
                  const val = e.target.value as SortByEnum
                  setSortBy(val)
                }}
                className="appearance-none bg-transparent pl-4 pr-10 py-2 text-xs font-bold uppercase tracking-widest cursor-pointer outline-none hover:bg-gray-100 rounded-lg transition-all"
                aria-label="Сортировать"
              >
                <option value={SortByEnum.Newest}>Сначала новые</option>
                <option value={SortByEnum.Popular}>По популярности</option>
                <option value={SortByEnum.Trending}>В тренде</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400" />
            </div>

            {showClear && (
              <button
                onClick={clearFilters}
                className="ml-2 text-xs uppercase text-gray-500 hover:text-black px-3 py-2 rounded-lg transition-colors"
                aria-label="Сбросить фильтры"
                title="Сбросить фильтры"
              >
                Сбросить
              </button>
            )}
          </div>

          <div className="hidden md:block text-[10px] text-gray-400 font-medium uppercase tracking-[0.2em]">
            Найдено: <span className="text-black font-bold ml-1">{totalResults}</span>
          </div>
        </div>

        {/* Tags area */}
        {showTags && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-4 animate-in slide-in-from-top-2 duration-300">
            {TAGS.map((tag) => {
              const isActive = multiSelect ? selectedTags.includes(tag) : activeTag === tag
              const count = tagCounts?.[tag] ?? null
              return (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  onKeyDown={(e) => onTagKey(e, tag)}
                  className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2 ${
                    isActive
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  aria-pressed={isActive}
                >
                  <span>{tag}</span>
                  {count !== null && (
                    <span className="text-xs text-gray-300">{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}