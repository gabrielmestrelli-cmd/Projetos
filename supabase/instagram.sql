-- =====================================================================
-- Instagram no site: stories das últimas 24 h + seguidores automáticos
-- Rode no SQL Editor do Supabase (pode rodar de novo sem problema).
-- =====================================================================

-- Stories copiados do Instagram (a função instagram-sync escreve; todo mundo lê)
create table if not exists public.instagram_stories (
  id text primary key,
  media_type text,
  media_url text not null,
  permalink text,
  taken_at timestamptz not null default now(),
  expires_at timestamptz not null,
  synced_at timestamptz not null default now()
);
alter table public.instagram_stories enable row level security;
drop policy if exists "stories publicos" on public.instagram_stories;
create policy "stories publicos" on public.instagram_stories for select using (true);
do $$ begin
  alter publication supabase_realtime add table public.instagram_stories;
exception when others then null;
end $$;

alter table public.store_profile add column if not exists instagram_synced_at timestamptz;

-- Token do Instagram: ninguém lê pelo site (sem política de leitura); só o servidor
create table if not exists public.instagram_config (
  id int primary key default 1 check (id = 1),
  access_token text,
  token_refreshed_at timestamptz,
  username text,
  last_run_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);
alter table public.instagram_config enable row level security;

-- O admin cola o token pelo painel
create or replace function public.salvar_token_instagram(token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Só o admin pode conectar o Instagram'; end if;
  insert into public.instagram_config (id, access_token, token_refreshed_at, last_error, updated_at)
  values (1, nullif(trim(token), ''), now(), null, now())
  on conflict (id) do update set access_token = excluded.access_token, token_refreshed_at = now(), last_error = null, updated_at = now();
end $$;
revoke all on function public.salvar_token_instagram(text) from public, anon;
grant execute on function public.salvar_token_instagram(text) to authenticated;

-- O painel vê se está conectado, sem ver o token
create or replace function public.status_instagram()
returns json language sql security definer set search_path = public as $$
  select case when not public.is_admin() then null else
    json_build_object(
      'conectado', coalesce((select access_token is not null from public.instagram_config where id = 1), false),
      'usuario', (select username from public.instagram_config where id = 1),
      'ultima_vez', (select last_run_at from public.instagram_config where id = 1),
      'erro', (select last_error from public.instagram_config where id = 1)
    ) end
$$;
grant execute on function public.status_instagram() to authenticated;

-- Roda a sincronização sozinha a cada 15 minutos
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$ begin
  perform cron.unschedule('instagram-sync');
exception when others then null;
end $$;
select cron.schedule(
  'instagram-sync',
  '*/15 * * * *',
  $$ select net.http_post(
       url := 'https://oltxefqvjrmmnajglkuj.supabase.co/functions/v1/instagram-sync',
       headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_dAwV4Dc0SQoADxDeMryF5Q_FM8Od8Vk", "Authorization": "Bearer sb_publishable_dAwV4Dc0SQoADxDeMryF5Q_FM8Od8Vk"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
