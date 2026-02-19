// components/admin/AuthorForm.tsx
'use client'
import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'


type Props = {
  initial?: { id?: string; full_name?: string; username?: string; avatar_url?: string }
  onDone?: () => void
}

export default function AuthorForm({ initial, onDone }: Props) {
  const [fullName, setFullName] = useState(initial?.full_name ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  async function uploadAvatar(file: File) {
    const ext = file.name.split('.').pop()
    const filename = `${crypto.randomUUID()}.${ext}`
    const path = filename
    const { data, error } = await supabase.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: false })
    if (error) throw error
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
    return pub.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      let finalAvatar = avatarUrl
      if (file) {
        finalAvatar = await uploadAvatar(file)
        setAvatarUrl(finalAvatar)
      }

      if (initial?.id) {
        const { error } = await supabase.from('profiles').update({
          full_name: fullName,
          username,
          avatar_url: finalAvatar
        }).eq('id', initial.id)
        if (error) throw error
      } else {
        // create profile - note: auth.users must exist separately. We're creating a profiles row that may be linked to auth user later.
        const { error } = await supabase.from('profiles').insert({
          full_name: fullName,
          username,
          avatar_url: finalAvatar,
          role: 'creator'
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
        <label className="block text-xs font-semibold">Полное имя</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border px-3 py-2 rounded" required />
      </div>

      <div>
        <label className="block text-xs font-semibold">Username (уникальный)</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border px-3 py-2 rounded" required />
      </div>

      <div>
        <label className="block text-xs font-semibold">Аватар</label>
        <div className="flex items-center gap-3">
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {avatarUrl && <img src={avatarUrl} alt="avatar" className="w-16 h-16 object-cover rounded" />}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded">
          {saving ? 'Сохраняю...' : initial?.id ? 'Сохранить' : 'Создать'}
        </button>
        <button type="button" onClick={() => onDone?.()} className="px-4 py-2 rounded border">Отмена</button>
      </div>
    </form>
  )
}
