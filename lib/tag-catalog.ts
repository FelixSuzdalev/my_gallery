export type TagCategory = {
  title: string
  tags: string[]
}

export const TAG_CATEGORIES: TagCategory[] = [
  {
    title: 'Фотография',
    tags: ['портрет', 'пейзаж', 'город', 'архитектура', 'природа', 'уличная фотография', 'аналог', 'плёнка'],
  },
  {
    title: 'Направление',
    tags: ['абстракция', 'минимализм', 'цифровое искусство', '3d', 'коллаж', 'иллюстрация', 'дизайн'],
  },
  {
    title: 'Настроение и визуал',
    tags: ['свет', 'цвет', 'текстура', 'геометрия', 'ночь', 'атмосфера', 'движение', 'эксперимент'],
  },
  {
    title: 'Темы',
    tags: ['человек', 'мода', 'вода', 'музыка', 'путешествия', 'память', 'серия'],
  },
]

export const TAG_CATALOG_TAGS = Array.from(new Set(TAG_CATEGORIES.flatMap((category) => category.tags)))

export const TAG_LIMIT = 8
export const TAG_MIN_LENGTH = 2
export const TAG_MAX_LENGTH = 32

export function normalizeTag(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function normalizeTagList(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  values.forEach((value) => {
    const tag = normalizeTag(value)
    if (!tag || seen.has(tag)) return
    seen.add(tag)
    result.push(tag)
  })

  return result
}

export function validateTag(tag: string) {
  const normalized = normalizeTag(tag)
  if (!normalized) return 'Введите тег.'
  if (normalized.length < TAG_MIN_LENGTH) return 'Тег должен быть не короче 2 символов.'
  if (normalized.length > TAG_MAX_LENGTH) return 'Тег должен быть не длиннее 32 символов.'
  return null
}

export function validateArtworkTags(tags: string[]) {
  const normalized = normalizeTagList(tags)
  if (normalized.length < 1) return 'Добавьте хотя бы один тег.'
  if (normalized.length > TAG_LIMIT) return 'Можно выбрать не больше 8 тегов.'

  for (const tag of normalized) {
    const error = validateTag(tag)
    if (error) return error
  }

  return null
}

export function mergeTagSuggestions(existingTags: string[]) {
  return normalizeTagList([...TAG_CATALOG_TAGS, ...existingTags]).sort((a, b) => a.localeCompare(b, 'ru'))
}