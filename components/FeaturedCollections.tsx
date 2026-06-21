'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import ImageLightbox from './ImageLightbox'
import { supabase } from '@/lib/supabase'

type Artwork = {
  id: string
  title?: string | null
  image_url?: string | null
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
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [artworkIds, setArtworkIds] = useState('')
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
            title: 'Neo Brutalism',
            description: 'Эстетика чистых форм и контраста.',
            created_at: new Date().toISOString(),
            items: [],
          },
          {
            id: '2',
            title: 'Liquid Dreams',
            description: 'Абстрактные формы и текучесть.',
            created_at: new Date().toISOString(),
            items: [],
          },
        ])
        return
      }

      const mapped = await Promise.all(
        rows.map(async (collection) => {
          const { data: items } = await supabase
            .from('collection_items')
            .select('*, artwork:artworks(*)')
            .eq('collection_id', collection.id)
            .order('position', { ascending: true })
            .limit(9)

          return { ...collection, items: (items ?? []) as CollectionItem[] }
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
    fetchCollections()
    checkAdmin()
  }, [checkAdmin, fetchCollections])

  const createCollection = useCallback(async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      const { data: col, error } = await supabase
        .from('collections')
        .insert({ title, description: desc })
        .select()
        .single()

      if (error) throw error

      const ids = artworkIds.split(',').map((item) => item.trim()).filter(Boolean)
      if (ids.length) {
        const items = ids.map((artworkId, position) => ({
          collection_id: col.id,
          artwork_id: artworkId,
          position,
        }))
        await supabase.from('collection_items').insert(items)
      }

      setTitle('')
      setDesc('')
      setArtworkIds('')
      setShowEditor(false)
      await fetchCollections()
    } catch (err: unknown) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [artworkIds, desc, fetchCollections, title])

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
                <textarea
                  value={artworkIds}
                  onChange={(event) => setArtworkIds(event.target.value)}
                  placeholder="Artwork IDs (comma)"
                  className="p-3 border rounded md:col-span-2"
                />
                <div className="flex gap-2">
                  <button onClick={createCollection} className="px-4 py-2 bg-black text-white rounded">
                    Сохранить
                  </button>
                  <button
                    onClick={() => {
                      setTitle('')
                      setDesc('')
                      setArtworkIds('')
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
                      <span className="font-mono text-xs text-zinc-400">INDEX // 0{idx + 1}</span>
                      <span className="h-[1px] w-6 bg-zinc-200" />
                      <span className="text-xs text-zinc-400">
                        {new Date(collection.created_at || '').toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black uppercase">{collection.title}</h3>
                    <p className="secondary-copy mt-2 text-zinc-500">{collection.description}</p>
                  </div>
                  <button className="rounded-full border border-black px-4 py-2 text-xs font-bold tracking-normal transition hover:bg-black hover:text-white">
                    Смотреть подборку
                  </button>
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
                          <span className="text-xs font-mono text-zinc-300">Artwork Placeholder</span>
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
                              NO_IMG
                            </div>
                          )}
                        </motion.div>
                      ))}
                </div>
              </motion.article>
            ))}
        </div>
      </div>

      <ImageLightbox src={lightboxSrc} alt="Preview" onClose={() => setLightboxSrc(null)} />
    </section>
  )
}
