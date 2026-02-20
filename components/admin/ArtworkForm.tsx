// components/admin/ArtworkForm.tsx
'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Props = {
  initial?: {
    id?: string
    title?: string
    description?: string
    image_url?: string
    author_id?: string
  }
  onDone?: () => void
}

export default function ArtworkForm({ initial, onDone }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '')
  const [authorId, setAuthorId] = useState(initial?.author_id ?? '')
  const [saving, setSaving] = useState(false)
  const [authors, setAuthors] = useState<Array<{ id: string; full_name?: string; username?: string }>>([])

  // Загружаем только авторов с ролью creator
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('role', 'creator')
        .order('full_name')
      setAuthors(data || [])
    })()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (initial?.id) {
        // обновление
        const { error } = await supabase
          .from('artworks')
          .update({
            title,
            description,
            image_url: imageUrl,
            author_id: authorId || null
          })
          .eq('id', initial.id)
        if (error) throw error
      } else {
        // создание
        const { error } = await supabase
          .from('artworks')
          .insert({
            title,
            description,
            image_url: imageUrl,
            author_id: authorId || null
          })
        if (error) throw error
      }

      if (onDone) onDone()
    } catch (err: any) {
      alert('Ошибка: ' + (err.message || JSON.stringify(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-600">Название</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border px-3 py-2 rounded text-gray-800"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600">Описание</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border px-3 py-2 rounded text-gray-800"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600">Автор</label>
        <select
          value={authorId ?? ''}
          onChange={(e) => setAuthorId(e.target.value)}
          className="w-full border px-3 py-2 rounded text-gray-800"
        >
          <option value="">— без автора —</option>
          {authors.map(a => (
            <option key={a.id} value={a.id}>
              {a.full_name ?? a.username ?? a.id}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600">URL изображения</label>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-full border px-3 py-2 rounded text-gray-800"
          placeholder="https://example.com/image.jpg"
          required
        />
        {imageUrl && (
          <div className="mt-2">
            <img
              src={imageUrl}
              alt="предпросмотр"
              className="h-20 w-auto object-cover rounded border"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : initial?.id ? 'Сохранить' : 'Создать'}
        </button>
        <button
          type="button"
          onClick={() => { if (onDone) onDone() }}
          className="px-4 py-2 rounded border text-gray-700 hover:bg-gray-100"
        >
          Отмена
        </button>
      </div>
    </form>
  )
}