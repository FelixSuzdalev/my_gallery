import Link from 'next/link'

const navigationLinks = [
  { label: 'Галерея', href: '/gallery' },
  { label: 'Авторы', href: '/authors' },
  { label: 'Подборки', href: '/collections' },
  { label: 'Поиск', href: '/search' },
]

const infoLinks = [
  { label: 'FAQ', href: '/faq' },
  { label: 'Контакты', href: '/contacts' },
  { label: 'Помощь', href: '/help' },
  { label: 'О проекте', href: '/about' },
]

const marqueeItems = [
  'НЕ ЛЕНТА',
  'НЕ СОЦСЕТЬ',
  'ВИРТУАЛЬНАЯ ГАЛЕРЕЯ',
  'CREATIVE ARCHIVE',
  'ИС-43',
  'SUPABASE + NEXT.JS',
]

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black px-6 py-14 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="archive-marquee mb-12 border-y border-white/10 py-4 text-zinc-500">
          <div className="archive-marquee-track gap-8">
            {[...marqueeItems, ...marqueeItems, ...marqueeItems].map((item, index) => (
              <span key={`${item}-${index}`} className="shrink-0 text-xs font-black uppercase tracking-[0.28em]">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr_0.75fr]">
          <div>
            <Link href="/" className="text-3xl font-black tracking-tight transition hover:text-zinc-300 md:text-5xl">
              CREATIVE ARCHIVE
            </Link>
            <p className="secondary-copy mt-5 max-w-md text-zinc-400">
              Виртуальная галерея для художников, фотографов и дизайнеров. Работы, авторы, события и личные подборки в одном визуальном архиве.
            </p>
          </div>

          <FooterColumn title="Навигация" links={navigationLinks} />
          <FooterColumn title="Информация" links={infoLinks} />
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-zinc-500 md:flex-row md:items-center md:justify-between">
          <p>Разработал Феликс Суздалев, студент МГГТК АГУ группы ИС-43.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="transition hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-white">
              Terms
            </Link>
            <span>{new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: Array<{ label: string; href: string }>
}) {
  return (
    <div>
      <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{title}</h3>
      <nav className="space-y-3">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="block text-sm font-semibold text-zinc-300 transition hover:text-white">
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
