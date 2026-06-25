'use client'

import { useDevRolePreview, type PreviewRole } from '@/lib/dev-role-preview'

const options: Array<{ value: PreviewRole; label: string }> = [
  { value: 'real', label: 'Реальная роль' },
  { value: 'user', label: 'Обычный пользователь' },
  { value: 'creator', label: 'Автор' },
  { value: 'admin', label: 'Администратор' },
]

export default function DevRolePreview() {
  const { previewRole, setPreviewRole } = useDevRolePreview(null)

  if (process.env.NODE_ENV !== 'development') return null

  return (
    <aside className="fixed bottom-4 left-4 z-[80] max-w-[calc(100vw-2rem)] rounded-2xl border border-amber-300 bg-amber-50 p-3 text-black shadow-2xl">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-amber-900">
        Локальный предпросмотр интерфейса — реальные права не изменены
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setPreviewRole(option.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              previewRole === option.value ? 'bg-black text-white' : 'bg-white text-zinc-700 hover:bg-amber-100'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </aside>
  )
}
