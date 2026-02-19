// app/admin/page.tsx
import Link from 'next/link'

export default function AdminIndex() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Панель администратора</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/admin/artworks" className="p-6 bg-white rounded shadow">
          <h3 className="font-semibold">Управление работами</h3>
          <p className="text-sm text-gray-500 mt-2">Создавайте, редактируйте и удаляйте работы.</p>
        </Link>

        <Link href="/admin/authors" className="p-6 bg-white rounded shadow">
          <h3 className="font-semibold">Управление авторами</h3>
          <p className="text-sm text-gray-500 mt-2">Добавляйте и редактируйте профили авторов.</p>
        </Link>
      </div>
    </div>
  )
}
