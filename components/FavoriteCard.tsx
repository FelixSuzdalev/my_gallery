'use client'

import { Heart, Trash2 } from 'lucide-react'
import { Artwork2 } from '@/app/core/models/types'

export type FavoriteArtwork = Artwork2 & {
  created_at?: string | null
  tags?: string[] | null
  profiles?: {
    username?: string | null
    full_name?: string | null
  } | null
}

type Props = {
  artwork: FavoriteArtwork
  favId?: string
  userLabel?: string | null
  showUser?: boolean
  onRemove?: (favId: string) => void
  onToggle?: () => void
  onOpen?: () => void
  isDeleting?: boolean
  isToggling?: boolean
}

export default function FavoriteCard({
  artwork,
  favId,
  userLabel,
  showUser = false,
  onRemove,
  onToggle,
  onOpen,
  isDeleting,
  isToggling,
}: Props) {
  const authorLabel =
    artwork.profiles?.full_name ||
    artwork.profiles?.username ||
    artwork.author_id ||
    'Автор'

  return (
    <article
      className={`gallery-card-motion archive-card-reveal group overflow-hidden rounded-[28px] border border-zinc-200 bg-white text-black shadow-sm transition hover:border-black hover:shadow-xl ${onOpen ? 'cursor-pointer' : ''}`}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onOpen) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100">
        <img
          src={artwork.image_url}
          alt={artwork.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="like-pop absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-black shadow-lg backdrop-blur">
          <Heart size={14} className="fill-red-500 text-red-500" />
          В избранном
        </div>
      </div>

      <div className="flex min-h-52 flex-col p-5">
        <div className="flex-1">
          <h3 className="line-clamp-2 text-xl font-black tracking-normal">{artwork.title}</h3>
          {artwork.description ? (
            <p className="secondary-copy mt-2 line-clamp-3 text-sm text-zinc-500">{artwork.description}</p>
          ) : null}

          {artwork.tags && artwork.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {artwork.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
          <div className="min-w-0 text-xs font-semibold text-zinc-500">
            {showUser && userLabel ? (
              <span className="block truncate">Добавил: {userLabel}</span>
            ) : (
              <span className="block truncate">{authorLabel}</span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {onToggle && (
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  onToggle()
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                aria-label="Переключить избранное"
                disabled={isToggling}
              >
                <Heart size={16} className="fill-current" />
              </button>
            )}

            {onRemove && favId ? (
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  onRemove(favId)
                }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-black hover:text-white disabled:opacity-50"
                aria-label="Убрать из избранного"
                disabled={isDeleting}
              >
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
