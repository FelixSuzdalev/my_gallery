# V2 App Integration Audit

Ветка: `feature/supabase-v2`

Цель: безопасно подготовить приложение к подключению к чистой Supabase V2 без переноса данных из V1. SQL в Supabase не запускался, приложение к V2 не подключалось.

Проанализированы миграции:

- `supabase/migrations/202606230001_create_v2_schema.sql`
- `supabase/migrations/202606230002_storage_policies.sql`
- `supabase/migrations/202606230003_artwork_stats.sql`

## Ключевые выводы

V2 сохраняет основные V1-совместимые поля `profiles`, `artworks.image_url`, `favorites`, `events`, `collections`, поэтому часть публичного просмотра останется работоспособной после переключения env на пустую V2-базу. Главные несовместимости связаны не с отсутствием таблиц, а с RLS и новой моделью медиа/статистики:

- публичный клиент больше не может читать сырые строки `favorites` других пользователей для подсчета популярности;
- приложение пока не использует `artwork_stats`, `artwork_likes`, `comments`, `follows`, `artwork_media`;
- загрузка аватаров использует неверный путь для V2 Storage;
- создание работ через админ-форму допускает пустой `author_id`, но в V2 `artworks.author_id` обязательный;
- публичные страницы не всегда явно фильтруют `status = 'published'`, `visibility = 'public'`, `deleted_at is null`, полагаясь только на RLS;
- API route проверки email зависит от отсутствующей в V2 RPC `get_user_by_email_safe` и от серверного `SUPABASE_SERVICE_ROLE_KEY`.

## Файлы с прямыми обращениями к Supabase, Auth, Storage или API routes

### `lib/supabase.ts`

- Использует: `createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)`.
- Действия: создает общий браузерный Supabase client с anon key.
- Соответствие V2: совместимо.
- Что сломается: при переключении локального env на V2 все клиентские запросы начнут проходить через V2 RLS; проблемы проявятся в местах, где код ожидал более открытые V1-данные.
- Точечные изменения: на первом этапе можно оставить, но позже желательно типизировать клиент схемой V2 и централизовать auth/profile helpers.

### `components/AuthForm.tsx`

- Использует: `supabase.auth.signInWithPassword`, `supabase.auth.signUp`.
- Поля auth metadata: `full_name`, `avatar_url`.
- Действия: вход, регистрация, redirect на `/auth/check-email`.
- Соответствие V2: регистрация совместима с `private.handle_new_user()`, который создает `public.profiles` с `role = 'user'`, `full_name`, `avatar_url`; `username` будет `null`.
- Что сломается/будет не так: новые пользователи не станут авторами автоматически, потому что V2 по умолчанию выдает роль `user`; авторские функции требуют `creator` или `admin`. `avatar_url` будет внешним Dicebear URL, не V2 Storage.
- Точечные изменения: после регистрации явно учитывать роль `user`; добавить UX для ожидания повышения до `creator`; при необходимости добавить заполнение `username` отдельным шагом профиля, а не через регистрацию.

### `components/Navbar.tsx`

- Использует: `supabase.auth.getSession`, `supabase.auth.onAuthStateChange`, `supabase.auth.signOut`, `profiles.select('role').eq('id', userId).single()`.
- Таблицы/поля: `profiles.id`, `profiles.role`.
- Действия: восстановление сессии, подписка на auth state, выход, проверка admin-меню.
- Соответствие V2: совместимо. V2 RLS разрешает пользователю читать свой профиль.
- Что сломается/будет не так: сразу после регистрации возможна короткая гонка, если профиль еще не создан триггером; тогда role временно `null` и admin link не появится.
- Точечные изменения: добавить tolerant helper `getCurrentProfile()` с retry/`maybeSingle()`; отображать avatar из `profiles.avatar_url`, а не только из `user_metadata.avatar_url`, когда профиль уже есть.

### `components/NagModal.tsx`

- Использует: `supabase.auth.getSession`.
- Действия: показывает предложение регистрации, если нет сессии.
- Соответствие V2: совместимо.
- Что сломается: ничего критичного.
- Точечные изменения: не требуется для подключения V2.

### `app/profile/page.tsx`

