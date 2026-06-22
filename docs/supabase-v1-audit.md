# Supabase V1 Audit

Дата аудита: 2026-06-23  
Ветка: `feature/supabase-v2`  
Область анализа: `app/`, `components/`, `lib/`, `next.config.ts`, `package.json`.

## 1. Файлы, где используется Supabase

Прямой импорт/создание Supabase клиента:

- `lib/supabase.ts`
- `lib/search.ts`
- `components/AuthForm.tsx`
- `components/FeaturedCollections.tsx`
- `components/Hero.tsx`
- `components/NagModal.tsx`
- `components/Navbar.tsx`
- `components/admin/ArtworkForm.tsx`
- `components/admin/AuthorForm.tsx`
- `components/admin/SelectUserModal.tsx`
- `app/admin/layout.tsx`
- `app/admin/artworks/page.tsx`
- `app/admin/authors/page.tsx`
- `app/admin/users/page.tsx`
- `app/api/auth/check-confirmation/route.ts`
- `app/api/auth/resend-confirmation/route.ts`
- `app/authors/page.tsx`
- `app/events/page.tsx`
- `app/favorites/page.tsx`
- `app/feed/page.tsx`
- `app/profile/page.tsx`
- `app/profile/[id]/page.tsx`

Связанные файлы без прямого клиента:

- `app/auth/check-email/CheckEmailClient.tsx` вызывает `/api/auth/resend-confirmation` и `/api/auth/check-confirmation`.
- `components/FavoriteCard.tsx` отображает данные `artworks.image_url`, `profiles` и `favorites`, полученные в родительских компонентах.
- `app/core/models/types.tsx` содержит типы с `image_url`/`author_id`.
- `next.config.ts` содержит remote pattern для Supabase bucket host.
- `package.json` содержит зависимости Supabase.

## 2. Используемые переменные окружения

- `NEXT_PUBLIC_SUPABASE_URL`
  - `lib/supabase.ts`
  - `app/api/auth/resend-confirmation/route.ts`
  - `app/api/auth/check-confirmation/route.ts`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `lib/supabase.ts`
  - `app/api/auth/resend-confirmation/route.ts`
- `SUPABASE_SERVICE_ROLE_KEY`
  - `app/api/auth/check-confirmation/route.ts`
  - Используется серверным route handler для `supabaseAdmin.rpc(...)` и `supabaseAdmin.auth.admin.listUsers(...)`.

## 3. Таблицы Supabase, используемые в коде

- `profiles`
- `artworks`
- `favorites`
- `events`
- `collections`
- `collection_items`

Дополнительно используется:

- Storage bucket `avatars`
- RPC function `get_user_by_email_safe`
- Supabase Auth: `signInWithPassword`, `signUp`, `signOut`, `getSession`, `getUser`, `onAuthStateChange`, `auth.resend`, `auth.admin.listUsers`

## 4. Таблицы, поля и файлы запросов

### `profiles`

Читаемые поля:

- `id`
- `full_name`
- `username`
- `avatar_url`
- `role`
- `bio`
- Вложенно через связь из `artworks`: `profiles ( username, full_name )`
- Вложенно из `profiles`: `artworks ( image_url )`

Создаваемые поля:

- Прямого `insert` в `profiles` нет.
- `components/AuthForm.tsx` при `supabase.auth.signUp` передает metadata `full_name` и `avatar_url`; если в БД есть trigger на создание профиля, он может зависеть от этих metadata.

Изменяемые поля:

- `role`
  - `app/admin/authors/page.tsx`
- `full_name`, `username`, `avatar_url`, `bio`, `role`
  - `components/admin/AuthorForm.tsx`

Удаляемые записи:

- `profiles.delete().eq('id', id)`
  - `app/admin/authors/page.tsx`: удаление creator-профиля.
  - `app/admin/users/page.tsx`: удаление user-профиля.

Файлы запросов:

