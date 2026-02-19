// app/feed/page.tsx
'use client'
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Heart, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import FeedFilters from '@/components/FeedFilters'
import NagModal from '@/components/NagModal'
import { SortByEnum } from '@/app/core/models/types'

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
  // ui-only
  liked?: boolean
}

export default function FeedPage() {
  const [works, setWorks] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    fetchArtworks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

async function refreshCounts(artworkId: string) {
  try {
    const { count, error } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('artwork_id', artworkId) // 👈 ВОТ ЭТО ОБЯЗАТЕЛЬНО

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

  async function fetchArtworks() {
    setLoading(true)
    try {
      // 1) get artworks with author profile
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

      if (worksErr) {
        console.error('Ошибка загрузки работ:', worksErr)
        setWorks([])
        setLoading(false)
        return
      }

      const worksArr = (dataWorks || []) as Artwork[]
      const artworkIds = worksArr.map(w => w.id)

      // 2) get favorites counts aggregated (single query returning many rows)
      // We'll fetch all favorite rows for these artworkIds and count client-side
      let countsMap: Record<string, number> = {}
      if (artworkIds.length > 0) {
        const { data: favRowsForCount, error: favCountErr } = await supabase
          .from('favorites')
          .select('artwork_id')
          .in('artwork_id', artworkIds)

        if (favCountErr) {
          console.warn('Не удалось загрузить counts для favorites:', favCountErr)
          // fallback: zero counts
          countsMap = {}
        } else {
          countsMap = (favRowsForCount || []).reduce((acc: Record<string, number>, r: any) => {
            acc[r.artwork_id] = (acc[r.artwork_id] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        }
      }

      // 3) try to get session & user favorites (to mark liked & build favMap)
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr) console.warn('getSession warning:', sessionErr)
      const userId = sessionData?.session?.user?.id ?? null

      let likedSet = new Set<string>()
      let favMapObj: Record<string, string> = {}

      if (userId && artworkIds.length > 0) {
        const { data: userFavRows, error: userFavErr } = await supabase
          .from('favorites')
          .select('artwork_id, id')
          .eq('user_id', userId)
          .in('artwork_id', artworkIds)

        if (userFavErr) {
          console.warn('Не удалось получить favorites текущего пользователя:', userFavErr)
        } else {
          ;(userFavRows || []).forEach((r: any) => {
            likedSet.add(r.artwork_id)
            favMapObj[r.artwork_id] = r.id
          })
        }
      }

      // 4) set states
      setCounts(countsMap)
      setFavMap(favMapObj)

      const mapped = worksArr.map(w => ({ ...w, liked: likedSet.has(w.id) }))
      setWorks(mapped)
    } catch (err) {
      console.error('fetchArtworks unexpected error', err)
      setWorks([])
    } finally {
      setLoading(false)
    }
  }

  const processedWorks = useMemo(() => {
    let filtered = works.filter(work => {
      const matchesTag = activeTag === 'Все' || (work.tags ?? []).includes(activeTag)
      const matchesSearch = work.title?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesTag && matchesSearch
    })
    return filtered
  }, [activeTag, searchQuery, works])

  // lightbox handlers
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

  // keyboard navigation
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

  // Toggle favorite: uses favMap for quick decisions and updates counts
  // Заменить текущую реализацию toggleFavorite на эту версию
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

      // синхронизируем счётчик из БД
      await refreshCounts(artworkId)

      // обновляем локально favMap и liked-флаг
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
        // гонка — перезагрузим favMap и counts из БД
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

    // success: используем реальный id и обновляем counts из БД
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

  return (
    <div className="min-h-screen bg-white">
      <FeedFilters
        activeTag={activeTag}
        setActiveTag={setActiveTag}
        setSearchQuery={setSearchQuery}
        sortBy={sortByEnum}
        setSortBy={setSortByEnum}
        totalResults={processedWorks.length}
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