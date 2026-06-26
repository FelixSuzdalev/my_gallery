import Link from 'next/link'

type InfoPageProps = {
  eyebrow?: string
  title: string
  description: string
  sections?: Array<{
    title: string
    text: string
  }>
  cta?: {
    label: string
    href: string
  }
}

export default function InfoPage({
  eyebrow = 'Creative Archive',
  title,
  description,
  sections = [],
  cta,
}: InfoPageProps) {
  return (
    <main className="min-h-screen bg-white text-black">
      <section className="bg-black px-6 py-24 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 text-[11px] uppercase tracking-[0.28em] text-zinc-500">{eyebrow}</div>
          <h1 className="max-w-4xl text-5xl font-black leading-none tracking-tight md:text-7xl">{title}</h1>
          <p className="secondary-copy mt-5 max-w-2xl text-zinc-300">{description}</p>
          {cta && (
            <Link href={cta.href} className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-zinc-200">
              {cta.label}
            </Link>
          )}
        </div>
      </section>

      {sections.length > 0 && (
        <section className="mx-auto grid max-w-7xl gap-5 px-6 py-12 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-black tracking-tight">{section.title}</h2>
              <p className="secondary-copy mt-3 text-zinc-500">{section.text}</p>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