- `app/admin/layout.tsx`
- `app/admin/authors/page.tsx`
- `app/admin/users/page.tsx`
- `app/authors/page.tsx`
- `app/favorites/page.tsx`
- `app/profile/[id]/page.tsx`
- `components/Navbar.tsx`
- `components/FeaturedCollections.tsx`
- `components/admin/ArtworkForm.tsx`
- `components/admin/AuthorForm.tsx`
- `components/admin/SelectUserModal.tsx`
- `lib/search.ts` через связь `profiles`
- `app/feed/page.tsx` через связь `profiles`
- `app/admin/artworks/page.tsx` через связь `profiles:author_id`

### `artworks`

Читаемые поля:

- Явно: `id`, `title`, `description`, `image_url`, `author_id`, `tags`, `created_at`
- Через `select('*')`: потенциально все поля таблицы.
- Вложенно: `profiles ( username, full_name )`

Создаваемые поля:

- `title`
- `description`
- `image_url`
- `author_id`
- `tags`
- Файл: `components/admin/ArtworkForm.tsx`

Изменяемые поля:

- `title`
- `description`
- `image_url`
- `author_id`
- `tags`
- Файл: `components/admin/ArtworkForm.tsx`

Удаляемые записи:

- `artworks.delete().eq('id', id)`
- Файл: `app/admin/artworks/page.tsx`

Файлы запросов:

- `lib/search.ts`
- `app/feed/page.tsx`
- `app/favorites/page.tsx`
- `app/profile/[id]/page.tsx`
- `app/admin/artworks/page.tsx`
- `app/authors/page.tsx`
- `components/Hero.tsx`
- `components/admin/ArtworkForm.tsx`
- `components/FeaturedCollections.tsx` через `artwork:artworks(*)`

### `favorites`

Читаемые поля:

- `id`
- `user_id`
- `artwork_id`
- `*` только для count-запросов с `{ count: 'exact', head: true }`

Создаваемые поля:

- `user_id`
- `artwork_id`
- Файлы:
  - `app/feed/page.tsx`
  - `app/profile/[id]/page.tsx`

Изменяемые поля:

- Прямых `update` нет.

Удаляемые записи:

- `favorites.delete().eq('id', favId/existingFavId)`
- Файлы:
  - `app/feed/page.tsx`
  - `app/favorites/page.tsx`
  - `app/profile/[id]/page.tsx`

Файлы запросов:

- `lib/search.ts`
- `app/feed/page.tsx`
- `app/favorites/page.tsx`
- `app/profile/[id]/page.tsx`

### `events`

Читаемые поля:

- `id`
- `title`
- `description`
- `location_name`
- `start_date`
- `end_date`
- `external_url`
- `created_at`

Создаваемые поля:

- Прямых `insert` нет.

Изменяемые поля:

- Прямых `update` нет.

Удаляемые записи:

- Прямых `delete` нет.

Файлы запросов:

- `app/events/page.tsx`

### `collections`

Читаемые поля:

- `select('*')`, далее код использует `id`, `title`, `description`, `created_at`.

Создаваемые поля:

- `title`
- `description`
- Файл: `components/FeaturedCollections.tsx`

Изменяемые поля:

- Прямых `update` нет.

Удаляемые записи:

- Прямых `delete` нет.

Файлы запросов:

- `components/FeaturedCollections.tsx`

### `collection_items`

Читаемые поля:

- `select('*, artwork:artworks(*)')`, далее код использует `id`, `artwork`, `artwork.image_url`, `artwork.title`.
- Фильтр по `collection_id`.
- Сортировка по `position`.

Создаваемые поля:

- `collection_id`
- `artwork_id`
- `position`
- Файл: `components/FeaturedCollections.tsx`

Изменяемые поля:

- Прямых `update` нет.

Удаляемые записи:

- Прямых `delete` нет.

Файлы запросов:

- `components/FeaturedCollections.tsx`

## 5. Все запросы `select`, `insert`, `update`, `delete`

