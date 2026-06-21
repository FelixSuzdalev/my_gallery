'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Loader2, MailCheck } from 'lucide-react'

export default function CheckEmailClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function resend() {
    if (!email) {
      setMessage('Email не указан в ссылке.')
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || json?.message || 'Не удалось отправить письмо.')
      setMessage('Письмо отправлено повторно. Проверьте почту и папку спам.')
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function checkConfirmed() {
    if (!email) {
      setMessage('Email не указан в ссылке.')
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/auth/check-confirmation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()

      if (res.ok && json?.confirmed) {
        router.push('/login?confirmed=1')
        return
      }

      setMessage('Почта еще не подтверждена. Перейдите по ссылке в письме и нажмите проверку снова.')
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="flex min-h-[calc(100vh-120px)] items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg rounded-[32px] border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
            <MailCheck className="h-7 w-7 text-black" />
          </div>

          <h1 className="text-4xl font-black leading-none tracking-tight">Проверьте почту</h1>
          <p className="secondary-copy mx-auto mt-4 max-w-sm text-zinc-500">
            {email ? (
              <>
                Мы отправили письмо на <span className="font-semibold text-black">{email}</span>. Перейдите по ссылке, чтобы подтвердить адрес.
              </>
            ) : (
              'Email не найден в ссылке. Вернитесь к регистрации и попробуйте снова.'
            )}
          </p>

          {message && (
            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-700">
              {message}
            </div>
          )}

          <div className="mt-7 space-y-3">
            <button
              onClick={checkConfirmed}
              disabled={loading || !email}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-6 py-4 text-sm font-black text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Я подтвердил почту
            </button>
            <button
              onClick={resend}
              disabled={loading || !email}
              className="w-full rounded-full border border-zinc-200 px-6 py-4 text-sm font-bold text-black transition hover:bg-zinc-100 disabled:opacity-50"
            >
              Отправить письмо повторно
            </button>
            <button
              onClick={() => router.push('/login')}
              className="w-full rounded-full px-6 py-3 text-sm font-semibold text-zinc-500 transition hover:text-black"
            >
              Вернуться ко входу
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
