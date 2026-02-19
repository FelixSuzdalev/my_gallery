// app/admin/layout.tsx
'use client'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
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
    })()

    return () => { mounted = false }
  }, [router])

  if (loading) return <div className="p-8">Проверка доступа...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b py-4">
        <div className="max-w-[1200px] mx-auto px-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Admin Panel</h2>
          <nav className="flex gap-3">
            <a href="/admin" className="text-sm px-3 py-1 rounded hover:bg-gray-100">Dashboard</a>
            <a href="/admin/artworks" className="text-sm px-3 py-1 rounded hover:bg-gray-100">Artworks</a>
            <a href="/admin/authors" className="text-sm px-3 py-1 rounded hover:bg-gray-100">Authors</a>
          </nav>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}
