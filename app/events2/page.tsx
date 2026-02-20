'use client'
import React, { useState, useEffect } from 'react'
import { Calendar, MapPin, ArrowUpRight, Ticket, Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Тип для события, который ожидает компонент
interface DisplayEvent {
  id: string
  title: string
  description: string
  image: string          // пока заглушка, можно добавить поле в БД позже
  type: string           // тоже заглушка
  dateStart: string      // start_date из БД
  dateEnd: string        // end_date из БД
  location: string       // location_name из БД
  status: 'active' | 'upcoming' | 'past'
}

// Функция загрузки из БД (возвращает сырые данные)
async function loadRawEvents(): Promise<any[]> {
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, title, description, location_name, start_date, end_date, external_url, created_at'
    )
  if (error) throw error
  return data || []
}

// Компонент таймера (без изменений)
const CountdownTimer = ({ targetDate }: { targetDate: string }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0 })

  useEffect(() => {
    const calculateTime = () => {
      const distance = new Date(targetDate).getTime() - new Date().getTime()
      if (distance < 0) {
        return { days: 0, hours: 0, mins: 0 }
      }
      return {
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        mins: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
      }
    }

    setTimeLeft(calculateTime())
    const timer = setInterval(() => setTimeLeft(calculateTime()), 60000)
    return () => clearInterval(timer)
  }, [targetDate])

  return (
    <div className="flex gap-4 text-black">
      <div className="flex flex-col">
        <span className="text-2xl font-black">{timeLeft.days}</span>
        <span className="text-[10px] uppercase font-bold text-gray-400">Дней</span>
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-black">{timeLeft.hours}</span>
        <span className="text-[10px] uppercase font-bold text-gray-400">Часов</span>
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-black">{timeLeft.mins}</span>
        <span className="text-[10px] uppercase font-bold text-gray-400">Мин</span>
      </div>
    </div>
  )
}

