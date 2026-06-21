'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Loader2, LogOut } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS = [
  { name: 'РАБОТЫ', href: '/feed' },
  { name: 'АВТОРЫ', href: '/authors' },
  { name: 'СОБЫТИЯ', href: '/events' },
  { name: 'ИЗБРАННОЕ', href: '/favorites' },
]

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let mounted = true

    async function getUser() {
      setLoading(true)
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (mounted) setUser(session?.user ?? null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let mounted = true
    if (!user) {
      setRole(null)
      return
    }
    const userId = user.id

    async function getRole() {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single()

        if (error) {
          console.warn('Failed to fetch profile role:', error.message)
          if (mounted) setRole(null)
          return
        }

        if (mounted) setRole(profile?.role ?? null)
      } catch (err) {
        console.warn('Failed to fetch profile role:', err)
        if (mounted) setRole(null)
      }
    }

    void getRole()
    return () => {
      mounted = false
    }
  }, [user])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setRole(null)
    router.refresh()
  }

  const avatarUrl =
    typeof user?.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : null
  const fullName =
    typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null
  const displayName = fullName || user?.email?.split('@')[0]
  const initials = (displayName || user?.email || 'U').slice(0, 2).toUpperCase()
  const isAdmin = role === 'admin'

  return (
    <nav className="sticky top-0 z-50 flex w-full justify-center px-4 py-5">
      <div className="flex w-full max-w-[860px] items-center gap-4 rounded-full border border-white/40 bg-[#d7d7d7]/95 px-5 py-3 text-slate-800 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <Link href="/" className="shrink-0 text-sm font-black tracking-tight hover:opacity-70">
          CREATIVE ARCHIVE
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto rounded-full bg-white/85 px-4 py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 text-xs font-bold tracking-[0.12em] transition ${
                  isActive ? 'text-black' : 'text-slate-700 hover:text-black'
                }`}
              >
                {item.name}
              </Link>
            )
          })}

          {isAdmin && (
            <Link
              href="/admin"
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                pathname === '/admin' || pathname?.startsWith('/admin/') ? 'bg-black text-white' : 'text-slate-800'
              }`}
            >
              Admin
            </Link>
          )}
        </div>

        <div className="hidden h-8 w-px shrink-0 bg-white/70 md:block" />

        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-500" />
        ) : user ? (
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/profile" className="flex min-w-0 items-center gap-2 rounded-full transition hover:opacity-75">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="h-8 w-8 rounded-full border border-white object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-600 text-xs font-bold text-white ring-2 ring-white/80">
                  {initials}
                </div>
              )}

              <span className="hidden max-w-[72px] truncate text-xs font-medium text-slate-500 md:block">
                {displayName}
              </span>
            </Link>

            <button
              onClick={handleLogout}
              className="text-slate-400 transition hover:text-red-500"
              title="Выйти"
              aria-label="Выйти"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="shrink-0 rounded-full bg-black px-4 py-1.5 text-xs font-bold text-white transition hover:bg-zinc-800"
          >
            Войти
          </Link>
        )}
      </div>
    </nav>
  )
}
