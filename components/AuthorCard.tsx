import AuthorCarousel from './AuthorCarousel'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

interface AuthorProps {
  id: string
  name: string
  bio: string
  avatar: string
  works: string[]
}

export default function AuthorCard({ id, name, bio, avatar, works }: AuthorProps) {
  return (
    <article className="gallery-card-motion archive-card-reveal group rounded-[32px] border border-zinc-200 bg-white p-6 text-black transition hover:border-black hover:shadow-xl">
      <div className="mb-7 flex items-center gap-5">
        <img
          src={avatar}
          alt={name}
          className="h-24 w-24 rounded-full border border-zinc-200 object-cover grayscale transition-all group-hover:grayscale-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h3 className="truncate text-3xl font-black tracking-normal">{name}</h3>
            <Link
              href={`/profile/${id}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700 transition hover:bg-black hover:text-white"
              aria-label={`Открыть профиль ${name}`}
            >
              <span className="hidden sm:inline">Профиль</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <p className="secondary-copy mt-2 line-clamp-3 text-base text-zinc-600">{bio}</p>
          <div className="mt-3 text-sm font-semibold text-zinc-400">{works.length} работ</div>
        </div>
      </div>

      <AuthorCarousel images={works} />
    </article>
  )
}