### `select`

- `lib/search.ts`
  - `artworks.select('*, profiles ( username, full_name )')` с `.or(...)`, `.contains('tags', ...)`, `.overlaps('tags', ...)`, `.order('created_at')`, `.range(...)`.
  - `favorites.select('id, artwork_id, user_id').in('artwork_id', artworkIds)`.
  - `favorites.select('artwork_id, id').eq('user_id', userId).in('artwork_id', artworkIds)`.
- `app/admin/layout.tsx`
  - `profiles.select('role').eq('id', session.user.id).single()`.
- `app/admin/artworks/page.tsx`
  - `artworks.select('id, title, description, image_url, author_id, tags, created_at, profiles:author_id ( full_name, username )').order('created_at')`.
- `app/admin/authors/page.tsx`
  - `profiles.select('id, full_name, username, avatar_url, role').eq('role', 'creator').order('full_name')`.
- `app/admin/users/page.tsx`
  - `profiles.select('id, full_name, username, avatar_url, role').eq('role', 'user').order('full_name')`.
- `components/admin/ArtworkForm.tsx`
  - `profiles.select('id, full_name, username').eq('role', 'creator').order('full_name')`.
- `components/admin/SelectUserModal.tsx`
  - `profiles.select('id, full_name, username, avatar_url').eq('role', 'user').order('full_name')`.
- `app/authors/page.tsx`
  - `profiles.select('id, full_name, bio, avatar_url, artworks ( image_url )').eq('role', 'creator')`.
- `app/events/page.tsx`
  - `events.select('id, title, description, location_name, start_date, end_date, external_url, created_at').order('start_date')`.
- `app/favorites/page.tsx`
  - `profiles.select('id, full_name, username, avatar_url, role').eq('id', uid).single()`.
  - `favorites.select('id, user_id, artwork_id').eq('user_id', uid)`.
  - `artworks.select('id, title, image_url, description, author_id, created_at, tags, profiles ( username, full_name )').in('id', artworkIds)`.
  - fallback: `artworks.select('id, title, image_url, description, author_id').in('id', artworkIds)`.
- `app/feed/page.tsx`
  - fallback: `artworks.select('*, profiles ( username, full_name )').order('created_at').limit(500)`.
  - `favorites.select('id, artwork_id, user_id').in('artwork_id', artworkIds)`.
  - `favorites.select('artwork_id, id').eq('user_id', userId).in('artwork_id', artworkIds)`.
  - `artworks.select('tags').limit(500)`.
  - `favorites.select('*', { count: 'exact', head: true }).eq('artwork_id', artworkId)`.
  - `favorites.insert(...).select('id, artwork_id').single()`.
  - duplicate fallback: `favorites.select('id, artwork_id').eq('user_id', user.id).eq('artwork_id', artworkId).maybeSingle()`.
- `app/profile/[id]/page.tsx`
  - `profiles.select('id, full_name, username, bio, avatar_url, role').eq('id' | 'username', profileKey).maybeSingle()`.
  - `artworks.select('id, title, image_url, description, author_id, created_at, tags, profiles ( username, full_name )').eq('author_id', nextProfile.id).order('created_at')`.
  - fallback: `artworks.select('id, title, image_url, description, author_id, created_at').eq('author_id', nextProfile.id).order('created_at')`.
  - `favorites.select('id, artwork_id, user_id').in('artwork_id', artworkIds)`.
  - `favorites.select('id, artwork_id').eq('user_id', userId).in('artwork_id', artworkIds)`.
  - `favorites.select('*', { count: 'exact', head: true }).eq('artwork_id', artworkId)`.
  - `favorites.insert(...).select('id, artwork_id').single()`.
- `components/FeaturedCollections.tsx`
  - `collections.select('*').order('created_at')`.
  - `collection_items.select('*, artwork:artworks(*)').eq('collection_id', collection.id).order('position').limit(9)`.
  - `profiles.select('role').eq('id', uid).single()`.
  - `collections.insert(...).select().single()`.
