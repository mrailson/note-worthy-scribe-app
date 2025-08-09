-- Enable required extensions for scheduling HTTP calls
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Curated HTML storage for Northamptonshire GP News digests
create table if not exists public.curated_news_pages (
  id uuid primary key default gen_random_uuid(),
  title text,
  html text not null,
  created_at timestamptz not null default now(),
  generated_by text default 'perplexity',
  digest_date date default current_date
);

alter table public.curated_news_pages enable row level security;

-- Allow authenticated users to read digests (in-app viewing)
create policy "Curated news readable by authenticated users"
  on public.curated_news_pages
  for select
  to authenticated
  using (true);

-- Schedule the Perplexity-powered fetcher at 08:00, 13:00, 17:00 UTC daily
-- Note: uses anon key for function invocation
select cron.schedule(
  'nhs-gp-news-3x-daily',
  '0 8,13,17 * * *',
  $$
  select net.http_post(
    url := 'https://dphcnbricafkbtizkoal.supabase.co/functions/v1/nhs-gp-news',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs"}'::jsonb,
    body := '{"mode":"run"}'::jsonb
  );
  $$
);