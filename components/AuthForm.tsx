'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Loader2, Lock, Mail, UserRound, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type AuthMode = 'login' | 'register'

type State = {
  mode: AuthMode
  email: string
  password: string
  confirmPassword: string
  fullName: string
  loading: boolean
  error: string | null
}

type AuthField = keyof Pick<State, 'email' | 'password' | 'confirmPassword' | 'fullName'>

type Action =
  | { type: 'setField'; field: AuthField; value: string }
  | { type: 'setLoading'; value: boolean }
  | { type: 'setError'; value: string | null }
  | { type: 'setMode'; value: AuthMode }

const fieldClass =
  'w-full rounded-2xl border border-zinc-200 bg-white px-12 py-4 text-sm font-medium text-black outline-none transition placeholder:text-zinc-400 focus:border-black focus:ring-4 focus:ring-black/5'

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setField':
      return { ...state, [action.field]: action.value }
    case 'setLoading':
      return { ...state, loading: action.value }
    case 'setError':
      return { ...state, error: action.value }
    case 'setMode':
      return { ...state, mode: action.value, error: null }
    default:
      return state
  }
}

function getPasswordChecks(password: string) {
  return [
    { label: 'Минимум 8 символов', valid: password.length >= 8 },
    { label: 'Есть строчная буква', valid: /[a-zа-яё]/.test(password) },
    { label: 'Есть заглавная буква', valid: /[A-ZА-ЯЁ]/.test(password) },
    { label: 'Есть цифра', valid: /\d/.test(password) },
    { label: 'Есть спецсимвол', valid: /[^A-Za-zА-Яа-яЁё0-9]/.test(password) },
  ]
}