- Использует: `supabase.auth.getUser`.
- Действия: редирект текущего пользователя на `/profile/{id}`.
- Соответствие V2: совместимо.
- Что сломается: ничего критичного.
- Точечные изменения: можно оставить.

### `app/profile/[id]/page.tsx`

- Использует: `auth.getSession`, `profiles.select`, `artworks.select`, `favorites.select/insert/delete/count`.
- Таблицы/поля: `profiles.id/full_name/username/bio/avatar_url/role`, `artworks.id/title/image_url/description/author_id/created_at/tags`, nested `profiles(username, full_name)`, `favorites.id/artwork_id/user_id`.
- Действия: публичный профиль, работы автора, суммарные лайки через `favorites`, toggle favorite.
- Соответствие V2: профиль и работы частично совместимы; `favorites` для состояния текущего пользователя совместимы.
- Что сломается/будет не так: подсчет популярности через чтение всех `favorites` не будет работать для anon/authenticated, потому что V2 разрешает читать только свои favorite rows. `totalLikes` и счетчики на карточках станут 0/1 или пустыми. Страница не фильтрует работы явно по `published/public/not deleted`, поэтому владелец или admin могут увидеть непубличные работы в публичном представлении.
- Точечные изменения: получать счетчики из `artwork_stats`; свои favorites читать отдельным запросом по `user_id`; добавить явные фильтры публичности на публичной странице; позже перейти с `image_url` на primary `artwork_media`.

### `app/feed/page.tsx`

- Использует: `searchArtworks`, fallback `artworks.select`, `favorites.select/insert/delete/count`, `auth.getSession`.
- Таблицы/поля: `artworks.*`, nested `profiles(username, full_name)`, `artworks.tags`, `favorites.id/artwork_id/user_id`.
- Действия: лента, поиск/фильтры, теги, популярность/trending, toggle favorite.
- Соответствие V2: выборка опубликованных работ будет частично работать за счет RLS; insert/delete favorites для текущего пользователя совместимы.
- Что сломается/будет не так: публичные счетчики и сортировки `Popular`/`Trending` строятся на сырых `favorites`, что V2 закрывает. Для admin/owner RLS может вернуть непубличные работы, потому что код не добавляет явные фильтры. Лента не использует `artwork_stats` и не различает `favorites` и `artwork_likes`.
- Точечные изменения: переписать загрузку работ на `artworks` + `artwork_stats`; отдельным запросом получать только favorites текущего пользователя; заменить `refreshCount()` на чтение `artwork_stats`; добавить явные фильтры `status`, `visibility`, `deleted_at`; решить UX: сердечко это favorite или like.

### `lib/search.ts`

- Использует: `artworks.select`, `artworks.contains/overlaps/or/range/order`, `favorites.select`, `auth.getSession`.
- Таблицы/поля: `artworks.*`, nested `profiles(username, full_name)`, `tags`, `created_at`, `favorites.id/artwork_id/user_id`.
- Действия: универсальный поиск, подсчет popularity через favorites, отметка liked.
- Соответствие V2: поиск по `artworks` частично совместим; tags есть в V2.
- Что сломается/будет не так: favorite counts не будут полными из-за RLS; `.or()` по embedded `profiles.*` может быть нестабильным и должен иметь fallback; нет явных публичных фильтров.
- Точечные изменения: возвращать `artwork_stats.favorites_count/likes_count/comments_count`; для текущего пользователя читать only-own favorites; добавить явные фильтры публичности в каждый запрос; при необходимости разделить поиск по работам и авторам.

### `app/favorites/page.tsx`

- Использует: `auth.getUser`, `profiles.select`, `favorites.select/delete`, `artworks.select`.
- Таблицы/поля: `profiles.id/full_name/username/avatar_url/role`, `favorites.id/user_id/artwork_id`, `artworks.id/title/image_url/description/author_id/created_at/tags`, nested `profiles(username, full_name)`.
- Действия: личное избранное, удаление favorite.
- Соответствие V2: в основном совместимо, потому что V2 разрешает читать и удалять свои favorites.
- Что сломается/будет не так: если избранная работа стала private/hidden/deleted, `artworks` не вернет ее обычному пользователю; это корректно, но UI должен спокойно скрывать такие записи. Admin-specific `showUser` фактически не используется, потому что rows не загружают пользователей favorites.
- Точечные изменения: добавить обработку отсутствующих работ; при необходимости показывать статус "работа недоступна"; позже заменить изображения на `artwork_media`.

