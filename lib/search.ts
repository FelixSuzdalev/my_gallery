import { SortByEnum } from '@/app/core/models/types'
import { fetchArtworkStats } from '@/lib/artwork-stats'
import { supabase } from '@/lib/supabase'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

export type ArtworkRow = {
  id: string
  title: string
  image_url: string
  tags?: string[]
  created_at?: string
  author_id?: string
  description?: string | null
  profiles?: { username?: string; full_name?: string }
  liked?: boolean
  _favorites_count?: number
}

type FavoriteRow = {
  id: string
  artwork_id: string
  user_id: string
}

type UserFavoriteRow = Pick<FavoriteRow, 'id' | 'artwork_id'>

export type SearchOptions = {
  q?: string
  tag?: string
  tags?: string[]
  limit?: number
  offset?: number
  sortBy?: SortByEnum
  authorId?: string
}

const ALL_TAG = '\u0412\u0441\u0435'
const MS_PER_DAY = 1000 * 60 * 60 * 24

function ilikePattern(s: string) {
  return `%${s.replace(/%/g, '\\%').trim()}%`
}

function publicArtworkQuery() {
  let query = supabase
    .from('artworks')
    .select(`*, profiles ( username, full_name )`)

  if (isSupabaseV2) {
    query = query
      .eq('status', 'published')
      .eq('visibility', 'public')
      .is('deleted_at', null)
  }

  return query
}

async function loadFavoriteCounts(artworkIds: string[]) {
  if (artworkIds.length === 0) return {}

  if (isSupabaseV2) {
    const statsByArtworkId = await fetchArtworkStats(artworkIds)
    return artworkIds.reduce<Record<string, number>>((acc, artworkId) => {
      acc[artworkId] = statsByArtworkId[artworkId]?.favorites_count ?? 0
      return acc
    }, {})
  }

  const { data: favRows, error: favErr } = await supabase
    .from('favorites')
    .select('id, artwork_id, user_id')
    .in('artwork_id', artworkIds)

  if (favErr || !favRows) {
    if (favErr) console.warn('searchArtworks: favorites fetch error', favErr)
    return {}
  }

  return ((favRows || []) as FavoriteRow[]).reduce<Record<string, number>>((acc, row) => {
    acc[row.artwork_id] = (acc[row.artwork_id] || 0) + 1
    return acc
  }, {})
}

async function loadCurrentUserFavorites(artworkIds: string[]) {
  const favMap: Record<string, string> = {}
  if (artworkIds.length === 0) return favMap

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
  if (sessionErr) console.warn('searchArtworks: getSession warning', sessionErr)

  const userId = sessionData?.session?.user?.id ?? null
  if (!userId) return favMap

  const { data: userFavRows, error: userFavErr } = await supabase
    .from('favorites')
    .select('artwork_id, id')
    .eq('user_id', userId)
    .in('artwork_id', artworkIds)

  if (userFavErr || !userFavRows) {
    if (userFavErr) console.warn('searchArtworks: user favorites fetch error', userFavErr)
    return favMap
  }

  ;((userFavRows || []) as UserFavoriteRow[]).forEach((row) => {
    favMap[row.artwork_id] = row.id
  })

  return favMap
}

export async function searchArtworks(opts: SearchOptions = {}) {
  const { q, tag, tags, limit = 200, offset = 0, sortBy = SortByEnum.Newest, authorId } = opts

  const idMap = new Map<string, ArtworkRow>()
  const hasQuery = Boolean(q?.trim())

  if (hasQuery) {
    try {
      const pattern = ilikePattern(q ?? '')
      const orCond = `title.ilike.${pattern},description.ilike.${pattern},profiles.username.ilike.${pattern},profiles.full_name.ilike.${pattern}`
      const { data, error } = await publicArtworkQuery()
        .or(orCond)
        .range(offset, offset + limit - 1)

      if (error) {
        console.warn('searchArtworks: title/profile search error', error)
      } else {
        ((data || []) as ArtworkRow[]).forEach((row) => idMap.set(row.id, row))
      }
    } catch (err) {
      console.warn('searchArtworks: title/profile unexpected', err)
    }
  }

  if (hasQuery) {
    const phrase = (q ?? '').trim()
    try {
      const { data, error } = await publicArtworkQuery().contains('tags', [phrase])
      if (!error) ((data || []) as ArtworkRow[]).forEach((row) => idMap.set(row.id, row))
    } catch {
      /* ignore */
    }

    const tokens = phrase.split(/\s+/).map((token) => token.trim()).filter(Boolean)
    if (tokens.length) {
      try {
        const { data, error } = await publicArtworkQuery().overlaps('tags', tokens)
        if (!error) ((data || []) as ArtworkRow[]).forEach((row) => idMap.set(row.id, row))
      } catch {
        /* ignore */
      }
    }
  }

  if (tag && tag !== ALL_TAG) {
    try {
      const { data, error } = await publicArtworkQuery()
        .contains('tags', [tag])
        .range(offset, offset + limit - 1)
      if (!error) ((data || []) as ArtworkRow[]).forEach((row) => idMap.set(row.id, row))
    } catch {
      /* ignore */
    }
  } else if (tags && tags.length) {
    try {
      const { data, error } = await publicArtworkQuery()
        .overlaps('tags', tags)
        .range(offset, offset + limit - 1)
      if (!error) ((data || []) as ArtworkRow[]).forEach((row) => idMap.set(row.id, row))
    } catch {
      /* ignore */
    }
  }

  if (authorId && (hasQuery || tag || (tags && tags.length > 0))) {
    Array.from(idMap.keys()).forEach((id) => {
      if (idMap.get(id)?.author_id !== authorId) idMap.delete(id)
    })
  }

  if (!hasQuery && !tag && (!tags || tags.length === 0)) {
    try {
      let baseQuery = publicArtworkQuery()
      if (authorId) baseQuery = baseQuery.eq('author_id', authorId)
      const { data, error } = await baseQuery
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
      if (!error) ((data || []) as ArtworkRow[]).forEach((row) => idMap.set(row.id, row))
    } catch {
      /* ignore */
    }
  }

  const artworkIds = Array.from(idMap.keys())
  const countsMap = await loadFavoriteCounts(artworkIds)
  const favMap = await loadCurrentUserFavorites(artworkIds)

  const results: Array<ArtworkRow & { _favorites_count?: number }> = artworkIds.map((id) => {
    const row = idMap.get(id)!
    return {
      ...row,
      liked: Boolean(favMap[row.id]),
      _favorites_count: countsMap[row.id] ?? 0,
    }
  })

  const now = Date.now()
  const sorted = results.slice()
  if (sortBy === SortByEnum.Random) {
    for (let index = sorted.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1))
      ;[sorted[index], sorted[randomIndex]] = [sorted[randomIndex], sorted[index]]
    }
  } else if (sortBy === SortByEnum.Newest) {
    sorted.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
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
    favMap,
  }
}