'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Bell, Calendar, ChevronDown, MapPin, Search, SlidersHorizontal, Ticket, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type EventStatus = 'active' | 'upcoming' | 'past'
type EventFilter = 'all' | EventStatus
type EventSort = 'date' | 'title' | 'location'

type RawEvent = {
  id: string
  title: string
  description: string | null
  location_name: string | null
  start_date: string
  end_date: string
  external_url: string | null
  created_at: string | null
}

type DisplayEvent = {
  id: string
  title: string
  description: string
  image: string
  type: string
  dateStart: string
  dateEnd: string
  location: string
  externalUrl: string | null
  status: EventStatus
}

const DEFAULT_EVENT_IMAGE =
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1200'

const STATUS_FILTERS: Array<{ id: EventFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'active', label: 'Идут сейчас' },
  { id: 'upcoming', label: 'Скоро' },
  { id: 'past', label: 'Архив' },
]

const STATUS_LABELS: Record<EventStatus, string> = {
  active: 'Идет сейчас',
  upcoming: 'Скоро',
  past: 'Архив',
}

function getTimeLeft(targetDate: string) {
  const distance = new Date(targetDate).getTime() - Date.now()
  if (distance < 0) return { days: 0, hours: 0, mins: 0 }

  return {
    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
    hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    mins: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
  }
}

async function loadRawEvents(): Promise<RawEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, description, location_name, start_date, end_date, external_url, created_at')
    .order('start_date', { ascending: true })

  if (error) throw error
  return (data ?? []) as RawEvent[]
}

function toDisplayEvent(item: RawEvent): DisplayEvent {
  const now = new Date()
  const start = new Date(item.start_date)
  const end = new Date(item.end_date)

  let status: EventStatus = 'upcoming'
  if (start <= now && end >= now) status = 'active'
  else if (end < now) status = 'past'

  return {
    id: item.id,
    title: item.title,
    description: item.description ?? 'Описание события скоро появится.',
    image: DEFAULT_EVENT_IMAGE,
    type: 'Событие',
    dateStart: item.start_date,
    dateEnd: item.end_date,
    location: item.location_name ?? 'Онлайн',
    externalUrl: item.external_url,
    status,
  }
}

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate))

  useEffect(() => {
    const timer = window.setInterval(() => setTimeLeft(getTimeLeft(targetDate)), 60000)
    return () => window.clearInterval(timer)
  }, [targetDate])

  return (
    <div className="flex gap-4 text-black">
      <TimePart value={timeLeft.days} label="дней" />
      <TimePart value={timeLeft.hours} label="часов" />
      <TimePart value={timeLeft.mins} label="мин" />
    </div>
  )
}

function TimePart({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-black">{value}</span>
      <span className="text-[11px] font-medium text-gray-400">{label}</span>
    </div>
  )
}

