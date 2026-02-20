// lib/search.ts
import { supabase } from '@/lib/supabase'
import { SortByEnum } from '@/app/core/models/types'

export type ArtworkRow = {
  id: string
  title: string
  image_url: string
  tags?: string[]
  created_at?: string
  author_id?: string
  profiles?: { username?: string; full_name?: string }
  liked?: boolean
  _favorites_count?: number
}

export type SearchOptions = {
  q?: string
  tag?: string
  tags?: string[]
  limit?: number
  offset?: number
  sortBy?: SortByEnum
}

function ilikePattern(s: string) {
  return `%${s.replace(/%/g, '\\%').trim()}%`
}

/**
 * searchArtworks - универсальный поиск работ
 * Возвращает: { artworks, counts, favMap }
 */
export async function searchArtworks(opts: SearchOptions = {}) {
  const { q, tag, tags, limit = 200, offset = 0, sortBy = SortByEnum.Newest } = opts

  const idMap = new Map<string, ArtworkRow>()

  // 1) если q — ищем по title OR profiles.username OR profiles.full_name
  if (q && q.trim().length > 0) {
    try {
      const pattern = ilikePattern(q)
      // supabase .or uses comma-separated conditions
      const orCond = `title.ilike.${pattern},profiles.username.ilike.${pattern},profiles.full_name.ilike.${pattern}`
      const { data, error } = await supabase
        .from('artworks')
        .select(`*, profiles ( username, full_name )`)
        .or(orCond)
        .range(offset, offset + limit - 1)

      if (error) {
        console.warn('searchArtworks: title/profile search error', error)
      } else {
        (data || []).forEach((r: any) => idMap.set(r.id, r as ArtworkRow))
      }
    } catch (err) {
      console.warn('searchArtworks: title/profile unexpected', err)
    }
  }

  // 2) попытка поиска по тегам: сначала целая фраза как тег, потом токены -> overlaps
  if (q && q.trim().length > 0) {
    const phrase = q.trim()
    try {
      const { data, error } = await supabase
        .from('artworks')
        .select(`*, profiles ( username, full_name )`)
        .contains('tags', [phrase])
      if (!error) (data || []).forEach((r: any) => idMap.set(r.id, r as ArtworkRow))
    } catch (err) {
      /* ignore */
    }

    const tokens = phrase.split(/\s+/).map(t => t.trim()).filter(Boolean)
    if (tokens.length) {
      try {
        const { data, error } = await supabase
          .from('artworks')
          .select(`*, profiles ( username, full_name )`)
          .overlaps('tags', tokens)
        if (!error) (data || []).forEach((r: any) => idMap.set(r.id, r as ArtworkRow))
      } catch (err) {
        /* ignore */
      }
    }
  }

  // 3) явные фильтры tag / tags
  if (tag && tag !== 'Все') {
    try {
      const { data, error } = await supabase
        .from('artworks')
        .select(`*, profiles ( username, full_name )`)
        .contains('tags', [tag])
        .range(offset, offset + limit - 1)
      if (!error) (data || []).forEach((r: any) => idMap.set(r.id, r as ArtworkRow))
    } catch (err) { /* ignore */ }
  } else if (tags && tags.length) {
    try {
      const { data, error } = await supabase
        .from('artworks')
        .select(`*, profiles ( username, full_name )`)
        .overlaps('tags', tags)
        .range(offset, offset + limit - 1)
      if (!error) (data || []).forEach((r: any) => idMap.set(r.id, r as ArtworkRow))
    } catch (err) { /* ignore */ }
  }

  // 4) fallback: если ничего не передано — берем свежие
  if ((!q || q.trim() === '') && (!tag && (!tags || tags.length === 0))) {
    try {
      const { data, error } = await supabase
        .from('artworks')
        .select(`*, profiles ( username, full_name )`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      if (!error) (data || []).forEach((r: any) => idMap.set(r.id, r as ArtworkRow))
    } catch (err) { /* ignore */ }
  }

  const artworkIds = Array.from(idMap.keys())

  // fetch favorites for these artworks (for counts + favMap)
  let countsMap: Record<string, number> = {}
  let favMap: Record<string, string> = {}

  if (artworkIds.length > 0) {
    try {
      const { data: favRows, error: favErr } = await supabase
        .from('favorites')
        .select('id, artwork_id, user_id')
        .in('artwork_id', artworkIds)

      if (!favErr && favRows) {
        countsMap = (favRows || []).reduce((acc: Record<string, number>, r: any) => {
          acc[r.artwork_id] = (acc[r.artwork_id] || 0) + 1
          return acc
        }, {})
      }
    } catch (err) {
      console.warn('searchArtworks: favorites fetch error', err)
    }

    // session => favMap for current user (mark liked)
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr) console.warn('searchArtworks: getSession warning', sessionErr)
      const userId = sessionData?.session?.user?.id ?? null
      if (userId) {
        const { data: userFavRows, error: userFavErr } = await supabase
          .from('favorites')
          .select('artwork_id, id')
          .eq('user_id', userId)
          .in('artwork_id', artworkIds)
        if (!userFavErr && userFavRows) {
          (userFavRows || []).forEach((r: any) => { favMap[r.artwork_id] = r.id })
        }
      }
    } catch (err) {
      /* ignore */
    }
  }

  // produce final results array
  const results: Array<ArtworkRow & { _favorites_count?: number }> = artworkIds.map(id => {
    const row = idMap.get(id)!
    return {
      ...row,
      liked: !!favMap[row.id],
      _favorites_count: countsMap[row.id] ?? 0
    }
  })

  // client-side sort
  const MS_PER_DAY = 1000 * 60 * 60 * 24
  const now = Date.now()
  const sorted = results.slice()
  if (sortBy === SortByEnum.Newest) {
    sorted.sort((a, b) => (new Date(b.created_at ?? 0).getTime()) - (new Date(a.created_at ?? 0).getTime()))
  } else if (sortBy === SortByEnum.Popular) {
    sorted.sort((a, b) => (b._favorites_count ?? 0) - (a._favorites_count ?? 0))
  } else if (sortBy === SortByEnum.Trending) {
    sorted.sort((a, b) => {
      const scoreA = (a._favorites_count ?? 0) / Math.max(1, (now - (a.created_at ? new Date(a.created_at).getTime() : now)) / MS_PER_DAY)
      const scoreB = (b._favorites_count ?? 0) / Math.max(1, (now - (b.created_at ? new Date(b.created_at).getTime() : now)) / MS_PER_DAY)
      if (scoreB !== scoreA) return scoreB - scoreA
      return (b._favorites_count ?? 0) - (a._favorites_count ?? 0)
    })
  }

  return {
    artworks: sorted,
    counts: countsMap,
    favMap
  }
}