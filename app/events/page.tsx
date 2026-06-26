'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Calendar, Edit3, Loader2, MapPin, Plus, Save, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

type EventStatus = 'active' | 'upcoming' | 'past'
type EventFilter = 'all' | 'active' | 'upcoming'
type EventSort = 'date' | 'title' | 'location'
type DbEventStatus = 'draft' | 'published' | 'archived' | 'hidden'

type RawEvent = {
  id: string
  title: string
  description: string | null
  location_name: string | null
  start_date: string
  end_date: string
  external_url: string | null
  image_url?: string | null
  status?: DbEventStatus | null
  created_at: string | null
}

type DisplayEvent = {
  id: string
  title: string
  description: string
  image: string
  dateStart: string
  dateEnd: string
  location: string
  externalUrl: string | null
  status: EventStatus
}

type EventFormState = {
  title: string
  description: string
  location_name: string
  start_date: string
  end_date: string
  external_url: string
  image_url: string
  status: DbEventStatus
}

const DEFAULT_EVENT_IMAGE = 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1200'
const emptyEventForm: EventFormState = {
  title: '',
  description: '',
  location_name: '',
  start_date: '',
  end_date: '',
  external_url: '',
  image_url: '',
  status: 'published',
}

const statusFilters: Array<{ id: EventFilter; label: string }> = [
  { id: 'all', label: 'Все актуальные' },
  { id: 'active', label: 'Идут сейчас' },
  { id: 'upcoming', label: 'Скоро' },
]

const statusLabels: Record<EventStatus, string> = {
  active: 'Идет сейчас',
  upcoming: 'Скоро',
  past: 'Архив',
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
    image: item.image_url || DEFAULT_EVENT_IMAGE,
    dateStart: item.start_date,
    dateEnd: item.end_date,
    location: item.location_name ?? 'Онлайн',
    externalUrl: item.external_url,
    status,
  }
}

function formatEventRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${formatter.format(new Date(startDate))} - ${formatter.format(new Date(endDate))}`
}

function toDatetimeLocal(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

async function loadPublicEvents() {
  const select = isSupabaseV2
    ? 'id, title, description, location_name, start_date, end_date, external_url, image_url, status, created_at'
    : 'id, title, description, location_name, start_date, end_date, external_url, created_at'

  let query = supabase.from('events').select(select).order('start_date', { ascending: true })

  if (isSupabaseV2) {
    query = query.eq('status', 'published').gte('end_date', new Date().toISOString())
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as RawEvent[]
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
  const [isAdmin, setIsAdmin] = useState(false)
  const canShowAdminPanel = isAdmin

  const refreshPublicEvents = useCallback(async () => {
    const rawEvents = await loadPublicEvents()
    setEvents(rawEvents.map(toDisplayEvent).filter((event) => event.status !== 'past'))
  }, [])

  useEffect(() => {
    let mounted = true

    async function fetchEvents() {
      try {
        setLoading(true)
        setError(null)
        const rawEvents = await loadPublicEvents()
        if (mounted) setEvents(rawEvents.map(toDisplayEvent).filter((event) => event.status !== 'past'))
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Не удалось загрузить события'
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

  useEffect(() => {
    if (!isSupabaseV2) return
    let mounted = true

    async function checkAdmin() {
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) {
        if (mounted) setIsAdmin(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, deleted_at')
        .eq('id', userId)
        .maybeSingle()

      if (mounted) setIsAdmin(profile?.role === 'admin' && !profile.deleted_at)
    }

    const timer = window.setTimeout(() => {
      void checkAdmin()
    }, 0)
    window.addEventListener('profile:updated', checkAdmin)

    return () => {
      mounted = false
      window.clearTimeout(timer)
      window.removeEventListener('profile:updated', checkAdmin)
    }
  }, [])

  const locations = useMemo(() => Array.from(new Set(events.map((event) => event.location))).sort(), [events])

  const filteredEvents = useMemo(() => {
    const search = query.trim().toLowerCase()

    return events
      .filter((event) => {
        const matchesSearch = !search || `${event.title} ${event.description} ${event.location}`.toLowerCase().includes(search)
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

  const hasActiveFilters = Boolean(query.trim()) || statusFilter !== 'all' || locationFilter !== 'all' || sort !== 'date'

  return (
    <main className="min-h-screen bg-white text-black">
      <section className="bg-black px-6 py-24 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 text-[11px] uppercase tracking-[0.28em] text-zinc-500">Creative Archive</div>
          <h1 className="text-5xl font-black leading-none tracking-tight md:text-7xl">События</h1>
          <p className="secondary-copy mt-5 max-w-xl text-zinc-300">Выставки, показы и встречи, которые добавляют контекст к работам и авторам архива.</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {canShowAdminPanel && <AdminEventsPanel onChanged={() => void refreshPublicEvents()} />}

        <section className="mb-8 rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-600">Найдено: <span className="text-black">{filteredEvents.length}</span></div>
              {statusFilter !== 'all' && <span className="rounded-full bg-black px-4 py-3 text-sm font-semibold text-white">{statusFilters.find((item) => item.id === statusFilter)?.label}</span>}
              {locationFilter !== 'all' && <span className="rounded-full bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-600">{locationFilter}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasActiveFilters && <button onClick={() => { setQuery(''); setStatusFilter('all'); setLocationFilter('all'); setSort('date') }} className="rounded-full px-4 py-3 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-black">Сбросить</button>}
              <button onClick={() => setFiltersOpen((value) => !value)} className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition ${filtersOpen ? 'bg-black text-white' : 'bg-zinc-100 text-black hover:bg-zinc-200'}`} aria-expanded={filtersOpen}>
                <SlidersHorizontal size={16} /> Поиск и фильтры
              </button>
            </div>
          </div>

          {filtersOpen && (
            <div className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <label className="relative block">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-full border border-zinc-200 bg-zinc-100 py-3 pl-11 pr-10 text-sm font-medium text-black outline-none transition placeholder:text-zinc-400 focus:border-black focus:bg-white" placeholder="Поиск события, описания или места..." />
                {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-black" aria-label="Очистить поиск"><X size={16} /></button>}
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as EventFilter)} className="event-filter-select">{statusFilters.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
              <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="event-filter-select"><option value="all">Все места</option>{locations.map((location) => <option key={location} value={location}>{location}</option>)}</select>
              <select value={sort} onChange={(event) => setSort(event.target.value as EventSort)} className="event-filter-select"><option value="date">По дате</option><option value="title">По названию</option><option value="location">По месту</option></select>
            </div>
          )}
        </section>

        {loading ? (
          <div className="flex justify-center py-20 text-zinc-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : error ? (
          <div className="rounded-[28px] border border-red-100 bg-red-50 p-10 text-center text-red-700">{error}</div>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-zinc-300 py-20 text-center text-zinc-500">Актуальные опубликованные события не найдены.</div>
        ) : (
          <div className="space-y-12 pb-16">
            {filteredEvents.map((event) => (
              <article key={event.id} className="group grid grid-cols-1 items-start gap-8 rounded-[32px] border border-zinc-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_420px]">
                <div className="relative aspect-[16/9] overflow-hidden rounded-[28px] bg-gray-100">
                  <img src={event.image} alt={event.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <span className={`absolute left-5 top-5 rounded-full px-4 py-2 text-xs font-bold shadow-xl backdrop-blur-md ${event.status === 'active' ? 'bg-green-500 text-white' : 'bg-white/90 text-black'}`}>{statusLabels[event.status]}</span>
                </div>
                <div className="flex h-full flex-col justify-center p-2 lg:p-4">
                  <h2 className="text-3xl font-black tracking-tight md:text-4xl">{event.title}</h2>
                  <p className="secondary-copy mt-4 text-zinc-600">{event.description}</p>
                  <div className="mt-5 space-y-3 border-t border-zinc-100 pt-5 text-sm font-medium">
                    <div className="flex items-center gap-3"><Calendar className="h-4 w-4 text-zinc-400" />{formatEventRange(event.dateStart, event.dateEnd)}</div>
                    <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-zinc-400" />{event.location}</div>
                  </div>
                  {event.externalUrl && <a href={event.externalUrl} className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800">Подробнее <ArrowUpRight size={16} /></a>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        :global(.event-filter-select) {
          width: 100%;
          appearance: none;
          border-radius: 999px;
          border: 1px solid rgb(228 228 231);
          background: white;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: black;
          outline: none;
        }
      `}</style>
    </main>
  )
}

function AdminEventsPanel({ onChanged }: { onChanged: () => void }) {
  const [events, setEvents] = useState<RawEvent[]>([])
  const [form, setForm] = useState<EventFormState>(emptyEventForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAdminEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from('events')
      .select('id, title, description, location_name, start_date, end_date, external_url, image_url, status, created_at')
      .order('start_date', { ascending: false })

    if (loadError) {
      setError('Не удалось загрузить события для управления: ' + loadError.message)
      setEvents([])
    } else {
      setEvents((data ?? []) as unknown as RawEvent[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAdminEvents()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadAdminEvents])

  function startEdit(event: RawEvent) {
    setEditingId(event.id)
    setForm({
      title: event.title,
      description: event.description ?? '',
      location_name: event.location_name ?? '',
      start_date: toDatetimeLocal(event.start_date),
      end_date: toDatetimeLocal(event.end_date),
      external_url: event.external_url ?? '',
      image_url: event.image_url ?? '',
      status: event.status ?? 'published',
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyEventForm)
  }

  async function saveEvent(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      if (!form.title.trim()) throw new Error('Укажите название события.')
      if (!form.start_date || !form.end_date) throw new Error('Укажите даты начала и окончания.')
      if (new Date(form.end_date) < new Date(form.start_date)) throw new Error('Дата окончания не может быть раньше начала.')

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        location_name: form.location_name.trim() || null,
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
        external_url: form.external_url.trim() || null,
        image_url: form.image_url.trim() || null,
        status: form.status,
      }

      const { error: saveError } = editingId
        ? await supabase.from('events').update(payload).eq('id', editingId)
        : await supabase.from('events').insert(payload)

      if (saveError) throw saveError
      resetForm()
      await loadAdminEvents()
      onChanged()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить событие.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEvent(eventId: string) {
    if (!confirm('Удалить событие? Это действие нельзя отменить.')) return
    const { error: deleteError } = await supabase.from('events').delete().eq('id', eventId)
    if (deleteError) {
      setError('Не удалось удалить событие: ' + deleteError.message)
      return
    }
    await loadAdminEvents()
    onChanged()
  }

  return (
    <section className="mb-8 rounded-[28px] border border-zinc-200 bg-zinc-50 p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div><p className="text-sm font-semibold text-zinc-500">Администратор</p><h2 className="text-2xl font-black">Управление событиями</h2></div>
        <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-bold text-white"><Plus size={16} /> Новое событие</button>
      </div>
      {error && <div className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      <form onSubmit={saveEvent} className="mb-5 grid gap-3 lg:grid-cols-2">
        <input className="admin-event-input" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Название" required />
        <input className="admin-event-input" value={form.location_name} onChange={(event) => setForm((current) => ({ ...current, location_name: event.target.value }))} placeholder="Место или онлайн" />
        <input className="admin-event-input" type="datetime-local" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} required />
        <input className="admin-event-input" type="datetime-local" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} required />
        <input className="admin-event-input" value={form.external_url} onChange={(event) => setForm((current) => ({ ...current, external_url: event.target.value }))} placeholder="Ссылка" />
        <input className="admin-event-input" value={form.image_url} onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))} placeholder="URL изображения" />
        <select className="admin-event-input" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as DbEventStatus }))}>
          <option value="draft">Черновик</option><option value="published">Опубликовано</option><option value="hidden">Скрыто</option><option value="archived">Архив</option>
        </select>
        <textarea className="admin-event-input min-h-24 lg:col-span-2" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Описание" />
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={16} />}{editingId ? 'Сохранить изменения' : 'Создать событие'}</button>
          {editingId && <button type="button" onClick={resetForm} className="rounded-full border border-zinc-200 px-5 py-3 text-sm font-bold text-zinc-700">Отмена</button>}
        </div>
      </form>
      {loading ? <div className="py-6 text-center text-zinc-500">Загрузка...</div> : events.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-zinc-500">Событий пока нет.</div> : (
        <div className="grid gap-3 md:grid-cols-2">
          {events.map((event) => <article key={event.id} className="rounded-2xl border border-zinc-200 bg-white p-4"><div className="text-xs font-bold text-zinc-400">{event.status ?? 'status не задан'} · {formatEventRange(event.start_date, event.end_date)}</div><h3 className="mt-1 font-black">{event.title}</h3><p className="secondary-copy mt-1 text-sm text-zinc-500">{event.location_name || 'Место не указано'}</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => startEdit(event)} className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-2 text-sm font-bold text-zinc-700"><Edit3 size={14} />Изменить</button><button onClick={() => void deleteEvent(event.id)} className="inline-flex items-center gap-2 rounded-full border border-red-200 px-3 py-2 text-sm font-bold text-red-600"><Trash2 size={14} />Удалить</button></div></article>)}
        </div>
      )}
      <style jsx>{`:global(.admin-event-input){width:100%;border-radius:1rem;border:1px solid rgb(228 228 231);background:white;padding:.75rem 1rem;font-size:.875rem;color:black;outline:none}:global(.admin-event-input:focus){border-color:black}`}</style>
    </section>
  )
}
