# Campus Lost & Found

A simple student lost and found web app built with Next.js, Tailwind CSS, and Supabase.

## Features

- Home page with `Lost Item` and `Found Item` buttons
- Create text-only reports with message, location, and contact phone
- Feed of latest posts shown first
- Clean UI optimized for college students

## Setup

1. Copy `.env.example` to `.env.local`
2. Set your Supabase values and admin email:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_ADMIN_EMAIL=admin@example.com
```

3. Install dependencies:

```bash
npm install
```

4. Run the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Supabase

Create a Supabase project and add a `posts` table in the `public` schema. Use the Supabase SQL editor and run:

```sql
create table public.posts (
  id bigint generated always as identity primary key,
  item_type text not null,
  message text not null,
  location text not null,
  contact text not null,
  user_id uuid references auth.users(id) on delete cascade,
  resolved boolean default false,
  created_at timestamp with time zone default timezone('utc', now())
);
```

If the table already exists, add the missing columns:

```sql
alter table public.posts add column user_id uuid references auth.users(id) on delete cascade;
alter table public.posts add column resolved boolean default false;
```

If you see an error about `public.posts` not being found, this table does not exist yet in your project.

If your table exists but inserts still fail with a row-level security policy error, add these policies in the Supabase SQL editor:

```sql
-- allow anonymous reads
create policy "Allow select for everyone" on public.posts
  for select
  using (true);

-- allow authenticated inserts
create policy "Allow insert for authenticated users" on public.posts
  for insert
  with check (auth.uid() = user_id);

-- allow update for post owner
create policy "Allow update for post owner" on public.posts
  for update
  using (auth.uid() = user_id);
```

Then refresh the schema cache and reload the app.

Ensure your project's API keys are available in `.env.local` before running the site.

## Notes

- The app uses a Supabase client helper in `lib/supabaseClient.ts`
- Login is handled with Google OAuth
- Posts are fetched and displayed newest-first in the feed
- Users can mark their own posts as resolved
