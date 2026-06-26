import { CalendarDays, Heart, Images, Search, ShieldCheck, UsersRound } from 'lucide-react'

const FEATURES = [
  {
    title: 'Архив работ',
    text: 'Лента визуальных проектов с крупными изображениями и быстрым просмотром.',
    icon: Images,
  },
  {
    title: 'Поиск по тегам',
    text: 'Фильтры помогают быстро найти стиль, автора или настроение.',
    icon: Search,
  },
  {
    title: 'Избранное',
    text: 'Пользователь собирает личную подборку работ, к которым хочется вернуться.',
    icon: Heart,
  },
  {
    title: 'Авторы',
    text: 'Отдельный раздел показывает художников, фотографов и дизайнеров.',
    icon: UsersRound,
  },
  {
    title: 'События',
    text: 'Выставки, показы и встречи можно вести через Supabase.',
    icon: CalendarDays,
  },
  {
    title: 'Администрирование',
    text: 'Контент, роли и профили управляются из закрытой панели.',
    icon: ShieldCheck,
  },
]

export default function PlatformFeatures() {
  return (
    <section className="bg-[#050505] px-6 py-24 text-white">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-12 flex flex-col justify-between gap-6 border-t border-white/10 pt-10 md:flex-row md:items-end">
          <div>
            <div className="mb-4 text-xs font-bold tracking-normal text-zinc-500">
              Возможности платформы
            </div>
            <h2 className="max-w-3xl text-4xl font-black leading-tight tracking-normal md:text-6xl">
              Не витрина, а рабочий архив
            </h2>
          </div>
          <p className="secondary-copy max-w-md text-zinc-400">
            Структура сайта собрана вокруг визуального контента: сначала работа, потом автор,
            контекст и действие.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <article key={feature.title} className="rounded-2xl border border-white/10 bg-[#080808] p-6 transition-colors hover:bg-[#101010]">
                <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-full border border-white/12 text-zinc-200">
                  <Icon size={18} />
                </div>
                <h3 className="mb-3 text-lg font-black tracking-normal text-white">{feature.title}</h3>
                <p className="secondary-copy text-sm text-zinc-400">{feature.text}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
