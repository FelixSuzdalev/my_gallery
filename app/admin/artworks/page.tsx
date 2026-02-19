// app/admin/artworks/page.tsx
'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ArtworkForm from '@/components/admin/ArtworkForm'

type Artwork = {
  id: string
  title: string
  description?: string | null
  image_url: string
  author_id?: string | null
  created_at?: string
}

export default function AdminArtworksPage() {
  const [items, setItems] = useState<Artwork[]>([])
  const [loading, setLoading] = useState(true)
  // editing используется как selectedArtwork
  const [editing, setEditing] = useState<Artwork | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('artworks')
      .select('id, title, description, image_url, author_id, created_at')
      .order('created_at', { ascending: false })
    if (error) {
      alert('Ошибка загрузки: ' + error.message)
      setLoading(false)
      return
    }
    setItems(data || [])
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить работу?')) return
    const { error } = await supabase.from('artworks').delete().eq('id', id)
    if (error) {
      alert('Не удалось удалить: ' + error.message)
      return
    }
    setItems((s) => s.filter((i) => i.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Работы</h1>
        <div>
          <button
            onClick={() => { setEditing(null); setShowForm(true) }}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            Добавить работу
          </button>
        </div>
      </div>

      {loading ? <div>Загрузка...</div> : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(it => (
              <div key={it.id} className="bg-white rounded shadow overflow-hidden">
                <div className="h-48 bg-gray-100">
                  <img src={it.image_url} alt={it.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{it.title}</h3>
                  <p className="text-sm text-gray-500 mt-2 line-clamp-2">{it.description ?? ''}</p>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => { setEditing(it); setShowForm(true) }}
                      className="px-3 py-1 bg-blue-50 text-blue-700 rounded"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDelete(it.id)}
                      className="px-3 py-1 bg-red-50 text-red-700 rounded"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* форма (новая/редактирование) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow max-w-3xl w-full p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-end">
              <button
                className="text-sm text-gray-500"
                onClick={() => { setShowForm(false); setEditing(null) }}
              >
                Закрыть
              </button>
            </div>

            <ArtworkForm
              initial={
                editing
                  ? {
                      ...editing,
                      // нормализуем null -> undefined, чтобы совпадало с сигнатурой формы
                      description: editing.description ?? undefined,
                      image_url: editing.image_url ?? undefined,
                      author_id: editing.author_id ?? undefined
                    }
                  : undefined
              }
              onDone={async () => {
                setShowForm(false)
                setEditing(null)
                await load()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}