// components/cards/FavoriteCard.tsx
'use client';
import React from 'react';
import Image from 'next/image';
import { Trash2, Heart } from 'lucide-react';
import { Artwork2 } from '@/app/core/models/types';

type Props = {
  artwork: Artwork2;
  favId?: string;
  userLabel?: string | null;
  showUser?: boolean;
  onRemove?: (favId: string) => void;
  onToggle?: () => void;       // <- toggle like/unlike
  isDeleting?: boolean;
  isToggling?: boolean;
};

export default function FavoriteCard({
  artwork,
  favId,
  userLabel,
  showUser = false,
  onRemove,
  onToggle,
  isDeleting,
  isToggling
}: Props) {
  return (
    <article className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col">
      <div className="relative w-full h-48 bg-gray-100">
        {/* next/image требует настроенный next.config.js для внешних доменов */}
        <Image
          src={artwork.image_url}
          alt={artwork.title}
          fill
          style={{ objectFit: 'cover' }}
          sizes="(max-width: 640px) 100vw, 33vw"
        />
      </div>

      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-semibold truncate">{artwork.title}</h3>
          {artwork.description ? (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{artwork.description}</p>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs text-gray-600">
            {showUser && userLabel ? (
              <div>Добавил: <strong>{userLabel}</strong></div>
            ) : (
              <div>Автор: <span className="font-medium">{artwork.author_id || '—'}</span></div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
              className="flex items-center gap-1 text-sm px-2 py-1 rounded-md bg-red-50 text-red-600 select-none"
              aria-label="toggle favorite"
              disabled={isToggling}
            >
              <Heart size={14} />
              <span className="sr-only">Toggle favorite</span>
            </button>

            {onRemove && favId ? (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(favId); }}
                className="p-2 rounded-md bg-gray-100 hover:bg-gray-200"
                aria-label="Удалить"
                disabled={isDeleting}
              >
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}