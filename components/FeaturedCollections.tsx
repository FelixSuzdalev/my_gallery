'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import ImageLightbox from './ImageLightbox'
import { supabase } from '@/lib/supabase'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

type Artwork = {
  id: string
  title?: string | null
  image_url?: string | null
}

type PublicArtwork = Artwork & {
  profiles?: {
    full_name?: string | null
    username?: string | null
  } | null
}

type CollectionItem = {
  id?: string
  artwork?: Artwork | null
}

type Collection = {
  id: string
  title: string
  description?: string | null
  created_at?: string | null
  items?: CollectionItem[]
}

type CollectionRow = Omit<Collection, 'items'>

export default function FeaturedCollections() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [availableArtworks, setAvailableArtworks] = useState<PublicArtwork[]>([])
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [artworkIds, setArtworkIds] = useState('')
  const [selectedArtworkIds, setSelectedArtworkIds] = useState<string[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const fetchCollections = useCallback(async () => {
    setLoading(true)
    try {
      const { data: cols } = await supabase
        .from('collections')
        .select('*')
        .order('created_at', { ascending: false })

      const rows = (cols ?? []) as CollectionRow[]
      if (rows.length === 0) {
        setCollections([
          {
            id: '1',
            title: 'Новая пластика',
            description: 'Эстетика чистых форм и контраста.',
            created_at: new Date().toISOString(),
            items: [],
          },
          {
            id: '2',
            title: 'Текучие сны',
            description: 'Абстрактные формы и текучесть.',
            created_at: new Date().toISOString(),
            items: [],
          },
        ])
        return
      }

      const mapped = await Promise.all(
        rows.map(async (collection) => {
          const itemSelect = isSupabaseV2
            ? '*, artwork:artworks!inner(id, title, image_url, status, visibility, deleted_at)'
            : '*, artwork:artworks(*)'

          let itemsQuery = supabase
            .from('collection_items')
            .select(itemSelect)
            .eq('collection_id', collection.id)

          if (isSupabaseV2) {
            itemsQuery = itemsQuery
              .eq('artwork.status', 'published')
              .eq('artwork.visibility', 'public')
              .is('artwork.deleted_at', null)
          }

          const { data: items } = await itemsQuery
            .order('position', { ascending: true })
            .limit(9)

          return { ...collection, items: (items ?? []) as unknown as CollectionItem[] }
        })
      )
      setCollections(mapped)
    } catch (err: unknown) {
      console.error(err)
      setCollections([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchAvailableArtworks = useCallback(async () => {
    if (!isSupabaseV2) {
      setAvailableArtworks([])
      return
    }

    const { data, error } = await supabase
      .from('artworks')
      .select('id, title, image_url, profiles:author_id(full_name, username)')
      .eq('status', 'published')
      .eq('visibility', 'public')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.warn('Не удалось загрузить работы для подборок:', error.message)
      setAvailableArtworks([])
      return
    }

    setAvailableArtworks((data ?? []) as unknown as PublicArtwork[])
  }, [])

  const checkAdmin = useCallback(async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const uid = userRes?.user?.id
      if (!uid) {
        setIsAdmin(false)
        return
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', uid).single()
      setIsAdmin(profile?.role === 'admin')
    } catch {
      setIsAdmin(false)
    }
  }, [])

  useEffect(() => {
    void fetchCollections()
    void checkAdmin()
    void fetchAvailableArtworks()
  }, [checkAdmin, fetchAvailableArtworks, fetchCollections])

  const createCollection = useCallback(async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      const { data: col, error } = await supabase
        .from('collections')
        .insert({ title: title.trim(), description: desc.trim() || null })
        .select()
        .single()

      if (error) throw error

      const ids = isSupabaseV2
        ? selectedArtworkIds
        : artworkIds.split(',').map((item) => item.trim()).filter(Boolean)

      if (ids.length) {
        const items = ids.map((artworkId, position) => ({
          collection_id: col.id,
          artwork_id: artworkId,
          position,
        }))
        const { error: itemsError } = await supabase.from('collection_items').insert(items)
        if (itemsError) throw itemsError
      }

      setTitle('')
      setDesc('')
      setArtworkIds('')
      setSelectedArtworkIds([])
      setShowEditor(false)
      await fetchCollections()
    } catch (err: unknown) {
      alert('Не удалось создать подборку: ' + (err instanceof Error ? err.message : JSON.stringify(err)))
    } finally {
      setLoading(false)
    }
  }, [artworkIds, desc, fetchCollections, selectedArtworkIds, title])

  function toggleArtworkSelection(artworkId: string) {
    setSelectedArtworkIds((current) =>
      current.includes(artworkId)
        ? current.filter((id) => id !== artworkId)
        : [...current, artworkId]
    )
  }

  return (
    <section className="bg-white px-6 py-28 text-black">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-4xl font-black tracking-normal">
              Подборки <span className="text-zinc-400 italic font-serif font-normal">команды</span>
            </h2>
            <p className="secondary-copy text-zinc-500">Кураторские наборы работ.</p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowEditor((value) => !value)}
              className="px-4 py-2 bg-black text-white rounded flex items-center gap-2"
            >
              {showEditor ? <X /> : <Plus />} {showEditor ? 'Закрыть' : 'Создать'}
            </button>
          )}
        </div>

        {showEditor && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mb-8 overflow-hidden"
          >
            <div className="bg-zinc-50 p-6 border rounded">
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Название"
                  className="p-3 border rounded"
                />
                <input
                  value={desc}
                  onChange={(event) => setDesc(event.target.value)}
                  placeholder="Описание"
                  className="p-3 border rounded"
                />

                {isSupabaseV2 ? (
                  <div className="md:col-span-2 rounded border bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">Работы в подборке</div>
                        <div className="text-xs text-zinc-500">Доступны только опубликованные открытые V2-работы.</div>
                      </div>
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-500">
                        Выбрано: {selectedArtworkIds.length}
                      </span>
                    </div>

                    {availableArtworks.length === 0 ? (
                      <div className="rounded border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
                        Нет опубликованных открытых работ для добавления в подборку.
                      </div>
                    ) : (
                      <div className="grid max-h-80 gap-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
                        {availableArtworks.map((artwork) => {
                          const selected = selectedArtworkIds.includes(artwork.id)
                          const authorName = artwork.profiles?.full_name || artwork.profiles?.username || 'Без автора'

                          return (
                            <button
                              key={artwork.id}
                              type="button"
                              onClick={() => toggleArtworkSelection(artwork.id)}
                              className={`flex items-center gap-3 rounded-xl border p-2 text-left transition ${
                                selected ? 'border-black bg-zinc-100' : 'border-zinc-200 hover:border-zinc-400'
                              }`}
                            >
                              <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                                {artwork.image_url ? (
                                  <img src={artwork.image_url} alt={artwork.title || 'Работа'} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-400">Нет фото</div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-zinc-900">{artwork.title || 'Без названия'}</div>
                                <div className="truncate text-xs text-zinc-500">{authorName}</div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <textarea
                    value={artworkIds}
                    onChange={(event) => setArtworkIds(event.target.value)}
                    placeholder="ID работ через запятую"
                    className="p-3 border rounded md:col-span-2"
                  />
                )}

                <div className="flex gap-2">
                  <button onClick={() => void createCollection()} className="px-4 py-2 bg-black text-white rounded">
                    Сохранить
                  </button>
                  <button
                    onClick={() => {
                      setTitle('')
                      setDesc('')
                      setArtworkIds('')
                      setSelectedArtworkIds([])
                    }}
                    className="px-4 py-2 border rounded"
                  >
                    Очистить
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-16">
          {loading && <div className="py-16 text-center text-sm text-zinc-400">Загрузка...</div>}

          {!loading &&
            collections.map((collection, idx) => (
              <motion.article
                key={collection.id}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="group"
              >
                <div className="flex justify-between items-start md:items-end mb-6 border-b pb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-xs text-zinc-400">Раздел // 0{idx + 1}</span>
                      <span className="h-[1px] w-6 bg-zinc-200" />
                      <span className="text-xs text-zinc-400">
                        {new Date(collection.created_at || '').toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black uppercase">{collection.title}</h3>
                    <p className="secondary-copy mt-2 text-zinc-500">{collection.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {!collection.items || collection.items.length === 0
                    ? [...Array(5)].map((_, index) => (
                        <div
                          key={index}
                          className={`bg-zinc-100 aspect-[3/4] ${
                            index === 0 ? 'md:col-span-2 md:row-span-2' : ''
                          } flex items-center justify-center`}
                        >
                          <span className="text-xs font-mono text-zinc-300">Нет работы</span>
                        </div>
                      ))
                    : collection.items.map((item, index) => (
                        <motion.div
                          key={item.id || index}
                          whileHover={{ y: -6 }}
                          onClick={() => item.artwork?.image_url && setLightboxSrc(item.artwork.image_url)}
                          className={`relative aspect-[3/4] cursor-pointer overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 ${
                            index === 0 ? 'md:col-span-2 md:row-span-2' : ''
                          }`}
                        >
                          {item.artwork?.image_url ? (
                            <img
                              src={item.artwork.image_url}
                              alt={item.artwork?.title || 'Работа из подборки'}
                              className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
                              Нет изображения
                            </div>
                          )}
                        </motion.div>
                      ))}
                </div>
              </motion.article>
            ))}
        </div>
      </div>

      <ImageLightbox src={lightboxSrc} alt="Просмотр" onClose={() => setLightboxSrc(null)} />
    </section>
  )
}