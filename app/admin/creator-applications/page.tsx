'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isSupabaseV2 } from '@/lib/supabase-schema-version'

type ApplicationStatus = 'pending' | 'approved' | 'rejected'

type CreatorApplication = {
  id: string
  applicant_id: string
  about: string
  portfolio_url: string | null
  social_url: string | null
  work_links: string[]
  status: ApplicationStatus
  admin_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  profiles?: {
    full_name?: string | null
    username?: string | null
    avatar_url?: string | null
    role?: string | null
  } | null
}

const statusLabels: Record<ApplicationStatus, string> = {
  pending: 'На рассмотрении',
  approved: 'Одобрена',
  rejected: 'Отклонена',
}

const statusClass: Record<ApplicationStatus, string> = {
  pending: 'bg-amber-50 text-amber-800',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
}

export default function AdminCreatorApplicationsPage() {
  const [applications, setApplications] = useState<CreatorApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({})
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({})

  const loadApplications = useCallback(async () => {
    if (!isSupabaseV2) {
      setApplications([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('creator_applications')
      .select(`
        id,
        applicant_id,
        about,
        portfolio_url,
        social_url,
        work_links,
        status,
        admin_note,
        reviewed_by,
        reviewed_at,
        created_at,
        profiles:applicant_id (
          full_name,
          username,
          avatar_url,
          role
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      alert('Не удалось загрузить заявки: ' + error.message)
      setApplications([])
    } else {
      setApplications((data ?? []) as unknown as CreatorApplication[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadApplications()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadApplications])

  const pendingCount = useMemo(() => applications.filter((application) => application.status === 'pending').length, [applications])

  async function updateStatus(application: CreatorApplication, status: ApplicationStatus) {
    if (updatingIds[application.id] || application.status !== 'pending') return

    setUpdatingIds((state) => ({ ...state, [application.id]: true }))

    const patch =
      status === 'rejected'
        ? { status, admin_note: rejectNotes[application.id]?.trim() || null }
        : { status, admin_note: null }

    const { error } = await supabase
      .from('creator_applications')
      .update(patch)
      .eq('id', application.id)

    if (error) {
      alert('Не удалось обновить заявку: ' + error.message)
    } else {
      await loadApplications()
    }

    setUpdatingIds((state) => {
      const next = { ...state }
      delete next[application.id]
      return next
    })
  }

  if (!isSupabaseV2) {
    return (
      <div className="space-y-6">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-8 text-center text-zinc-500 shadow-sm">
          Заявки авторов доступны только в Supabase V2.
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Модерация ролей</p>
            <h2 className="text-3xl font-black tracking-tight">Заявки авторов</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              Рассматривайте заявки пользователей на публикацию работ в галерее.
            </p>
          </div>

          <button
            onClick={() => void loadApplications()}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            <RefreshCw size={16} />
            Обновить
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Всего" value={applications.length} />
          <Stat label="На рассмотрении" value={pendingCount} />
          <Stat label="Одобрено" value={applications.filter((application) => application.status === 'approved').length} />
          <Stat label="Отклонено" value={applications.filter((application) => application.status === 'rejected').length} />
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-zinc-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Загрузка заявок...
          </div>
        ) : applications.length === 0 ? (
          <div className="py-20 text-center text-zinc-500">Заявок пока нет.</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {applications.map((application) => {
              const applicantName =
                application.profiles?.full_name || application.profiles?.username || application.applicant_id
              const busy = !!updatingIds[application.id]
              const canReview = application.status === 'pending'

              return (
                <article key={application.id} className="p-5">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {application.profiles?.avatar_url ? (
                            <img
                              src={application.profiles.avatar_url}
                              alt={applicantName}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500">
                              {applicantName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="truncate text-lg font-black">{applicantName}</h3>
                            <p className="text-xs text-zinc-500">
                              {application.profiles?.username ? `@${application.profiles.username}` : application.applicant_id}
                            </p>
                          </div>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass[application.status]}`}>
                          {statusLabels[application.status]}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {new Date(application.created_at).toLocaleString('ru-RU')}
                        </span>
                      </div>

                      <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-6 text-zinc-700">
                        {application.about}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {application.portfolio_url && <LinkPill href={application.portfolio_url}>Портфолио</LinkPill>}
                        {application.social_url && <LinkPill href={application.social_url}>Контакт</LinkPill>}
                        {application.work_links.map((link, index) => (
                          <LinkPill key={link} href={link}>
                            Работа {index + 1}
                          </LinkPill>
                        ))}
                      </div>

                      {application.admin_note && (
                        <p className="mt-4 rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                          Комментарий администратора: {application.admin_note}
                        </p>
                      )}
                    </div>

                    <div className="w-full space-y-3 lg:w-80">
                      <textarea
                        value={rejectNotes[application.id] ?? ''}
                        onChange={(event) => setRejectNotes((state) => ({ ...state, [application.id]: event.target.value }))}
                        className="min-h-24 w-full resize-y rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-black focus:ring-4 focus:ring-black/5 disabled:bg-zinc-100"
                        placeholder="Комментарий при отклонении"
                        disabled={!canReview || busy}
                      />
                      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                        <button
                          onClick={() => void updateStatus(application, 'approved')}
                          disabled={!canReview || busy}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Одобрить
                        </button>
                        <button
                          onClick={() => void updateStatus(application, 'rejected')}
                          disabled={!canReview || busy}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                          Отклонить
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-zinc-50 p-4">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-sm text-zinc-500">{label}</div>
    </div>
  )
}

function LinkPill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200 hover:text-black"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  )
}