### `components/Hero.tsx`

- Использует: `artworks.select('id, title, image_url').order().limit()`.
- Таблицы/поля: `artworks.id/title/image_url/created_at`.
- Действия: превью работ на главной.
- Соответствие V2: для anon сработает через RLS по публичным опубликованным работам.
- Что сломается/будет не так: на пустой V2 базе будет fallback; для admin/owner без явных фильтров могут попасть непубличные работы.
- Точечные изменения: добавить явные фильтры публичности; позже брать preview из `artwork_media`.

### `app/authors/page.tsx`

- Использует: `profiles.select(... artworks(image_url)).eq('role', 'creator')`.
- Таблицы/поля: `profiles.id/full_name/bio/avatar_url/role`, nested `artworks.image_url`.
- Действия: список авторов и превью работ.
- Соответствие V2: совместимо для публичных creator-профилей и публичных работ.
- Что сломается/будет не так: в чистой V2 все новые пользователи будут `user`, поэтому авторов не будет, пока admin не назначит `creator`. Работы без `image_url` или с будущим `artwork_media` не попадут в превью.
- Точечные изменения: сохранить фильтр `role='creator'`; добавить empty state для чистой V2; позже использовать `artwork_media`.

### `app/events/page.tsx`

- Использует: `events.select('id, title, description, location_name, start_date, end_date, external_url, created_at')`.
- Таблицы/поля: `events`.
- Действия: публичный список событий.
- Соответствие V2: совместимо; RLS разрешает select только `status='published'`.
- Что сломается/будет не так: поле `image_url` есть в V2, но код его не читает и всегда использует default image.
- Точечные изменения: по желанию добавить `image_url` после базового V2 smoke-test.

### `components/FeaturedCollections.tsx`

- Использует: `collections.select/insert`, `collection_items.select/insert`, `auth.getUser`, `profiles.select('role')`.
- Таблицы/поля: `collections.*`, `collection_items.collection_id/artwork_id/position`, nested `artworks(*)`, `profiles.role`.
- Действия: публичные подборки, admin-only создание подборки по IDs работ.
- Соответствие V2: публичное чтение совместимо; создание работает только для admin по RLS.
- Что сломается/будет не так: insert `collections` не заполняет `created_by`, но поле nullable; nested `artworks(*)` отдаст только публичные работы для обычных пользователей. Ввод IDs вручную хрупкий.
- Точечные изменения: оставить на поздний этап; для admin добавить выбор работ из V2 и `created_by = user.id`.

### `components/admin/ArtworkForm.tsx`

- Использует: `profiles.select(...).eq('role','creator')`, `artworks.insert/update`.
- Таблицы/поля: `profiles.id/full_name/username/role`, `artworks.title/description/image_url/author_id/tags`.
- Действия: создание и редактирование работ в admin.
- Соответствие V2: update/insert разрешены admin по RLS; поля существуют.
- Что сломается/будет не так: V2 `artworks.author_id` `not null`, а форма допускает "Без автора" и отправляет `author_id: null`; insert/update с null упадет. Форма не управляет `status`, `visibility`, `comments_enabled`, `deleted_at`; все новые работы будут `published/public` по default. Нет загрузки в `artwork-media`.
- Точечные изменения: сделать автора обязательным; добавить поля `status`, `visibility`, `comments_enabled`; не загружать медиа здесь до отдельного Storage-этапа; сохранить `image_url` как временный V1-compatible путь.

### `app/admin/artworks/page.tsx`

- Использует: `artworks.select/delete`, nested `profiles:author_id`, `ArtworkForm`.
- Таблицы/поля: `artworks.id/title/description/image_url/author_id/tags/created_at`.
- Действия: admin список, фильтры, создание/редактирование/удаление работ.
- Соответствие V2: admin select/delete совместимы через RLS; delete policy для artworks есть только admin.
- Что сломается/будет не так: UI не показывает `status`, `visibility`, `deleted_at`, `comments_enabled`, `artwork_stats`, `artwork_media`; может создавать некорректные работы через форму с пустым автором.
- Точечные изменения: расширить admin список статусами; перед удалением учитывать cascade на media/favorites/comments/stats; добавить soft/hide workflow до физического delete, если это нужно дипломной логике.

