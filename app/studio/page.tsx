'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit3, Image as ImageIcon, Loader2, Plus, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'
import ArtworkForm from '@/components/admin/ArtworkForm'

type Profile = {
  id: string
  full_name?: string | null
  username?: string | null
  role?: string | null
  deleted_at?: string | null
}

type StudioArtwork = {
  id: string
  title: string
  description?: string | null
  image_url?: string | null
  author_id: string
  tags?: string[] | null
  status?: 'draft' | 'published' | 'archived' | 'hidden'
  visibility?: 'public' | 'unlisted' | 'private'
  comments_enabled?: boolean | null
  created_at?: string | null
}

type StatusFilter = 'all' | 'published' | 'draft' | 'hidden' | 'archived'

const statusLabels: Record<string, string> = {
  published: 'Опубликовано',
  draft: 'Черновик',
  hidden: 'Скрыто',
  archived: 'Архив',
}

function getAuthorLabel(profile: Profile | null) {
  if (!profile) return 'Автор'
  return profile.full_name || (profile.username ? '@' + profile.username : profile.id)
}

export default function StudioPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [artworks, setArtworks] = useState<StudioArtwork[]>([])
  const [loading, setLoading] = useState(true)
  const [artworksLoading, setArtworksLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editingArtwork, setEditingArtwork] = useState<StudioArtwork | null>(null)

  const canPublish = Boolean(isSupabaseV2 && profile && !profile.deleted_at && (profile.role === 'creator' || profile.role === 'admin'))

  const loadArtworks = useCallback(async (authorId: string) => {
    setArtworksLoading(true)
    const { data, error: loadError } = await supabase
      .from('artworks')
      .select('id, title, description, image_url, author_id, tags, status, visibility, comments_enabled, created_at')
      .eq('author_id', authorId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (loadError) {
      setError('Не удалось загрузить работы: ' + loadError.message)
      setArtworks([])
    } else {
      setArtworks((data ?? []) as StudioArtwork[])
    }
    setArtworksLoading(false)
  }, [])

  const loadStudio = useCallback(async () => {
    if (!isSupabaseV2) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      setProfile(null)
      setArtworks([])
      setLoading(false)
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, username, role, deleted_at')
      .eq('id', userData.user.id)
      .maybeSingle()

    if (profileError) {
      setError('Не удалось проверить профиль: ' + profileError.message)
      setProfile(null)
      setLoading(false)
      return
    }

    const nextProfile = profileData as Profile | null
    setProfile(nextProfile)
    if (nextProfile && !nextProfile.deleted_at && (nextProfile.role === 'creator' || nextProfile.role === 'admin')) {
      await loadArtworks(nextProfile.id)
    } else {
      setArtworks([])
    }
    setLoading(false)
  }, [loadArtworks])

  useEffect(() => {
    void Promise.resolve().then(() => loadStudio())
    window.addEventListener('profile:updated', loadStudio)
    return () => window.removeEventListener('profile:updated', loadStudio)
  }, [loadStudio])

  const filteredArtworks = useMemo(() => {
    const search = query.trim().toLowerCase()
    return artworks.filter((artwork) => {
      const matchesStatus = statusFilter === 'all' || artwork.status === statusFilter
      const haystack = [artwork.title, artwork.description, ...(artwork.tags ?? [])].filter(Boolean).join(' ').toLowerCase()
      const matchesSearch = !search || haystack.includes(search)
      return matchesStatus && matchesSearch
    })
  }, [artworks, query, statusFilter])

  function openCreateForm() {
    setEditingArtwork(null)
    setFormMode('create')
  }

  function openEditForm(artwork: StudioArtwork) {
    setEditingArtwork(artwork)
    setFormMode('edit')
  }

  async function closeFormAndReload() {
    setFormMode(null)
    setEditingArtwork(null)
    if (profile) await loadArtworks(profile.id)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-zinc-500">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    )
  }

  if (!isSupabaseV2) {
    return (
      <main className="min-h-screen bg-white px-6 py-20 text-black">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-zinc-200 p-8 text-center">
          <h1 className="text-3xl font-black">Студия доступна в Supabase V2</h1>
          <Link href="/" className="mt-6 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white">На главную</Link>
        </div>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-white px-6 py-20 text-black">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-zinc-200 p-8 text-center">
          <h1 className="text-3xl font-black">Войдите, чтобы открыть студию</h1>
          <p className="secondary-copy mt-3 text-zinc-600">Публикация работ доступна авторизованным авторам.</p>
          <Link href="/login" className="mt-6 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white">Войти</Link>
        </div>
      </main>
    )
  }

  if (!canPublish) {
    return (
      <main className="min-h-screen bg-white px-6 py-20 text-black">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-sm font-semibold text-zinc-500">Студия автора</p>
          <h1 className="mt-2 text-3xl font-black">Публикация работ доступна авторам</h1>
          <p className="secondary-copy mt-3 text-zinc-600">Подайте заявку на роль автора в профиле, чтобы загружать и публиковать свои работы.</p>
          <Link href="/profile" className="mt-6 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white">Перейти к заявке автора</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-500">{getAuthorLabel(profile)}</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">Студия автора</h1>
            <p className="secondary-copy mt-3 max-w-2xl text-zinc-600">Публикуйте открытые работы, редактируйте описание и поддерживайте свою страницу автора живой.</p>
          </div>
          <button onClick={openCreateForm} className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition hover:bg-zinc-800">
            <Plus className="h-4 w-4" /> Опубликовать работу
          </button>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {error && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

        {formMode && (
          <section className="mb-8 rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-100 pb-4">
              <div>
                <p className="text-sm font-semibold text-zinc-500">{formMode === 'create' ? 'Новая публикация' : 'Редактирование'}</p>
                <h2 className="text-2xl font-black">{formMode === 'create' ? 'Опубликовать работу' : editingArtwork?.title}</h2>
              </div>
              <button onClick={() => { setFormMode(null); setEditingArtwork(null) }} className="rounded-full p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-black" aria-label="Закрыть форму">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ArtworkForm
              initial={editingArtwork ? {
                id: editingArtwork.id,
                title: editingArtwork.title,
                description: editingArtwork.description ?? '',
                image_url: editingArtwork.image_url ?? null,
                author_id: editingArtwork.author_id,
                tags: editingArtwork.tags ?? [],
                status: editingArtwork.status ?? 'published',
                visibility: editingArtwork.visibility ?? 'public',
                comments_enabled: editingArtwork.comments_enabled ?? true,
              } : {
                author_id: profile.id,
                status: 'published',
                visibility: 'public',
                comments_enabled: true,
              }}
              selfAuthorId={profile.id}
              selfAuthorLabel={getAuthorLabel(profile)}
              selfPublishMode
              onDone={closeFormAndReload}
            />
          </section>
        )}

        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 border-b border-zinc-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-500">Мои работы</p>
              <h2 className="text-2xl font-black">{filteredArtworks.length} работ</h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block min-w-[260px]">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-black" placeholder="Поиск по работам" />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="rounded-full border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-black">
                <option value="all">Все статусы</option>
                <option value="published">Опубликовано</option>
                <option value="draft">Черновик</option>
                <option value="hidden">Скрыто</option>
                <option value="archived">Архив</option>
              </select>
            </div>
          </div>

          {artworksLoading ? (
            <div className="flex justify-center py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filteredArtworks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
              {artworks.length === 0 ? 'У вас пока нет опубликованных работ.' : 'По выбранным параметрам ничего не найдено.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredArtworks.map((artwork) => (
                <article key={artwork.id} className="group overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-sm transition hover:border-black hover:shadow-xl">
                  <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100">
                    {artwork.image_url ? (
                      <img src={artwork.image_url} alt={artwork.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-400"><ImageIcon /></div>
                    )}
                    <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-black shadow-sm">{statusLabels[artwork.status ?? 'published'] ?? artwork.status}</span>
                  </div>
                  <div className="p-5">
                    <h3 className="line-clamp-2 text-xl font-black">{artwork.title}</h3>
                    {artwork.description && <p className="secondary-copy mt-2 line-clamp-2 text-sm text-zinc-600">{artwork.description}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(artwork.tags ?? []).slice(0, 4).map((tag) => <span key={tag} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">{tag}</span>)}
                    </div>
                    <div className="mt-5 flex gap-2 border-t border-zinc-100 pt-4">
                      <button onClick={() => openEditForm(artwork)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-800"><Edit3 className="h-4 w-4" /> Редактировать</button>
                      <Link href={`/profile/${profile.id}`} className="inline-flex flex-1 items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:bg-zinc-100">Открыть</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
