'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Image as ImageIcon, Loader2, Save, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ArtworkTagSelector from '@/components/admin/ArtworkTagSelector'
import { normalizeTagList, validateArtworkTags } from '@/lib/tag-catalog'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'
import {
  canArtworkHavePublicMedia,
  deletePublicArtworkMedia,
  getPrimaryArtworkMedia,
  type ArtworkMediaRow,
  type ArtworkStatus,
  type ArtworkVisibility,
} from '@/lib/v2-content'

type Props = {
  initial?: {
    id?: string
    title?: string
    description?: string
    image_url?: string | null
    author_id?: string
    tags?: string[]
    status?: ArtworkStatus
    visibility?: ArtworkVisibility
    comments_enabled?: boolean
  }
  onDone?: () => void | Promise<void>
}

type AuthorOption = {
  id: string
  full_name?: string | null
  username?: string | null
  role?: 'user' | 'creator' | 'admin' | null
}

type ArtworkPayload = {
  title: string
  description: string | null
  author_id: string | null
  tags: string[]
  image_url?: string | null
  status?: ArtworkStatus
  visibility?: ArtworkVisibility
  comments_enabled?: boolean
}

type V2ArtworkUpdatePayload = Pick<
  ArtworkPayload,
  'title' | 'description' | 'tags' | 'status' | 'visibility' | 'comments_enabled'
>

type UploadedArtworkImage = {
  publicUrl: string
  storagePath: string
}

const ARTWORK_MEDIA_BUCKET = 'artwork-media'
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const fieldClass =
  'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-black focus:ring-4 focus:ring-black/5 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500'

