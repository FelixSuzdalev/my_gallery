import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

type AdminUserBody = {
  mode?: 'invite' | 'create'
  email?: string
  password?: string
  full_name?: string
  username?: string
  role?: 'user' | 'creator' | 'admin'
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function getClients() {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing public Supabase env vars')
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

  return {
    authClient: createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } }),
    adminClient: createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } }),
  }
}

async function requireAdmin(request: NextRequest) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null
  if (!token) return { error: jsonError('Нужна авторизация администратора.', 401) }

  const { authClient, adminClient } = getClients()
  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  if (userError || !userData.user) return { error: jsonError('Сессия недействительна.', 401) }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, deleted_at')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError) return { error: jsonError('Не удалось проверить роль администратора.', 500) }
  if (!profile || profile.role !== 'admin' || profile.deleted_at) {
    return { error: jsonError('Доступ разрешён только администратору.', 403) }
  }

  return { adminClient, adminUserId: userData.user.id }
}

function normalizeEmail(value?: string) {
  return (value ?? '').trim().toLowerCase()
}

function normalizeName(value?: string) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeUsername(value?: string) {
  return (value ?? '').trim().toLowerCase()
}

function validateUserBody(body: AdminUserBody) {
  const mode = body.mode === 'invite' ? 'invite' : body.mode === 'create' ? 'create' : null
  const email = normalizeEmail(body.email)
  const fullName = normalizeName(body.full_name)
  const username = normalizeUsername(body.username)
  const role = body.role ?? 'user'
  const password = body.password ?? ''

  if (!mode) return { error: 'Выберите сценарий: приглашение или временный пароль.' }
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Укажите корректный email.' }
  if (!fullName) return { error: 'Укажите имя пользователя.' }
  if (!/^[a-z0-9_-]{3,32}$/.test(username)) {
    return { error: 'Username должен быть от 3 до 32 символов: латиница, цифры, подчёркивание или дефис.' }
  }
  if (!['user', 'creator', 'admin'].includes(role)) return { error: 'Некорректная роль пользователя.' }
  if (mode === 'create' && password.length < 8) return { error: 'Временный пароль должен быть не короче 8 символов.' }

  return { value: { mode, email, fullName, username, role, password } }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('error' in auth) return auth.error

    const searchParams = request.nextUrl.searchParams
    const query = (searchParams.get('q') ?? '').trim().toLowerCase()
    const roleFilter = searchParams.get('role') ?? 'all'

    const { data: profiles, error: profilesError } = await auth.adminClient
      .from('profiles')
      .select('id, full_name, username, avatar_url, role, deleted_at, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (profilesError) return jsonError('Не удалось загрузить профили: ' + profilesError.message, 500)

    const { data: usersData, error: usersError } = await auth.adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (usersError) return jsonError('Не удалось загрузить email пользователей: ' + usersError.message, 500)

    const emailById = new Map((usersData.users ?? []).map((user) => [user.id, user.email ?? '']))
    const items = (profiles ?? [])
      .map((profile) => ({ ...profile, email: emailById.get(profile.id) ?? '' }))
      .filter((profile) => roleFilter === 'all' || profile.role === roleFilter)
      .filter((profile) => {
        if (!query) return true
        const haystack = `${profile.email} ${profile.username ?? ''} ${profile.full_name ?? ''}`.toLowerCase()
        return haystack.includes(query)
      })

    return NextResponse.json({ users: items })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return jsonError(message, 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('error' in auth) return auth.error

    const parsed = validateUserBody((await request.json()) as AdminUserBody)
    if ('error' in parsed) return jsonError(parsed.error ?? 'Некорректные данные пользователя.')

    const { mode, email, fullName, username, role, password } = parsed.value

    if (role === 'admin') {
      const { data: currentAdminProfile, error: currentAdminError } = await auth.adminClient
        .from('profiles')
        .select('role, deleted_at')
        .eq('id', auth.adminUserId)
        .maybeSingle()

      if (currentAdminError) return jsonError('Не удалось повторно проверить права администратора.', 500)
      if (!currentAdminProfile || currentAdminProfile.role !== 'admin' || currentAdminProfile.deleted_at) {
        return jsonError('Создать администратора может только действующий администратор.', 403)
      }
    }

    const { data: existingUsername, error: usernameError } = await auth.adminClient
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .is('deleted_at', null)
      .limit(1)

    if (usernameError) return jsonError('Не удалось проверить username: ' + usernameError.message, 500)
    if (existingUsername && existingUsername.length > 0) return jsonError('Такой username уже занят.', 409)

    const authResult = mode === 'invite'
      ? await auth.adminClient.auth.admin.inviteUserByEmail(email, {
          data: { full_name: fullName, username, role },
        })
      : await auth.adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, username },
        })

    if (authResult.error) return jsonError(authResult.error.message, 400)
    if (!authResult.data.user) return jsonError('Supabase не вернул созданного пользователя.', 500)

    const { error: profileError } = await auth.adminClient
      .from('profiles')
      .upsert({
        id: authResult.data.user.id,
        full_name: fullName,
        username,
        role,
        is_public: true,
        deleted_at: null,
      }, { onConflict: 'id' })

    if (profileError) return jsonError('Пользователь создан, но профиль не сохранён: ' + profileError.message, 500)

    return NextResponse.json({
      user: {
        id: authResult.data.user.id,
        email: authResult.data.user.email,
        full_name: fullName,
        username,
        role,
      },
      message: mode === 'invite' ? 'Приглашение отправлено.' : 'Пользователь создан с временным паролем.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return jsonError(message, 500)
  }
}