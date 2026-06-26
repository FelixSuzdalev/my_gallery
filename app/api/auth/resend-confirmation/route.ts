
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'На сервере не настроено подключение к Supabase.' },
      { status: 500 }
    )
  }

  try {
    const { email } = await req.json()

    if (!email?.trim()) {
      return NextResponse.json(
        { error: 'Укажите адрес электронной почты.' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const origin = new URL(req.url).origin

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${origin}/login?confirmed=1`,
      },
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Не удалось обработать запрос.',
      },
      { status: 500 }
    )
  }
}

