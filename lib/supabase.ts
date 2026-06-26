import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseBrowserKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_URL is required.')
}

if (!supabaseBrowserKey) {
  throw new Error('Missing Supabase configuration: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is required.')
}

export const supabase = createClient(supabaseUrl, supabaseBrowserKey)
