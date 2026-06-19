-- ════════════════════════════════════════════════════════════════════════
-- Playlist Arena — esquema de base de datos (Supabase / Postgres)
--
-- CÓMO USARLO:
--   1. Entra en tu proyecto de Supabase.
--   2. Menú izquierdo → "SQL Editor" → "New query".
--   3. Pega TODO este archivo y pulsa "Run".
--   Es idempotente: puedes ejecutarlo varias veces sin romper nada.
--
-- MODELO:
--   profiles  → una fila por persona (nombre visible, si es dueño).
--   songs     → la playlist compartida (una sola copia para todos).
--   ratings   → la nota que CADA persona pone a CADA canción.
--   playlist_meta → datos generales de la playlist (1 sola fila).
-- ════════════════════════════════════════════════════════════════════════

-- ── PERFILES ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  is_owner     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ── CANCIONES (playlist compartida) ──────────────────────────────────────
create table if not exists public.songs (
  entry_id              text primary key,
  spotify_id            text not null,
  spotify_uri           text not null default '',
  title                 text not null,
  artists               text[] not null default '{}',
  album                 text not null default '',
  cover_url             text not null default '',
  spotify_url           text not null default '',
  release_date          text not null default '',
  release_year          text not null default '',
  added_at              text not null default '',
  duration_ms           integer not null default 0,
  is_in_active_playlist boolean not null default true,
  created_at            timestamptz not null default now()
);

-- ── NOTAS POR PERSONA ────────────────────────────────────────────────────
create table if not exists public.ratings (
  user_id        uuid not null references auth.users (id) on delete cascade,
  song_entry_id  text not null references public.songs (entry_id) on delete cascade,
  rating         numeric(3,1) not null check (rating >= 0 and rating <= 10),
  updated_at     timestamptz not null default now(),
  primary key (user_id, song_entry_id)
);

create index if not exists ratings_song_idx on public.ratings (song_entry_id);

-- ── METADATOS DE LA PLAYLIST (una sola fila, id = 1) ─────────────────────
create table if not exists public.playlist_meta (
  id                  integer primary key default 1 check (id = 1),
  playlist_id         text,
  playlist_url        text,
  name                text,
  cover_url           text,
  total_songs         integer not null default 0,
  total_duration_ms   bigint not null default 0,
  spotify_track_count integer not null default 0,
  last_synced_at      timestamptz
);

-- ════════════════════════════════════════════════════════════════════════
-- SEGURIDAD (Row Level Security)
-- ════════════════════════════════════════════════════════════════════════
alter table public.profiles      enable row level security;
alter table public.songs         enable row level security;
alter table public.ratings       enable row level security;
alter table public.playlist_meta enable row level security;

-- helper: ¿la persona logueada es el dueño?
create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select is_owner from public.profiles where id = auth.uid()),
    false
  );
$$;

-- PROFILES: todos los logueados ven todos los perfiles (para mostrar nombres).
--           cada uno solo edita el suyo.
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- SEGURIDAD: impide que un usuario normal se ascienda a si mismo a dueño.
-- is_owner solo se puede cambiar desde el SQL Editor (rol postgres/service),
-- nunca desde la app. Si un usuario intenta cambiarlo, se ignora silenciosamente.
create or replace function public.protect_is_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_owner is distinct from old.is_owner and auth.role() <> 'service_role' then
    new.is_owner := old.is_owner;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_is_owner on public.profiles;
create trigger trg_protect_is_owner
  before update on public.profiles
  for each row execute function public.protect_is_owner();

-- SONGS: todos los logueados leen; solo el dueño escribe.
drop policy if exists "songs_select_all" on public.songs;
create policy "songs_select_all" on public.songs
  for select to authenticated using (true);

drop policy if exists "songs_write_owner" on public.songs;
create policy "songs_write_owner" on public.songs
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- RATINGS: todos los logueados LEEN todas las notas (ver quién puntuó qué).
--          cada uno solo crea/edita/borra las suyas.
drop policy if exists "ratings_select_all" on public.ratings;
create policy "ratings_select_all" on public.ratings
  for select to authenticated using (true);

drop policy if exists "ratings_insert_self" on public.ratings;
create policy "ratings_insert_self" on public.ratings
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "ratings_update_self" on public.ratings;
create policy "ratings_update_self" on public.ratings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "ratings_delete_self" on public.ratings;
create policy "ratings_delete_self" on public.ratings
  for delete to authenticated using (user_id = auth.uid());

-- PLAYLIST_META: todos leen; solo el dueño escribe.
drop policy if exists "meta_select_all" on public.playlist_meta;
create policy "meta_select_all" on public.playlist_meta
  for select to authenticated using (true);

drop policy if exists "meta_write_owner" on public.playlist_meta;
create policy "meta_write_owner" on public.playlist_meta
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- ════════════════════════════════════════════════════════════════════════
-- VICTORIAS DE TORNEO (compartidas entre todas las personas)
-- Cada fila = las victorias que UNA persona dio a UNA cancion en UN torneo.
-- El desempate del ranking suma las victorias de TODOS.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists public.tournament_song_wins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  song_entry_id text not null references public.songs (entry_id) on delete cascade,
  tournament_id text not null,
  wins          integer not null default 0 check (wins >= 0),
  created_at    timestamptz not null default now()
);

create index if not exists tsw_song_idx on public.tournament_song_wins (song_entry_id);

alter table public.tournament_song_wins enable row level security;

-- todos los logueados leen todas las victorias (para el ranking global).
drop policy if exists "tsw_select_all" on public.tournament_song_wins;
create policy "tsw_select_all" on public.tournament_song_wins
  for select to authenticated using (true);

-- cada uno solo registra/borra sus propias victorias.
drop policy if exists "tsw_insert_self" on public.tournament_song_wins;
create policy "tsw_insert_self" on public.tournament_song_wins
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "tsw_delete_self" on public.tournament_song_wins;
create policy "tsw_delete_self" on public.tournament_song_wins
  for delete to authenticated using (user_id = auth.uid());

do $$
begin
  alter publication supabase_realtime add table public.tournament_song_wins;
exception
  when duplicate_object then null;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- AUTO-CREAR PERFIL AL REGISTRARSE
-- Toma el display_name de los metadatos del registro (o el email si falta).
-- ════════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════════
-- TIEMPO REAL: que las notas se actualicen en vivo para todos.
-- (idempotente: si la tabla ya esta en la publicacion, no falla)
-- ════════════════════════════════════════════════════════════════════════
do $$
begin
  alter publication supabase_realtime add table public.ratings;
exception
  when duplicate_object then null;
end $$;
