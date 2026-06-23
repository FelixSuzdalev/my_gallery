import { supabase } from '@/lib/supabase'

export type ArtworkStatsCounts = {
  likes_count: number
  favorites_count: number
  comments_count: number
}

type ArtworkStatsRow = ArtworkStatsCounts & {
  artwork_id: string
}

export type ArtworkStatsMap = Record<string, ArtworkStatsCounts>

export async function fetchArtworkStats(artworkIds: string[]): Promise<ArtworkStatsMap> {
  const uniqueIds = Array.from(new Set(artworkIds.filter(Boolean)))
  if (uniqueIds.length === 0) return {}

  const { data, error } = await supabase
    .from('artwork_stats')
    .select('artwork_id, likes_count, favorites_count, comments_count')
    .in('artwork_id', uniqueIds)

  if (error) {
    console.warn('fetchArtworkStats: stats load error', error)
    return {}
  }

  return ((data ?? []) as ArtworkStatsRow[]).reduce<ArtworkStatsMap>((acc, row) => {
    acc[row.artwork_id] = {
      likes_count: Number(row.likes_count ?? 0),
      favorites_count: Number(row.favorites_count ?? 0),
      comments_count: Number(row.comments_count ?? 0),
    }
    return acc
  }, {})
}
