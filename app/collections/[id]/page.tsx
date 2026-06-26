'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, Image as ImageIcon, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'
import type { V2Collection } from '@/components/V2Collections'

export default function CollectionDetailPage() {
  const params = useParams<{ id: string }>()
  const collectionId = String(params?.id ?? '')
  const [collection, setCollection] = useState<V2Collection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCollection = useCallback(async () => {
    if (!isSupabaseV2 || !collectionId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: loadError } = await supabase
      .from('collections')
      .select(`
        id,
        title,
        description,
        cover_url,
        visibility,
        created_by,
        created_at,
        profiles:created_by(full_name, username),
        collection_items(
          id,
          artwork_id,
          position,
          artwork:artworks(id, title, image_url, author_id)
        )
      `)
      .eq('id', collectionId)
      .eq('visibility', 'public')
      .maybeSingle()

    if (loadError) {
      setError('Не удалось загрузить коллекцию: ' + loadError.message)
      setCollection(null)
    } else {
      const nextCollection = data as unknown as V2Collection | null
      setCollection(
        nextCollection
          ? {
              ...nextCollection,
              collection_items: [...(nextCollection.collection_items ?? [])].sort(
                (a, b) => (a.position ?? 0) - (b.position ?? 0)
              ),
            }
          : null
      )
      if (!nextCollection) setError('Коллекция не найдена или скрыта.')
    }

    setLoading(false)
  }, [collectionId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCollection()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadCollection])

  if (!isSupabaseV2) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-black">
        <div className="rounded-[28px] border border-zinc-200 p-8 text-center shadow-sm">
          <p className="secondary-copy text-zinc-500">Коллекции доступны в новой V2-схеме.</p>
          <Link href="/collections" className="mt-6 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white">
            К подборкам
          </Link>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    )
  }

  if (error || !collection) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-black">
        <div className="rounded-[28px] border border-zinc-200 p-8 text-center shadow-sm">
          <p className="secondary-copy text-zinc-500">{error ?? 'Коллекция не найдена.'}</p>
          <Link href="/collections" className="mt-6 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white">
            К коллекциям
          </Link>
        </div>
      </main>
    )
  }

  const authorName = collection.profiles?.full_name || collection.profiles?.username || 'Автор'
  const cover = collection.cover_url || collection.collection_items?.[0]?.artwork?.image_url || null

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="bg-black px-6 py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
          <div>
            <Link href="/collections" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-zinc-400 transition hover:text-white">
              <ArrowLeft size={16} />
              Все коллекции
            </Link>
            <p className="mb-4 text-[11px] uppercase tracking-[0.28em] text-zinc-500">{authorName}</p>
            <h1 className="text-5xl font-black leading-none tracking-tight md:text-7xl">{collection.title}</h1>
            {collection.description && <p className="secondary-copy mt-5 max-w-2xl text-zinc-300">{collection.description}</p>}
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-[28px] bg-zinc-900">
            {cover ? (
              <img src={cover} alt={collection.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-600">
                <ImageIcon className="h-10 w-10" />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        {collection.collection_items?.length ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {collection.collection_items.map((item) => (
              <article key={item.id} className="group overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm transition hover:border-black hover:shadow-xl">
                <div className="aspect-[4/5] overflow-hidden bg-zinc-100">
                  {item.artwork?.image_url ? (
                    <img
                      src={item.artwork.image_url}
                      alt={item.artwork.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-400">
                      <ImageIcon />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h2 className="text-xl font-black">{item.artwork?.title || 'Работа'}</h2>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
            В коллекции пока нет публичных работ.
          </div>
        )}
      </section>
    </main>
  )
}

