import Link from 'next/link'
import { ArrowUpRight, Paintbrush, Users, UserRoundCog } from 'lucide-react'

const CARDS = [
  {
    href: '/admin/artworks',
    title: 'Работы',
    text: 'Добавление, редактирование, поиск, фильтры и проверка заполненности карточек.',
    icon: Paintbrush,
  },
  {
    href: '/admin/authors',
    title: 'Авторы',
    text: 'Назначение авторов, редактирование профилей и аватаров.',
    icon: UserRoundCog,
  },
  {
    href: '/admin/users',
    title: 'Пользователи',
    text: 'Просмотр пользовательских профилей и управление ролями.',
    icon: Users,
  },
]

export default function AdminIndex() {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">Рабочая область</p>
        <h2 className="mt-1 text-3xl font-black tracking-tight">Управление галереей</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          Здесь собраны основные административные сценарии: публикация работ, управление авторами
          и проверка пользовательских профилей перед показом проекта.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {CARDS.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-black"
            >
              <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-black">
                <Icon size={20} />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black tracking-tight">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{card.text}</p>
                </div>
                <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-zinc-400 transition group-hover:text-black" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