### `components/admin/AuthorForm.tsx`

- Использует: `storage.from('avatars').upload/getPublicUrl`, `profiles.update`.
- Bucket: `avatars`.
- Таблицы/поля: `profiles.full_name/username/avatar_url/bio/role`.
- Действия: обновление профиля и роли, загрузка аватара.
- Соответствие V2: update профиля совместим для admin; смена `role` разрешена только admin благодаря trigger `prevent_profile_protected_field_update`.
- Что сломается/будет не так: V2 Storage требует путь `avatars/{user_id}/avatar-{uuid}.{ext}`, а код загружает просто `{uuid}.{ext}`. Upload в `avatars` будет отклонен RLS. `accept="image/*"` допускает типы, не разрешенные bucket policy. Для не-admin попытка менять `role` будет отклонена trigger.
- Точечные изменения: формировать путь `${form.id}/avatar-${crypto.randomUUID()}.${ext}`; проверять MIME `image/jpeg`, `image/png`, `image/webp`; обновлять `profiles.avatar_url` только после успешного upload.

### `app/admin/users/page.tsx`

- Использует: `profiles.select`, `profiles.delete`, `AuthorForm`.
- Таблицы/поля: `profiles.id/full_name/username/avatar_url/role`.
- Действия: список пользователей с `role='user'`, попытка удаления профиля.
- Соответствие V2: select совместим для admin.
- Что сломается/будет не так: в V2 нет delete policy для `profiles`, поэтому `supabase.from('profiles').delete()` будет запрещен даже для admin через клиентскую сессию. Физическое удаление профиля также каскадно удалило бы работы, что рискованно.
- Точечные изменения: заменить delete на admin-only soft delete через `profiles.update({ deleted_at: now })` или отдельный серверный workflow; не удалять auth user из браузера.

### `app/admin/authors/page.tsx`

- Использует: `profiles.select`, `profiles.update({ role: 'creator' })`, `profiles.delete`, `AuthorForm`, `SelectUserModal`.
- Таблицы/поля: `profiles.id/full_name/username/avatar_url/role`.
- Действия: список creators, назначение роли creator, попытка удаления creator.
- Соответствие V2: назначение `creator` admin-пользователем совместимо; select совместим.
- Что сломается/будет не так: delete профиля будет запрещен RLS; создание creator зависит от существующих пользователей в чистой V2.
- Точечные изменения: оставить role update только для admin; заменить delete на soft delete/архивацию; добавить понятный empty state.

### `components/admin/SelectUserModal.tsx`

- Использует: `profiles.select(...).eq('role','user')`.
- Таблицы/поля: `profiles.id/full_name/username/avatar_url/role`.
- Действия: выбор пользователей для назначения creator.
- Соответствие V2: совместимо для admin; обычные пользователи не должны видеть этот UI.
- Что сломается: ничего критичного, если admin доступ проверен.
- Точечные изменения: добавить фильтр `deleted_at is null` явно, даже если RLS уже фильтрует.

### `app/admin/layout.tsx`

- Использует: `auth.getSession`, `profiles.select('role')`.
- Таблицы/поля: `profiles.role`.
- Действия: client-side guard admin-раздела.
- Соответствие V2: совместимо.
- Что сломается/будет не так: это только client-side guard; безопасность обеспечивается RLS, но UX может мигать до редиректа.
- Точечные изменения: оставить как UX guard; позже можно добавить server middleware/route guard, но не обязательно для V2 RLS.

### `app/api/auth/resend-confirmation/route.ts`

- Использует: server route, `createClient` с anon key, `supabase.auth.resend`.
- Действия: повторная отправка signup confirmation email.
- Соответствие V2: совместимо с Supabase Auth, если V2 Auth email templates/redirect URLs настроены.
- Что сломается: если redirect URL V2 не разрешает origin локального приложения, письма/redirect будут работать неправильно.
- Точечные изменения: проверить локальные redirect URLs в Supabase Auth перед smoke-test; код менять не обязательно.

