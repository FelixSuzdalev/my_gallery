// hooks/useSearch.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { searchArtworks, ArtworkRow, SearchOptions } from '@/lib/search'
import { SortByEnum } from '@/app/core/models/types'

export function useSearch(initial?: { q?: string; tag?: string; tags?: string[]; sortBy?: SortByEnum }) {
  const [q, setQ] = useState(initial?.q ?? '')
  const [tag, setTag] = useState<string | undefined>(initial?.tag)
  const [tags, setTags] = useState<string[] | undefined>(initial?.tags)
  const [sortBy, setSortBy] = useState<SortByEnum>(initial?.sortBy ?? SortByEnum.Newest)

  const [results, setResults] = useState<(ArtworkRow & { _favorites_count?: number })[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [favMap, setFavMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const debounceRef = useRef<number | null>(null)

  const doSearch = useCallback(async (opts?: Partial<SearchOptions>) => {
    setLoading(true)
    try {
      const res = await searchArtworks({
        q: opts?.q ?? q,
        tag: opts?.tag ?? tag,
        tags: opts?.tags ?? tags,
        sortBy: opts?.sortBy ?? sortBy,
        limit: opts?.limit,
        offset: opts?.offset
      })
      setResults(res.artworks)
      setCounts(res.counts || {})
      setFavMap(res.favMap || {})
    } finally {
      setLoading(false)
    }
  }, [q, tag, tags, sortBy])

  // debounced query effect
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      doSearch({ q })
    }, 300)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
  }, [q, doSearch])

  // immediate refetch when tag/tags or sortBy changes
  useEffect(() => {
    doSearch({ tag, tags, sortBy })
  }, [tag, tags, sortBy, doSearch])

  return {
    q, setQ,
    tag, setTag,
    tags, setTags,
    sortBy, setSortBy,
    results, counts, favMap,
    loading,
    refetch: doSearch
  }
}