- `components/Hero.tsx`
  - `artworks.select('id, title, image_url').order('created_at').limit(9)`.
- `components/Navbar.tsx`
  - `profiles.select('role').eq('id', userId).single()`.

### `insert`

- `components/admin/ArtworkForm.tsx`
  - `artworks.insert({ title, description, image_url, author_id, tags })`.
- `app/feed/page.tsx`
  - `favorites.insert({ user_id: user.id, artwork_id: artworkId }).select('id, artwork_id').single()`.
- `app/profile/[id]/page.tsx`
  - `favorites.insert({ user_id: user.id, artwork_id: artworkId }).select('id, artwork_id').single()`.
- `components/FeaturedCollections.tsx`
  - `collections.insert({ title, description: desc }).select().single()`.
  - `collection_items.insert([{ collection_id, artwork_id, position }, ...])`.

### `update`

- `components/admin/ArtworkForm.tsx`
  - `artworks.update({ title, description, image_url, author_id, tags }).eq('id', initial.id)`.
- `components/admin/AuthorForm.tsx`
  - `profiles.update({ full_name, username, avatar_url, bio, role }).eq('id', form.id)`.
- `app/admin/authors/page.tsx`
  - `profiles.update({ role: 'creator' }).in('id', selectedIds)`.

### `delete`

- `app/admin/artworks/page.tsx`
  - `artworks.delete().eq('id', id)`.
- `app/admin/authors/page.tsx`
  - `profiles.delete().eq('id', id)`.
- `app/admin/users/page.tsx`
  - `profiles.delete().eq('id', id)`.
- `app/feed/page.tsx`
  - `favorites.delete().eq('id', existingFavId)`.
- `app/favorites/page.tsx`
  - `favorites.delete().eq('id', favId)`.
- `app/profile/[id]/page.tsx`
  - `favorites.delete().eq('id', existingFavId)`.

## 6. Изображения, `image_url`, `avatar_url`, public URL и Storage

### `image_url`

- `artworks.image_url` читается и отображается в:
  - `components/Hero.tsx`
  - `components/FavoriteCard.tsx`
  - `components/FeaturedCollections.tsx`
  - `app/admin/artworks/page.tsx`
  - `app/authors/page.tsx`
  - `app/favorites/page.tsx`
  - `app/feed/page.tsx`
  - `app/profile/[id]/page.tsx`
- `artworks.image_url` создается/изменяется в:
  - `components/admin/ArtworkForm.tsx`
- Типы с `image_url`:
  - `lib/search.ts`
  - `app/core/models/types.tsx`
  - несколько page/component-local type declarations.

### `avatar_url`

- Auth metadata `avatar_url` задается при регистрации:
  - `components/AuthForm.tsx`
- `profiles.avatar_url` читается/отображается в:
  - `app/admin/authors/page.tsx`
  - `app/admin/users/page.tsx`
  - `app/authors/page.tsx`
  - `app/favorites/page.tsx`
  - `app/profile/[id]/page.tsx`
  - `components/admin/AuthorForm.tsx`
  - `components/admin/SelectUserModal.tsx`
- `user.user_metadata.avatar_url` читается в:
  - `components/Navbar.tsx`
- `profiles.avatar_url` изменяется в:
  - `components/admin/AuthorForm.tsx`

### Storage и public URL

- Единственное прямое использование Supabase Storage:
  - `components/admin/AuthorForm.tsx`
  - bucket: `avatars`
  - upload: `supabase.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: false })`
  - public URL: `supabase.storage.from('avatars').getPublicUrl(path)`
  - результат `pub.publicUrl` записывается в `profiles.avatar_url`.

### Конфигурация изображений

- `next.config.ts` содержит remote pattern:
  - `your-supabase-bucket.supabase.co`
