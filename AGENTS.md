# AGENTS.md

## Project
This is a diploma project: a virtual gallery for artists, photographers, and designers.
The application is built with Next.js, React, TypeScript, Tailwind CSS, and Supabase.

## Main folders
- app/ — Next.js App Router pages and API routes.
- components/ — reusable UI components.
- lib/ — Supabase clients, search logic, helpers.
- public/ — static assets.
- app/admin/ — admin panel.
- app/feed/ — artworks feed.
- app/authors/ — authors page.
- app/events/ — events page.
- app/favorites/ — favorites page.

## Run commands
- Install dependencies: npm install
- Start dev server: npm run dev
- Check lint: npm run lint
- Check production build: npm run build

## Environment
The app requires:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

Never create or commit .env.local.
Never request or expose service role keys, passwords, or production secrets.

## Coding rules
- Use TypeScript.
- Keep the current visual style.
- Do not replace the project stack.
- Do not migrate from Supabase to another backend.
- Make small, reviewable changes.
- Do not change database schema unless explicitly asked.
- After code changes, run npm run lint and npm run build when possible.

## Diploma constraints
The implementation must remain consistent with the diploma text:
- virtual gallery theme;
- artworks, authors, events, favorites, admin panel;
- Next.js, React, TypeScript, Supabase;
- three-tier architecture;
- Supabase Auth, Database, and Storage.

## Definition of done
A task is done only when:
- the code compiles;
- TypeScript errors are not introduced;
- npm run lint passes or the remaining issues are explained;
- npm run build passes or the remaining issues are explained;
- the change is summarized clearly.