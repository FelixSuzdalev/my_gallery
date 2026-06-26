'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

type DemoRole = 'user' | 'creator' | 'admin'

type DemoRoleResponse = {
  available?: boolean
  role?: DemoRole
  error?: string
}

const PIN_STORAGE_KEY = 'my_gallery_demo_role_switcher_pin'

const roleLabels: Record<DemoRole, string> = {
  user: 'Пользователь',
  creator: 'Автор',
  admin: 'Администратор',
}

const roleOptions: Array<{ value: DemoRole; label: string }> = [
  { value: 'user', label: 'Пользователь' },
  { value: 'creator', label: 'Автор' },
  { value: 'admin', label: 'Администратор' },
]

export default function DemoRoleSwitcher() {
  const router = useRouter()
  const [available, setAvailable] = useState(false)
  const [loading, setLoading] = useState(isSupabaseV2)
  const [role, setRole] = useState<DemoRole | null>(null)
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [busyRole, setBusyRole] = useState<DemoRole | 'unlock' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const savedPin = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return window.sessionStorage.getItem(PIN_STORAGE_KEY) ?? ''
  }, [])

  const requestDemoRole = useCallback(async (options?: RequestInit) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Нужна авторизация.')

    const response = await fetch('/api/demo-role', {
      ...options,
      headers: {
        ...(options?.headers ?? {}),
        authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })

    const payload = (await response.json().catch(() => ({}))) as DemoRoleResponse
    if (!response.ok) throw new Error(payload.error ?? 'Демонстрационный режим недоступен.')
    return payload
  }, [])

  const loadState = useCallback(async () => {
    if (!isSupabaseV2) return

    setLoading(true)
    try {
      const payload = await requestDemoRole()
      setAvailable(Boolean(payload.available))
      setRole(payload.role ?? null)
      const storedPin = window.sessionStorage.getItem(PIN_STORAGE_KEY)
      setUnlocked(Boolean(storedPin))
      setPin(storedPin ?? '')
      setError(null)
    } catch {
      setAvailable(false)
      setRole(null)
      setUnlocked(false)
    } finally {
      setLoading(false)
    }
  }, [requestDemoRole])

  useEffect(() => {
    void loadState()

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void loadState()
    })

    return () => subscription.subscription.unsubscribe()
  }, [loadState])

  async function applyRole(nextRole: DemoRole, mode: 'unlock' | 'switch') {
    const pinToUse = mode === 'unlock' ? pin.trim() : window.sessionStorage.getItem(PIN_STORAGE_KEY) ?? pin.trim()
    if (!pinToUse) {
      setError('Введите PIN демонстрационного режима.')
      return
    }

    setBusyRole(mode === 'unlock' ? 'unlock' : nextRole)
    setError(null)
    setMessage(null)

    try {
      const payload = await requestDemoRole({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: nextRole, pin: pinToUse }),
      })

      const updatedRole = payload.role ?? nextRole
      window.sessionStorage.setItem(PIN_STORAGE_KEY, pinToUse)
      setUnlocked(true)
      setPin(pinToUse)
      setRole(updatedRole)
      setMessage(mode === 'unlock' ? 'PIN принят.' : `Роль изменена: ${roleLabels[updatedRole]}.`)
      window.dispatchEvent(new CustomEvent('profile:updated'))
      router.refresh()
    } catch (switchError) {
      const nextError = switchError instanceof Error ? switchError.message : 'Не удалось изменить роль.'
      setError(nextError)
      if (mode === 'unlock') {
        window.sessionStorage.removeItem(PIN_STORAGE_KEY)
        setUnlocked(false)
      }
    } finally {
      setBusyRole(null)
    }
  }

  useEffect(() => {
    if (savedPin) setPin(savedPin)
  }, [savedPin])

  if (!isSupabaseV2 || loading || !available || !role) return null

  return (
    <aside className="fixed bottom-4 right-4 z-[70] w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-amber-300 bg-white p-3 text-black shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black">Демонстрационный режим</div>
          <div className="text-xs font-semibold text-zinc-600">Переключение реальных прав аккаунта</div>
          <div className="mt-1 text-xs text-zinc-500">Текущая роль: {roleLabels[role]}</div>
        </div>
      </div>

      {!unlocked ? (
        <div className="mt-3 flex gap-2">
          <input
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            type="password"
            className="min-w-0 flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none transition focus:border-black"
            placeholder="PIN"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => void applyRole(role, 'unlock')}
            disabled={busyRole === 'unlock'}
            className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {busyRole === 'unlock' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            Разблокировать
          </button>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {roleOptions.map((option) => {
            const active = role === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => void applyRole(option.value, 'switch')}
                disabled={busyRole !== null || active}
                className={`rounded-full px-3 py-2 text-xs font-bold transition disabled:cursor-default ${
                  active ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                }`}
              >
                {busyRole === option.value ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : option.label}
              </button>
            )
          })}
        </div>
      )}

      {message && <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{message}</div>}
      {error && <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}
    </aside>
  )
}
