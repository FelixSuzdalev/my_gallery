import { supabase } from '@/lib/supabase'
import { fetchArtworkStats, type ArtworkStatsCounts, type ArtworkStatsMap } from '@/lib/artwork-stats'

export type ArtworkStatus = 'draft' | 'published' | 'hidden' | 'archived'
export type ArtworkVisibility = 'public' | 'unlisted' | 'private'

export type UserActionMap = Record<string, string>

export type V2EngagementState = {
  stats: ArtworkStatsMap
  favorites: UserActionMap
  likes: UserActionMap
}

export type ArtworkMediaRow = {
  id: string
  bucket_id: string
  storage_path: string
}

export type NonPublicArtworkPatch = {
  status: ArtworkStatus
  visibility: ArtworkVisibility
}

export type NonPublicArtworkContentPatch = {
  title?: string
  description?: string | null
  tags?: string[]
  comments_enabled?: boolean
}

type UserActionRow = {
  id: string
  artwork_id: string
}

type ArtworkMediaCleanupSource = {
  image_url?: string | null
}

const ARTWORK_MEDIA_BUCKET = 'artwork-media'

export const emptyStats: ArtworkStatsCounts = {
  likes_count: 0,
  favorites_count: 0,
  comments_count: 0,
}

export function getStats(stats: ArtworkStatsMap, artworkId: string): ArtworkStatsCounts {
  return stats[artworkId] ?? emptyStats
}

export function canArtworkHavePublicMedia({
  status,
  visibility,
  deleted_at,
}: {
  status?: ArtworkStatus | null
  visibility?: ArtworkVisibility | null
  deleted_at?: string | null
}) {
  return status === 'published' && visibility === 'public' && !deleted_at
}

export async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.warn('V2 auth session warning:', error.message)
    return null
  }
  return data.session?.user?.id ?? null
}

export async function loadOwnActionMap(
  table: 'favorites' | 'artwork_likes',
  userId: string | null,
  artworkIds: string[]
): Promise<UserActionMap> {
  const uniqueIds = Array.from(new Set(artworkIds.filter(Boolean)))
  if (!userId || uniqueIds.length === 0) return {}

  const { data, error } = await supabase
    .from(table)
    .select('id, artwork_id')
    .eq('user_id', userId)
    .in('artwork_id', uniqueIds)

  if (error) {
    console.warn(`V2 ${table} own-state warning:`, error.message)
    return {}
  }

  return ((data ?? []) as UserActionRow[]).reduce<UserActionMap>((acc, row) => {
    acc[row.artwork_id] = row.id
    return acc
  }, {})
}

export async function loadV2Engagement(artworkIds: string[], userId?: string | null): Promise<V2EngagementState> {
  const uniqueIds = Array.from(new Set(artworkIds.filter(Boolean)))
  const currentUserId = userId === undefined ? await getCurrentUserId() : userId

  const [stats, favorites, likes] = await Promise.all([
    fetchArtworkStats(uniqueIds),
    loadOwnActionMap('favorites', currentUserId, uniqueIds),
    loadOwnActionMap('artwork_likes', currentUserId, uniqueIds),
  ])

  return { stats, favorites, likes }
}

export async function refreshV2ArtworkStats(artworkId: string): Promise<ArtworkStatsCounts> {
  const stats = await fetchArtworkStats([artworkId])
  return getStats(stats, artworkId)
}

export async function createOwnAction(table: 'favorites' | 'artwork_likes', userId: string, artworkId: string) {
  const { data, error } = await supabase
    .from(table)
    .insert({ user_id: userId, artwork_id: artworkId })
    .select('id, artwork_id')
    .single()

  if (error) throw error
  return data as UserActionRow
}

export async function deleteOwnAction(table: 'favorites' | 'artwork_likes', rowId: string) {
  const { error } = await supabase.from(table).delete().eq('id', rowId)
  if (error) throw error
}

