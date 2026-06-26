'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Image as ImageIcon, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type HomeArtwork = {
  id: string
  title: string
  description?: string | null
  image_url?: string | null
  author_id?: string | null
  tags?: string[] | null
  created_at?: string | null
  profiles?: {
    full_name?: string | null
    username?: string | null
  } | null
}

type HomeAuthor = {
  id: string
  full_name?: string | null
  username?: string | null
  bio?: string | null
  avatar_url?: string | null
  role?: string | null
  worksCount: number
}

type HomeCollection = {
  id: string
  title: string
  description?: string | null
  cover_url?: string | null
  collection_items?: Array<{
    artwork?: {
      image_url?: string | null
      status?: string | null
      visibility?: string | null
      deleted_at?: string | null
    } | null
  }> | null
}

type CurrentProfile = {
  id: string
  role?: string | null
} | null

function getAuthorName(artwork: HomeArtwork) {
  return artwork.profiles?.full_name || artwork.profiles?.username || 'Автор'
}

function getProfileName(author: HomeAuthor) {
  return author.full_name || author.username || 'Автор'
}

export default function V2Home() {
  const [artworks, setArtworks] = useState<HomeArtwork[]>([])
  const [authors, setAuthors] = useState<HomeAuthor[]>([])
  const [collections, setCollections] = useState<HomeCollection[]>([])
  const [profile, setProfile] = useState<CurrentProfile>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function loadHome() {
      setLoading(true)
      const { data: userData } = await supabase.auth.getUser()

      const profilePromise = userData.user
        ? supabase.from('profiles').select('id, role').eq('id', userData.user.id).maybeSingle()
        : Promise.resolve({ data: null })

      const artworksPromise = supabase
        .from('artworks')
        .select('id, title, description, image_url, author_id, tags, created_at, profiles:author_id(full_name, username)')
        .eq('status', 'published')
        .eq('visibility', 'public')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(12)

      const authorsPromise = supabase
        .from('profiles')
        .select('id, full_name, username, bio, avatar_url, role')
        .in('role', ['creator', 'admin'])
        .eq('is_public', true)
        .is('deleted_at', null)
        .limit(8)

      const collectionsPromise = supabase
        .from('collections')
        .select('id, title, description, cover_url, collection_items(artwork:artworks(image_url, status, visibility, deleted_at))')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(4)

      const [profileResult, artworksResult, authorsResult, collectionsResult] = await Promise.all([
        profilePromise,
        artworksPromise,
        authorsPromise,
        collectionsPromise,
      ])

      if (!mounted) return

      const nextArtworks = ((artworksResult.data ?? []) as unknown as HomeArtwork[]).filter((artwork) => Boolean(artwork.image_url))
      const counts = new Map<string, number>()
      nextArtworks.forEach((artwork) => {
        if (artwork.author_id) counts.set(artwork.author_id, (counts.get(artwork.author_id) ?? 0) + 1)
      })

      setProfile((profileResult.data as CurrentProfile) ?? null)
      setArtworks(nextArtworks)
      setAuthors(((authorsResult.data ?? []) as Omit<HomeAuthor, 'worksCount'>[]).map((author) => ({
        ...author,
        worksCount: counts.get(author.id) ?? 0,
      })).filter((author) => author.worksCount > 0).slice(0, 4))
      setCollections(((collectionsResult.data ?? []) as unknown as HomeCollection[]).filter((collection) => {
        if (collection.cover_url) return true
        return collection.collection_items?.some((item) => isPublicArtworkImage(item.artwork))
      }))
      setLoading(false)
    }

    void loadHome()
    window.addEventListener('profile:updated', loadHome)
    return () => {
      mounted = false
      window.removeEventListener('profile:updated', loadHome)
    }
  }, [])

  const heroArtwork = useMemo(() => artworks[0] ?? null, [artworks])
  const discoveryArtworks = useMemo(() => artworks.slice(1, 9), [artworks])
  const canPublish = profile?.role === 'creator' || profile?.role === 'admin'

  return (
    <main className="min-h-screen overflow-hidden bg-[#0b0b0b] text-white">
      <section className="relative min-h-[92vh] px-6 py-20 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_35%)]" />
        <div className="absolute inset-0 opacity-[0.055] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
          <div className="pt-16 md:pt-24">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-zinc-500">Цифровая выставка</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.92] tracking-tight md:text-7xl lg:text-8xl">Creative Archive</h1>
            <p className="secondary-copy mt-6 max-w-xl text-base leading-7 text-zinc-300 md:text-lg">
              Пространство для работ художников, фотографов и дизайнеров: открывайте новые визуальные серии, авторов и коллекции.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/feed" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-zinc-200">
                Смотреть ленту <ArrowUpRight className="h-4 w-4" />
              </Link>
              {heroArtwork && (
                <Link href={`/profile/${heroArtwork.author_id}`} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-black">
                  Открыть работу
                </Link>
              )}
            </div>
          </div>

          <div className="archive-reveal relative min-h-[560px] overflow-hidden rounded-[36px] border border-white/10 bg-zinc-900 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
            {loading ? (
              <div className="flex h-[560px] items-center justify-center text-zinc-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : heroArtwork?.image_url ? (
              <>
                <img src={heroArtwork.image_url} alt={heroArtwork.title} className="h-[560px] w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/15 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                  <div className="mb-4 inline-flex rounded-full bg-white/90 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-black">Работа дня</div>
                  <h2 className="max-w-2xl text-3xl font-black leading-tight md:text-5xl">{heroArtwork.title}</h2>
                  <p className="mt-3 text-sm font-semibold text-zinc-200">{getAuthorName(heroArtwork)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(heroArtwork.tags ?? []).slice(0, 4).map((tag) => <span key={tag} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">{tag}</span>)}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-[560px] flex-col items-center justify-center px-8 text-center text-zinc-400">
                <ImageIcon className="mb-4 h-10 w-10" />
                <h2 className="text-2xl font-black text-white">Пока нет опубликованных работ</h2>
                <p className="secondary-copy mt-2 max-w-sm text-sm">Когда авторы добавят публичные работы, главная станет витриной галереи.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-500">Откройте новое</p>
              <h2 className="text-4xl font-black tracking-tight md:text-5xl">Свежие работы</h2>
            </div>
            <Link href="/feed" className="text-sm font-bold text-zinc-300 transition hover:text-white">Вся лента</Link>
          </div>

          {discoveryArtworks.length === 0 ? (
            <EmptyBand text="Работы появятся здесь после публикации авторами." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {discoveryArtworks.map((artwork, index) => (
                <Link key={artwork.id} href={`/profile/${artwork.author_id}`} className={`archive-reveal group relative overflow-hidden rounded-[28px] bg-zinc-900 ${index === 0 || index === 5 ? 'lg:row-span-2' : ''}`}>
                  <div className={`${index === 0 || index === 5 ? 'aspect-[4/5] lg:h-full' : 'aspect-[4/5]'} overflow-hidden`}>
                    <img src={artwork.image_url ?? ''} alt={artwork.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/10 to-transparent opacity-80 transition group-hover:opacity-95" />
                  <div className="absolute bottom-0 left-0 right-0 translate-y-2 p-5 opacity-90 transition group-hover:translate-y-0 group-hover:opacity-100">
                    <h3 className="line-clamp-2 text-xl font-black">{artwork.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-zinc-300">{getAuthorName(artwork)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white px-6 py-16 text-black">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-500">Авторы недели</p>
              <h2 className="text-4xl font-black tracking-tight md:text-5xl">Публичные авторы</h2>
            </div>
            <Link href="/authors" className="text-sm font-bold text-zinc-600 transition hover:text-black">Каталог авторов</Link>
          </div>
          {authors.length === 0 ? (
            <EmptyBand light text="Авторы появятся здесь после публикации работ." />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {authors.map((author) => (
                <Link key={author.id} href={`/profile/${author.id}`} className="archive-reveal rounded-[28px] border border-zinc-200 bg-zinc-50 p-5 transition hover:border-black hover:bg-white">
                  <div className="mb-5 h-20 w-20 overflow-hidden rounded-full bg-zinc-200">
                    {author.avatar_url ? <img src={author.avatar_url} alt={getProfileName(author)} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xl font-black">{getProfileName(author).slice(0, 2).toUpperCase()}</div>}
                  </div>
                  <h3 className="text-xl font-black">{getProfileName(author)}</h3>
                  {author.bio && <p className="secondary-copy mt-2 line-clamp-3 text-sm text-zinc-600">{author.bio}</p>}
                  <p className="mt-4 text-sm font-bold text-zinc-500">{author.worksCount} работ</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-zinc-500">Коллекции</p>
              <h2 className="text-4xl font-black tracking-tight md:text-5xl">Подборки галереи</h2>
            </div>
            <Link href="/collections" className="text-sm font-bold text-zinc-300 transition hover:text-white">Все коллекции</Link>
          </div>
          {collections.length === 0 ? (
            <EmptyBand text="Публичные коллекции появятся здесь после создания авторами." />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {collections.map((collection) => {
                const imageUrl = collection.cover_url || collection.collection_items?.find((item) => isPublicArtworkImage(item.artwork))?.artwork?.image_url
                return (
                  <Link key={collection.id} href={`/collections/${collection.id}`} className="archive-reveal group overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900">
                    <div className="aspect-[4/3] overflow-hidden bg-zinc-800">
                      {imageUrl ? <img src={imageUrl} alt={collection.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-zinc-500"><ImageIcon /></div>}
                    </div>
                    <div className="p-5">
                      <h3 className="text-xl font-black">{collection.title}</h3>
                      {collection.description && <p className="secondary-copy mt-2 line-clamp-2 text-sm text-zinc-400">{collection.description}</p>}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="archive-reveal mx-auto flex max-w-7xl flex-col gap-5 rounded-[36px] border border-white/10 bg-white p-8 text-black md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-500">Следующий шаг</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight md:text-5xl">
              {canPublish ? 'Опубликуйте новую работу' : profile ? 'Подайте заявку, чтобы стать автором' : 'Создайте профиль и начните исследовать галерею'}
            </h2>
          </div>
          <Link href={canPublish ? '/studio' : profile ? '/profile' : '/register'} className="inline-flex shrink-0 items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition hover:bg-zinc-800">
            {canPublish ? 'Открыть студию' : profile ? 'Перейти в профиль' : 'Создать профиль'}
          </Link>
        </div>
      </section>

      <style jsx>{`
        .archive-reveal { animation: archiveFadeUp .7s ease both; }
        @keyframes archiveFadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .archive-reveal { animation: none; } * { scroll-behavior: auto !important; } }
      `}</style>
    </main>
  )
}

function isPublicArtworkImage(artwork: NonNullable<HomeCollection['collection_items']>[number]['artwork']) {
  return Boolean(
    artwork?.image_url &&
      artwork.status === 'published' &&
      artwork.visibility === 'public' &&
      !artwork.deleted_at
  )
}

function EmptyBand({ text, light = false }: { text: string; light?: boolean }) {
  return (
    <div className={`rounded-[28px] border border-dashed p-10 text-center text-sm ${light ? 'border-zinc-300 text-zinc-500' : 'border-white/15 text-zinc-500'}`}>
      {text}
    </div>
  )
}