### `app/api/auth/check-confirmation/route.ts`

- Использует: server route, `createClient` с `SUPABASE_SERVICE_ROLE_KEY`, `supabaseAdmin.rpc('get_user_by_email_safe')`, fallback `auth.admin.listUsers`.
- Действия: проверка подтверждения email.
- Соответствие V2: не полностью совместимо. Миграции V2 не создают RPC `get_user_by_email_safe`; fallback будет работать только при наличии server-only service role key.
- Что сломается/будет не так: в локальном V2 без `SUPABASE_SERVICE_ROLE_KEY` route упадет при инициализации/запросе; RPC всегда вернет ошибку, затем fallback ограничен первыми 1000 users. Service role не должен попадать в браузер.
- Точечные изменения: убрать зависимость от отсутствующей RPC или заменить сценарий на auth callback/session check; если route остается, держать service role строго на сервере и валидировать env.

### `app/auth/check-email/CheckEmailClient.tsx`

- Использует: `fetch('/api/auth/resend-confirmation')`, `fetch('/api/auth/check-confirmation')`.
- Действия: повторная отправка письма и проверка подтверждения.
- Соответствие V2: зависит от двух API routes выше.
- Что сломается: проверка подтверждения сломается без server-only service role key или из-за отсутствующей RPC/fallback limits.
- Точечные изменения: упростить flow: после клика "я подтвердил" вести на login и показывать ошибку уже при login, либо проверять текущую session после redirect.

## Отдельные проверки

### Регистрация, вход, выход, восстановление сессии

- Регистрация: `AuthForm` совместим с V2 Auth и trigger `handle_new_user()`, профиль создается с `role='user'`.
- Вход: `signInWithPassword` совместим.
- Выход: `Navbar.signOut()` совместим.
- Восстановление сессии: `getSession`, `getUser`, `onAuthStateChange` используются корректно.
- Риск: check-email route зависит от service role и отсутствующей RPC; это не должно блокировать базовый вход, но может ломать UX подтверждения email.

### Автоматическое создание profiles после регистрации

- V2 trigger `on_auth_user_created` создает `profiles`.
- `full_name` и `avatar_url` из `AuthForm` попадут в profile.
- `username` не передается и будет `null`.
- Риск: UI авторов зависит от `role='creator'`, а новый профиль получает `user`.

### Роли `user` / `creator` / `admin`

- V2 роли ограничены check constraint.
- `private.is_admin()` и `private.is_creator_or_admin()` используются RLS.
- Admin может менять `role` через `profiles.update`, обычный пользователь заблокирован trigger на `role/deleted_at`.
- Первый admin должен быть назначен вручную после регистрации, как указано в миграции 001.

### Лента и поиск работ

- Основные поля `artworks` совместимы: `title`, `description`, `image_url`, `tags`, `author_id`, `created_at`.
- Нужно убрать зависимость от сырых `favorites` для счетчиков.
- Нужно добавить явные публичные фильтры, чтобы admin/owner не видели служебные работы в публичной ленте.

### Избранное и лайки

- Текущее приложение использует `favorites` одновременно как избранное и как лайк.
- V2 разделяет `favorites` и `artwork_likes`.
- Без решения UX `artwork_likes` останется неиспользованной таблицей, а `likes_count` в `artwork_stats` будет 0.

### Использование `favorites` как популярности

- В V2 это больше нельзя делать через чтение сырых rows.
- Нужно использовать `artwork_stats.favorites_count` для popularity/trending и `favorites` только для состояния текущего пользователя.

### `artwork_stats`

- Таблица есть в миграции 003, RLS разрешает public select только для опубликованных публичных работ и admin для всех.
- Приложение пока нигде ее не читает.
- Это рекомендуемый источник публичных счетчиков `likes_count`, `favorites_count`, `comments_count`.

### `comments`

- V2 таблица и RLS готовы: публично видны только `visible` comments к публичным работам; автор видит свои; admin видит все.
- Приложение comments не использует.
- Интеграцию comments стоит делать после feed/stats.

### `follows`

- V2 таблица и RLS готовы для authenticated users.
- Приложение follows не использует.
- Интеграция не блокирует базовый V2 запуск.

### Admin-раздел

