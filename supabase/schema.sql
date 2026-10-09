-- Run once in the Supabase SQL editor for this project.
-- Access stays on the server; never expose the service-role key to the browser.
create table if not exists public.quiz_leagues (
  id uuid primary key,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  league jsonb not null check (
    jsonb_typeof(league) = 'object'
    and league ?& array['id', 'title', 'participants', 'quizzes']
    and league->>'id' = id::text
    and jsonb_typeof(league->'title') = 'string'
    and jsonb_typeof(league->'participants') = 'array'
    and jsonb_typeof(league->'quizzes') = 'array'
  ),
  revision integer not null default 0 check (revision >= 0)
);

alter table public.quiz_leagues enable row level security;

-- No anonymous or authenticated policies are created. All public reads and
-- token-authorized writes go through the app's API with its server credential.
revoke all on table public.quiz_leagues from public, anon, authenticated;
grant select, insert, update, delete on table public.quiz_leagues to service_role;

-- The API updates using: WHERE id = :id AND revision = :previous_revision.
-- PostgreSQL makes that comparison and the revision increment atomic, so two
-- serverless instances cannot silently overwrite each other's quiz results.
