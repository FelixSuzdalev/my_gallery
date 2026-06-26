import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

export const dynamic = 'force-dynamic'

type DemoRole = 'user' | 'creator' | 'admin'

type DemoRoleBody = {
  role?: unknown
  pin?: unknown
}

const allowedRoles = new Set<DemoRole>(['user', 'creator', 'admin'])

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function getConfig() {
  const isV2 = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA_VERSION === 'v2'
  const enabled = process.env.DEMO_ROLE_SWITCHER_ENABLED === 'true'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const demoUserId = process.env.DEMO_ROLE_SWITCHER_USER_ID
  const demoPin = process.env.DEMO_ROLE_SWITCHER_PIN

  if (!isV2 || !enabled || !supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !demoUserId || !demoPin) {
    return null
  }

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey, demoUserId, demoPin }
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization')
  return authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null
}

function pinsMatch(value: string, expected: string) {
  const valueBuffer = Buffer.from(value)
  const expectedBuffer = Buffer.from(expected)
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer)
}

async function requireDemoUser(request: NextRequest) {
  const config = getConfig()
  if (!config) return { error: jsonError('Демонстрационный режим недоступен.', 404) }

  const token = getBearerToken(request)
  if (!token) return { error: jsonError('Нужна авторизация.', 401) }

  const authClient = createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: false } })
  const adminClient = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false } })

  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userData.user) return { error: jsonError('Сессия недействительна.', 401) }

  if (userData.user.id !== config.demoUserId) {
    return { error: jsonError('Переключатель доступен только демонстрационному аккаунту.', 403) }
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, deleted_at')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError) return { error: jsonError('Не удалось проверить профиль демонстрационного аккаунта.', 500) }
  if (!profile || profile.deleted_at) return { error: jsonError('Демонстрационный профиль недоступен.', 403) }

  return { adminClient, config, userId: userData.user.id, role: profile.role as DemoRole }
}

export async function GET(request: NextRequest) {
  const auth = await requireDemoUser(request)
  if ('error' in auth) return auth.error

  return NextResponse.json({ available: true, role: auth.role })
}

export async function POST(request: NextRequest) {
  const auth = await requireDemoUser(request)
  if ('error' in auth) return auth.error

  let body: DemoRoleBody
  try {
    body = (await request.json()) as DemoRoleBody
  } catch {
    return jsonError('Некорректный JSON.', 400)
  }

  const keys = Object.keys(body)
  if (keys.some((key) => key !== 'role' && key !== 'pin')) {
    return jsonError('Запрос может содержать только role и pin.', 400)
  }

  if (typeof body.role !== 'string' || !allowedRoles.has(body.role as DemoRole)) {
    return jsonError('Выберите роль: user, creator или admin.', 400)
  }

  if (typeof body.pin !== 'string' || !pinsMatch(body.pin, auth.config.demoPin)) {
    return jsonError('Неверный PIN демонстрационного режима.', 403)
  }

  const nextRole = body.role as DemoRole
  const { data, error } = await auth.adminClient
    .from('profiles')
    .update({ role: nextRole })
    .eq('id', auth.userId)
    .select('role')
    .maybeSingle()

  if (error) return jsonError('Не удалось изменить роль: ' + error.message, 500)
  if (!data) return jsonError('Демонстрационный профиль не найден.', 404)

  return NextResponse.json({ role: data.role })
}
