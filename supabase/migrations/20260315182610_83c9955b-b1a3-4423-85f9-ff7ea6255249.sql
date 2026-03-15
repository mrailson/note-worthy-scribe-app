
-- Create meeting_infographics table
create table public.meeting_infographics (
  id uuid primary key default gen_random_uuid(),
  meeting_id text not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  image_url text not null,
  storage_path text,
  style text,
  orientation text default 'landscape',
  created_at timestamptz default now()
);

alter table public.meeting_infographics enable row level security;

create policy "Users manage own infographics"
  on public.meeting_infographics for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Create storage bucket
insert into storage.buckets (id, name, public)
values ('meeting-infographics', 'meeting-infographics', true)
on conflict (id) do nothing;

-- Storage RLS: users can upload to their own folder
create policy "Users upload own infographics"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'meeting-infographics' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read own infographics"
  on storage.objects for select to authenticated
  using (bucket_id = 'meeting-infographics' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own infographics"
  on storage.objects for delete to authenticated
  using (bucket_id = 'meeting-infographics' and (storage.foldername(name))[1] = auth.uid()::text);

-- Public read for viewing via public URLs
create policy "Public read meeting infographics"
  on storage.objects for select to anon
  using (bucket_id = 'meeting-infographics');
