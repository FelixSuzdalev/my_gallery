'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Heart, Image as ImageIcon, Loader2, Search, X } from 'lucide-react'
import { SortByEnum } from '@/app/core/models/types'
import { supabase } from '@/lib/supabase'
import { searchArtworks, type ArtworkRow } from '@/lib/search'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

type AuthorOption = {
  id: string
  full_name?: string | null
  username?: string | null
}

const ALL = 'Все'
const inputClass = 'w-full rounded-full border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm font-medium text-black outline-none transition placeholder:text-zinc-400 focus:border-black focus:bg-white'

function getAuthorName(work: ArtworkRow) {
  return work.profiles?.full_name || work.profiles?.username || work.author_id || 'Автор'
}

export default function SearchPage() {
  const [works, setWorks] = useState<ArtworkRow[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [authors, setAuthors] = useState<AuthorOption[]>([])
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState(ALL)
  const [authorId, setAuthorId] = useState('')
  const [sortBy, setSortBy] = useState<SortByEnum>(isSupabaseV2 ? SortByEnum.Random : SortByEnum.Newest)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadFilters = useCallback(async () => {
    let tagQuery = supabase.from('artworks').select('tags').limit(500)
    if (isSupabaseV2) tagQuery = tagQuery.eq('status', 'published').eq('visibility', 'public').is('deleted_at', null)
    const { data: tagRows } = await tagQuery
    setTags(Array.from(new Set((tagRows ?? []).flatMap((row: { tags?: string[] | null }) => row.tags ?? []).filter(Boolean))).sort())

    let authorsQuery = supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('role', ['creator', 'admin'])
      .order('full_name')
      .limit(200)
    if (isSupabaseV2) authorsQuery = authorsQuery.is('deleted_at', null).eq('is_public', true)
    const { data: authorRows } = await authorsQuery
    setAuthors((authorRows ?? []) as AuthorOption[])
  }, [])

  const loadWorks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await searchArtworks({
        q: query.trim() || undefined,
        tag: activeTag !== ALL ? activeTag : undefined,
        authorId: authorId || undefined,
        sortBy,
        limit: 500,
      })
      setWorks(result.artworks)
    } catch (loadError) {
      setWorks([])
      setError(loadError instanceof Error ? loadError.message : 'Не удалось выполнить поиск.')
    } finally {
      setLoading(false)
    }
  }, [activeTag, authorId, query, sortBy])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFilters()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadFilters])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadWorks()
    }, 260)
    return () => window.clearTimeout(timer)
  }, [loadWorks])

  const hasFilters = useMemo(
    () => Boolean(query.trim()) || activeTag !== ALL || Boolean(authorId) || sortBy !== (isSupabaseV2 ? SortByEnum.Random : SortByEnum.Newest),
    [activeTag, authorId, query, sortBy]
  )

  const selectedAuthor = authors.find((author) => author.id === authorId)

  function resetFilters() {
    setQuery('')
    setActiveTag(ALL)
    setAuthorId('')
    setSortBy(isSupabaseV2 ? SortByEnum.Random : SortByEnum.Newest)
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="bg-black px-6 py-24 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-[11px] uppercase tracking-[0.28em] text-zinc-500">Creative Archive</p>
          <h1 className="text-5xl font-black leading-none tracking-tight md:text-7xl">Поиск</h1>
          <p className="secondary-copy mt-5 max-w-xl text-zinc-300">Ищите работы по названию, описанию, тегам и автору.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="mb-8 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_180px]">
            <label className="relative block">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} pl-11 pr-10`} placeholder="Название, описание, тег или автор" />
              {query && <button type="button" onClick={() => setQuery('')} aria-label="Очистить поиск" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 hover:bg-zinc-200 hover:text-black"><X size={16} /></button>}
            </label>
            <select value={activeTag} onChange={(event) => setActiveTag(event.target.value)} className={inputClass}>
              <option value={ALL}>Все теги</option>
              {tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            <select value={authorId} onChange={(event) => setAuthorId(event.target.value)} className={inputClass}>
              <option value="">Все авторы</option>
              {authors.map((author) => <option key={author.id} value={author.id}>{author.full_name || author.username || author.id}</option>)}
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortByEnum)} className={inputClass}>
              {isSupabaseV2 && <option value={SortByEnum.Random}>Случайный порядок</option>}
              <option value={SortByEnum.Newest}>Новые</option>
              <option value={SortByEnum.Popular}>Популярные</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4 text-sm font-semibold text-zinc-500">
            <span className="rounded-full bg-zinc-100 px-3 py-1">{works.length} работ</span>
            {query.trim() && <span className="rounded-full bg-zinc-100 px-3 py-1">Запрос: {query.trim()}</span>}
            {activeTag !== ALL && <span className="rounded-full bg-zinc-100 px-3 py-1">Тег: {activeTag}</span>}
            {selectedAuthor && <span className="rounded-full bg-zinc-100 px-3 py-1">Автор: {selectedAuthor.full_name || selectedAuthor.username}</span>}
            {hasFilters && <button onClick={resetFilters} className="rounded-full px-3 py-1 text-zinc-500 hover:bg-zinc-100 hover:text-black">Сбросить фильтры</button>}
          </div>
        </section>

        {loading ? (
          <div className="flex justify-center py-20 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : error ? (
          <div className="rounded-[28px] border border-red-100 bg-red-50 p-10 text-center text-red-700">{error}</div>
        ) : works.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-zinc-300 p-10 text-center text-zinc-500">По выбранным фильтрам работы не найдены.</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {works.map((work) => (
              <article key={work.id} className="group overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm transition hover:border-black hover:shadow-xl">
                <div className="aspect-[4/5] overflow-hidden bg-zinc-100">
                  {work.image_url ? <img src={work.image_url} alt={work.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /> : <div className="flex h-full w-full items-center justify-center text-zinc-400"><ImageIcon /></div>}
                </div>
                <div className="p-5">
                  <h2 className="line-clamp-2 text-xl font-black">{work.title}</h2>
                  {work.description && <p className="secondary-copy mt-2 line-clamp-3 text-sm text-zinc-500">{work.description}</p>}
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm text-zinc-500">
                    <Link href={work.author_id ? `/profile/${work.author_id}` : '#'} className="font-semibold hover:text-black">{getAuthorName(work)}</Link>
                    <span className="inline-flex items-center gap-1"><Heart size={15} />{work._favorites_count ?? 0}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}