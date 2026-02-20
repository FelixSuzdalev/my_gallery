// app/admin/artworks/page.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ArtworkForm from '@/components/admin/ArtworkForm'

type ArtworkWithAuthor = {
  id: string
  title: string
  description: string | null
  image_url: string
  author_id: string
  author_name: string
  created_at?: string
}

export default function AdminArtworksPage() {
  const [artworks, setArtworks] = useState<ArtworkWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingArtwork, setEditingArtwork] = useState<ArtworkWithAuthor | null>(null)

  // Загрузка списка работ с именем автора
  const loadArtworks = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('artworks')
      .select(`
        id,
        title,
        description,
        image_url,
        author_id,
        profiles:author_id ( full_name, username )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      alert('Ошибка загрузки работ: ' + error.message)
    } else {
      const formatted = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        image_url: item.image_url,
        author_id: item.author_id,
        author_name: item.profiles?.full_name || item.profiles?.username || 'Неизвестный автор'
      }))
      setArtworks(formatted)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadArtworks()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить эту работу?')) return

    const { error } = await supabase.from('artworks').delete().eq('id', id)
    if (error) {
      alert('Ошибка удаления: ' + error.message)
    } else {
      loadArtworks() // обновляем список
    }
  }

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

  const handleFormDone = () => {
    closeModal()
    loadArtworks()
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Управление работами</h1>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Добавить работу
        </button>
      </div>

      {loading ? (
        <p>Загрузка...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 border text-xs font-semibold text-gray-600">Изображение</th>
                <th className="px-4 py-2 border text-xs font-semibold text-gray-600">Название</th>
                <th className="px-4 py-2 border text-xs font-semibold text-gray-600">Автор</th>
                <th className="px-4 py-2 border text-xs font-semibold text-gray-600">Действия</th>
              </tr>
            </thead>
            <tbody>
              {artworks.map((art) => (
                <tr key={art.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border border-gray-700">
                    {art.image_url && (
                      <img src={art.image_url} alt={art.title} className="h-16 w-16 object-cover rounded border-red" />
                    )}
                  </td>
                  <td className="px-4 py-2 border text-gray-700 font-medium">{art.title}</td>
                  <td className="px-4 py-2 border text-gray-700">{art.author_name}</td>
                  <td className="px-4 py-2 border text-gray-700 space-x-2">
                    <button
                      onClick={() => openEditModal(art)}
                      className="text-blue-600 hover:underline"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDelete(art.id)}
                      className="text-red-600 hover:underline"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {artworks.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-gray-500">
                    Нет добавленных работ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Модальное окно */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingArtwork ? 'Редактировать работу' : 'Новая работа'}
            </h2>
            <ArtworkForm
              initial={editingArtwork ? {
                id: editingArtwork.id,
                title: editingArtwork.title,
                description: editingArtwork.description ?? undefined,
                image_url: editingArtwork.image_url,
                author_id: editingArtwork.author_id
              } : undefined }
              onDone={handleFormDone}
            />
            <button
              onClick={closeModal}
              className="mt-4 text-gray-600 hover:text-gray-800"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  )
}