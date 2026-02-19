'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import AuthorCard from '@/components/AuthorCard'

export default function AuthorsPage() {
  const [authors, setAuthors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAuthors = async () => {
    setLoading(true)
    
    // Запрос к Supabase: берем авторов и их работы
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, 
        full_name, 
        bio, 
        avatar_url,
        artworks ( image_url )
      `)
      .eq('role', 'creator') 

    if (error) {
      console.error('Ошибка БД:', error)
      setError(error.message)
    } else if (data) {
      // Форматируем данные под наш компонент AuthorCard
      const formattedAuthors = data.map(auth => ({
        id: auth.id,
        name: auth.full_name || 'Анонимный автор',
        bio: auth.bio || 'Описание отсутствует',
        avatar: auth.avatar_url || 'https://via.placeholder.com/150',
        works: auth.artworks?.map((art: any) => art.image_url) || []
      }))
      setAuthors(formattedAuthors)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchAuthors()
  }, [])

  return (
    <main className="min-h-screen bg-white text-black">
      
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-12 tracking-tighter">АВТОРЫ КОМЬЮНИТИ</h1>
        
        {loading && <p className="text-gray-500">Загрузка талантов из базы...</p>}
        
        {error && <p className="text-red-500">Ошибка подключения: {error}</p>}

        {!loading && authors.length === 0 && (
          <div className="border-2 border-dashed p-10 text-center">
            <p className="text-gray-400">В базе пока нет авторов с ролью "creator".</p>
            <p className="text-sm">Проверь таблицу profiles в Supabase!</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {authors.map(author => (
            <AuthorCard key={author.id} {...author} />
          ))}
        </div>
      </div>
    </main>
  )
}