const EventsPage = () => {
  const [events, setEvents] = useState<DisplayEvent[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming'>('all')
  const [loading, setLoading] = useState(true)

  // Загрузка данных при монтировании
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true)
        const rawEvents = await loadRawEvents()

        // Преобразуем поля БД в формат для отображения
        const transformed: DisplayEvent[] = rawEvents.map((item) => {
          const now = new Date()
          const start = new Date(item.start_date)
          const end = new Date(item.end_date)

          let status: 'active' | 'upcoming' | 'past' = 'upcoming'
          if (start <= now && end >= now) status = 'active'
          else if (end < now) status = 'past'

          return {
            id: item.id,
            title: item.title,
            description: item.description,
            image: '/images/placeholder.jpg',   // пока заглушка
            type: 'Событие',                     // заглушка
            dateStart: item.start_date,
            dateEnd: item.end_date,
            location: item.location_name,
            status,
          }
        })

        setEvents(transformed)
      } catch (error: any) {
        console.error('Ошибка загрузки:', error.message)
        alert('Не удалось загрузить события')
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [])

  // Фильтрация
  const filteredEvents = events.filter((e) => {
    if (filter === 'all') return true
    return e.status === filter
  })

  return (
    <main className="min-h-screen bg-white text-black pt-20">
      <div className="max-w-7xl mx-auto px-6">
        {/* Заголовок страницы */}
        <header className="mb-16">
          <h1 className="text-[8vw] md:text-[5vw] font-black uppercase leading-[0.8] tracking-tighter mb-8">
            События<span className="text-gray-200">.</span>
          </h1>
          <div className="flex gap-4 border-b border-gray-100 pb-8">
            {[
              { id: 'all', label: 'Все' },
              { id: 'active', label: 'Идут сейчас' },
              { id: 'upcoming', label: 'Скоро' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                  filter === f.id ? 'bg-black text-white' : 'text-gray-400 hover:text-black'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </header>

        {/* Список событий */}
        {loading ? (
          <div className="text-center py-20">Загрузка...</div>
        ) : (
          <div className="space-y-32 pb-32">
            {filteredEvents.map((event) => (
              <section
                key={event.id}
                className="group relative grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
              >
                {/* Левая часть: Изображение и Статус */}
                <div className="lg:col-span-7 relative overflow-hidden rounded-2xl aspect-[16/9] bg-gray-100">
                  <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-6 left-6">
                    <span
                      className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] shadow-xl backdrop-blur-md ${
                        event.status === 'active'
                          ? 'bg-green-500 text-white'
                          : event.status === 'upcoming'
                          ? 'bg-white/90 text-black'
                          : 'bg-gray-500 text-white' // для past
                      }`}
                    >
                      {event.status === 'active'
                        ? '• Live Now'
                        : event.status === 'upcoming'
                        ? 'Upcoming'
                        : 'Archived'}
                    </span>
                  </div>
                </div>

                {/* Правая часть: Контент */}
                <div className="lg:col-span-5 flex flex-col h-full justify-center">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 text-gray-400">
                      <span className="text-xs font-bold uppercase tracking-[0.3em]">{event.type}</span>
                      <div className="w-12 h-[1px] bg-gray-200"></div>
                    </div>

                    <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none group-hover:text-gray-600 transition-colors">
                      {event.title}
                    </h2>

                    <p className="text-gray-500 text-sm leading-relaxed max-w-md italic">
                      {event.description}
                    </p>

                    <div className="space-y-4 pt-4 border-t border-gray-50">
                      <div className="flex items-center gap-3 text-sm font-medium">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {new Date(event.dateStart).toLocaleDateString('ru-RU')} —{' '}
                        {new Date(event.dateEnd).toLocaleDateString('ru-RU')}
                      </div>
                      <div className="flex items-center gap-3 text-sm font-medium">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {event.location}
                      </div>
                    </div>

                    {/* Таймер (только для active/upcoming) */}
                    {event.status !== 'past' && (
                      <div className="pt-8 border-t border-gray-100 mt-8">
                        <div className="flex items-center justify-between gap-8">
                          <div>
                            <p className="text-[10px] font-bold uppercase text-gray-400 mb-2">
                              {event.status === 'active'
                                ? 'До конца осталось:'
                                : 'До начала осталось:'}
                            </p>
                            <CountdownTimer
                              targetDate={
                                event.status === 'active' ? event.dateEnd : event.dateStart
                              }
                            />
                          </div>
                          <button className="flex-shrink-0 w-16 h-16 bg-black rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform active:scale-95 group/btn shadow-xl">
                            <Ticket className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="pt-6">
                      <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:gap-4 transition-all group/link">
                        Подробнее о событии
                        <ArrowUpRight className="w-4 h-4 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Фоновый номер для декора */}
                <div className="absolute -bottom-10 -right-4 text-[15vw] font-black text-gray-100/30 -z-10 select-none pointer-events-none">
                  0{typeof event.id === 'string' ? event.id.slice(0, 2) : event.id}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Секция подписки (без изменений) */}
        <section className="bg-black text-white rounded-[3rem] p-12 md:p-24 mb-32 text-center relative overflow-hidden">
          <div className="relative z-10 space-y-8">
            <h3 className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-none">
              Не пропускай <br /> главные показы
            </h3>
            <p className="text-gray-400 text-sm max-w-sm mx-auto uppercase tracking-widest font-bold">
              Подпишись на уведомления о новых выставках и закрытых вечеринках
            </p>
            <div className="flex flex-col md:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="EMAIL@EXAMPLE.COM"
                className="flex-1 bg-white/10 border border-white/20 rounded-full py-4 px-8 outline-none focus:border-white transition-all text-xs font-bold"
              />
              <button className="bg-white text-black px-10 py-4 rounded-full font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                <Bell className="w-4 h-4" /> Следить
              </button>
            </div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none"></div>
        </section>
      </div>
    </main>
  )
}

export default EventsPage