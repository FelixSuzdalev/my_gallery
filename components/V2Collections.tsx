'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Image as ImageIcon, Loader2, Save, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

type CollectionVisibility = 'public' | 'private'

type CollectionArtwork = {
  id: string
  title: string
  image_url?: string | null
  author_id?: string | null
}

type CollectionItem = {
  id: string
  artwork_id: string
  position?: number | null
  artwork?: CollectionArtwork | null
}

type ProfileLite = {
  full_name?: string | null
  username?: string | null
}

export type V2Collection = {
  id: string
  title: string
  description?: string | null
  cover_url?: string | null
  visibility: CollectionVisibility | 'unlisted'
  created_by?: string | null
  created_at?: string | null
  profiles?: ProfileLite | null
  collection_items?: CollectionItem[] | null
}

type AvailableArtwork = CollectionArtwork & {
  profiles?: ProfileLite | null
}

const emptyForm = {
  title: '',
  description: '',
  cover_url: '',
  visibility: 'public' as CollectionVisibility,
}

function getAuthorName(collection: V2Collection) {
  return collection.profiles?.full_name || collection.profiles?.username || 'Автор'
}

function normalizeCollection(row: V2Collection): V2Collection {
  return {
    ...row,
    collection_items: [...(row.collection_items ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
  }
}

export function V2CollectionManager({
  currentUserId,
  role,
}: {
  currentUserId: string
  role?: string | null
}) {
  const canManage = Boolean(isSupabaseV2 && currentUserId && (role === 'creator' || role === 'admin'))
  const [collections, setCollections] = useState<V2Collection[]>([])
  const [availableArtworks, setAvailableArtworks] = useState<AvailableArtwork[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? collections[0] ?? null,
    [collections, selectedCollectionId]
  )


  const artworksForSelectedCollection = useMemo(() => {
    if (!selectedCollection) return []
    return availableArtworks.filter((artwork) => artwork.author_id === selectedCollection.created_by)
  }, [availableArtworks, selectedCollection])

  const loadCollections = useCallback(async () => {
    if (!canManage) return

    setLoading(true)
    setError(null)

    let query = supabase
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
      .order('created_at', { ascending: false })

    if (role !== 'admin') {
      query = query.eq('created_by', currentUserId)
    }

    const { data, error: loadError } = await query

    if (loadError) {
      setError('Не удалось загрузить коллекции: ' + loadError.message)
      setCollections([])
    } else {
      const nextCollections = ((data ?? []) as unknown as V2Collection[]).map(normalizeCollection)
      setCollections(nextCollections)
      setSelectedCollectionId((current) => {
        if (current && nextCollections.some((collection) => collection.id === current)) return current
        return nextCollections[0]?.id ?? null
      })
    }

    setLoading(false)
  }, [canManage, currentUserId, role])

  const loadAvailableArtworks = useCallback(async () => {
    if (!canManage) return

    let query = supabase
      .from('artworks')
      .select('id, title, image_url, author_id, profiles:author_id(full_name, username)')
      .eq('status', 'published')
      .eq('visibility', 'public')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200)

    if (role !== 'admin') {
      query = query.eq('author_id', currentUserId)
    }

    const { data, error: loadError } = await query
    if (loadError) {
      console.warn('Не удалось загрузить работы для коллекций:', loadError.message)
      setAvailableArtworks([])
      return
    }

    setAvailableArtworks((data ?? []) as unknown as AvailableArtwork[])
  }, [canManage, currentUserId, role])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCollections()
      void loadAvailableArtworks()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadAvailableArtworks, loadCollections])

  function startEdit(collection: V2Collection) {
    setEditingId(collection.id)
    setForm({
      title: collection.title,
      description: collection.description ?? '',
      cover_url: collection.cover_url ?? '',
      visibility: collection.visibility === 'private' ? 'private' : 'public',
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function saveCollection() {
    if (!canManage || saving) return

    const title = form.title.trim()
    if (!title) {
      setError('Укажите название коллекции.')
      return
    }

    const coverUrl = form.cover_url.trim()
    if (coverUrl && !/^https?:\/\/\S+$/.test(coverUrl)) {
      setError('Ссылка на обложку должна начинаться с http:// или https:// и не содержать пробелов.')
      return
    }

    setSaving(true)
    setError(null)

    const payload = {
      title,
      description: form.description.trim() || null,
      cover_url: coverUrl || null,
      visibility: form.visibility,
    }

    const { error: saveError } = editingId
      ? await supabase.from('collections').update(payload).eq('id', editingId)
      : await supabase.from('collections').insert({ ...payload, created_by: currentUserId })

    if (saveError) {
      setError('Не удалось сохранить коллекцию: ' + saveError.message)
    } else {
      resetForm()
      await loadCollections()
    }

    setSaving(false)
  }

  async function deleteCollection(collectionId: string) {
    if (!canManage || !window.confirm('Удалить коллекцию? Работы останутся в галерее.')) return

    setError(null)
    const { error: deleteError } = await supabase.from('collections').delete().eq('id', collectionId)
    if (deleteError) {
      setError('Не удалось удалить коллекцию: ' + deleteError.message)
      return
    }

    if (editingId === collectionId) resetForm()
    await loadCollections()
  }

  async function addArtwork(collectionId: string, artworkId: string) {
    const collection = collections.find((item) => item.id === collectionId)
    if (!collection) return

    const nextPosition = collection.collection_items?.length ?? 0
    const { error: insertError } = await supabase
      .from('collection_items')
      .insert({ collection_id: collectionId, artwork_id: artworkId, position: nextPosition })

    if (insertError) {
      setError('Не удалось добавить работу: ' + insertError.message)
      return
    }

    await loadCollections()
  }

  async function removeArtwork(itemId: string) {
    const { error: deleteError } = await supabase.from('collection_items').delete().eq('id', itemId)
    if (deleteError) {
      setError('Не удалось убрать работу: ' + deleteError.message)
      return
    }

    await loadCollections()
  }

  if (!isSupabaseV2) return null

  if (!canManage) {
    return (
      <section className="rounded-[28px] border border-zinc-200 bg-zinc-50 p-5 text-black">
        <h2 className="text-xl font-black">Мои коллекции</h2>
        <p className="secondary-copy mt-2 text-sm text-zinc-600">
          Создавать коллекции могут авторы и администраторы.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-[28px] border border-zinc-200 bg-white p-5 text-black shadow-sm">
      <div className="mb-5 flex flex-col gap-3 border-b border-zinc-100 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-zinc-500">Авторский раздел</p>
          <h2 className="text-2xl font-black tracking-tight">Мои коллекции</h2>
          <p className="secondary-copy mt-2 max-w-2xl text-sm text-zinc-600">
            Собирайте опубликованные открытые работы в публичные или приватные коллекции.
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-600">
          {collections.length} коллекций
        </span>
      </div>

      {error && <div className="mb-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="mb-4 text-lg font-black">{editingId ? 'Редактирование' : 'Новая коллекция'}</h3>
          <div className="space-y-3">
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
              placeholder="Название"
            />
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-28 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
              placeholder="Описание"
            />
            <input
              value={form.cover_url}
              onChange={(event) => setForm((current) => ({ ...current, cover_url: event.target.value }))}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
              placeholder="Ссылка на обложку"
            />
            <select
              value={form.visibility}
              onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as CollectionVisibility }))}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
            >
              <option value="public">Публичная</option>
              <option value="private">Приватная</option>
            </select>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void saveCollection()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={16} />}
                Сохранить
              </button>
              {editingId && (
                <button
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm font-bold text-zinc-700 transition hover:bg-zinc-100"
                >
                  <X size={16} />
                  Отмена
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {loading ? (
            <div className="flex justify-center rounded-3xl border border-dashed border-zinc-300 py-12 text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : collections.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500">
              Коллекций пока нет.
            </div>
          ) : (
            collections.map((collection) => (
              <article key={collection.id} className="rounded-3xl border border-zinc-200 bg-white p-4">
                <div className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
                  <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-zinc-100">
                    {collection.cover_url || collection.collection_items?.[0]?.artwork?.image_url ? (
                      <img
                        src={collection.cover_url || collection.collection_items?.[0]?.artwork?.image_url || ''}
                        alt={collection.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-400">
                        <ImageIcon />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">
                        {collection.visibility === 'public' ? 'Публичная' : 'Приватная'}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {collection.created_at ? new Date(collection.created_at).toLocaleDateString('ru-RU') : 'Без даты'}
                      </span>
                      {role === 'admin' && <span className="text-xs text-zinc-400">{getAuthorName(collection)}</span>}
                    </div>
                    <h3 className="text-xl font-black">{collection.title}</h3>
                    {collection.description && <p className="secondary-copy mt-1 text-sm text-zinc-600">{collection.description}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/collections/${collection.id}`}
                        className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:bg-black hover:text-white"
                      >
                        <ExternalLink size={15} />
                        Открыть
                      </Link>
                      <button
                        onClick={() => {
                          setSelectedCollectionId(collection.id)
                          startEdit(collection)
                        }}
                        className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:bg-zinc-100"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => void deleteCollection(collection.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 size={15} />
                        Удалить
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-zinc-100 pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-black">Работы в коллекции</h4>
                    <span className="text-xs font-semibold text-zinc-400">{collection.collection_items?.length ?? 0} работ</span>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {(collection.collection_items ?? []).map((item) => (
                      <div key={item.id} className="inline-flex items-center gap-2 rounded-full bg-zinc-100 py-1 pl-2 pr-1 text-sm">
                        <span className="max-w-[180px] truncate">{item.artwork?.title || 'Работа'}</span>
                        <button
                          onClick={() => void removeArtwork(item.id)}
                          className="rounded-full p-1 text-zinc-500 transition hover:bg-white hover:text-red-600"
                          aria-label="Убрать работу"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {(collection.collection_items ?? []).length === 0 && (
                      <span className="text-sm text-zinc-500">Работы ещё не добавлены.</span>
                    )}
                  </div>

                  <div className="grid max-h-72 gap-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
                    {availableArtworks
                      .filter((artwork) => artwork.author_id === collection.created_by)
                      .map((artwork) => {
                        const alreadyAdded = (collection.collection_items ?? []).some((item) => item.artwork_id === artwork.id)
                        return (
                          <button
                            key={artwork.id}
                            onClick={() => void addArtwork(collection.id, artwork.id)}
                            disabled={alreadyAdded}
                            className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-2 text-left transition hover:border-black disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <div className="h-14 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                              {artwork.image_url ? (
                                <img src={artwork.image_url} alt={artwork.title} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-zinc-400">
                                  <ImageIcon size={16} />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold">{artwork.title}</div>
                              <div className="text-xs text-zinc-500">{alreadyAdded ? 'Уже в коллекции' : 'Добавить'}</div>
                            </div>
                          </button>
                        )
                      })}
                  </div>

                  {artworksForSelectedCollection.length === 0 && selectedCollection?.id === collection.id && (
                    <p className="mt-3 text-sm text-zinc-500">
                      Для этой коллекции нет опубликованных открытых работ автора.
                    </p>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

export function PublicCollectionsBlock({
  authorId,
  title = 'Коллекции автора',
  compact = false,
}: {
  authorId?: string
  title?: string
  compact?: boolean
}) {
  const [collections, setCollections] = useState<V2Collection[]>([])
  const [loading, setLoading] = useState(isSupabaseV2)

  useEffect(() => {
    if (!isSupabaseV2) return

    let mounted = true

    async function loadPublicCollections() {
      setLoading(true)
      let query = supabase
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
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(compact ? 3 : 30)

      if (authorId) query = query.eq('created_by', authorId)

      const { data, error } = await query
      if (!mounted) return

      if (error) {
        console.warn('Не удалось загрузить публичные коллекции:', error.message)
        setCollections([])
      } else {
        setCollections(((data ?? []) as unknown as V2Collection[]).map(normalizeCollection))
      }
      setLoading(false)
    }

    const timer = window.setTimeout(() => {
      void loadPublicCollections()
    }, 0)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [authorId, compact])

  if (!isSupabaseV2) return null

  return (
    <section className={compact ? '' : 'mx-auto max-w-7xl px-6 py-10'}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">Подборки работ</p>
          <h2 className="text-2xl font-black tracking-tight">{title}</h2>
        </div>
        {compact && collections.length > 0 && (
          <Link href="/collections" className="text-sm font-bold text-zinc-500 transition hover:text-black">
            Все коллекции
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center rounded-[28px] border border-dashed border-zinc-300 py-10 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : collections.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-zinc-300 p-8 text-center text-zinc-500">
          Публичных коллекций пока нет.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      )}
    </section>
  )
}

export function CollectionCard({ collection }: { collection: V2Collection }) {
  const cover = collection.cover_url || collection.collection_items?.[0]?.artwork?.image_url || null
  const previews = (collection.collection_items ?? []).slice(0, 4)

  return (
    <article className="group overflow-hidden rounded-[28px] border border-zinc-200 bg-white text-black shadow-sm transition hover:border-black hover:shadow-xl">
      <Link href={`/collections/${collection.id}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
          {cover ? (
            <img
              src={cover}
              alt={collection.title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-400">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
          <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-black backdrop-blur">
            {collection.collection_items?.length ?? 0} работ
          </div>
        </div>
        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">{getAuthorName(collection)}</p>
          <h3 className="mt-2 text-2xl font-black">{collection.title}</h3>
          {collection.description && <p className="secondary-copy mt-2 line-clamp-3 text-sm text-zinc-600">{collection.description}</p>}
          {previews.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {previews.map((item) => (
                <div key={item.id} className="aspect-square overflow-hidden rounded-xl bg-zinc-100">
                  {item.artwork?.image_url && (
                    <img src={item.artwork.image_url} alt={item.artwork.title} className="h-full w-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Link>
    </article>
  )
}



