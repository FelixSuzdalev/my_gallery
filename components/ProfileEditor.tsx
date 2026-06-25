'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Save, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

type EditableProfile = {
  id: string
  full_name?: string | null
  username?: string | null
  bio?: string | null
  avatar_url?: string | null
  is_public?: boolean | null
}

type Props = {
  profile: EditableProfile
  onSaved: (profile: EditableProfile) => void
  onCancel: () => void
}

const AVATAR_BUCKET = 'avatars'
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const fieldClass =
  'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-black focus:ring-4 focus:ring-black/5'

export default function ProfileEditor({ profile, onSaved, onCancel }: Props) {
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [username, setUsername] = useState(profile.username ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [isPublic, setIsPublic] = useState(profile.is_public ?? true)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [nameWarning, setNameWarning] = useState<string | null>(null)
  const [checkingName, setCheckingName] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(avatarFile)
    setAvatarPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [avatarFile])

  useEffect(() => {
    if (!isSupabaseV2) return

    const normalizedName = normalizeFullName(fullName)
    if (!normalizedName) {
      setNameWarning(null)
      setCheckingName(false)
      return
    }

    let mounted = true
    setCheckingName(true)

    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('full_name', normalizedName)
        .eq('is_public', true)
        .neq('id', profile.id)
        .limit(1)

      if (!mounted) return
      if (error) {
        console.warn('Не удалось проверить совпадение имени профиля:', error.message)
        setNameWarning(null)
      } else {
        setNameWarning(
          data && data.length > 0
            ? 'Профиль с таким отображаемым именем уже существует. Рекомендуется выбрать узнаваемое имя или псевдоним.'
            : null
        )
      }
      setCheckingName(false)
    }, 350)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [fullName, profile.id])

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    const validationError = validateAvatarFile(file)
    if (validationError) {
      alert(validationError)
      event.target.value = ''
      setAvatarFile(null)
      return
    }

    setAvatarFile(file)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const normalizedFullName = normalizeFullName(fullName)
    const normalizedUsername = normalizeUsername(username)
    const normalizedBio = bio.trim()

    const validationError = validateProfile({
      fullName: normalizedFullName,
      username: normalizedUsername,
      bio: normalizedBio,
    })

    if (validationError) {
      alert(validationError)
      return
    }

    setSaving(true)
    let uploadedPath: string | null = null
    let nextAvatarUrl = avatarUrl || null

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError) throw userError
      if (!user || user.id !== profile.id) {
        throw new Error('Редактировать можно только свой профиль.')
      }

      if (isSupabaseV2) {
        const usernameAvailable = await checkUsernameAvailable(normalizedUsername, user.id)
        if (!usernameAvailable) throw new Error('Такое имя пользователя уже занято.')
      }

      if (avatarFile) {
        const uploaded = await uploadAvatar(user.id, avatarFile)
        uploadedPath = uploaded.path
        nextAvatarUrl = uploaded.publicUrl
      }

      const patch = {
        full_name: normalizedFullName,
        username: normalizedUsername,
        bio: normalizedBio || null,
        avatar_url: nextAvatarUrl,
        is_public: isPublic,
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select('id, full_name, username, bio, avatar_url, is_public')
        .single()

      if (error) throw error

      if (avatarFile) {
        const oldAvatarPath = getAvatarPathFromPublicUrl(profile.avatar_url)
        if (oldAvatarPath && oldAvatarPath !== uploadedPath) {
          const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([oldAvatarPath])
          if (removeError) console.warn('Не удалось удалить старый аватар:', removeError.message)
        }
      }

      setAvatarUrl(nextAvatarUrl ?? '')
      setAvatarFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      window.dispatchEvent(new CustomEvent('profile:updated'))
      onSaved(data as EditableProfile)
    } catch (error) {
      if (uploadedPath) {
        const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([uploadedPath])
        if (removeError) console.warn('Не удалось удалить новый аватар после ошибки:', removeError.message)
      }
      alert('Не удалось сохранить профиль: ' + getProfileErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const preview = avatarPreviewUrl ?? avatarUrl

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-zinc-900">Имя</span>
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className={fieldClass}
          placeholder="Как вас показывать в галерее"
          required
        />
        {nameWarning && (
          <span className="mt-2 block rounded-2xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
            {nameWarning}
          </span>
        )}
        {!nameWarning && checkingName && (
          <span className="mt-2 block text-xs leading-5 text-zinc-400">Проверяем совпадения имени...</span>
        )}
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-zinc-900">Имя пользователя</span>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className={fieldClass}
          placeholder="latin-name"
          required
        />
        <span className="mt-2 block text-xs leading-5 text-zinc-500">
          Латиница, цифры, подчёркивание или дефис. От 3 до 32 символов.
        </span>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-zinc-900">О себе</span>
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          className={`${fieldClass} min-h-28 resize-y`}
          placeholder="Коротко о практике, технике или темах работ"
        />
      </label>

      <label className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <span>
          <span className="block text-sm font-semibold text-zinc-900">Публичный профиль</span>
          <span className="block text-xs leading-5 text-zinc-500">Если выключить, профиль не будет доступен другим пользователям.</span>
        </span>
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(event) => setIsPublic(event.target.checked)}
          className="h-5 w-5 accent-black"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-[96px_1fr] sm:items-center">
        <div className="h-24 w-24 overflow-hidden rounded-full border border-zinc-200 bg-zinc-100">
          {preview ? (
            <img src={preview} alt="Аватар профиля" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">Аватар</div>
          )}
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-zinc-900">Новый аватар</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleAvatarChange}
            className={fieldClass}
          />
          <span className="mt-2 block text-xs leading-5 text-zinc-500">JPEG, PNG или WebP, до 2 MB.</span>
        </label>
      </div>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : avatarFile ? <Upload className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saving ? 'Сохранение...' : 'Сохранить профиль'}
        </button>
      </div>
    </form>
  )
}