export default function EventsPage() {
  const [events, setEvents] = useState<DisplayEvent[]>([])
  const [statusFilter, setStatusFilter] = useState<EventFilter>('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [sort, setSort] = useState<EventSort>('date')
  const [query, setQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchEvents() {
      try {
        setLoading(true)
        setError(null)
        const rawEvents = await loadRawEvents()
        if (mounted) setEvents(rawEvents.map(toDisplayEvent))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Не удалось загрузить события'
        console.error('Events load error:', message)
        if (mounted) setError(message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    const timer = window.setTimeout(() => {
      void fetchEvents()
    }, 0)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [])

  const locations = useMemo(() => Array.from(new Set(events.map((event) => event.location))).sort(), [events])

  const filteredEvents = useMemo(() => {
    const search = query.trim().toLowerCase()

    return events
      .filter((event) => {
        const matchesSearch =
          !search ||
          `${event.title} ${event.description} ${event.location}`.toLowerCase().includes(search)
        const matchesStatus = statusFilter === 'all' || event.status === statusFilter
        const matchesLocation = locationFilter === 'all' || event.location === locationFilter
        return matchesSearch && matchesStatus && matchesLocation
      })
      .sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title)
        if (sort === 'location') return a.location.localeCompare(b.location)
        return new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
      })
  }, [events, locationFilter, query, sort, statusFilter])

  const hasActiveFilters =
    Boolean(query.trim()) ||
    statusFilter !== 'all' ||
    locationFilter !== 'all' ||
    sort !== 'date'

  const resetFilters = () => {
    setQuery('')
    setStatusFilter('all')
    setLocationFilter('all')
    setSort('date')
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="bg-black px-6 py-24 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 text-[11px] uppercase tracking-[0.28em] text-zinc-500">Creative Archive</div>
          <h1 className="text-5xl font-black leading-none tracking-tight md:text-7xl">
            События<span className="text-zinc-500">.</span>
          </h1>
          <p className="secondary-copy mt-5 max-w-xl text-zinc-300">
            Выставки, показы и встречи, которые добавляют контекст к работам и авторам архива.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="mb-12 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-600">
                Найдено: <span className="text-black">{filteredEvents.length}</span>
              </div>
              {statusFilter !== 'all' && (
                <span className="rounded-full bg-black px-4 py-3 text-sm font-semibold text-white">
                  {STATUS_FILTERS.find((item) => item.id === statusFilter)?.label}
                </span>
              )}
              {locationFilter !== 'all' && (
                <span className="rounded-full bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-600">
                  {locationFilter}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="rounded-full px-4 py-3 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-black"
                >
                  Сбросить
                </button>
              )}
              <button
                onClick={() => setFiltersOpen((value) => !value)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition ${
                  filtersOpen ? 'bg-black text-white' : 'bg-zinc-100 text-black hover:bg-zinc-200'
                }`}
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal size={16} />
                Поиск и фильтры
              </button>
            </div>
          </div>

          {filtersOpen && (
            <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full rounded-full border border-zinc-200 bg-zinc-100 py-3 pl-11 pr-10 text-sm font-medium text-black outline-none transition placeholder:text-zinc-400 focus:border-black focus:bg-white focus:ring-4 focus:ring-black/5"
                  placeholder="Поиск события, описания или места..."
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-black"
                    aria-label="Очистить поиск"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <SelectWrap>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as EventFilter)}
                  className="admin-filter-select"
                >
                  {STATUS_FILTERS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </SelectWrap>

              <SelectWrap>
                <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="admin-filter-select">
                  <option value="all">Все места</option>
                  {locations.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </SelectWrap>

              <SelectWrap>
                <select value={sort} onChange={(event) => setSort(event.target.value as EventSort)} className="admin-filter-select">
                  <option value="date">По дате</option>
                  <option value="title">По названию</option>
                  <option value="location">По месту</option>
                </select>
              </SelectWrap>
            </div>
          )}
        </section>

        {loading ? (
          <div className="py-20 text-center text-zinc-500">Загрузка...</div>
        ) : error ? (
          <div className="py-20 text-center text-red-600">{error}</div>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-zinc-300 py-20 text-center text-zinc-500">
            События не найдены.
          </div>
        ) : (
          <div className="space-y-28 pb-24">
            {filteredEvents.map((event) => (
              <section
                key={event.id}
                className="group relative grid grid-cols-1 items-start gap-12 lg:grid-cols-12"
              >
                <div className="relative aspect-[16/9] overflow-hidden rounded-[32px] bg-gray-100 lg:col-span-7">
                  <img
                    src={event.image}
                    alt={event.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute left-6 top-6">
                    <span
                      className={`rounded-full px-4 py-2 text-xs font-bold shadow-xl backdrop-blur-md ${
                        event.status === 'active'
                          ? 'bg-green-500 text-white'
                          : event.status === 'upcoming'
                            ? 'bg-white/90 text-black'
                            : 'bg-gray-500 text-white'
                      }`}
                    >
                      {STATUS_LABELS[event.status]}
                    </span>
                  </div>
                </div>

                <div className="flex h-full flex-col justify-center lg:col-span-5">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 text-gray-400">
                      <span className="text-xs font-bold">{event.type}</span>
                      <div className="h-px w-12 bg-gray-200" />
                    </div>

                    <h2 className="text-4xl font-black leading-none tracking-tight transition-colors group-hover:text-gray-600 md:text-5xl">
                      {event.title}
                    </h2>

                    <p className="secondary-copy max-w-md text-zinc-500">{event.description}</p>

                    <div className="space-y-4 border-t border-gray-100 pt-4">
                      <div className="flex items-center gap-3 text-sm font-medium">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        {new Date(event.dateStart).toLocaleDateString('ru-RU')} -{' '}
                        {new Date(event.dateEnd).toLocaleDateString('ru-RU')}
                      </div>
                      <div className="flex items-center gap-3 text-sm font-medium">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        {event.location}
                      </div>
                    </div>

                    {event.status !== 'past' && (
                      <div className="mt-8 border-t border-gray-100 pt-8">
                        <div className="flex items-center justify-between gap-8">
                          <div>
                            <p className="mb-2 text-xs font-semibold text-gray-400">
                              {event.status === 'active' ? 'До конца осталось:' : 'До начала осталось:'}
                            </p>
                            <CountdownTimer targetDate={event.status === 'active' ? event.dateEnd : event.dateStart} />
                          </div>
                          <a
                            href={event.externalUrl ?? '#'}
                            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-black text-white shadow-xl transition-transform hover:scale-110 active:scale-95"
                            aria-label="Открыть событие"
                          >
                            <Ticket className="h-6 w-6" />
                          </a>
                        </div>
                      </div>
                    )}

                    <div className="pt-4">
                      <a
                        href={event.externalUrl ?? '#'}
                        className="inline-flex items-center gap-2 text-sm font-bold transition-all hover:gap-4"
                      >
                        Подробнее о событии
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="relative mb-24 overflow-hidden rounded-[3rem] bg-black p-12 text-center text-white md:p-24">
          <div className="relative z-10 space-y-8">
            <h3 className="text-4xl font-black leading-none tracking-tight md:text-7xl">
              Не пропускай <br /> главные показы
            </h3>
            <p className="secondary-copy mx-auto max-w-sm text-zinc-400">
              Подпишись на уведомления о новых выставках и закрытых вечерах.
            </p>
            <div className="mx-auto flex max-w-md flex-col gap-4 md:flex-row">
              <input
                type="email"
                placeholder="email@example.com"
                className="flex-1 rounded-full border border-white/20 bg-white/10 px-8 py-4 text-sm font-medium outline-none transition-all focus:border-white"
              />
              <button className="flex items-center justify-center gap-2 rounded-full bg-white px-10 py-4 text-sm font-black text-black transition-colors hover:bg-gray-200">
                <Bell className="h-4 w-4" /> Следить
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function SelectWrap({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <style jsx>{`
        :global(.admin-filter-select) {
          width: 100%;
          appearance: none;
          border-radius: 999px;
          border: 1px solid rgb(228 228 231);
          background: white;
          padding: 0.75rem 2.5rem 0.75rem 1rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: black;
          outline: none;
        }
        :global(.admin-filter-select:focus) {
          border-color: black;
        }
      `}</style>
    </div>
  )
}