export default function ArtworkForm({ initial, onDone }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? '')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [authorId, setAuthorId] = useState(initial?.author_id ?? '')
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(', '))
  const [selectedTags, setSelectedTags] = useState<string[]>(() => normalizeTagList(initial?.tags ?? []))
  const [status, setStatus] = useState<ArtworkStatus>(initial?.status ?? 'published')
  const [visibility, setVisibility] = useState<ArtworkVisibility>(initial?.visibility ?? 'public')
  const [commentsEnabled, setCommentsEnabled] = useState(initial?.comments_enabled ?? true)
  const [saving, setSaving] = useState(false)
  const [deletingImage, setDeletingImage] = useState(false)
  const [hasPrimaryMedia, setHasPrimaryMedia] = useState(false)
  const [checkingMedia, setCheckingMedia] = useState(false)
  const [authors, setAuthors] = useState<AuthorOption[]>([])
  const [currentAuthor, setCurrentAuthor] = useState<AuthorOption | null>(null)
  const [authorSearch, setAuthorSearch] = useState('')
  const [authorSearchLoading, setAuthorSearchLoading] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const isEditing = Boolean(initial?.id)
  const isV2Editing = isSupabaseV2 && isEditing
  const canUploadNewImage = !isSupabaseV2 || canUseArtworkMedia({ status, visibility })
  const hasExistingImage = Boolean(imageUrl) || hasPrimaryMedia
  const hasPublishableImage = Boolean(imageUrl) && hasPrimaryMedia

  useEffect(() => {
    if (isSupabaseV2) return

    let mounted = true

    async function loadAuthors() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, role')
        .eq('role', 'creator')
        .order('full_name')

      if (mounted) setAuthors((data ?? []) as AuthorOption[])
    }

    void loadAuthors()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseV2 || !authorId) {
      setCurrentAuthor(null)
      return
    }

    let mounted = true

    async function loadCurrentAuthor() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, role')
        .eq('id', authorId)
        .maybeSingle()

      if (!mounted) return
      if (error) console.warn('Не удалось загрузить текущего автора:', error.message)
      setCurrentAuthor((data as AuthorOption | null) ?? null)
    }

    void loadCurrentAuthor()
    return () => {
      mounted = false
    }
  }, [authorId])

  useEffect(() => {
    if (!isSupabaseV2) return

    const query = authorSearch.trim()
    if (query.length < 2) {
      setAuthors([])
      setAuthorSearchLoading(false)
      return
    }

    let mounted = true
    setAuthorSearchLoading(true)

    const timer = window.setTimeout(async () => {
      const pattern = `%${query.replace(/%/g, '\\%')}%`
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, role')
        .is('deleted_at', null)
        .or(`full_name.ilike.${pattern},username.ilike.${pattern}`)
        .order('full_name')
        .limit(12)

      if (!mounted) return
      if (error) {
        console.warn('Не удалось найти авторов:', error.message)
        setAuthors([])
      } else {
        setAuthors((data ?? []) as AuthorOption[])
      }
      setAuthorSearchLoading(false)
    }, 300)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [authorSearch])

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

  useEffect(() => {
    if (canUploadNewImage || !imageFile) return
    setImageFile(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }, [canUploadNewImage, imageFile])

  useEffect(() => {
    if (!isSupabaseV2 || !initial?.id) return

    let mounted = true
    setCheckingMedia(true)

    async function loadPrimaryMedia() {
      try {
        const media = await getPrimaryArtworkMedia(initial?.id ?? '')
        if (mounted) setHasPrimaryMedia(Boolean(media))
      } catch (error) {
        console.warn('Не удалось проверить primary artwork_media:', error)
        if (mounted) setHasPrimaryMedia(false)
      } finally {
        if (mounted) setCheckingMedia(false)
      }
    }

    void loadPrimaryMedia()
    return () => {
      mounted = false
    }
  }, [initial?.id])

  const tags = useMemo(() => {
    if (isSupabaseV2) return selectedTags
    return tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .filter((tag, index, arr) => arr.indexOf(tag) === index)
  }, [selectedTags, tagsText])

  const previewUrl = imagePreviewUrl ?? imageUrl

  function handleImageFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null

    if (isSupabaseV2 && !canUploadNewImage && file) {
      alert('Новое изображение можно загрузить только для опубликованной публичной V2-работы.')
      event.target.value = ''
      setImageFile(null)
      return
    }

    const validationError = validateImageFile(file, false)
    if (validationError) {
      alert(validationError)
      event.target.value = ''
      setImageFile(null)
      return
    }

    setImageFile(file)
  }

  async function handleDeleteImage() {
    if (!isSupabaseV2 || !initial?.id || deletingImage) return

    setDeletingImage(true)
    try {
      await deletePublicArtworkMedia(initial.id, { image_url: imageUrl })
      setImageUrl('')
      setImageFile(null)
      setImagePreviewUrl(null)
      setHasPrimaryMedia(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    } catch (err: unknown) {
      alert('Ошибка удаления изображения: ' + getErrorMessage(err))
    } finally {
      setDeletingImage(false)
    }
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
        const v2Payload: ArtworkPayload = {
          ...payload,
          status,
          visibility,
          comments_enabled: commentsEnabled,
        }

        const validationError = validateV2Submission(v2Payload, imageFile, isEditing)
        if (validationError) {
          alert(validationError)
          return
        }

        if (initial?.id) {
          const isSavingPublic = canUseArtworkMedia(v2Payload)
          if (isSavingPublic && !imageFile && !hasPublishableImage) {
            alert('Для публикации загрузите изображение.')
            return
          }

          await updateV2Artwork(initial.id, v2Payload, imageFile, {
            hasPublishableMedia: hasPublishableImage,
          })
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
                ? 'Автор существующей V2-работы не меняется: он связан с правами и путём загруженного изображения.'
                : isSupabaseV2
                  ? 'Начните вводить имя или username. Владелец работы должен иметь роль creator или admin.'
                  : undefined
            }
          >
            {isSupabaseV2 ? (
              <div className="space-y-3">
                {currentAuthor && (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-sm font-semibold text-zinc-900">{getAuthorLabel(currentAuthor)}</div>
                    <div className="text-xs text-zinc-500">Текущий автор · {currentAuthor.role ?? 'role не задана'}</div>
                  </div>
                )}

                {!isV2Editing && (
                  <>
                    <input
                      type="search"
                      value={authorSearch}
                      onChange={(event) => setAuthorSearch(event.target.value)}
                      className={fieldClass}
                      placeholder="Найти автора по имени или username"
                      required={!authorId}
                    />

                    <div className="rounded-2xl border border-zinc-200 bg-white p-2">
                      {authorSearch.trim().length < 2 ? (
                        <div className="p-4 text-sm text-zinc-500">Введите минимум 2 символа для поиска.</div>
                      ) : authorSearchLoading ? (
                        <div className="flex items-center gap-2 p-4 text-sm text-zinc-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Ищем автора...
                        </div>
                      ) : authors.length === 0 ? (
                        <div className="p-4 text-sm text-zinc-500">Пользователи не найдены.</div>
                      ) : (
                        <div className="grid gap-2">
                          {authors.map((author) => {
                            const canSelect = author.role === 'creator' || author.role === 'admin'
                            const selected = author.id === authorId
                            return (
                              <button
                                key={author.id}
                                type="button"
                                disabled={!canSelect}
                                onClick={() => {
                                  if (!canSelect) return
                                  setAuthorId(author.id)
                                  setCurrentAuthor(author)
                                }}
                                className={`rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  selected ? 'border-black bg-zinc-100' : 'border-zinc-200 hover:border-black'
                                }`}
                              >
                                <div className="text-sm font-semibold text-zinc-900">{getAuthorLabel(author)}</div>
                                <div className="text-xs text-zinc-500">
                                  {canSelect
                                    ? `Можно выбрать · ${author.role}`
                                    : 'Роль user: сначала назначьте пользователя автором в админке'}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <select value={authorId} onChange={(event) => setAuthorId(event.target.value)} className={fieldClass}>
                <option value="">Без автора</option>
                {authors.map((author) => (
                  <option key={author.id} value={author.id}>
                    {getAuthorLabel(author)}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {isSupabaseV2 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Статус">
                <select value={status} onChange={(event) => setStatus(event.target.value as ArtworkStatus)} className={fieldClass}>
                  <option value="draft">Черновик</option>
                  <option value="published">Опубликовано</option>
                  <option value="hidden">Скрыто</option>
                  {status === 'archived' && (
                    <option value="archived" disabled>
                      В архиве
                    </option>
                  )}
                </select>
              </Field>

              <Field label="Видимость">
                <select value={visibility} onChange={(event) => setVisibility(event.target.value as ArtworkVisibility)} className={fieldClass}>
                  <option value="public">Открытая</option>
                  <option value="unlisted">По ссылке</option>
                  <option value="private">Приватная</option>
                </select>
              </Field>
            </div>
          )}

          {isSupabaseV2 && (
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-zinc-900">Комментарии</span>
                <span className="block text-xs leading-5 text-zinc-500">Пользователи смогут оставлять visible-комментарии.</span>
              </span>
              <input
                type="checkbox"
                checked={commentsEnabled}
                onChange={(event) => setCommentsEnabled(event.target.checked)}
                className="h-5 w-5 accent-black"
              />
            </label>
          )}

          {isSupabaseV2 ? (
            <Field label="Теги">
              <ArtworkTagSelector value={selectedTags} onChange={setSelectedTags} />
            </Field>
          ) : (
            <>
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
            </>
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
              hint={
                canUploadNewImage
                  ? 'JPEG, PNG или WebP, до 5 MB. Загрузка доступна только для опубликованной открытой работы.'
                  : 'Новое изображение нельзя загрузить для черновика, скрытой или непубличной работы: public bucket доступен только для опубликованных открытых работ.'
              }
            >
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageFileChange}
                className={fieldClass}
                required={canUploadNewImage && !isEditing}
                disabled={!canUploadNewImage}
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
                  {isSupabaseV2 ? 'Изображение не выбрано' : 'Предпросмотр появится после ссылки'}
                </span>
              </div>
            )}
          </div>

          {isSupabaseV2 && isEditing && hasExistingImage && !checkingMedia && (
            <button
              type="button"
              onClick={() => void handleDeleteImage()}
              disabled={deletingImage || saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
            >
              {deletingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Удалить изображение
            </button>
          )}
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
          disabled={saving || deletingImage}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Сохранение...' : initial?.id ? 'Сохранить изменения' : 'Создать работу'}
        </button>
      </div>
    </form>
  )
}

function getAuthorLabel(author: AuthorOption) {
  return author.full_name || (author.username ? '@' + author.username : author.id)
}

function canUseArtworkMedia(payload: Pick<ArtworkPayload, 'status' | 'visibility'>) {
  return canArtworkHavePublicMedia({ status: payload.status, visibility: payload.visibility, deleted_at: null })
}

function validateV2Submission(payload: ArtworkPayload, imageFile: File | null, isEditing: boolean) {
  if (!payload.author_id) return 'Выберите автора работы.'
  const tagError = validateArtworkTags(payload.tags)
  if (tagError) return tagError
  if (imageFile && !canUseArtworkMedia(payload)) {
    return 'Новое изображение можно загрузить только для опубликованной открытой V2-работы.'
  }
  if (!isEditing && canUseArtworkMedia(payload) && !imageFile) return 'Выберите изображение работы.'
  return validateImageFile(imageFile, false)
}

function validateImageFile(file: File | null, required: boolean) {
  if (!file) return required ? 'Выберите изображение работы.' : null
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return 'Поддерживаются только JPEG, PNG или WebP.'
  if (file.size > MAX_IMAGE_SIZE_BYTES) return 'Изображение должно быть не больше 5 MB.'
  return null
}

async function createV2Artwork(payload: ArtworkPayload, imageFile: File | null) {
  if (!payload.author_id) throw new Error('Выберите автора работы.')
  if (imageFile && !canUseArtworkMedia(payload)) {
    throw new Error('Новое изображение можно загрузить только для опубликованной открытой V2-работы.')
  }
  if (canUseArtworkMedia(payload) && !imageFile) throw new Error('Выберите изображение работы.')

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

    if (!imageFile) return

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

async function updateV2Artwork(
  artworkId: string,
  payload: ArtworkPayload,
  imageFile: File | null,
  options: { hasPublishableMedia?: boolean } = {}
) {
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

  if (imageFile && !canUseArtworkMedia(payload)) {
    throw new Error('Новое изображение можно загрузить только для опубликованной открытой V2-работы.')
  }

  if (!canUseArtworkMedia(payload)) {
    const { error } = await supabase.from('artworks').update(getV2ArtworkUpdatePayload(payload)).eq('id', artworkId)
    if (error) throw error
    return
  }

  if (!imageFile && !options.hasPublishableMedia) {
    throw new Error('Для публикации загрузите изображение.')
  }

  if (!imageFile) {
    const { error } = await supabase.from('artworks').update(getV2ArtworkUpdatePayload(payload)).eq('id', artworkId)
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

    const { error: artworkUpdateError } = await supabase
      .from('artworks')
      .update({
        ...getV2ArtworkUpdatePayload(payload),
        image_url: uploadedImage.publicUrl,
      })
      .eq('id', artworkId)

    if (artworkUpdateError) throw artworkUpdateError

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

function getV2ArtworkUpdatePayload(payload: ArtworkPayload): V2ArtworkUpdatePayload {
  return {
    title: payload.title,
    description: payload.description,
    tags: payload.tags,
    status: payload.status,
    visibility: payload.visibility,
    comments_enabled: payload.comments_enabled,
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