'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Edit3,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ArtworkForm from '@/components/admin/ArtworkForm'

type ArtworkWithAuthor = {
  id: string
  title: string
  description: string | null
  image_url: string
  author_id: string | null
  author_name: string
  tags: string[]
  created_at?: string | null
}

type ArtworkRow = Omit<ArtworkWithAuthor, 'author_name' | 'tags'> & {
  tags?: string[] | null
  profiles?: {
    full_name?: string | null
    username?: string | null
  } | null
}

type QualityFilter = 'all' | 'without-author' | 'without-description' | 'without-tags'
type SortMode = 'newest' | 'title' | 'author'

const inputClass =
  'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-black focus:ring-4 focus:ring-black/5'

export default function AdminArtworksPage() {
  const [artworks, setArtworks] = useState<ArtworkWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingArtwork, setEditingArtwork] = useState<ArtworkWithAuthor | null>(null)
  const [query, setQuery] = useState('')
  const [authorFilter, setAuthorFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')

  const loadArtworks = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('artworks')
      .select(`
        id,
        title,
        description,
        image_url,
        author_id,
        tags,
        created_at,
        profiles:author_id ( full_name, username )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      alert('Ошибка загрузки работ: ' + error.message)
    } else {
      const formatted = ((data ?? []) as ArtworkRow[]).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        image_url: item.image_url,
        author_id: item.author_id,
        tags: item.tags ?? [],
        created_at: item.created_at,
        author_name: item.profiles?.full_name || item.profiles?.username || 'Без автора',
      }))
      setArtworks(formatted)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadArtworks()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadArtworks])

  const authors = useMemo(() => {
    const map = new Map<string, string>()
    artworks.forEach((artwork) => {
      if (artwork.author_id) map.set(artwork.author_id, artwork.author_name)
    })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [artworks])

  const tags = useMemo(() => {
    return Array.from(new Set(artworks.flatMap((artwork) => artwork.tags))).sort((a, b) => a.localeCompare(b))
  }, [artworks])

  const filteredArtworks = useMemo(() => {
    const search = query.trim().toLowerCase()

    return artworks
      .filter((artwork) => {
        const searchable = [
          artwork.title,
          artwork.description ?? '',
          artwork.author_name,
          artwork.tags.join(' '),
        ]
          .join(' ')
          .toLowerCase()

        const matchesSearch = !search || searchable.includes(search)
        const matchesAuthor = authorFilter === 'all' || artwork.author_id === authorFilter
        const matchesTag = tagFilter === 'all' || artwork.tags.includes(tagFilter)
        const matchesQuality =
          qualityFilter === 'all' ||
          (qualityFilter === 'without-author' && !artwork.author_id) ||
          (qualityFilter === 'without-description' && !artwork.description?.trim()) ||
          (qualityFilter === 'without-tags' && artwork.tags.length === 0)

        return matchesSearch && matchesAuthor && matchesTag && matchesQuality
      })
      .sort((a, b) => {
        if (sortMode === 'title') return a.title.localeCompare(b.title)
        if (sortMode === 'author') return a.author_name.localeCompare(b.author_name)
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      })
  }, [artworks, authorFilter, qualityFilter, query, sortMode, tagFilter])

  const openCreateModal = () => {
    setEditingArtwork(null)
    setModalOpen(true)
  }

  const openEditModal = (artwork: ArtworkWithAuthor) => {
    setEditingArtwork(artwork)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingArtwork(null)
  }

  const handleFormDone = async () => {
    closeModal()
    await loadArtworks()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить эту работу? Действие нельзя отменить.')) return

    const { error } = await supabase.from('artworks').delete().eq('id', id)
    if (error) {
      alert('Ошибка удаления: ' + error.message)
    } else {
      await loadArtworks()
    }
  }

  const resetFilters = () => {
    setQuery('')
    setAuthorFilter('all')
    setTagFilter('all')
    setQualityFilter('all')
    setSortMode('newest')
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Контент галереи</p>
            <h2 className="text-3xl font-black tracking-tight">Работы</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Ищите работы по названию, автору, описанию и тегам. Быстро находите карточки без автора,
              описания или тегов перед публикацией.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void loadArtworks()}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
            >
              <RefreshCw size={16} />
              Обновить
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              <Plus size={16} />
              Добавить работу
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Всего работ" value={artworks.length} />
          <Stat label="На экране" value={filteredArtworks.length} />
          <Stat label="Авторов" value={authors.length} />
          <Stat label="Тегов" value={tags.length} />
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${inputClass} pl-11`}
              placeholder="Поиск по названию, автору, тегам..."
            />
          </div>

          <select value={authorFilter} onChange={(event) => setAuthorFilter(event.target.value)} className={inputClass}>
            <option value="all">Все авторы</option>
            {authors.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} className={inputClass}>
            <option value="all">Все теги</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>

          <select
            value={qualityFilter}
            onChange={(event) => setQualityFilter(event.target.value as QualityFilter)}
            className={inputClass}
          >
            <option value="all">Все статусы</option>
            <option value="without-author">Без автора</option>
            <option value="without-description">Без описания</option>
            <option value="without-tags">Без тегов</option>
          </select>

          <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className={inputClass}>
            <option value="newest">Сначала новые</option>
            <option value="title">По названию</option>
            <option value="author">По автору</option>
          </select>

          <button
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-black"
          >
            <X size={16} />
            Сброс
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-zinc-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Загрузка работ...
          </div>
        ) : filteredArtworks.length === 0 ? (
          <div className="py-20 text-center text-zinc-500">Ничего не найдено.</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-500">
                  <tr>
                    <th className="px-5 py-4">Работа</th>
                    <th className="px-5 py-4">Автор</th>
                    <th className="px-5 py-4">Теги</th>
                    <th className="px-5 py-4">Дата</th>
                    <th className="px-5 py-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredArtworks.map((artwork) => (
                    <tr key={artwork.id} className="hover:bg-zinc-50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-4">
                          <ArtworkThumb artwork={artwork} />
                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-950">{artwork.title}</div>
                            <div className="max-w-md truncate text-xs text-zinc-500">
                              {artwork.description || 'Описание не заполнено'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-zinc-700">{artwork.author_name}</td>
                      <td className="px-5 py-4">
                        <TagList tags={artwork.tags} />
                      </td>
                      <td className="px-5 py-4 text-zinc-500">
                        {artwork.created_at ? new Date(artwork.created_at).toLocaleDateString('ru-RU') : '-'}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <IconButton label="Редактировать" onClick={() => openEditModal(artwork)}>
                            <Edit3 size={16} />
                          </IconButton>
                          <IconButton label="Удалить" danger onClick={() => void handleDelete(artwork.id)}>
                            <Trash2 size={16} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-3 lg:hidden">
              {filteredArtworks.map((artwork) => (
                <article key={artwork.id} className="rounded-3xl border border-zinc-200 p-3">
                  <div className="flex gap-3">
                    <ArtworkThumb artwork={artwork} large />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{artwork.title}</h3>
                      <p className="text-sm text-zinc-500">{artwork.author_name}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-600">
                        {artwork.description || 'Описание не заполнено'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <TagList tags={artwork.tags} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openEditModal(artwork)}
                      className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => void handleDelete(artwork.id)}
                      className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600"
                    >
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/55 p-4 backdrop-blur-sm md:p-8">
          <div className="w-full max-w-3xl rounded-[32px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 p-5">
              <div>
                <p className="text-sm text-zinc-500">{editingArtwork ? 'Редактирование' : 'Создание'}</p>
                <h2 className="text-2xl font-black tracking-tight">
                  {editingArtwork ? 'Работа' : 'Новая работа'}
                </h2>
              </div>
              <button
                onClick={closeModal}
                className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-black"
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <ArtworkForm
                initial={
                  editingArtwork
                    ? {
                        id: editingArtwork.id,
                        title: editingArtwork.title,
                        description: editingArtwork.description ?? undefined,
                        image_url: editingArtwork.image_url,
                        author_id: editingArtwork.author_id ?? undefined,
                        tags: editingArtwork.tags,
                      }
                    : undefined
                }
                onDone={handleFormDone}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-zinc-50 p-4">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-sm text-zinc-500">{label}</div>
    </div>
  )
}

function ArtworkThumb({ artwork, large = false }: { artwork: ArtworkWithAuthor; large?: boolean }) {
  const size = large ? 'h-28 w-24' : 'h-16 w-16'

  if (!artwork.image_url) {
    return (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400`}>
        <ImageIcon size={18} />
      </div>
    )
  }

  return <img src={artwork.image_url} alt={artwork.title} className={`${size} shrink-0 rounded-2xl object-cover`} />
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-xs text-zinc-400">Без тегов</span>

  return (
    <div className="flex max-w-md flex-wrap gap-1.5">
      {tags.slice(0, 4).map((tag) => (
        <span key={tag} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
          {tag}
        </span>
      ))}
      {tags.length > 4 && (
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
          +{tags.length - 4}
        </span>
      )}
    </div>
  )
}

function IconButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full p-2 transition ${
        danger ? 'text-red-500 hover:bg-red-50' : 'text-zinc-500 hover:bg-zinc-100 hover:text-black'
      }`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  )
}