- В коде почти везде используется обычный `<img>`, а не `next/image`; поэтому `next.config.ts` может не влиять на текущий показ этих изображений, но станет важным при переходе на `next/image`.

## 7. API routes, связанные с авторизацией

- `app/api/auth/resend-confirmation/route.ts`
  - Метод: `POST`
  - Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Операция: `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo } })`
  - Redirect: `${origin}/login?confirmed=1`
- `app/api/auth/check-confirmation/route.ts`
  - Метод: `POST`
  - Env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - Операции:
    - `supabaseAdmin.rpc('get_user_by_email_safe', { p_email: normalizedEmail })`
    - fallback: `supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })`
  - Возвращает `{ confirmed: Boolean(email_confirmed_at) }`.
- `app/auth/check-email/CheckEmailClient.tsx`
  - Клиентский UI вызывает оба API route через `fetch`.

## 8. Проверки ролей пользователя и административного доступа

- `app/admin/layout.tsx`
  - Проверяет `supabase.auth.getSession()`.
  - Если нет `session.user`, редиректит на `/login`.
  - Читает `profiles.role` по `session.user.id`.
  - Если `role !== 'admin'`, редиректит на `/`.
- `components/Navbar.tsx`
  - Читает `profiles.role` текущего пользователя.
  - Показывает ссылку `Admin`, если `role === 'admin'`.
- `components/FeaturedCollections.tsx`
  - Читает `profiles.role`.
  - Показывает редактор создания коллекций, если `role === 'admin'`.
- `app/favorites/page.tsx`
  - Читает `profiles.role`.
  - Передает `showUser={profile.role === 'admin'}` в `FavoriteCard`.
- `components/admin/AuthorForm.tsx`
  - Позволяет выбрать `role` из `user`, `creator`, `admin`.
  - Компонент используется внутри админских страниц, которые защищены `app/admin/layout.tsx`.
- `app/admin/authors/page.tsx`
  - Массово меняет роль выбранных пользователей на `creator`.

## 9. Функции, завязанные на ключевые таблицы

- `profiles`
  - Авторизация административного доступа.
  - Отображение пользователей, авторов, профилей.
  - Выбор автора для работы.
  - Роли `user`, `creator`, `admin`.
  - Аватары и bio.
- `artworks`
  - Лента работ, поиск, фильтр по тегам, сортировки.
  - Главный hero preview.
  - Профиль автора и список его работ.
  - Избранное и карточки работ.
  - Админское создание/редактирование/удаление работ.
  - Превью работ авторов.
  - Работы внутри коллекций.
- `favorites`
  - Лайки/избранное.
  - Подсчет популярности.
  - Персональное избранное пользователя.
  - Маркировка `liked` в ленте, поиске и профиле автора.
- `events`
  - Страница событий.
  - Фильтр по статусу, месту, строке поиска.
  - Сортировка по дате, названию, месту.
- `collections`
  - Блок "Подборки команды".
  - Чтение коллекций.
  - Админское создание коллекции.
- `collection_items`
  - Состав коллекции.
  - Порядок работ через `position`.
  - Привязка коллекции к `artwork_id`.

## 10. Потенциальные риски при переходе на новую структуру БД