- Client-side admin guard совместим с V2.
- Admin select/update/create works через RLS в основном работают.
- Удаление `profiles` сломается из-за отсутствия delete policy.
- Создание artworks с пустым author сломается из-за `author_id not null`.
- Admin UI не показывает V2-поля `status`, `visibility`, `comments_enabled`, `deleted_at`, `artwork_stats`, `artwork_media`.

### `image_url`, `avatar_url` и переход к `artwork_media`

- V2 сохраняет `artworks.image_url`, поэтому текущий просмотр может работать без немедленного перехода.
- `artwork_media` уже создана, но приложение ее не использует.
- Рекомендуемый переход: оставить `image_url` как fallback, добавить чтение primary media, затем постепенно заменить отображение.
- Нельзя заменять `image_url` на `artwork_media` одним большим изменением.

### Загрузка файлов в `avatars` и `artwork-media`

- `avatars`: текущая загрузка сломается из-за неверного path. Нужен `{user_id}/avatar-{uuid}.{ext}`.
- `artwork-media`: загрузки пока нет. Для V2 нужен путь `{author_id}/{artwork_id}/display/{sort_order}-{uuid}.{ext}` и запись в `public.artwork_media`.
- Bucket MIME ограничены `image/jpeg`, `image/png`, `image/webp`; UI должен валидировать это до upload.

### Места, где клиент потенциально пытается менять `role` или удалять `profiles`

- `components/admin/AuthorForm.tsx`: обновляет `profiles.role`; допустимо только для admin.
- `app/admin/authors/page.tsx`: массово обновляет `role='creator'`; допустимо только для admin.
- `app/admin/users/page.tsx`: пытается `delete()` profiles; в V2 будет запрещено.
- `app/admin/authors/page.tsx`: пытается `delete()` profiles; в V2 будет запрещено.
- Обычный пользователь не должен получать UI с role select; RLS/trigger дополнительно защищают БД.

## План реализации по этапам

### Этап 1 — Auth и профиль

- Файлы: `lib/supabase.ts`, `components/AuthForm.tsx`, `components/Navbar.tsx`, `app/profile/page.tsx`, `app/profile/[id]/page.tsx`, `app/auth/check-email/CheckEmailClient.tsx`, `app/api/auth/resend-confirmation/route.ts`, `app/api/auth/check-confirmation/route.ts`.
- Функции: добавить helper `getCurrentProfile()`; стабилизировать роль и avatar source; убрать/смягчить зависимость от `get_user_by_email_safe`; оставить service role только в server route, если route сохраняется.
- Критерий готовности: регистрация создает `profiles`; login/logout работают; Navbar корректно показывает admin только admin; обычный user не может менять role.
- Риски: email confirmation redirects в Supabase Auth; отсутствие первого admin; server-only service role env для check route.

### Этап 2 — Лента, работы и `artwork_stats`

- Файлы: `lib/search.ts`, `app/feed/page.tsx`, `components/Hero.tsx`, `app/profile/[id]/page.tsx`, `app/favorites/page.tsx`.
- Функции: изменить `searchArtworks()` на чтение `artwork_stats`; добавить `loadArtworkStats(artworkIds)`; заменить `refreshCount()`; добавить явные публичные фильтры.
- Критерий готовности: anon видит публичную ленту; popularity/trending работают без чтения сырых `favorites`; свои favorites отображаются только через own rows.
- Риски: PostgREST nested select/joins; пустая V2 база; различие favorite vs like в UX.

### Этап 3 — Создание и редактирование работ

- Файлы: `components/admin/ArtworkForm.tsx`, `app/admin/artworks/page.tsx`, возможно `app/profile/[id]/page.tsx` если появится creator workflow.
- Функции: сделать `author_id` обязательным; добавить `status`, `visibility`, `comments_enabled`; валидировать tags; сохранить `image_url` как временный fallback.
- Критерий готовности: admin может создать публичную работу с автором; creator/admin RLS не блокирует допустимые операции; публичная лента показывает новую работу.
- Риски: создание работ от имени creator vs admin; случайная публикация draft/private из-за default `published/public`.

### Этап 4 — Storage и изображения

