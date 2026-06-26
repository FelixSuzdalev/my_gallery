'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  TAG_CATEGORIES,
  TAG_LIMIT,
  mergeTagSuggestions,
  normalizeTag,
  normalizeTagList,
  validateTag,
} from '@/lib/tag-catalog'

type Props = {
  value: string[]
  onChange: (tags: string[]) => void
}

const chipBase = 'rounded-full px-3 py-1.5 text-sm font-semibold transition'

export default function ArtworkTagSelector({ value, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [existingTags, setExistingTags] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const selectedTags = useMemo(() => normalizeTagList(value), [value])

  useEffect(() => {
    let mounted = true

    async function loadExistingTags() {
      const { data, error: loadError } = await supabase.from('artworks').select('tags').limit(500)
      if (!mounted) return
      if (loadError) {
        console.warn('Не удалось загрузить существующие теги:', loadError.message)
        setExistingTags([])
        return
      }

      setExistingTags(
        normalizeTagList((data ?? []).flatMap((row: { tags?: string[] | null }) => row.tags ?? []))
      )
    }

    const timer = window.setTimeout(() => {
      void loadExistingTags()
    }, 0)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [])

  const suggestions = useMemo(() => {
    const search = normalizeTag(query)
    return mergeTagSuggestions(existingTags)
      .filter((tag) => !selectedTags.includes(tag))
      .filter((tag) => !search || tag.includes(search))
      .slice(0, 18)
  }, [existingTags, query, selectedTags])

  function addTag(rawTag: string) {
    const tag = normalizeTag(rawTag)
    const validationError = validateTag(tag)
    if (validationError) {
      setError(validationError)
      return
    }
    if (selectedTags.includes(tag)) {
      setError('Такой тег уже добавлен.')
      return
    }
    if (selectedTags.length >= TAG_LIMIT) {
      setError('Можно выбрать не больше 8 тегов.')
      return
    }

    setError(null)
    setQuery('')
    onChange([...selectedTags, tag])
  }

  function removeTag(tag: string) {
    setError(null)
    onChange(selectedTags.filter((item) => item !== tag))
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    addTag(query)
  }

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
      <div>
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-black focus:ring-4 focus:ring-black/5"
          placeholder="Найти тег или добавить свой через Enter"
        />
        <div className="mt-2 text-xs leading-5 text-zinc-500">Выберите от 1 до 8 тегов. Собственный тег: 2-32 символа.</div>
      </div>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-2 rounded-full bg-black py-1.5 pl-3 pr-1.5 text-sm font-semibold text-white">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="rounded-full p-1 text-white/75 hover:bg-white/15 hover:text-white" aria-label={`Удалить тег ${tag}`}>
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <div className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</div>}

      <div className="space-y-3">
        {query.trim() ? (
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Подсказки</div>
            <div className="flex flex-wrap gap-2">
              {suggestions.length > 0 ? suggestions.map((tag) => (
                <button key={tag} type="button" onClick={() => addTag(tag)} className={`${chipBase} bg-white text-zinc-700 hover:bg-black hover:text-white`}>
                  {tag}
                </button>
              )) : <span className="text-sm text-zinc-500">Нажмите Enter, чтобы добавить собственный тег.</span>}
            </div>
          </div>
        ) : (
          TAG_CATEGORIES.map((category) => (
            <div key={category.title}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">{category.title}</div>
              <div className="flex flex-wrap gap-2">
                {category.tags.map((tag) => {
                  const selected = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => selected ? removeTag(tag) : addTag(tag)}
                      className={`${chipBase} ${selected ? 'bg-black text-white' : 'bg-white text-zinc-700 hover:bg-zinc-200'}`}
                      aria-pressed={selected}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}