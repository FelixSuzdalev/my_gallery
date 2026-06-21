import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

type SafeUser = {
  email?: string | null
  email_confirmed_at?: string | null
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    const normalizedEmail = String(email).trim().toLowerCase()

    const rpcResult = await supabaseAdmin.rpc('get_user_by_email_safe', { p_email: normalizedEmail })
    if (!rpcResult.error) {
      const user = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data
      return NextResponse.json({ confirmed: Boolean(user?.email_confirmed_at) })
    }

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const user = (data.users as SafeUser[]).find((item) => item.email?.toLowerCase() === normalizedEmail)
    return NextResponse.json({ confirmed: Boolean(user?.email_confirmed_at) })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
