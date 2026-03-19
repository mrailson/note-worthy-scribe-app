
create table public.domain_dictionary (
  id uuid primary key default gen_random_uuid(),
  wrong_term text not null,
  correct_term text not null,
  category text not null default 'general',
  created_at timestamptz not null default now()
);

create index idx_domain_dictionary_category on public.domain_dictionary(category);

alter table public.domain_dictionary enable row level security;

create policy "Authenticated users can read dictionary"
  on public.domain_dictionary for select
  to authenticated
  using (true);
