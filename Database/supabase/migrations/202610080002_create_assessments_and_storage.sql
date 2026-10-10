-- Pet-Care assessment history and private media storage.
-- Apply after 202610080001_create_profiles.sql.

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  species text not null check (species in ('cat', 'dog')),
  pet_age smallint not null check (pet_age between 0 and 40),
  breed text,
  symptom_text text,
  symptom_audio_path text,
  image_path text,
  onset_text text,
  onset_audio_path text,
  transcript text,
  onset_transcript text,
  status text not null default 'processing' check (status in ('processing', 'complete', 'failed')),
  probable_conditions jsonb,
  triage text check (triage in ('MONITOR', 'CONSULT', 'URGENT')),
  triage_reason text,
  monitoring_plan jsonb,
  safety_note text,
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.assessments enable row level security;
grant select on table public.assessments to authenticated;

create policy "Users can read their own assessment history"
on public.assessments
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Assessment inputs are uploaded directly from the browser only into the
-- requesting user's private folder. There is no public bucket or public URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assessment-media',
  'assessment-media',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload their own assessment media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'assessment-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can read their own assessment media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'assessment-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Live history updates are delivered to the owner after an Edge Function
-- creates or finishes an assessment.
alter publication supabase_realtime add table public.assessments;
