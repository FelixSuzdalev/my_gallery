'use client'

import { useCallback, useEffect, useState } from 'react'
import { Edit3, Loader2, MessageCircle, Send, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { refreshV2ArtworkStats } from '@/lib/v2-content'
import type { ArtworkStatsCounts } from '@/lib/artwork-stats'

type CommentProfile = {
  username?: string | null
  full_name?: string | null
  avatar_url?: string | null
}

type CommentRow = {
  id: string
  artwork_id: string
  author_id: string
  body: string
  status: 'visible' | 'hidden' | 'deleted' | 'pending'
  created_at?: string | null
  updated_at?: string | null
  profiles?: CommentProfile | null
}

type Props = {
  artworkId: string
  commentsEnabled?: boolean
  onStatsChange?: (stats: ArtworkStatsCounts) => void
  className?: string
  tone?: 'light' | 'dark'
}

function getAuthorName(comment: CommentRow) {
  return comment.profiles?.full_name || comment.profiles?.username || 'Участник'
}

export default function ArtworkComments({ artworkId, commentsEnabled = true, onStatsChange, className = '', tone = 'light' }: Props) {
  const [comments, setComments] = useState<CommentRow[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingBody, setEditingBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const isDark = tone === 'dark'

  const refreshStats = useCallback(async () => {
    const stats = await refreshV2ArtworkStats(artworkId)
    onStatsChange?.(stats)
  }, [artworkId, onStatsChange])

  const loadComments = useCallback(async () => {
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()
    setCurrentUserId(sessionData.session?.user?.id ?? null)

    const { data, error } = await supabase
      .from('comments')
      .select(`
        id,
        artwork_id,
        author_id,
        body,
        status,
        created_at,
        updated_at,
        profiles:author_id ( username, full_name, avatar_url )
      `)
      .eq('artwork_id', artworkId)
      .eq('status', 'visible')
      .order('created_at', { ascending: true })

    if (error) {
      console.warn('Comments load warning:', error.message)
      setComments([])
    } else {
      setComments((data ?? []) as unknown as CommentRow[])
    }

    setLoading(false)
  }, [artworkId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadComments()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadComments])

  async function submitComment(event: React.FormEvent) {
    event.preventDefault()
    const text = body.trim()
    if (!text || saving) return

    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id ?? null
    if (!userId) {
      alert('Войдите, чтобы оставить комментарий.')
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('comments')
      .insert({ artwork_id: artworkId, author_id: userId, body: text, status: 'visible' })

    if (error) {
      alert(`Не удалось отправить комментарий: ${error.message}`)
    } else {
      setBody('')
      await loadComments()
      await refreshStats()
    }
    setSaving(false)
  }

  async function saveEdit(commentId: string) {
    const text = editingBody.trim()
    if (!text || saving) return

    setSaving(true)
    const { error } = await supabase.from('comments').update({ body: text, status: 'visible' }).eq('id', commentId)

    if (error) {
      alert(`Не удалось обновить комментарий: ${error.message}`)
    } else {
      setEditingId(null)
      setEditingBody('')
      await loadComments()
      await refreshStats()
    }
    setSaving(false)
  }

  async function softDelete(commentId: string) {
    if (saving) return
    setSaving(true)
    const { error } = await supabase.from('comments').update({ status: 'deleted' }).eq('id', commentId)

    if (error) {
      alert(`Не удалось удалить комментарий: ${error.message}`)
    } else {
      await loadComments()
      await refreshStats()
    }
    setSaving(false)
  }

  return (
    <section className={`${className} ${isDark ? 'text-white' : 'text-black'}`}>
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <MessageCircle size={16} />
        Комментарии
      </div>

      {loading ? (
        <div className={`flex items-center gap-2 rounded-2xl p-4 text-sm ${isDark ? 'bg-white/10 text-white/70' : 'bg-zinc-50 text-zinc-500'}`}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Загрузка комментариев...
        </div>
      ) : comments.length === 0 ? (
        <div className={`rounded-2xl p-4 text-sm ${isDark ? 'bg-white/10 text-white/65' : 'bg-zinc-50 text-zinc-500'}`}>
          Комментариев пока нет.
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const isOwn = Boolean(currentUserId && comment.author_id === currentUserId)
            const isEditing = editingId === comment.id

            return (
              <article key={comment.id} className={`rounded-2xl p-4 ${isDark ? 'bg-white/10' : 'bg-zinc-50'}`}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">{getAuthorName(comment)}</div>
                    {comment.created_at && (
                      <div className={`text-xs ${isDark ? 'text-white/45' : 'text-zinc-400'}`}>
                        {new Date(comment.created_at).toLocaleDateString('ru-RU')}
                      </div>
                    )}
                  </div>

                  {commentsEnabled && isOwn && !isEditing && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(comment.id)
                          setEditingBody(comment.body)
                        }}
                        className={`rounded-full p-2 transition ${isDark ? 'hover:bg-white/10' : 'hover:bg-white'}`}
                        aria-label="Редактировать комментарий"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void softDelete(comment.id)}
                        className={`rounded-full p-2 transition ${isDark ? 'hover:bg-white/10' : 'hover:bg-white'}`}
                        aria-label="Удалить комментарий"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingBody}
                      onChange={(event) => setEditingBody(event.target.value)}
                      className="min-h-20 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-black outline-none focus:border-black"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void saveEdit(comment.id)}
                        className="rounded-full bg-black px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                        disabled={saving}
                      >
                        Сохранить
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null)
                          setEditingBody('')
                        }}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100"
                      >
                        <X size={13} />
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={`whitespace-pre-wrap text-sm leading-6 ${isDark ? 'text-white/80' : 'text-zinc-700'}`}>{comment.body}</p>
                )}
              </article>
            )
          })}
        </div>
      )}

      {commentsEnabled ? (
        <form onSubmit={submitComment} className="mt-4 flex gap-2">
          <input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className={`min-w-0 flex-1 rounded-full border px-4 py-3 text-sm outline-none transition focus:ring-4 ${
              isDark
                ? 'border-white/10 bg-white text-black focus:ring-white/10'
                : 'border-zinc-200 bg-white text-black focus:border-black focus:ring-black/5'
            }`}
            placeholder={currentUserId ? 'Написать комментарий...' : 'Войдите, чтобы комментировать'}
            disabled={!currentUserId || saving}
          />
          <button
            type="submit"
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black text-white transition hover:bg-zinc-800 disabled:opacity-50"
            disabled={!currentUserId || saving || !body.trim()}
            aria-label="Отправить комментарий"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      ) : (
        <div className={`mt-4 rounded-2xl p-4 text-sm ${isDark ? 'bg-white/10 text-white/65' : 'bg-zinc-50 text-zinc-500'}`}>
          Комментарии отключены автором.
        </div>
      )}
    </section>
  )
}