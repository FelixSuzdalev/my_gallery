// components/admin/AuthorForm.tsx
'use client'
import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Profile = {
  id?: string
  full_name?: string
  username?: string
  avatar_url?: string
  bio?: string
  role?: string
}

interface Props {
  initial?: Profile
  onDone: () => void
}

export default function AuthorForm({ initial, onDone }: Props) {
  const [form, setForm] = useState<Profile>({
    full_name: initial?.full_name || '',
    username: initial?.username || '',
    avatar_url: initial?.avatar_url || '',
    bio: initial?.bio || '',
    role: initial?.role || 'user',
    id: initial?.id
  })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function uploadAvatar(file: File) {
    const ext = file.name.split('.').pop()
    const filename = `${crypto.randomUUID()}.${ext}`
    const path = filename
    const { error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (error) throw error
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
    return pub.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      let finalAvatar = form.avatar_url
      if (file) {
        finalAvatar = await uploadAvatar(file)
      }

      if (!form.id) {
        alert('Создание новых профилей через эту форму не поддерживается. Используйте регистрацию.')
        setSaving(false)
        return
      }

      // Обновление существующего профиля
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name,
          username: form.username,
          avatar_url: finalAvatar,
          bio: form.bio,
          role: form.role
        })
        .eq('id', form.id)

      if (error) throw error
      onDone()
    } catch (err: any) {
      alert('Ошибка: ' + (err.message || JSON.stringify(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-slate-800">
      <div>
        <label className="block text-xs font-semibold">Полное имя</label>
        <input
          type="text"
          name="full_name"
          value={form.full_name}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold">Username (уникальный)</label>
        <input
          type="text"
          name="username"
          value={form.username}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold">Bio</label>
        <textarea
          name="bio"
          value={form.bio}
          onChange={handleChange}
          rows={3}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold">Аватар</label>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {form.avatar_url && (
            <img src={form.avatar_url} alt="avatar" className="w-16 h-16 object-cover rounded" />
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold">Роль</label>
        <select
          name="role"
          value={form.role}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
        >
          <option value="user">Пользователь</option>
          <option value="creator">Создатель</option>
          <option value="admin">Администратор</option>
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 rounded border"
        >
          Отмена
        </button>
      </div>
    </form>
  )
}