import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type CurrentProfile = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  role: string | null
  bio: string | null
  is_public: boolean | null
}

export type CurrentProfileResult = {
  user: User | null
  profile: CurrentProfile | null
  error: Error | null
}

const PROFILE_SELECT = 'id, full_name, username, avatar_url, role, bio, is_public'
const DEFAULT_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY_MS = 250

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function toError(value: unknown) {
  return value instanceof Error ? value : new Error(String(value))
}

export async function getCurrentProfile(options?: {
  attempts?: number
  retryDelayMs?: number
}): Promise<CurrentProfileResult> {
  const attempts = Math.min(Math.max(options?.attempts ?? DEFAULT_ATTEMPTS, 1), DEFAULT_ATTEMPTS)
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) return { user: null, profile: null, error: userError }

    const user = userData.user
    if (!user) return { user: null, profile: null, error: null }

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT)
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) return { user, profile: null, error: profileError }
      if (profile) return { user, profile: profile as CurrentProfile, error: null }

      if (attempt < attempts) await delay(retryDelayMs)
    }

    return { user, profile: null, error: null }
  } catch (error) {
    return { user: null, profile: null, error: toError(error) }
  }
}
