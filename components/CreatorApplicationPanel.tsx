'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2, Plus, Send, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type CreatorApplication = {
  id: string
  applicant_id: string
  about: string
  portfolio_url: string | null
  social_url: string | null
  work_links: string[]
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
}

type Props = {
  profileId: string
}

const inputClass =
  'w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-black focus:ring-4 focus:ring-black/5'

const statusLabels: Record<CreatorApplication['status'], string> = {
  pending: 'На рассмотрении',
  approved: 'Одобрена',
  rejected: 'Отклонена',
}

export default function CreatorApplicationPanel({ profileId }: Props) {
  const [applications, setApplications] = useState<CreatorApplication[]>([])
  const [about, setAbout] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [socialUrl, setSocialUrl] = useState('')
  const [workLinks, setWorkLinks] = useState([''])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const latestApplication = applications[0] ?? null
  const pendingApplication = applications.find((application) => application.status === 'pending') ?? null
  const canSubmit = !pendingApplication

  const previousApplications = useMemo(() => applications.filter((application) => application.status !== 'pending'), [applications])

  const loadApplications = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('creator_applications')
      .select('id, applicant_id, about, portfolio_url, social_url, work_links, status, admin_note, created_at, reviewed_at')
      .eq('applicant_id', profileId)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Не удалось загрузить заявки автора:', error.message)
      setApplications([])
    } else {
      setApplications((data ?? []) as CreatorApplication[])
    }
    setLoading(false)
  }, [profileId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadApplications()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadApplications])

  function updateWorkLink(index: number, value: string) {
    setWorkLinks((state) => state.map((link, itemIndex) => (itemIndex === index ? value : link)))
  }

  function addWorkLink() {
    setWorkLinks((state) => (state.length >= 5 ? state : [...state, '']))
  }

  function removeWorkLink(index: number) {
    setWorkLinks((state) => {
      const next = state.filter((_, itemIndex) => itemIndex !== index)
      return next.length > 0 ? next : ['']
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const normalizedAbout = about.trim()
    const normalizedPortfolioUrl = portfolioUrl.trim()
    const normalizedSocialUrl = socialUrl.trim()
    const normalizedWorkLinks = workLinks.map((link) => link.trim()).filter(Boolean)
    const validationError = validateApplication({
      about: normalizedAbout,
      portfolioUrl: normalizedPortfolioUrl,
      socialUrl: normalizedSocialUrl,
      workLinks: normalizedWorkLinks,
    })

    if (validationError) {
      alert(validationError)
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('creator_applications').insert({
      applicant_id: profileId,
      about: normalizedAbout,
      portfolio_url: normalizedPortfolioUrl || null,
      social_url: normalizedSocialUrl || null,
      work_links: normalizedWorkLinks,
      status: 'pending',
    })

    if (error) {
      alert('Не удалось отправить заявку: ' + getApplicationErrorMessage(error))
    } else {
      setAbout('')
      setPortfolioUrl('')
      setSocialUrl('')
      setWorkLinks([''])
      await loadApplications()
    }
    setSubmitting(false)
  }

  return (
    <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-500">Роль автора</p>
          <h2 className="text-2xl font-black tracking-tight">Стать автором</h2>
          <p className="secondary-copy mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Расскажите о себе и покажите несколько работ. После одобрения вы сможете публиковать работы в галерее.
          </p>
        </div>
        {latestApplication && (
          <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700">
            {statusLabels[latestApplication.status]}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка заявки...
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {pendingApplication && (
            <ApplicationStatus application={pendingApplication} />
          )}

          {!canSubmit && (
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Новую заявку можно отправить после решения администратора.
            </div>
          )}

          {canSubmit && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {latestApplication?.status === 'rejected' && (
                <ApplicationStatus application={latestApplication} />
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-zinc-900">О себе и направлении</span>
                <textarea
                  value={about}
                  onChange={(event) => setAbout(event.target.value)}
                  className={`${inputClass} min-h-28 resize-y`}
                  placeholder="Расскажите, чем вы занимаетесь, какие темы и техники вам близки."
                  required
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-zinc-900">Портфолио</span>
                  <input
                    value={portfolioUrl}
                    onChange={(event) => setPortfolioUrl(event.target.value)}
                    className={inputClass}
                    placeholder="https://..."
                    type="url"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-zinc-900">Соцсеть или контакт</span>
                  <input
                    value={socialUrl}
                    onChange={(event) => setSocialUrl(event.target.value)}
                    className={inputClass}
                    placeholder="https://..."
                    type="url"
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-zinc-900">Ссылки на работы</span>
                  <button
                    type="button"
                    onClick={addWorkLink}
                    disabled={workLinks.length >= 5}
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Добавить
                  </button>
                </div>

                {workLinks.map((link, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      value={link}
                      onChange={(event) => updateWorkLink(index, event.target.value)}
                      className={inputClass}
                      placeholder="https://..."
                      type="url"
                      required={index === 0}
                    />
                    {workLinks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWorkLink(index)}
                        className="rounded-full border border-zinc-200 p-3 text-zinc-500 transition hover:bg-zinc-100 hover:text-black"
                        aria-label="Удалить ссылку"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <p className="text-xs leading-5 text-zinc-500">Добавьте от 1 до 5 ссылок на примеры работ.</p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? 'Отправка...' : 'Отправить заявку'}
              </button>
            </form>
          )}

          {previousApplications.length > 1 && (
            <div className="space-y-2 border-t border-zinc-100 pt-4">
              <h3 className="text-sm font-bold text-zinc-900">История заявок</h3>
              {previousApplications.slice(1).map((application) => (
                <ApplicationStatus key={application.id} application={application} compact />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function ApplicationStatus({ application, compact = false }: { application: CreatorApplication; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-zinc-50 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-700">
          {statusLabels[application.status]}
        </span>
        <span className="text-xs text-zinc-500">
          {new Date(application.created_at).toLocaleDateString('ru-RU')}
        </span>
      </div>
      {!compact && <p className="secondary-copy mt-3 text-sm leading-6 text-zinc-600">{application.about}</p>}
      {application.admin_note && (
        <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm text-zinc-600">
          Комментарий администратора: {application.admin_note}
        </p>
      )}
      {!compact && application.work_links.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {application.work_links.map((link) => (
            <a
              key={link}
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-700 transition hover:text-black"
            >
              Работа <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function validateApplication({
  about,
  portfolioUrl,
  socialUrl,
  workLinks,
}: {
  about: string
  portfolioUrl: string
  socialUrl: string
  workLinks: string[]
}) {
  if (!about) return 'Расскажите о себе и творческом направлении.'
  if (workLinks.length < 1) return 'Добавьте минимум одну ссылку на работу.'
  if (workLinks.length > 5) return 'Можно добавить не больше 5 ссылок на работы.'

  const urls = [portfolioUrl, socialUrl, ...workLinks].filter(Boolean)
  if (urls.some((url) => !isValidHttpUrl(url))) return 'Ссылки должны быть корректными URL с http:// или https://.'
  return null
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function getApplicationErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
    return 'У вас уже есть заявка на рассмотрении.'
  }
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return JSON.stringify(error)
}
