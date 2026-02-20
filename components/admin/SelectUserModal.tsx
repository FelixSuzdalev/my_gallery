'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type User = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
}

interface Props {
  onClose: () => void
  onConfirm: (selectedIds: string[]) => Promise<void>
}

export default function SelectUserModal({ onClose, onConfirm }: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .eq('role', 'user')
      .order('full_name')
    if (error) {
      alert('Ошибка загрузки пользователей: ' + error.message)
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  const toggleUser = (id: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  const handleConfirm = async () => {
    if (selected.size === 0) {
      alert('Выберите хотя бы одного пользователя')
      return
    }
    setSaving(true)
    await onConfirm(Array.from(selected))
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-6 z-50 overflow-auto">
      <div className="bg-white rounded-lg shadow max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Выберите пользователей</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {loading ? (
          <div>Загрузка...</div>
        ) : (
          <>
            <div className="space-y-2 max-h-96 overflow-y-auto border rounded p-2">
              {users.map(user => (
                <label
                  key={user.id}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(user.id)}
                    onChange={() => toggleUser(user.id)}
                    className="h-4 w-4 text-blue-600"
                  />
                  {user.avatar_url ? (
					<>
                    	<img src={user.avatar_url} className="w-8 h-8 object-cover rounded-full" />
					</>
                  ) : (
                    <div className="w-8 h-8 bg-gray-200 rounded-full" />
                  )}
                  <div>
                    <div className="font-medium text-gray-800">{user.full_name ?? user.username}</div>
                    {user.username && <div className="text-xs text-gray-500">@{user.username}</div>}
                  </div>
                </label>
              ))}
              {users.length === 0 && (
                <div className="text-center py-4 text-gray-500">Нет пользователей с ролью user</div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded"
              >
                Отмена
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving || selected.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Назначить создателями'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}