// app/admin/users/page.tsx
'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AuthorForm from '@/components/admin/AuthorForm'

type Profile = { 
  id: string; 
  full_name?: string; 
  username?: string; 
  avatar_url?: string;
  role?: string;
}

export default function AdminUsersPage() {
  const [items, setItems] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Profile | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, role')
      .eq('role', 'user')  // только пользователи
      .order('full_name')
    if (error) {
      alert('Ошибка: ' + error.message)
    } else {
      setItems(data || [])
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить пользователя? Это удалит и все связанные работы (если они есть).')) return
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) {
      alert('Ошибка удаления: ' + error.message)
    } else {
      setItems(prev => prev.filter(i => i.id !== id))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-500">Пользователи</h1>
        {/* Кнопка добавления — если хочешь, можешь скрыть или заменить на приглашение */}
        <button 
          onClick={() => { setEditing(null); setShowForm(true) }} 
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Добавить пользователя
        </button>
      </div>

      {loading ? <div>Загрузка...</div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(profile => (
            <div key={profile.id} className="bg-white rounded shadow p-4 flex flex-col">
              <div className="flex items-center gap-3">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded" />
                )}
                <div>
                  <div className="font-medium text-gray-800">{profile.full_name ?? profile.username}</div>
                  <div className="text-xs text-gray-500">{profile.username}</div>
                  <div className="text-xs text-gray-400">Роль: {profile.role}</div>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button 
                  onClick={() => { setEditing(profile); setShowForm(true) }} 
                  className="px-3 py-1 bg-blue-50 text-blue-700 rounded"
                >
                  Редактировать
                </button>
                <button 
                  onClick={() => handleDelete(profile.id)} 
                  className="px-3 py-1 bg-red-50 text-red-700 rounded"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-6 z-50 overflow-auto">
          <div className="bg-white rounded-lg shadow max-w-xl w-full p-6">
            <button className="text-sm text-gray-500 mb-4" onClick={() => setShowForm(false)}>
              Закрыть
            </button>
            <AuthorForm
              initial={editing ?? undefined}
              onDone={async () => { setShowForm(false); await load() }}
            />
          </div>
        </div>
      )}
    </div>
  )
}