export default function AuthForm({ initialMode = 'login' }: { initialMode?: AuthMode }) {
  const [state, dispatch] = useReducer(reducer, {
    mode: initialMode,
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    loading: false,
    error: null,
  })
  const router = useRouter()
  const mounted = useRef(true)
  const isLogin = state.mode === 'login'

  const passwordChecks = useMemo(() => getPasswordChecks(state.password), [state.password])
  const passwordStrong = passwordChecks.every((check) => check.valid)
  const passwordsMatch = state.password.length > 0 && state.password === state.confirmPassword

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const handleChange = useCallback(
    (field: AuthField) =>
      (event: ChangeEvent<HTMLInputElement>) =>
        dispatch({ type: 'setField', field, value: event.target.value }),
    []
  )

  async function handleAuth(event: FormEvent) {
    event.preventDefault()
    dispatch({ type: 'setError', value: null })

    if (!isLogin) {
      if (!passwordStrong) {
        dispatch({ type: 'setError', value: 'Пароль должен соответствовать всем правилам сложности.' })
        return
      }

      if (!passwordsMatch) {
        dispatch({ type: 'setError', value: 'Пароли не совпадают.' })
        return
      }
    }

    dispatch({ type: 'setLoading', value: true })

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: state.email,
          password: state.password,
        })
        if (error) throw error
        router.push('/feed')
      } else {
        const origin = window.location.origin
        const { error } = await supabase.auth.signUp({
          email: state.email,
          password: state.password,
          options: {
            emailRedirectTo: `${origin}/login?confirmed=1`,
            data: {
              full_name: state.fullName,
              avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                state.fullName || state.email
              )}`,
            },
          },
        })
        if (error) throw error
        router.push(`/auth/check-email?email=${encodeURIComponent(state.email)}`)
      }
    } catch (err: unknown) {
      dispatch({ type: 'setError', value: err instanceof Error ? err.message : String(err) })
    } finally {
      if (mounted.current) dispatch({ type: 'setLoading', value: false })
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="grid min-h-[calc(100vh-120px)] grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative flex min-h-[420px] items-end overflow-hidden bg-black px-6 py-16 text-white lg:px-12">
          <div className="absolute inset-0 opacity-50">
            <div className="grid h-full grid-cols-3 gap-2 p-2">
              {[
                'https://images.unsplash.com/photo-1547891654-e66ed7ebb968?w=900',
                'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=900',
                'https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=900',
                'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=900',
                'https://images.unsplash.com/photo-1495567720989-cebdbdd97913?w=900',
                'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=900',
              ].map((src, index) => (
                <div
                  key={src}
                  className={`rounded-[28px] bg-cover bg-center ${index === 1 || index === 4 ? 'translate-y-10' : ''}`}
                  style={{ backgroundImage: `url(${src})` }}
                />
              ))}
            </div>
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.32),#000_88%)]" />
          <div className="relative max-w-xl">
            <div className="mb-4 text-[11px] uppercase tracking-[0.28em] text-zinc-500">Creative Archive</div>
            <h1 className="text-5xl font-black leading-none tracking-tight md:text-7xl">
              {isLogin ? 'Вход в архив' : 'Новый автор'}
            </h1>
            <p className="secondary-copy mt-5 max-w-md text-zinc-300">
              {isLogin
                ? 'Возвращайтесь к избранным работам, авторам и личной коллекции.'
                : 'Создайте профиль, чтобы сохранять работы и быть частью визуального архива.'}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-md">
            <div className="mb-8 flex rounded-full bg-zinc-100 p-1">
              <button
                type="button"
                onClick={() => dispatch({ type: 'setMode', value: 'login' })}
                className={`flex-1 rounded-full px-4 py-3 text-sm font-bold transition ${
                  isLogin ? 'bg-black text-white shadow-sm' : 'text-zinc-500 hover:text-black'
                }`}
              >
                Вход
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: 'setMode', value: 'register' })}
                className={`flex-1 rounded-full px-4 py-3 text-sm font-bold transition ${
                  !isLogin ? 'bg-black text-white shadow-sm' : 'text-zinc-500 hover:text-black'
                }`}
              >
                Регистрация
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <label className="relative block">
                  <UserRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={state.fullName}
                    onChange={handleChange('fullName')}
                    required
                    placeholder="Ваше имя"
                    className={fieldClass}
                  />
                </label>
              )}

              <label className="relative block">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  value={state.email}
                  onChange={handleChange('email')}
                  required
                  placeholder="Email"
                  className={fieldClass}
                />
              </label>

              <label className="relative block">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="password"
                  value={state.password}
                  onChange={handleChange('password')}
                  required
                  minLength={isLogin ? 6 : 8}
                  placeholder="Пароль"
                  className={fieldClass}
                />
              </label>

              {!isLogin && (
                <>
                  <label className="relative block">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="password"
                      value={state.confirmPassword}
                      onChange={handleChange('confirmPassword')}
                      required
                      minLength={8}
                      placeholder="Повторите пароль"
                      className={fieldClass}
                    />
                  </label>

                  <div className="grid gap-2 rounded-[24px] bg-zinc-50 p-4">
                    {passwordChecks.map((check) => (
                      <div key={check.label} className={`flex items-center gap-2 text-xs font-semibold ${check.valid ? 'text-green-700' : 'text-zinc-400'}`}>
                        {check.valid ? <Check size={14} /> : <X size={14} />}
                        {check.label}
                      </div>
                    ))}
                    <div className={`flex items-center gap-2 text-xs font-semibold ${passwordsMatch ? 'text-green-700' : 'text-zinc-400'}`}>
                      {passwordsMatch ? <Check size={14} /> : <X size={14} />}
                      Пароли совпадают
                    </div>
                  </div>
                </>
              )}

              {state.error && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                  {state.error}
                </div>
              )}

              <button
                type="submit"
                disabled={state.loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-6 py-4 text-sm font-black text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {state.loading ? 'Загрузка...' : isLogin ? 'Войти' : 'Создать аккаунт'}
              </button>
            </form>

            <div className="secondary-copy mt-6 text-center text-sm text-zinc-500">
              {isLogin ? (
                <>
                  Нет аккаунта?{' '}
                  <button type="button" onClick={() => dispatch({ type: 'setMode', value: 'register' })} className="font-bold text-black">
                    Зарегистрироваться
                  </button>
                </>
              ) : (
                <>
                  Уже есть аккаунт?{' '}
                  <button type="button" onClick={() => dispatch({ type: 'setMode', value: 'login' })} className="font-bold text-black">
                    Войти
                  </button>
                </>
              )}
            </div>

            <div className="mt-8 text-center">
              <Link href="/feed" className="text-sm font-semibold text-zinc-500 transition hover:text-black">
                Смотреть архив без входа
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
