'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FileCheck2, LayoutDashboard, Loader2, Paintbrush, Users, UserRoundCog } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

const ADMIN_NAV = [
  { href: '/admin', label: 'Обзор', icon: LayoutDashboard },
  { href: '/admin/artworks', label: 'Работы', icon: Paintbrush },
  { href: '/admin/authors', label: 'Авторы', icon: UserRoundCog },
  ...(isSupabaseV2 ? [{ href: '/admin/creator-applications', label: 'Заявки авторов', icon: FileCheck2 }] : []),
  { href: '/admin/users', label: 'Пользователи', icon: Users },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let mounted = true

    async function checkAccess() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.user) {
        router.push('/login')
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (error || profile?.role !== 'admin') {
        router.push('/')
        return
      }

      if (mounted) setLoading(false)
    }

    checkAccess()
    window.addEventListener('profile:updated', checkAccess)
    return () => {
      mounted = false
      window.removeEventListener('profile:updated', checkAccess)
    }
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-zinc-50 text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Проверка доступа...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6">
        <header className="mb-6 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-500">Creative Archive</p>
              <h1 className="text-2xl font-black tracking-tight">Панель администратора</h1>
            </div>

            <nav className="flex gap-2 overflow-x-auto rounded-full bg-zinc-100 p-1">
              {ADMIN_NAV.map((item) => {
                const Icon = item.icon
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active ? 'bg-black text-white shadow-sm' : 'text-zinc-600 hover:bg-white hover:text-black'
                    }`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </header>

        {children}
      </div>
    </div>
  )
}
