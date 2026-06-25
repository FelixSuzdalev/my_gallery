'use client'

import InfoPage from '@/components/info/InfoPage'
import { PublicCollectionsBlock } from '@/components/V2Collections'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

export default function CollectionsPage() {
  if (!isSupabaseV2) {
    return (
      <InfoPage
        title="Подборки"
        description="Раздел для кураторских наборов работ. Сейчас он служит входом в избранное и будущие тематические коллекции."
        cta={{ label: 'Открыть избранное', href: '/favorites' }}
        sections={[
          {
            title: 'Личные подборки',
            text: 'Пользователь может сохранять понравившиеся работы и возвращаться к ним через страницу избранного.',
          },
          {
            title: 'Кураторский сценарий',
            text: 'В дальнейшем здесь можно разместить подборки по темам, техникам, авторам или событиям.',
          },
        ]}
      />
    )
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="bg-black px-6 py-24 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="mb-4 text-[11px] uppercase tracking-[0.28em] text-zinc-500">Creative Archive</p>
          <h1 className="text-5xl font-black leading-none tracking-tight md:text-7xl">Коллекции</h1>
          <p className="secondary-copy mt-5 max-w-xl text-zinc-300">
            Публичные авторские подборки из опубликованных работ галереи.
          </p>
        </div>
      </section>

      <PublicCollectionsBlock title="Публичные коллекции" />
    </main>
  )
}
