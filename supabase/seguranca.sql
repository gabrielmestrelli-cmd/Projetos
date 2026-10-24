-- =====================================================================
-- Lev & Fit — Regras de segurança do banco (RLS)
-- Rode este arquivo UMA VEZ no Supabase: Dashboard > SQL Editor > New query
-- Cole tudo, clique em "Run". Pode rodar de novo sem problema.
-- =====================================================================

-- 1) Tabela de administradores -----------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Ninguém lê/escreve essa tabela pelo site; só a função abaixo consulta.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- 1b) Colunas novas (perfil completo e entrega) ------------------------
alter table public.store_profile add column if not exists bio text;
alter table public.store_profile add column if not exists is_open boolean default true;
alter table public.store_profile add column if not exists stats jsonb;
alter table public.store_profile add column if not exists profile_picture text;

alter table public.products add column if not exists type text default 'encomenda';
alter table public.products add column if not exists ingredients text[] default '{}';

alter table public.orders add column if not exists delivery_type text;
alter table public.orders add column if not exists address text;
alter table public.orders add column if not exists delivery_fee numeric default 0;
alter table public.orders add column if not exists notes text;
alter table public.orders add column if not exists delivery_km numeric;

alter table public.store_profile add column if not exists delivery jsonb;
alter table public.promotions add column if not exists is_launch boolean default false;
alter table public.promotions add column if not exists cta_label text;

-- 2) Cardápio: qualquer um LÊ, só admin ESCREVE ---------------------------
do $$
declare t text;
begin
  foreach t in array array['categories','products','store_profile','testimonials','promotions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "leitura publica" on public.%I', t);
    execute format('drop policy if exists "admin escreve" on public.%I', t);
    execute format('create policy "leitura publica" on public.%I for select using (true)', t);
    execute format('create policy "admin escreve" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- 3) Pedidos: cliente só CRIA; admin vê e altera tudo ---------------------
alter table public.orders enable row level security;
drop policy if exists "cliente cria pedido" on public.orders;
drop policy if exists "admin gerencia pedidos" on public.orders;

create policy "cliente cria pedido" on public.orders
  for insert to anon, authenticated
  with check (status = 'pending');

create policy "admin gerencia pedidos" on public.orders
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 4) Telefone só com números (ignora parênteses, traço e o 55) -----------
create or replace function public.norm_tel(t text)
returns text language sql immutable as $$
  select case when length(d) > 11 and d like '55%' then substr(d, 3) else d end
  from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') as d) x;
$$;

-- 5) Criar pedido com número único (#1001, #1002...) gerado pelo banco ----
create sequence if not exists public.pedido_numero_seq start 1001;
-- continua depois do maior número que já existe (não repete pedidos antigos)
do $$
declare m bigint;
begin
  select max(order_number::text::bigint) into m
  from public.orders where order_number::text ~ '^[0-9]{1,15}$';
  if m is not null and m >= (select last_value from public.pedido_numero_seq) then
    perform setval('public.pedido_numero_seq', m);
  end if;
end $$;

create or replace function public.criar_pedido(p jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n text;
begin
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'Pedido sem itens';
  end if;
  if length(public.norm_tel(p->>'customer_phone')) < 10 then
    raise exception 'Telefone inválido';
  end if;
  n := nextval('public.pedido_numero_seq')::text;
  insert into public.orders
  select (jsonb_populate_record(null::public.orders,
    p || jsonb_build_object(
      'order_number', n,
      'status', 'pending',
      'customer_phone', public.norm_tel(p->>'customer_phone'),
      'created_at', now()
    ))).*;
  return n;
end;
$$;
grant execute on function public.criar_pedido(jsonb) to anon, authenticated;

-- 6) "Meus pedidos" do cliente: busca só os pedidos daquele telefone ------
create or replace function public.pedidos_do_cliente(telefone text)
returns setof public.orders
language sql
stable
security definer
set search_path = public
as $$
  select * from public.orders
  where length(public.norm_tel(telefone)) >= 10
    and public.norm_tel(customer_phone) = public.norm_tel(telefone)
  order by created_at desc
  limit 50;
$$;
grant execute on function public.pedidos_do_cliente(text) to anon, authenticated;

-- 7) Pedidos chegam em tempo real no painel ------------------------------
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when others then null;
end $$;

-- =====================================================================
-- 8) CRIAR O ADMIN (faça depois de rodar o resto)
--   a) Dashboard > Authentication > Users > "Add user" > "Create new user"
--      coloque o e-mail e uma senha forte, marque "Auto Confirm User".
--   b) Rode a linha abaixo trocando o e-mail:
--
-- insert into public.admins (user_id)
--   select id from auth.users where email = 'SEU-EMAIL-AQUI@gmail.com';
--
--   c) Recomendado: Authentication > Providers/Sign In > desligue
--      "Allow new users to sign up" para ninguém criar conta sozinho.
-- =====================================================================

-- 9) Avaliações do Google e Instagram ---------------------------------
alter table public.testimonials add column if not exists source text;
alter table public.store_profile add column if not exists google jsonb;

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


-- O agendamento automático (a cada 15 min) está em supabase/instagram.sql
