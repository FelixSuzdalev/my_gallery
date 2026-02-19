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
  const [file, setFile] = useState<File | null>(null)
  const [authorId, setAuthorId] = useState(initial?.author_id ?? '')
  const [saving, setSaving] = useState(false)
  const [authors, setAuthors] = useState<Array<{ id: string; full_name?: string; username?: string }>>([])

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, username').order('full_name')
      setAuthors(data || [])
    })()
  }, [])

  async function uploadFile(file: File) {
    const ext = file.name.split('.').pop()
    const filename = `${crypto.randomUUID()}.${ext}`
    const path = filename
    const { data, error: uploadErr } = await supabase.storage.from('artworks').upload(path, file, { cacheControl: '3600', upsert: false })
    if (uploadErr) throw uploadErr
    const { data: publicData } = supabase.storage.from('artworks').getPublicUrl(path)
    return publicData.publicUrl
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      let finalUrl = imageUrl
      if (file) {
        finalUrl = await uploadFile(file)
        setImageUrl(finalUrl)
      }

      if (initial?.id) {
        // update
        const { error } = await supabase.from('artworks').update({
          title, description, image_url: finalUrl, author_id: authorId || null
        }).eq('id', initial.id)
        if (error) throw error
      } else {
        // insert
        const { error } = await supabase.from('artworks').insert({
          title, description, image_url: finalUrl, author_id: authorId || null
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
        <label className="block text-xs font-semibold">Название</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border px-3 py-2 rounded" required />
      </div>

      <div>
        <label className="block text-xs font-semibold">Описание</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border px-3 py-2 rounded" rows={3} />
      </div>

      <div>
        <label className="block text-xs font-semibold">Автор (привязка)</label>
        <select value={authorId ?? ''} onChange={(e) => setAuthorId(e.target.value)} className="w-full border px-3 py-2 rounded">
          <option value="">— без автора —</option>
          {authors.map(a => <option key={a.id} value={a.id}>{a.full_name ?? a.username ?? a.id}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold">Изображение</label>
        <div className="flex items-center gap-3">
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {imageUrl && <img src={imageUrl} alt="preview" className="w-20 h-12 object-cover rounded" />}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="bg-green-600 text-white px-4 py-2 rounded">
          {saving ? 'Сохраняю...' : initial?.id ? 'Сохранить' : 'Создать'}
        </button>
        <button type="button" onClick={() => { if (onDone) onDone(); }} className="px-4 py-2 rounded border">Отмена</button>
      </div>
    </form>
  )
}
