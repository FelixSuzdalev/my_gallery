'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

type Role = 'user' | 'creator' | 'admin'
type RoleFilter = Role | 'all'
type CreateMode = 'invite' | 'create'

type Profile = {
  id: string
  email?: string
  full_name?: string | null
  username?: string | null
  avatar_url?: string | null
  role?: Role | null
}

const roles: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: 'Все роли' },
  { value: 'user', label: 'user' },
  { value: 'creator', label: 'creator' },
  { value: 'admin', label: 'admin' },
]

const inputClass =
  'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-black focus:ring-4 focus:ring-black/5'

export default function AdminUsersPage() {
  const [items, setItems] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [showForm, setShowForm] = useState(false)
  const [mode, setMode] = useState<CreateMode>('invite')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [submitting, setSubmitting] = useState(false)

  const canUseServerAdmin = isSupabaseV2

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      if (canUseServerAdmin) {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (!token) throw new Error('Нужна авторизация администратора.')

        const params = new URLSearchParams()
        if (query.trim()) params.set('q', query.trim())
        if (roleFilter !== 'all') params.set('role', roleFilter)

        const response = await fetch(`/api/admin/users?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error ?? 'Не удалось загрузить пользователей.')
        setItems((payload.users ?? []) as Profile[])
      } else {
        const { data, error: loadError } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, role')
          .eq('role', 'user')
          .order('full_name')

        if (loadError) throw loadError
        setItems(data || [])
      }
    } catch (loadError) {
      setItems([])
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить пользователей.')
    } finally {
      setLoading(false)
    }
  }, [canUseServerAdmin, query, roleFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 250)
    return () => window.clearTimeout(timer)
  }, [load])

  const hasFilters = useMemo(() => Boolean(query.trim()) || roleFilter !== 'all', [query, roleFilter])

  function resetCreateForm() {
    setEmail('')
    setPassword('')
    setFullName('')
    setUsername('')
    setRole('user')
    setMode('invite')
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Нужна авторизация администратора.')

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode, email, password, full_name: fullName, username, role }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Не удалось создать пользователя.')

      setMessage(payload.message ?? 'Пользователь добавлен.')
      resetCreateForm()
      setShowForm(false)
      await load()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Не удалось создать пользователя.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRoleChange(profile: Profile, nextRole: Role) {
    if (!isSupabaseV2) return
    const previous = items
    setItems((current) => current.map((item) => (item.id === profile.id ? { ...item, role: nextRole } : item)))
    const { error: updateError } = await supabase.from('profiles').update({ role: nextRole }).eq('id', profile.id)
    if (updateError) {
      setItems(previous)
      setError('Не удалось изменить роль: ' + updateError.message)
    }
  }

  async function handleDelete(id: string) {
    if (isSupabaseV2) {
      if (!confirm('Скрыть профиль? Он исчезнет из публичных списков, но не будет удалён физически.')) return
      const { error: deleteError } = await supabase.from('profiles').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (deleteError) setError('Ошибка скрытия: ' + deleteError.message)
      else setItems((prev) => prev.filter((item) => item.id !== id))
      return
    }

    if (!confirm('Удалить пользователя? Это удалит и все связанные работы, если они есть.')) return
    const { error: deleteError } = await supabase.from('profiles').delete().eq('id', id)
    if (deleteError) setError('Ошибка удаления: ' + deleteError.message)
    else setItems((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm text-zinc-500">Администрирование</p>
          <h1 className="text-2xl font-black tracking-tight">Пользователи</h1>
          <p className="secondary-copy mt-1 text-sm text-zinc-600">Поиск по email, username и отображаемому имени.</p>
        </div>
        {isSupabaseV2 && (
          <button
            onClick={() => setShowForm((value) => !value)}
            className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800"
          >
            <Plus size={16} />
            Добавить пользователя
          </button>
        )}
      </div>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-center">
          <label className="relative block">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${inputClass} pl-11`}
              placeholder="Email, username или имя"
            />
          </label>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)} className={inputClass}>
            {roles.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
          {hasFilters && (
            <button onClick={() => { setQuery(''); setRoleFilter('all') }} className="rounded-full px-4 py-3 text-sm font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-black">
              Сбросить фильтры
            </button>
          )}
        </div>
      </section>

      {showForm && isSupabaseV2 && (
        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <UserPlus size={18} />
            <h2 className="text-xl font-black">Новый пользователь</h2>
          </div>
          <form onSubmit={handleCreate} className="grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2 flex flex-wrap gap-2 rounded-full bg-zinc-100 p-1">
              <button type="button" onClick={() => setMode('invite')} className={`rounded-full px-4 py-2 text-sm font-bold ${mode === 'invite' ? 'bg-black text-white' : 'text-zinc-600'}`}>
                Пригласить по email
              </button>
              <button type="button" onClick={() => setMode('create')} className={`rounded-full px-4 py-2 text-sm font-bold ${mode === 'create' ? 'bg-black text-white' : 'text-zinc-600'}`}>
                Создать с временным паролем
              </button>
            </div>

            <input value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} type="email" placeholder="Email" required />
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} className={inputClass} placeholder="Отображаемое имя" required />
            <input value={username} onChange={(event) => setUsername(event.target.value)} className={inputClass} placeholder="username" required />
            <select value={role} onChange={(event) => setRole(event.target.value as Role)} className={inputClass}>
              <option value="user">user</option>
              <option value="creator">creator</option>
              <option value="admin">admin</option>
            </select>
            {mode === 'create' && (
              <input value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} type="password" placeholder="Временный пароль" minLength={8} required />
            )}
            <div className="flex flex-wrap gap-2 lg:col-span-2">
              <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === 'invite' ? 'Отправить приглашение' : 'Создать пользователя'}
              </button>
              <button type="button" onClick={() => { resetCreateForm(); setShowForm(false) }} className="rounded-full border border-zinc-200 px-5 py-3 text-sm font-bold text-zinc-700 hover:bg-zinc-100">
                Отмена
              </button>
            </div>
          </form>
        </section>
      )}

      {message && <div className="rounded-2xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{message}</div>}
      {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

      <section className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">Пользователи не найдены.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((profile) => (
              <article key={profile.id} className="rounded-3xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.full_name ?? profile.username ?? ''} className="h-12 w-12 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-xs font-bold text-zinc-400">
                      {(profile.full_name || profile.username || profile.email || 'U').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-bold text-zinc-900">{profile.full_name || profile.username || 'Без имени'}</div>
                    <div className="truncate text-xs text-zinc-500">{profile.email || 'email недоступен'}</div>
                    <div className="truncate text-xs text-zinc-400">@{profile.username || 'username не задан'}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {isSupabaseV2 ? (
                    <select value={profile.role ?? 'user'} onChange={(event) => void handleRoleChange(profile, event.target.value as Role)} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold">
                      <option value="user">user</option>
                      <option value="creator">creator</option>
                      <option value="admin">admin</option>
                    </select>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-600">{profile.role}</span>
                  )}
                  <button onClick={() => void handleDelete(profile.id)} className="rounded-full border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                    {isSupabaseV2 ? 'Скрыть' : 'Удалить'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}