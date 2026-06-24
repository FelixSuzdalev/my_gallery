'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon, Loader2, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

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

type ArtworkPayload = {
  title: string
  description: string | null
  author_id: string | null
  tags: string[]
  image_url?: string | null
  status?: 'published'
  visibility?: 'public'
  comments_enabled?: boolean
}

type ArtworkMediaRow = {
  id: string
  bucket_id: string
  storage_path: string
}

type UploadedArtworkImage = {
  publicUrl: string
  storagePath: string
}

const ARTWORK_MEDIA_BUCKET = 'artwork-media'
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const fieldClass =
  'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-black focus:ring-4 focus:ring-black/5'

export default function ArtworkForm({ initial, onDone }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [authorId, setAuthorId] = useState(initial?.author_id ?? '')
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(', '))
  const [saving, setSaving] = useState(false)
  const [authors, setAuthors] = useState<AuthorOption[]>([])

  const isEditing = Boolean(initial?.id)

  useEffect(() => {
    let mounted = true

    async function loadAuthors() {
      const profilesQuery = supabase.from('profiles').select('id, full_name, username')
      const { data } = await (isSupabaseV2
        ? profilesQuery.in('role', ['creator', 'admin']).order('full_name')
        : profilesQuery.eq('role', 'creator').order('full_name'))

      if (mounted) setAuthors((data ?? []) as AuthorOption[])
    }

    loadAuthors()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(imageFile)
    setImagePreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [imageFile])

  const tags = useMemo(() => {
    return tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag, index, arr) => arr.indexOf(tag) === index)
  }, [tagsText])

  const previewUrl = imagePreviewUrl ?? imageUrl
  const isV2Editing = isSupabaseV2 && isEditing

  function handleImageFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    const validationError = validateImageFile(file, false)

    if (validationError) {
      alert(validationError)
      event.target.value = ''
      setImageFile(null)
      return
    }

    setImageFile(file)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)

    const payload: ArtworkPayload = {
      title: title.trim(),
      description: description.trim() || null,
      author_id: authorId || null,
      tags,
    }

    try {
      if (isSupabaseV2) {
        const validationError = validateV2Submission(payload.author_id, imageFile, isEditing)
        if (validationError) {
          alert(validationError)
          return
        }

        const v2Payload: ArtworkPayload = {
          ...payload,
          status: 'published',
          visibility: 'public',
          comments_enabled: true,
        }

        if (initial?.id) {
          await updateV2Artwork(initial.id, v2Payload, imageFile)
        } else {
          await createV2Artwork(v2Payload, imageFile)
        }
      } else {
        const v1Payload: ArtworkPayload = {
          ...payload,
          image_url: imageUrl.trim(),
        }

        if (initial?.id) {
          const { error } = await supabase.from('artworks').update(v1Payload).eq('id', initial.id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('artworks').insert(v1Payload)
          if (error) throw error
        }
      }

      await onDone?.()
    } catch (err: unknown) {
      alert('Ошибка: ' + getErrorMessage(err))
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

          <Field
            label="Автор"
            hint={
              isV2Editing
                ? 'После создания автора нельзя изменить: он связан с путём загруженного изображения.'
                : undefined
            }
          >
            <select
              value={authorId}
              onChange={(event) => setAuthorId(event.target.value)}
              className={fieldClass}
              required={isSupabaseV2}
              disabled={isV2Editing}
            >
              {isSupabaseV2 ? (
                <option value="" disabled>
                  Выберите автора
                </option>
              ) : (
                <option value="">Без автора</option>
              )}
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
          {isSupabaseV2 ? (
            <Field
              label="Изображение"
              hint="JPEG, PNG или WebP, до 5 MB. В V2 эта форма сразу публикует работу в публичной галерее."
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageFileChange}
                className={fieldClass}
                required={!isEditing}
              />
            </Field>
          ) : (
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
          )}

          <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-50">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Предпросмотр"
                className="h-80 w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <div className="flex h-80 flex-col items-center justify-center text-zinc-400">
                <ImageIcon className="mb-3 h-8 w-8" />
                <span className="text-sm">
                  {isSupabaseV2 ? 'Предпросмотр появится после выбора файла' : 'Предпросмотр появится после ссылки'}
                </span>
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

function validateV2Submission(authorId: string | null, imageFile: File | null, isEditing: boolean) {
  if (!authorId) return 'Выберите автора работы.'
  return validateImageFile(imageFile, !isEditing)
}

function validateImageFile(file: File | null, required: boolean) {
  if (!file) return required ? 'Выберите изображение работы.' : null
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return 'Поддерживаются только JPEG, PNG или WebP.'
  if (file.size > MAX_IMAGE_SIZE_BYTES) return 'Изображение должно быть не больше 5 MB.'
  return null
}

async function createV2Artwork(payload: ArtworkPayload, imageFile: File | null) {
  if (!payload.author_id) throw new Error('Выберите автора работы.')
  if (!imageFile) throw new Error('Выберите изображение работы.')

  let artworkId: string | null = null
  let uploadedStoragePath: string | null = null
  let mediaRowId: string | null = null

  try {
    const { data: artwork, error: artworkError } = await supabase
      .from('artworks')
      .insert({
        ...payload,
        image_url: null,
      })
      .select('id')
      .single()

    if (artworkError) throw artworkError
    artworkId = artwork.id as string

    const uploadedImage = await uploadArtworkImage(imageFile, payload.author_id, artworkId)
    uploadedStoragePath = uploadedImage.storagePath

    const { data: media, error: mediaError } = await supabase
      .from('artwork_media')
      .insert({
        artwork_id: artworkId,
        bucket_id: ARTWORK_MEDIA_BUCKET,
        storage_path: uploadedImage.storagePath,
        media_type: 'image',
        sort_order: 0,
      })
      .select('id')
      .single()

    if (mediaError) throw mediaError
    mediaRowId = media.id as string

    const { error: imageUrlError } = await supabase
      .from('artworks')
      .update({ image_url: uploadedImage.publicUrl })
      .eq('id', artworkId)

    if (imageUrlError) throw imageUrlError
  } catch (error) {
    if (uploadedStoragePath) await removeArtworkMediaFile(uploadedStoragePath)
    if (mediaRowId) await deleteArtworkMediaRow(mediaRowId)
    if (artworkId) await deleteCreatedArtwork(artworkId)
    throw error
  }
}

async function updateV2Artwork(artworkId: string, payload: ArtworkPayload, imageFile: File | null) {
  if (!payload.author_id) throw new Error('Выберите автора работы.')

  const { data: artwork, error: artworkError } = await supabase
    .from('artworks')
    .select('author_id')
    .eq('id', artworkId)
    .single()

  if (artworkError) throw artworkError

  const currentAuthorId = (artwork as { author_id: string | null }).author_id
  if (payload.author_id !== currentAuthorId) {
    throw new Error('Нельзя изменить автора существующей V2-работы: он связан с путём загруженного изображения.')
  }

  if (!imageFile) {
    const { error } = await supabase.from('artworks').update(payload).eq('id', artworkId)
    if (error) throw error
    return
  }

  let uploadedStoragePath: string | null = null
  let createdMediaRowId: string | null = null
  let previousMediaRow: ArtworkMediaRow | null = null
  let replacedMediaRow: ArtworkMediaRow | null = null

  try {
    const uploadedImage = await uploadArtworkImage(imageFile, payload.author_id, artworkId)
    uploadedStoragePath = uploadedImage.storagePath

    previousMediaRow = await getPrimaryArtworkMedia(artworkId)

    if (previousMediaRow) {
      const { error: mediaError } = await supabase
        .from('artwork_media')
        .update({
          bucket_id: ARTWORK_MEDIA_BUCKET,
          storage_path: uploadedImage.storagePath,
          media_type: 'image',
        })
        .eq('id', previousMediaRow.id)

      if (mediaError) throw mediaError
      replacedMediaRow = previousMediaRow
    } else {
      const { data: media, error: mediaError } = await supabase
        .from('artwork_media')
        .insert({
          artwork_id: artworkId,
          bucket_id: ARTWORK_MEDIA_BUCKET,
          storage_path: uploadedImage.storagePath,
          media_type: 'image',
          sort_order: 0,
        })
        .select('id')
        .single()

      if (mediaError) throw mediaError
      createdMediaRowId = media.id as string
    }

    const { error: artworkError } = await supabase
      .from('artworks')
      .update({
        ...payload,
        image_url: uploadedImage.publicUrl,
      })
      .eq('id', artworkId)

    if (artworkError) throw artworkError

    if (previousMediaRow?.storage_path) {
      await removeArtworkMediaFile(previousMediaRow.storage_path)
    }
  } catch (error) {
    if (uploadedStoragePath) await removeArtworkMediaFile(uploadedStoragePath)
    if (createdMediaRowId) await deleteArtworkMediaRow(createdMediaRowId)
    if (replacedMediaRow) await restoreArtworkMediaRow(replacedMediaRow)
    throw error
  }
}

async function uploadArtworkImage(file: File, authorId: string, artworkId: string): Promise<UploadedArtworkImage> {
  const extension = getImageExtension(file)
  const storagePath = authorId + '/' + artworkId + '/display/0-' + crypto.randomUUID() + '.' + extension

  const { error } = await supabase.storage.from(ARTWORK_MEDIA_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) throw error

  const { data } = supabase.storage.from(ARTWORK_MEDIA_BUCKET).getPublicUrl(storagePath)

  return {
    publicUrl: data.publicUrl,
    storagePath,
  }
}

async function getPrimaryArtworkMedia(artworkId: string): Promise<ArtworkMediaRow | null> {
  const { data, error } = await supabase
    .from('artwork_media')
    .select('id, bucket_id, storage_path')
    .eq('artwork_id', artworkId)
    .eq('sort_order', 0)
    .maybeSingle()

  if (error) throw error
  return data as ArtworkMediaRow | null
}

async function deleteArtworkMediaRow(id: string) {
  const { error } = await supabase.from('artwork_media').delete().eq('id', id)
  if (error) console.warn('Не удалось удалить metadata artwork_media после ошибки:', error.message)
}

async function restoreArtworkMediaRow(row: ArtworkMediaRow) {
  const { error } = await supabase
    .from('artwork_media')
    .update({
      bucket_id: row.bucket_id,
      storage_path: row.storage_path,
      media_type: 'image',
    })
    .eq('id', row.id)

  if (error) console.warn('Не удалось восстановить metadata artwork_media после ошибки:', error.message)
}

async function deleteCreatedArtwork(id: string) {
  const { error } = await supabase.from('artworks').delete().eq('id', id)
  if (error) console.warn('Не удалось удалить созданную работу после ошибки:', error.message)
}

async function removeArtworkMediaFile(storagePath: string) {
  const { error } = await supabase.storage.from(ARTWORK_MEDIA_BUCKET).remove([storagePath])
  if (error) console.warn('Не удалось удалить файл artwork-media:', error.message)
}

function getImageExtension(file: File) {
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  throw new Error('Поддерживаются только JPEG, PNG или WebP.')
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return JSON.stringify(err)
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