export async function getPrimaryArtworkMedia(artworkId: string): Promise<ArtworkMediaRow | null> {
  const { data, error } = await supabase
    .from('artwork_media')
    .select('id, bucket_id, storage_path')
    .eq('artwork_id', artworkId)
    .eq('sort_order', 0)
    .maybeSingle()

  if (error) throw error
  return data as ArtworkMediaRow | null
}

export async function hasPrimaryArtworkMedia(artworkId: string): Promise<boolean> {
  return Boolean(await getPrimaryArtworkMedia(artworkId))
}

export async function deletePublicArtworkMedia(artworkId: string, source: ArtworkMediaCleanupSource = {}) {
  const result = await deletePublicMediaFileAndMetadata(artworkId, source)
  const { error: imageUrlError } = await supabase.from('artworks').update({ image_url: null }).eq('id', artworkId)
  if (imageUrlError) {
    console.warn('Public файл удалён, но image_url очистить не удалось:', imageUrlError.message)
    throw new Error(`Public файл удалён, но image_url очистить не удалось: ${imageUrlError.message}`)
  }

  return result
}

export async function moveArtworkToNonPublicState(
  artworkId: string,
  lifecyclePatch: NonPublicArtworkPatch,
  source: ArtworkMediaCleanupSource = {},
  contentPatch: NonPublicArtworkContentPatch = {}
) {
  if (canArtworkHavePublicMedia(lifecyclePatch)) {
    throw new Error('Non-public lifecycle helper нельзя использовать для published/public работы.')
  }

  await deletePublicMediaFileAndMetadata(artworkId, source)

  const { error } = await supabase
    .from('artworks')
    .update({
      status: lifecyclePatch.status,
      visibility: lifecyclePatch.visibility,
      image_url: null,
      ...sanitizeNonPublicContentPatch(contentPatch),
    })
    .eq('id', artworkId)

  if (error) {
    console.warn('Public media удалено, но non-public работу обновить не удалось:', error.message)
    throw new Error(`Не удалось обновить non-public работу после удаления public media: ${error.message}`)
  }
}

async function deletePublicMediaFileAndMetadata(artworkId: string, source: ArtworkMediaCleanupSource = {}) {
  const primaryMedia = await getPrimaryArtworkMedia(artworkId)
  const fallbackPath = primaryMedia ? null : getArtworkMediaPathFromPublicUrl(source.image_url)
  const storagePath = primaryMedia?.storage_path ?? fallbackPath

  if (!storagePath) {
    if (source.image_url) {
      throw new Error('Не удалось определить путь public-изображения. Media не удалено, работа не изменена.')
    }

    return { hadMedia: false }
  }

  const { error: fileError } = await supabase.storage.from(ARTWORK_MEDIA_BUCKET).remove([storagePath])
  if (fileError) {
    throw new Error(`Не удалось удалить public-файл artwork-media: ${fileError.message}`)
  }

  if (primaryMedia) {
    const { error: rowError } = await supabase.from('artwork_media').delete().eq('id', primaryMedia.id)
    if (rowError) {
      console.warn('Public файл удалён, но metadata artwork_media удалить не удалось:', rowError.message)
      throw new Error(`Public файл удалён, но metadata artwork_media удалить не удалось: ${rowError.message}`)
    }
  }

  return { hadMedia: true }
}

function sanitizeNonPublicContentPatch(contentPatch: NonPublicArtworkContentPatch) {
  const sanitized: NonPublicArtworkContentPatch = {}

  if ('title' in contentPatch) sanitized.title = contentPatch.title
  if ('description' in contentPatch) sanitized.description = contentPatch.description
  if ('tags' in contentPatch) sanitized.tags = contentPatch.tags
  if ('comments_enabled' in contentPatch) sanitized.comments_enabled = contentPatch.comments_enabled

  return sanitized
}

function getArtworkMediaPathFromPublicUrl(imageUrl?: string | null) {
  if (!imageUrl) return null

  try {
    const url = new URL(imageUrl)
    const marker = `/object/public/${ARTWORK_MEDIA_BUCKET}/`
    const markerIndex = url.pathname.indexOf(marker)
    if (markerIndex < 0) return null

    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
  } catch {
    return null
  }
}