- В нескольких местах используется `select('*')`; удаление или переименование любых колонок может сломать runtime-ожидания.
- Жестко прошиты имена таблиц: `profiles`, `artworks`, `favorites`, `events`, `collections`, `collection_items`.
- Жестко прошиты значения ролей: `user`, `creator`, `admin`.
- Код ожидает, что `profiles.id` совпадает с `auth.users.id`.
- Код ожидает связь `artworks.author_id -> profiles.id`; используются PostgREST relations `profiles (...)` и `profiles:author_id (...)`.
- `favorites` ожидает уникальность пары `user_id + artwork_id`; обработка duplicate опирается на ошибку `23505` или слово `duplicate`.
- Поиск и фильтры ожидают `artworks.tags` как массив, пригодный для `.contains()` и `.overlaps()`.
- `app/profile/[id]/page.tsx` ищет профиль либо по UUID `id`, либо по `username`; V2 должна сохранить уникальность/доступность `username`.
- Админские операции выполняются с client-side anon client и должны быть защищены RLS. При миграции RLS-политики критичны.
- `profiles.delete()` и `artworks.delete()` могут ожидать cascade-поведение для связанных работ, избранного и элементов коллекций.
- `components/FeaturedCollections.tsx` вводит `artworkIds` вручную через comma-separated IDs; смена формата ID сломает создание подборок.
- `collection_items.select('*, artwork:artworks(*)')` зависит от имени relationship `artworks`.
- `events` сейчас не использует image column; UI показывает фиксированную fallback-картинку.
- `image_url` и `avatar_url` хранят готовые URL. Если V2 переходит на storage paths или private buckets, текущий UI перестанет показывать изображения без compatibility слоя.
- Bucket `avatars` должен остаться доступным или должен быть сохранен compatible public URL в `profiles.avatar_url`.
- `next.config.ts` содержит placeholder host `your-supabase-bucket.supabase.co`; при переходе на `next/image` потребуется реальный host.
- `app/api/auth/check-confirmation/route.ts` зависит от `SUPABASE_SERVICE_ROLE_KEY`, RPC `get_user_by_email_safe` и fallback `listUsers` только на первые 1000 пользователей.
- Регистрация пишет `full_name` и `avatar_url` только в Auth metadata; если профиль создается DB trigger'ом, V2 должна сохранить этот trigger/механику.
- В нескольких местах favorites count считается чтением строк, а не агрегатом; на больших данных и при новых RLS это может стать медленно или неполно.

## 11. Предложение порядка миграции V1 -> V2 без изменения кода

1. Зафиксировать текущий контракт V1: имена таблиц, поля, FK, relationship names, RLS, Storage bucket `avatars`, RPC `get_user_by_email_safe`.
2. Сделать backup данных и схемы V1; отдельно выгрузить Auth users, `profiles`, `artworks`, `favorites`, `events`, `collections`, `collection_items`.
3. Подготовить V2-структуру параллельно, не удаляя V1-таблицы.
4. Заполнить V2 данными из V1, сохранив старые IDs там, где код их использует напрямую: `profiles.id`, `artworks.id`, `favorites.artwork_id`, `collection_items.artwork_id`.
5. Создать compatibility слой с прежними именами `profiles`, `artworks`, `favorites`, `events`, `collections`, `collection_items`: таблицы-алиасы, views или updatable views с triggers.
6. Сохранить старые поля в compatibility слое, особенно `image_url`, `avatar_url`, `role`, `tags`, `author_id`, `user_id`, `artwork_id`, `collection_id`, `position`.
7. Сохранить PostgREST relationship names, которые использует код: `profiles`, `profiles:author_id`, `artwork:artworks`.
8. Перенести или воссоздать RLS так, чтобы текущий anon client мог читать публичные данные, обычный пользователь мог управлять своим `favorites`, а admin мог выполнять текущие операции.
9. Сохранить bucket `avatars` и public URL, либо заранее переписать `profiles.avatar_url` на совместимые публичные URL.
10. Проверить Auth trigger/логику создания `profiles` из `signUp` metadata `full_name` и `avatar_url`.
11. Проверить API routes в staging: resend confirmation, check confirmation, RPC и fallback `listUsers`.
12. Прогнать smoke-test страниц: `/`, `/feed`, `/authors`, `/events`, `/favorites`, `/profile`, `/profile/[id]`, `/admin`, `/admin/artworks`, `/admin/authors`, `/admin/users`.
13. После успешной проверки переключить production на compatibility слой V2 на уровне БД, не меняя application code.
14. Наблюдать логи RLS/PostgREST/Auth/Storage после переключения.
15. Только после отдельного этапа изменения кода постепенно убрать V1-compatible поля, `select('*')` и старые relationship assumptions.

