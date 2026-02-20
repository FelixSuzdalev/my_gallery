'use client'

import { useCallback, useReducer, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type State = {
  isLogin: boolean
  email: string
  password: string
  fullName: string
  loading: boolean
  error: string | null
}

type Action =
  | { type: 'setField'; field: keyof State; value: string }
  | { type: 'setLoading'; value: boolean }
  | { type: 'setError'; value: string | null }
  | { type: 'toggleMode' }

const initialState: State = {
  isLogin: true,
  email: '',
  password: '',
  fullName: '',
  loading: false,
  error: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setField':
      return { ...state, [action.field]: action.value }
    case 'setLoading':
      return { ...state, loading: action.value }
    case 'setError':
      return { ...state, error: action.value }
    case 'toggleMode':
      return { ...state, isLogin: !state.isLogin, error: null }
    default:
      return state
  }
}

export default function LoginPage() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const router = useRouter()
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const handleChange = useCallback(
    (field: keyof State) =>
      (e: React.ChangeEvent<HTMLInputElement>) =>
        dispatch({ type: 'setField', field, value: e.target.value }),
    []
  )

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    dispatch({ type: 'setError', value: null })
    dispatch({ type: 'setLoading', value: true })

    try {
      if (state.isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: state.email,
          password: state.password,
        })
        if (error) throw error
        router.push('/feed')
      } else {
        const { error } = await supabase.auth.signUp({
          email: state.email,
          password: state.password,
          options: {
            data: {
              full_name: state.fullName,
              avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                state.fullName || state.email
              )}`,
            },
          },
        })
        if (error) throw error

        // Перенаправляем на страницу "Проверьте почту"
        router.push(`/auth/check-email?email=${encodeURIComponent(state.email)}`)
      }
    } catch (err: any) {
      dispatch({ type: 'setError', value: err?.message ?? String(err) })
    } finally {
      if (mounted.current) dispatch({ type: 'setLoading', value: false })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="relative max-w-md w-full bg-white p-8 rounded-3xl shadow-2xl overflow-hidden">

        {/* Заменяем чёрный ползун на мягкий полупрозрачный градиент */}
        <div
          aria-hidden
          className={`absolute inset-0 transition-transform duration-600 ease-in-out pointer-events-none
            ${state.isLogin ? '-translate-x-[110%]' : 'translate-x-0'}`}
          style={{
            background:
              'linear-gradient(135deg, rgba(255,183,77,0.10) 0%, rgba(147,51,234,0.10) 50%, rgba(59,130,246,0.08) 100%)',
            transformOrigin: 'left center',
            mixBlendMode: 'multiply',
            filter: 'blur(18px)',
          }}
        />

        <div className="relative z-10">
          <div className="text-center mb-6 transition-all duration-300">
            <h1 className="text-3xl font-extrabold uppercase tracking-tight text-slate-800">
              {state.isLogin ? 'С возвращением' : 'Создать аккаунт'}
            </h1>
            <p className="text-slate-800 text-xs mt-2 uppercase tracking-wide">
              {state.isLogin ? 'Войдите в систему Admin: felixsuzdalev@yandex.ru Пароль: ~9db.-GY@embhM5'  : 'Присоединяйтесь к сообществу'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            <div
              className={`transition-all duration-500 ${
                state.isLogin ? 'opacity-0 -translate-y-2 h-0 overflow-hidden' : 'opacity-100 translate-y-0'
              }`}
            >
              {!state.isLogin && (
                <div className="relative">
                  <input
                    type="text"
                    value={state.fullName}
                    onChange={handleChange('fullName')}
                    required
                    placeholder="Ваше имя"
                    className="peer w-full bg-white px-4 pt-6 pb-2 rounded-xl border border-gray-300 text-sm font-medium text-black placeholder-transparent focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition"
                  />
                  <label className="absolute left-4 top-2 text-xs text-gray-500 transition-all
                    peer-placeholder-shown:top-4 
                    peer-placeholder-shown:text-sm
                    peer-focus:top-2 
                    peer-focus:text-xs 
                    peer-focus:text-black">
                    Ваше имя
                  </label>
                </div>
              )}
            </div>

            <div className="relative">
              <input
                type="email"
                value={state.email}
                onChange={handleChange('email')}
                required
                placeholder="Email"
                className="peer w-full bg-white px-4 pt-6 pb-2 rounded-xl border border-gray-300 text-sm font-medium text-black placeholder-transparent focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition"
              />
              <label className="absolute left-4 top-2 text-xs text-gray-500 transition-all
                peer-placeholder-shown:top-4 
                peer-placeholder-shown:text-sm
                peer-focus:top-2 
                peer-focus:text-xs 
                peer-focus:text-black">
                Email
              </label>
            </div>

            <div className="relative">
              <input
                type="password"
                value={state.password}
                onChange={handleChange('password')}
                required
                placeholder="Пароль"
                className="peer w-full bg-white px-4 pt-6 pb-2 rounded-xl border border-gray-300 text-sm font-medium text-black placeholder-transparent focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition"
              />
              <label className="absolute left-4 top-2 text-xs text-gray-500 transition-all
                peer-placeholder-shown:top-4 
                peer-placeholder-shown:text-sm
                peer-focus:top-2 
                peer-focus:text-xs 
                peer-focus:text-black">
                Пароль
              </label>
            </div>

            {state.error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-lg text-center animate-pulse">
                {state.error}
              </div>
            )}

            <button
              type="submit"
              disabled={state.loading}
              className="w-full bg-black text-white py-3 rounded-xl font-semibold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition transform"
            >
              {state.loading ? 'Загрузка...' : state.isLogin ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => dispatch({ type: 'toggleMode' })}
              className="text-xs text-gray-500 uppercase tracking-wide hover:text-black transition"
            >
              {state.isLogin ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
