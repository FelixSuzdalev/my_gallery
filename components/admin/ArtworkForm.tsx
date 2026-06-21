'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon, Loader2, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Props = {
  initial?: {
    id?: string
    title?: string
    description?: string
    image_url?: string
    author_id?: string
    tags?: string[]
  }
  onDone?: () => void | Promise<void>
}

type AuthorOption = {
  id: string
  full_name?: string | null
  username?: string | null
}

const fieldClass =
  'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-black focus:ring-4 focus:ring-black/5'

export default function ArtworkForm({ initial, onDone }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '')
  const [authorId, setAuthorId] = useState(initial?.author_id ?? '')
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(', '))
  const [saving, setSaving] = useState(false)
  const [authors, setAuthors] = useState<AuthorOption[]>([])

  useEffect(() => {
    let mounted = true

    async function loadAuthors() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('role', 'creator')
        .order('full_name')

      if (mounted) setAuthors((data ?? []) as AuthorOption[])
    }

    loadAuthors()
    return () => {
      mounted = false
    }
  }, [])

  const tags = useMemo(() => {
    return tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag, index, arr) => arr.indexOf(tag) === index)
  }, [tagsText])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      image_url: imageUrl.trim(),
      author_id: authorId || null,
      tags,
    }

    try {
      if (initial?.id) {
        const { error } = await supabase.from('artworks').update(payload).eq('id', initial.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('artworks').insert(payload)
        if (error) throw error
      }

      await onDone?.()
    } catch (err: unknown) {
      alert('Ошибка: ' + (err instanceof Error ? err.message : JSON.stringify(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <Field label="Название" hint="Короткое название, которое будет видно в ленте.">
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={fieldClass}
              placeholder="Например: Свет и тень"
              required
            />
          </Field>

          <Field label="Автор">
            <select value={authorId} onChange={(event) => setAuthorId(event.target.value)} className={fieldClass}>
              <option value="">Без автора</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.full_name ?? author.username ?? author.id}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Теги" hint="Через запятую: фотография, минимализм, 3D.">
            <input
              type="text"
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              className={fieldClass}
              placeholder="Фотография, Портрет, Digital"
            />
          </Field>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <Field label="Описание">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={`${fieldClass} min-h-32 resize-y`}
              placeholder="Кратко опишите работу, технику или идею."
            />
          </Field>
        </div>

        <div className="space-y-5">
          <Field label="URL изображения" hint="Пока используется ссылка на изображение.">
            <input
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              className={fieldClass}
              placeholder="https://example.com/image.jpg"
              required
            />
          </Field>

          <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Предпросмотр"
                className="h-80 w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <div className="flex h-80 flex-col items-center justify-center text-zinc-400">
                <ImageIcon className="mb-3 h-8 w-8" />
                <span className="text-sm">Предпросмотр появится после ссылки</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => void onDone?.()}
          className="rounded-full border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Сохранение...' : initial?.id ? 'Сохранить изменения' : 'Создать работу'}
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-zinc-900">{label}</span>
      {children}
      {hint && <span className="mt-2 block text-xs leading-5 text-zinc-500">{hint}</span>}
    </label>
  )
}
