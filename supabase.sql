-- JPL Folder.io - run this once in the Supabase SQL editor, then paste the
-- project URL and anon key into SB at the top of app.js.
-- Everyone can read and upload (no login), so the policies are open on purpose.

create table if not exists public.folders (
  id      text primary key,
  name    text not null,
  date    date not null,
  created bigint not null default 0
);

create table if not exists public.photos (
  id      text primary key,
  fid     text references public.folders(id) on delete cascade,
  title   text not null,
  date    date not null,
  path    text not null,
  created bigint not null default 0
);

create index if not exists photos_fid on public.photos(fid);

alter table public.folders enable row level security;
alter table public.photos  enable row level security;

drop policy if exists "read folders"   on public.folders;
drop policy if exists "add folders"    on public.folders;
drop policy if exists "edit folders"   on public.folders;
drop policy if exists "kill folders"   on public.folders;
drop policy if exists "read photos"    on public.photos;
drop policy if exists "add photos"     on public.photos;
drop policy if exists "kill photos"    on public.photos;

create policy "read folders" on public.folders for select using (true);
create policy "add folders"  on public.folders for insert with check (true);
create policy "edit folders" on public.folders for update using (true);
create policy "kill folders" on public.folders for delete using (true);

create policy "read photos" on public.photos for select using (true);
create policy "add photos"  on public.photos for insert with check (true);
create policy "kill photos" on public.photos for delete using (true);

-- public bucket: everyone can see the images, anyone can add or remove them
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

drop policy if exists "read photos files"  on storage.objects;
drop policy if exists "add photos files"  on storage.objects;
drop policy if exists "kill photos files" on storage.objects;

create policy "read photos files" on storage.objects for select using (bucket_id = 'photos');
create policy "add photos files"  on storage.objects for insert with check (bucket_id = 'photos');
create policy "kill photos files" on storage.objects for delete using (bucket_id = 'photos');
