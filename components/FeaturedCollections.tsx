// components/FeaturedCollections.tsx
'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import ImageLightbox from './ImageLightbox'
import { supabase } from '@/lib/supabase'

export default function FeaturedCollections() {
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [artworkIds, setArtworkIds] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  useEffect(() => {
    fetchCollections()
    checkAdmin()
  }, [])

  async function checkAdmin() {
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const uid = userRes?.user?.id
      if (!uid) return setIsAdmin(false)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', uid).single()
      setIsAdmin(profile?.role === 'admin')
    } catch (err) {
      setIsAdmin(false)
    }
  }

  async function fetchCollections() {
    setLoading(true)
    try {
      const { data: cols } = await supabase.from('collections').select('*').order('created_at', { ascending: false })
      if (!cols || cols.length === 0) {
        setCollections([
          { id: '1', title: 'Neo Brutalism', description: 'Эстетика чистых форм и контраста.', created_at: new Date().toISOString(), items: [] },
          { id: '2', title: 'Liquid Dreams', description: 'Абстрактные формы и текучесть.', created_at: new Date().toISOString(), items: [] }
        ])
        setLoading(false)
        return
      }
      const mapped = await Promise.all(
        cols.map(async (c: any) => {
          const { data: items } = await supabase.from('collection_items').select('*, artwork:artworks(*)').eq('collection_id', c.id).order('position', { ascending: true }).limit(9)
          return { ...c, items }
        })
      )
      setCollections(mapped)
    } catch (err) {
      console.error(err)
      setCollections([])
    } finally {
      setLoading(false)
    }
  }

  const createCollection = useCallback(async () => {
    if (!title.trim()) return
    setLoading(true)
    try {
      const { data: col, error } = await supabase.from('collections').insert({ title, description: desc }).select().single()
      if (error) throw error
      const ids = artworkIds.split(',').map(s => s.trim()).filter(Boolean)
      if (ids.length) {
        const items = ids.map((aid, idx) => ({ collection_id: col.id, artwork_id: aid, position: idx }))
        await supabase.from('collection_items').insert(items)
      }
      setTitle(''); setDesc(''); setArtworkIds(''); setShowEditor(false)
      await fetchCollections()
    } catch (err: any) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [title, desc, artworkIds])

  return (
    <section className="py-28 px-6 bg-white">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-4xl font-black uppercase tracking-tight">Подборки <span className="text-zinc-400 italic font-serif font-normal">команды</span></h2>
            <p className="text-zinc-500 text-sm">Кураторские наборы работ.</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setIsAdmin(v => !v)} className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">[ Debug: {isAdmin ? 'Admin' : 'User'} ]</button>
            {isAdmin && (
              <button onClick={() => setShowEditor(s => !s)} className="px-4 py-2 bg-black text-white rounded flex items-center gap-2">
                {showEditor ? <X /> : <Plus />} {showEditor ? 'Закрыть' : 'Создать'}
              </button>
            )}
          </div>
        </div>

        {showEditor && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mb-8 overflow-hidden">
            <div className="bg-zinc-50 p-6 border rounded">
              <div className="grid md:grid-cols-2 gap-4">
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Название" className="p-3 border rounded" />
                <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Описание" className="p-3 border rounded" />
                <textarea value={artworkIds} onChange={e => setArtworkIds(e.target.value)} placeholder="Artwork IDs (comma)" className="p-3 border rounded md:col-span-2" />
                <div className="flex gap-2">
                  <button onClick={createCollection} className="px-4 py-2 bg-black text-white rounded">Сохранить</button>
                  <button onClick={() => { setTitle(''); setDesc(''); setArtworkIds('') }} className="px-4 py-2 border rounded">Очистить</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="space-y-16">
          {loading && <div className="py-16 text-center text-sm text-zinc-400">Загрузка...</div>}

          {!loading && collections.map((c, idx) => (
            <motion.article key={c.id} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="group">
              <div className="flex justify-between items-start md:items-end mb-6 border-b pb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-xs text-zinc-400">INDEX // 0{idx + 1}</span>
                    <span className="h-[1px] w-6 bg-zinc-200" />
                    <span className="text-xs text-zinc-400">{new Date(c.created_at || '').toLocaleDateString()}</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black uppercase">{c.title}</h3>
                  <p className="text-zinc-500 text-sm mt-2">{c.description}</p>
                </div>
                <button className="px-4 py-2 border border-black text-xs uppercase tracking-widest hover:bg-black hover:text-white transition">View Full</button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {(!c.items || c.items.length === 0) ? (
                  [...Array(5)].map((_, i) => (
                    <div key={i} className={`bg-zinc-100 aspect-[3/4] ${i === 0 ? 'md:col-span-2 md:row-span-2' : ''} flex items-center justify-center`}>
                      <span className="text-xs font-mono text-zinc-300">Artwork Placeholder</span>
                    </div>
                  ))
                ) : (
                  c.items.map((it: any, i: number) => (
                    <motion.div key={it.id || i} whileHover={{ y: -6 }} onClick={() => it.artwork?.image_url && setLightboxSrc(it.artwork.image_url)} className={`cursor-pointer relative collection-card overflow-hidden aspect-[3/4] ${i === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}>
                      {it.artwork?.image_url ? (
                        <img src={it.artwork.image_url} alt={it.artwork?.title || ''} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">NO_IMG</div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </div>

      <ImageLightbox src={lightboxSrc} alt="Preview" onClose={() => setLightboxSrc(null)} />
    </section>
  )
}