- Файлы: `components/admin/AuthorForm.tsx`, `components/admin/ArtworkForm.tsx`, `app/admin/artworks/page.tsx`, `app/feed/page.tsx`, `app/profile/[id]/page.tsx`, `components/Hero.tsx`, `app/authors/page.tsx`, `components/FeaturedCollections.tsx`.
- Функции: исправить `uploadAvatar()` path; добавить upload в `artwork-media`; добавить создание `artwork_media` rows; добавить resolver `getArtworkImage()` с fallback на `image_url`.
- Критерий готовности: avatar upload проходит RLS; artwork media upload проходит Storage policy и DB trigger; публичные изображения открываются из bucket.
- Риски: неверный storage path; MIME/size limits; преждевременная массовая замена `image_url`.

### Этап 5 — likes, favorites, comments, follows

- Файлы: `app/feed/page.tsx`, `app/profile/[id]/page.tsx`, `app/favorites/page.tsx`, новые/существующие компоненты для comments/follows.
- Функции: разделить favorite toggle и like toggle; добавить comments CRUD в рамках V2 RLS; добавить follow/unfollow; читать counters из `artwork_stats`.
- Критерий готовности: favorite сохраняет в личный список; like влияет на `likes_count`; visible comments попадают в `comments_count`; follows работают только для authenticated.
- Риски: UX-неясность между like/favorite; optimistic updates должны синхронизироваться с `artwork_stats`.

### Этап 6 — Admin-раздел

- Файлы: `app/admin/layout.tsx`, `app/admin/users/page.tsx`, `app/admin/authors/page.tsx`, `app/admin/artworks/page.tsx`, `components/admin/AuthorForm.tsx`, `components/admin/SelectUserModal.tsx`, `components/admin/ArtworkForm.tsx`.
- Функции: заменить delete profiles на soft-delete/admin workflow; добавить явные фильтры `deleted_at`; показывать V2 статусы; добавить moderation для comments при необходимости.
- Критерий готовности: admin может назначать roles, редактировать профили и работы; запрещенные delete операции больше не вызываются из UI.
- Риски: физическое удаление auth users нельзя делать из браузера; soft-delete профиля не удаляет связанные работы автоматически.

### Этап 7 — Локальный end-to-end smoke-test V2

- Файлы: код менять только если smoke-test находит дефекты; основная проверка через локальные env, dev server и браузер.
- Функции: сценарии регистрации, login/logout, назначение admin/creator, создание работы, favorite/like, profile, authors, feed, events, Storage upload.
- Критерий готовности: `npm run lint` и `npm run build` проходят; anon/authenticated/admin сценарии проходят на чистой V2 базе; RLS не требует service role в браузере.
- Риски: Auth redirect settings; пустой Storage; отсутствие тестовых данных.

### Этап 8 — Только после всех проверок решение о переключении Vercel

- Файлы: Vercel env не менять до завершения этапов 1-7.
- Функции: подготовить rollback plan; сравнить production env и локальный V2 smoke-test; проверить preview deployment.
- Критерий готовности: есть подтвержденный список env vars, smoke-test пройден, V1 не удалена.
- Риски: преждевременное переключение сломает production feed, auth confirmation или media URLs.

## Что нельзя делать до завершения интеграции

- Не менять Vercel environment variables.
- Не удалять V1.
- Не переносить контент.
- Не использовать service role key в браузере.
- Не загружать постоянные работы в V2 Storage.
- Не заменять `image_url` на `artwork_media` одним большим изменением.

## Краткий итог

Уже совместимы с V2: базовый Supabase client, login/logout/session restore, автоматическое создание `profiles`, публичное чтение `events`, часть публичного чтения `artworks`, личное чтение/удаление `favorites`, admin role check через `profiles.role`.

Требуют доработки: публичные счетчики и популярность через `artwork_stats`, разделение likes/favorites, загрузка avatar path, будущий `artwork-media`, admin delete profiles, обязательный author для artworks, явные публичные фильтры на feed/search/profile/hero, check-email route без отсутствующей RPC.

Рекомендуемый первый кодовый этап: Этап 1 — Auth и профиль. Он минимален по объему, проверяет главный фундамент V2 (`auth.users -> profiles`, роли, session restore) и не требует переноса данных или подключения медиа.
