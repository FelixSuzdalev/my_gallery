// app/feed/page.tsx
'use client'
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Heart, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import FeedFilters from '@/components/FeedFilters'
import NagModal from '@/components/NagModal'
import { SortByEnum } from '@/app/core/models/types'
import { searchArtworks } from '@/lib/search' // <-- добавил импорт

interface Artwork {
  id: string
  title: string
  image_url: string
  tags?: string[]
  created_at?: string
  author_id?: string
  profiles?: {
    username?: string
    full_name?: string
  }
  liked?: boolean
}

export default function FeedPage() {
  const [works, setWorks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)

  // filter/sort state (controlled by FeedFilters)
  const [activeTag, setActiveTag] = useState('Все')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortByEnum, setSortByEnum] = useState<SortByEnum>(SortByEnum.Newest)

  const [showNag, setShowNag] = useState(false)
  const [togglingIds, setTogglingIds] = useState<Record<string, boolean>>({})

  // favMap: artworkId -> favoriteRowId (for quick delete)
  const [favMap, setFavMap] = useState<Record<string, string>>({})
  // counts: artworkId -> number of favorites
  const [counts, setCounts] = useState<Record<string, number>>({})

  // lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // --- fetchArtworks: пробуем searchArtworks, а если пусто - делаем fallback fetch + client-side фильтр ---
  async function fetchArtworks(filters?: { tag?: string; tags?: string[]; search?: string }) {
    setLoading(true)
    try {
      console.debug('fetchArtworks called', { tag: filters?.tag, search: filters?.search, sortByEnum })

      const explicitTag = filters?.tag && filters.tag !== 'Все' ? filters.tag : undefined
      const explicitTags = filters?.tags && filters.tags.length ? filters.tags : undefined
      const search = filters?.search?.trim() ?? ''
      const hasSearch = search.length > 0

      // 1) Попытка использовать searchArtworks (тот код, что ты уже написал)
      let res: any = null
      try {
        res = await searchArtworks({
          q: hasSearch ? search : undefined,
          tag: explicitTag,
          tags: explicitTags,
          sortBy: sortByEnum,
          limit: 500
        })
        console.debug('searchArtworks returned', res?.artworks?.length ?? 0)
      } catch (err) {
        console.warn('searchArtworks failed, will fallback to client filtering', err)
        res = null
      }

      let artworks: Artwork[] = []

      // 2) Если searchArtworks вернул данные — используем их
      if (res && Array.isArray(res.artworks) && res.artworks.length > 0) {
        artworks = (res.artworks || []).map((a: any) => ({
          id: a.id,
          title: a.title,
          image_url: a.image_url,
          tags: a.tags,
          created_at: a.created_at,
          author_id: a.author_id,
          profiles: a.profiles,
          liked: !!res.favMap?.[a.id]
        } as Artwork))
        // also ensure counts/favMap are available
        setCounts(res.counts || {})
        setFavMap(res.favMap || {})
      } else {
        // 3) FALLBACK: если ничего не вернулось — fetch all recent and фильтруем клиент-сайдом
        console.debug('fallback: fetching artworks and filtering client-side')
        const { data: dataWorks, error: worksErr } = await supabase
          .from('artworks')
          .select(`
            *,
            profiles (
              username,
              full_name
            )
          `)
          .order('created_at', { ascending: false })
          .limit(500)

        if (worksErr) {
          console.error('Ошибка загрузки работ (fallback):', worksErr)
        } else {
          const all = (dataWorks || []) as any[]

          // client-side filter function
          const searchLower = search.toLowerCase()
          const tokens = hasSearch ? searchLower.split(/\s+/).filter(Boolean) : []

          const matchesSearch = (item: any) => {
            if (!hasSearch) return true
            const title = (item.title || '').toLowerCase()
            if (title.includes(searchLower)) return true
            const uname = (item.profiles?.username || '').toLowerCase()
            if (uname.includes(searchLower)) return true
            const fullname = (item.profiles?.full_name || '').toLowerCase()
            if (fullname.includes(searchLower)) return true
            // tags exact token includes or tag contains token
            const tagsArr: string[] = item.tags || []
            for (const t of tagsArr) {
              const tLower = (t || '').toLowerCase()
              if (tLower.includes(searchLower)) return true
              for (const tk of tokens) {
                if (tLower.includes(tk)) return true
              }
            }
            return false
          }

          const matchesTagFilter = (item: any) => {
            if (explicitTag) {
              const tagsArr: string[] = item.tags || []
              return tagsArr.includes(explicitTag)
            } else if (explicitTags) {
              const tagsArr: string[] = item.tags || []
              return explicitTags.some(t => tagsArr.includes(t))
            }
            return true
          }

          const filtered = all.filter(i => matchesSearch(i) && matchesTagFilter(i))
          artworks = filtered.map((r: any) => ({
            id: r.id,
            title: r.title,
            image_url: r.image_url,
            tags: r.tags,
            created_at: r.created_at,
            author_id: r.author_id,
            profiles: r.profiles,
            liked: false
          } as Artwork))

          // We'll compute counts/favMap below from these artwork ids
        }
      }

      // 4) Теперь — если ещё не получили counts/favMap (например в fallback) — загрузим их
      const artworkIds = artworks.map(w => w.id)
      let countsMap: Record<string, number> = {}
      let favMapObj: Record<string, string> = {}

      if (artworkIds.length > 0) {
        // get all favorites for these artworks to compute counts
        try {
          const { data: favRowsForCount, error: favCountErr } = await supabase
            .from('favorites')
            .select('id, artwork_id, user_id')
            .in('artwork_id', artworkIds)

          if (favCountErr) {
            console.warn('Не удалось загрузить counts для favorites:', favCountErr)
          } else {
            countsMap = (favRowsForCount || []).reduce((acc: Record<string, number>, r: any) => {
              acc[r.artwork_id] = (acc[r.artwork_id] || 0) + 1
              return acc
            }, {} as Record<string, number>)
          }
        } catch (err) {
          console.warn('favorites fetch failed', err)
        }

        // try to get session user favorites (to mark liked & build favMap)
        try {
          const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
          if (sessionErr) console.warn('getSession warning:', sessionErr)
          const userId = sessionData?.session?.user?.id ?? null

          if (userId) {
            const { data: userFavRows, error: userFavErr } = await supabase
              .from('favorites')
              .select('artwork_id, id')
              .eq('user_id', userId)
              .in('artwork_id', artworkIds)

            if (userFavErr) {
              console.warn('Не удалось получить favorites текущего пользователя:', userFavErr)
            } else {
              ;(userFavRows || []).forEach((r: any) => {
                favMapObj[r.artwork_id] = r.id
              })
            }
          }
        } catch (err) {
          console.warn('getSession or user favorites failed', err)
        }
      }

      // 5) Apply counts & liked flags
      setCounts(countsMap)
      setFavMap(favMapObj)
      setWorks(artworks.map(w => ({ ...w, liked: !!favMapObj[w.id] })))
      console.debug('final works length', artworks.length, 'counts keys', Object.keys(countsMap).length)
    } catch (err) {
      console.error('fetchArtworks unexpected error', err)
      setWorks([])
      setCounts({})
      setFavMap({})
    } finally {
      setLoading(false)
    }
  }

  // Minimal onFiltersChange — sync parent state with filters from FeedFilters
  const onFiltersChange = useCallback((filters: { tag: string; tags?: string[]; search: string; sortBy: SortByEnum }) => {
    // keep parent state in sync — FeedFilters already calls setSearchQuery with debounce,
    // but mirroring here ensures parent knows current filters immediately
    if (typeof filters.search === 'string') setSearchQuery(filters.search)
    if (filters.sortBy) setSortByEnum(filters.sortBy)

    if (filters.tag && filters.tag !== 'Все' && filters.tag !== 'Множественный') {
      setActiveTag(filters.tag)
    } else if (filters.tag === 'Все') {
      setActiveTag('Все')
    }
    // Note: we intentionally do NOT call fetchArtworks directly here to avoid double requests
    // because there's already an effect that triggers fetch when activeTag/searchQuery change.
  }, [])

  // initial load
  useEffect(() => {
    fetchArtworks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch whenever tag, search or sort changes (FeedFilters controls these states)
  useEffect(() => {
    const tagToSend = activeTag && activeTag !== 'Все' ? activeTag : undefined
    fetchArtworks({ tag: tagToSend, search: searchQuery || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTag, searchQuery, sortByEnum])

  // processedWorks: apply client-side filtering is redundant because we fetch filtered set,
  // but we still apply final sorting here based on sortByEnum + counts
  const processedWorks = useMemo(() => {
    // create a shallow copy to avoid mutating state
    const arr = [...works]

    if (sortByEnum === SortByEnum.Newest) {
      arr.sort((a, b) => (new Date(b.created_at ?? 0).getTime()) - (new Date(a.created_at ?? 0).getTime()))
    } else if (sortByEnum === SortByEnum.Popular) {
      arr.sort((a, b) => {
        const cb = counts[b.id] ?? 0
        const ca = counts[a.id] ?? 0
        if (cb !== ca) return cb - ca
        // tiebreaker: newest first
        return (new Date(b.created_at ?? 0).getTime()) - (new Date(a.created_at ?? 0).getTime())
      })
    } else if (sortByEnum === SortByEnum.Trending) {
      const MS_PER_DAY = 1000 * 60 * 60 * 24
      const now = Date.now()
      arr.sort((a, b) => {
        const ca = counts[a.id] ?? 0
        const cb = counts[b.id] ?? 0

        const ta = a.created_at ? new Date(a.created_at).getTime() : now
        const tb = b.created_at ? new Date(b.created_at).getTime() : now

        const ageDaysA = Math.max(1, (now - ta) / MS_PER_DAY)
        const ageDaysB = Math.max(1, (now - tb) / MS_PER_DAY)

        const scoreA = ca / ageDaysA
        const scoreB = cb / ageDaysB

        if (scoreB !== scoreA) return scoreB - scoreA
        if (cb !== ca) return cb - ca
        return tb - ta
      })
    }

    return arr
  }, [works, sortByEnum, counts])

  // lightbox handlers (unchanged)
  const openLightbox = useCallback((artworkId: string) => {
    const idx = processedWorks.findIndex(w => w.id === artworkId)
    if (idx >= 0) setLightboxIndex(idx)
  }, [processedWorks])

  const closeLightbox = useCallback(() => setLightboxIndex(null), [])

  const showPrev = useCallback(() => {
    setLightboxIndex(i => {
      if (i === null) return null
      const prev = (i - 1 + processedWorks.length) % processedWorks.length
      return prev
    })
  }, [processedWorks.length])

  const showNext = useCallback(() => {
    setLightboxIndex(i => {
      if (i === null) return null
      const next = (i + 1) % processedWorks.length
      return next
    })
  }, [processedWorks.length])

  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') showPrev()
      if (e.key === 'ArrowRight') showNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, closeLightbox, showPrev, showNext])

  // Toggle favorite (unchanged logic from your version)
  const toggleFavorite = async (artworkId: string) => {
    try {
      setTogglingIds(s => ({ ...s, [artworkId]: true }))

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr) {
        console.error('getSession error', sessionErr)
        alert('Ошибка авторизации. Попробуйте перезайти.')
        setTogglingIds(s => { const n = { ...s }; delete n[artworkId]; return n })
        return
      }
      const user = sessionData?.session?.user ?? null
      if (!user) {
        setShowNag(true)
        setTogglingIds(s => { const n = { ...s }; delete n[artworkId]; return n })
        return
      }

      const existingFavId = favMap[artworkId]

      if (existingFavId) {
        // DELETE
        const { error: delErr } = await supabase.from('favorites').delete().eq('id', existingFavId)
        if (delErr) {
          console.error('Error deleting favorite:', delErr)
          alert('Не удалось удалить из избранного: ' + delErr.message)
          setTogglingIds(s => { const n = { ...s }; delete n[artworkId]; return n })
          return
        }

        await refreshCounts(artworkId)

        setFavMap(m => { const n = { ...m }; delete n[artworkId]; return n })
        setWorks(ws => ws.map(w => w.id === artworkId ? { ...w, liked: false } : w))
        setTogglingIds(s => { const n = { ...s }; delete n[artworkId]; return n })
        return
      }

      // INSERT
      const { data: insertData, error: insertErr } = await supabase
        .from('favorites')
        .insert({ user_id: user.id, artwork_id: artworkId })
        .select()
        .single()

      if (insertErr) {
        console.error('Error inserting favorite:', insertErr)
        const msg = String(insertErr.message || '')
        if (insertErr.code === '23505' || msg.toLowerCase().includes('duplicate')) {
          // race — refetch
          const { data: refetchFav, error: refetchErr } = await supabase
            .from('favorites')
            .select('id, artwork_id')
            .eq('user_id', user.id)
            .eq('artwork_id', artworkId)
            .maybeSingle()

          if (!refetchErr && refetchFav?.id) {
            setFavMap(f => ({ ...f, [artworkId]: refetchFav.id }))
          }
          await refreshCounts(artworkId)
          setWorks(ws => ws.map(w => w.id === artworkId ? { ...w, liked: true } : w))
        } else {
          alert('Не удалось добавить в избранное: ' + msg)
        }
        setTogglingIds(s => { const n = { ...s }; delete n[artworkId]; return n })
        return
      }

      setFavMap(f => ({ ...f, [artworkId]: insertData.id }))
      await refreshCounts(artworkId)
      setWorks(ws => ws.map(w => w.id === artworkId ? { ...w, liked: true } : w))

    } catch (err) {
      console.error('toggleFavorite unexpected error', err)
      alert('Ошибка при переключении избранного: ' + String(err))
    } finally {
      setTogglingIds(s => { const n = { ...s }; delete n[artworkId]; return n })
    }
  }

  // helper: refresh a single artwork's favorite count
  async function refreshCounts(artworkId: string) {
    try {
      const { count, error } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('artwork_id', artworkId)

      if (error) {
        console.warn('refreshCounts error:', error)
        return
      }

      setCounts(c => ({
        ...c,
        [artworkId]: count ?? 0
      }))
    } catch (err) {
      console.error('refreshCounts unexpected', err)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <FeedFilters
        activeTag={activeTag}
        setActiveTag={setActiveTag}
        setSearchQuery={setSearchQuery}
        sortBy={sortByEnum}
        setSortBy={setSortByEnum}
        totalResults={processedWorks.length}
        onFiltersChange={onFiltersChange}
      />

      <div className="max-w-[1800px] mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-8 space-y-8">
            {processedWorks.map((work) => (
              <div
                key={work.id}
                className="break-inside-avoid group cursor-pointer relative rounded-2xl overflow-hidden shadow-sm"
                onClick={() => openLightbox(work.id)}
              >
                <img src={work.image_url} alt={work.title} className="w-full h-auto transition-transform duration-700 group-hover:scale-105" />

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity p-6 flex flex-col justify-end">
                  <h3 className="text-white font-bold">{work.title}</h3>
                  <p className="text-white/70 text-sm">@{work.profiles?.username}</p>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(work.id) }}
                      className={`w-fit p-2 rounded-full transition-colors ${work.liked ? 'bg-red-500 text-white' : 'bg-white text-black hover:bg-red-500 hover:text-white'}`}
                      title={work.liked ? 'Убрать из избранного' : 'Добавить в избранное'}
                      aria-pressed={work.liked ? 'true' : 'false'}
                      disabled={!!togglingIds[work.id]}
                    >
                      <Heart size={18} />
                    </button>

                    <div className="text-white/90 text-sm select-none">
                      {counts[work.id] ?? 0}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNag && <NagModal onClose={() => setShowNag(false)} />}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => closeLightbox()}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => closeLightbox()}
              className="absolute right-3 top-3 p-2 rounded bg-black/40 text-white"
              aria-label="Close"
            >
              <X />
            </button>

            <button
              onClick={() => showPrev()}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded bg-black/40 text-white"
              aria-label="Previous"
            >
              <ChevronLeft />
            </button>

            <div className="max-w-full max-h-full">
              <img
                src={processedWorks[lightboxIndex].image_url}
                alt={processedWorks[lightboxIndex].title}
                className="max-w-[90vw] max-h-[80vh] object-contain"
              />
              <div className="mt-3 text-center text-white">
                <div className="font-semibold">{processedWorks[lightboxIndex].title}</div>
                <div className="text-sm text-white/80">@{processedWorks[lightboxIndex].profiles?.username}</div>
              </div>
            </div>

            <button
              onClick={() => showNext()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded bg-black/40 text-white"
              aria-label="Next"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}