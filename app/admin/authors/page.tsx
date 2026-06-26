
'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'
import AuthorForm from '@/components/admin/AuthorForm'
import SelectUserModal from '@/components/admin/SelectUserModal'

type Profile = {
  id: string
  full_name?: string
  username?: string
  avatar_url?: string
  role?: string
}

export default function AdminCreatorsPage() {
  const [items, setItems] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showSelectModal, setShowSelectModal] = useState(false)

  async function load() {
    setLoading(true)

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, role')
      .eq('role', 'creator')
      .order('full_name')

    if (error) {
      alert('Ошибка: ' + error.message)
    } else {
      setItems(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  async function handleAssignCreators(selectedIds: string[]) {
    if (selectedIds.length === 0) {
      setShowSelectModal(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: 'creator' })
      .in('id', selectedIds)

    if (error) {
      alert('Ошибка назначения автора: ' + error.message)
      return
    }

    setShowSelectModal(false)
    await load()
  }

  async function handleDelete(id: string) {
    if (isSupabaseV2) {
      if (!confirm('Скрыть профиль? Он исчезнет из публичных списков, но не будет удалён физически.')) {
        return
      }

      const { error } = await supabase
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        alert('Ошибка скрытия: ' + error.message)
      } else {
        setItems((prev) => prev.filter((item) => item.id !== id))
      }

      return
    }

    if (!confirm('Удалить создателя? Это удалит и все связанные работы.')) {
      return
    }

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Ошибка удаления: ' + error.message)
    } else {
      setItems((prev) => prev.filter((item) => item.id !== id))
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-500">Создатели</h1>

        <button
          onClick={() => setShowSelectModal(true)}
          className="rounded bg-green-600 px-4 py-2 text-white"
        >
          Назначить создателя
        </button>
      </div>

      {loading ? (
        <div>Загрузка...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((profile) => (
            <div key={profile.id} className="flex flex-col rounded bg-white p-4 shadow">
              <div className="flex items-center gap-3">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name ?? profile.username ?? ''}
                    className="h-12 w-12 rounded object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded bg-gray-100" />
                )}

                <div>
                  <div className="font-medium text-gray-800">
                    {profile.full_name ?? profile.username}
                  </div>
                  <div className="text-xs text-gray-500">{profile.username}</div>
                  <div className="text-xs text-gray-400">
                    Роль: {profile.role}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    setEditing(profile)
                    setShowForm(true)
                  }}
                  className="rounded bg-blue-50 px-3 py-1 text-blue-700"
                >
                  Редактировать
                </button>

                <button
                  onClick={() => void handleDelete(profile.id)}
                  className="rounded bg-red-50 px-3 py-1 text-red-700"
                >
                  {isSupabaseV2 ? 'Скрыть' : 'Удалить'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-6">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow">
            <button
              className="mb-4 text-sm text-gray-500"
              onClick={() => setShowForm(false)}
            >
              Закрыть
            </button>

            <AuthorForm
              initial={editing ?? undefined}
              onDone={async () => {
                setShowForm(false)
                await load()
              }}
            />
          </div>
        </div>
      )}

      {showSelectModal && (
        <SelectUserModal
          onClose={() => setShowSelectModal(false)}
          onConfirm={handleAssignCreators}
        />
      )}
    </div>
  )
}

