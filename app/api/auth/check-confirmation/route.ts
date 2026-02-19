// app/api/auth/check-confirmation/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    // Вызов RPC, который безопасно возвращает email_confirmed_at
    const { data, error } = await supabaseAdmin.rpc('get_user_by_email_safe', { p_email: email })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const user = Array.isArray(data) ? data[0] : data
    const confirmed = !!(user?.email_confirmed_at)
    return NextResponse.json({ confirmed })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