function normalizeFullName(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

function validateProfile({ fullName, username, bio }: { fullName: string; username: string; bio: string }) {
  const name = normalizeFullName(fullName)
  const handle = normalizeUsername(username)
  const text = bio.trim()

  if (!name) return 'Отображаемое имя обязательно.'
  if (name.length > 80) return 'Имя должно быть не длиннее 80 символов.'
  if (!/^[a-z0-9_-]{3,32}$/.test(handle)) {
    return 'Имя пользователя должно быть от 3 до 32 символов: латиница, цифры, подчёркивание или дефис.'
  }
  if (text.length > 500) return 'Описание профиля должно быть не длиннее 500 символов.'
  return null
}

async function checkUsernameAvailable(username: string, currentUserId: string) {
  const { data, error } = await supabase.rpc('is_username_available', {
    p_username: username,
    p_current_user_id: currentUserId,
  })

  if (error) throw error
  return data === true
}

function validateAvatarFile(file: File | null) {
  if (!file) return null
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) return 'Аватар должен быть JPEG, PNG или WebP.'
  if (file.size > MAX_AVATAR_SIZE_BYTES) return 'Аватар должен быть не больше 2 MB.'
  return null
}

async function uploadAvatar(userId: string, file: File) {
  const extension = getAvatarExtension(file)
  const path = `${userId}/avatar-${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })

  if (error) throw error

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}

function getAvatarExtension(file: File) {
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  throw new Error('Аватар должен быть JPEG, PNG или WebP.')
}

function getAvatarPathFromPublicUrl(avatarUrl?: string | null) {
  if (!avatarUrl) return null

  try {
    const url = new URL(avatarUrl)
    const marker = `/object/public/${AVATAR_BUCKET}/`
    const markerIndex = url.pathname.indexOf(marker)
    if (markerIndex < 0) return null
    return decodeURIComponent(url.pathname.slice(markerIndex + marker.length))
  } catch {
    return null
  }
}

function getProfileErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
    return 'Такое имя пользователя уже занято.'
  }
  if (error instanceof Error) {
    if (/duplicate|unique|profiles_username/i.test(error.message)) return 'Такое имя пользователя уже занято.'
    return error.message
  }
  if (typeof error === 'string') return error
  return JSON.stringify(error)
}
