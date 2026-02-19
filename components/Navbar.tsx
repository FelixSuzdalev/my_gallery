'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { LogOut, User as UserIcon, Loader2 } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'

export default function Navbar() {
  const [user, setUser] = useState<any>(null) // supabase user object
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null) // profile.role
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let mounted = true

    const getUser = async () => {
      setLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const u = session?.user ?? null
        if (!mounted) return
        setUser(u)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // fetch role from profiles whenever user changes
  useEffect(() => {
    let mounted = true
    if (!user) {
      setRole(null)
      return
    }

    (async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (error) {
          // не ломаем UX — просто не показываем админку
          console.warn('Failed to fetch profile role:', error.message)
          if (mounted) setRole(null)
          return
        }

        if (mounted) setRole(profile?.role ?? null)
      } catch (err) {
        console.warn('Failed to fetch profile role:', err)
        if (mounted) setRole(null)
      }
    })()

    return () => { mounted = false }
  }, [user])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setRole(null)
    router.refresh()
  }

  const avatarUrl = user?.user_metadata?.avatar_url
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0]

  // базовое навигационное меню (Favorites добавлен сюда)
  const navItems = [
    { name: 'Работы', href: '/feed' },
    { name: 'Авторы', href: '/authors' },
    { name: 'События', href: '/events' },
    { name: 'Избранное', href: '/favorites' }, // <-- новая страница
  ]

  const isAdmin = role === 'admin'

  return (
    <nav className="w-full flex justify-center py-6 sticky top-0 z-50">
      <div className="flex items-center gap-6 bg-white/80 backdrop-blur-md border border-gray-200 px-6 py-3 rounded-full shadow-md">

        {/* ЛОГО */}
        <Link href="/" className="text-slate-800 font-black tracking-tight text-sm hover:opacity-70 transition">
          CREATIVE ARCHIVE
        </Link>

        {/* КАПСУЛЬНОЕ МЕНЮ */}
        <div className="flex items-center bg-gray-100 rounded-full p-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all
                  ${isActive
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-200'}
                `}
              >
                {item.name}
              </Link>
            )
          })}

          {/* ссылка на админку — видна только admin */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`
                ml-2 px-3 py-1.5 text-xs font-semibold rounded-full transition-all
                ${pathname === '/admin' || pathname?.startsWith('/admin/') ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-200'}
              `}
            >
              Admin
            </Link>
          )}
        </div>

        {/* AUTH БЛОК */}
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        ) : user ? (
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover border"
              />
            ) : (
              <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center">
                <UserIcon className="w-4 h-4" />
              </div>
            )}

            <span className="text-xs font-medium hidden md:block max-w-[100px] truncate">
              {displayName}
            </span>

            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-500 transition"
              title="Выйти"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="bg-black text-white text-xs font-bold px-4 py-1.5 rounded-full hover:scale-105 transition"
          >
            Войти
          </Link>
        )}
      </div>
    </nav>
  )
}
