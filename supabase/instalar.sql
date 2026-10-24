-- =====================================================================
-- Lev & Fit — INSTALAÇÃO COMPLETA para um projeto Supabase NOVO
-- Supabase > SQL Editor > New query > cole tudo > Run.
-- Cria as tabelas, a segurança e o cardápio. Pode rodar de novo sem duplicar nada.
-- (Arquivo gerado por scripts/gerar-sql-inicial.ts — não edite à mão)
-- =====================================================================

-- 0) Tabelas -----------------------------------------------------------
create table if not exists public.categories (
  id text primary key,
  name text not null,
  icon text,
  emoji text,
  image_url text
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  description text default '',
  price numeric(10,2) not null default 0,
  category_id text,
  image_url text,
  is_active boolean not null default true,
  tags text[] not null default '{}',
  type text default 'encomenda',
  ingredients text[] default '{}'
);

create table if not exists public.store_profile (
  id int primary key default 1,
  name text,
  description text,
  phone text,
  address text,
  instagram_url text,
  delivery_fee numeric(10,2) default 0
);

create table if not exists public.testimonials (
  id text primary key,
  name text not null,
  comment text,
  rating int default 5,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists public.promotions (
  id text primary key,
  title text not null,
  description text,
  image_url text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.orders (
  id text primary key,
  order_number text,
  customer_name text,
  customer_phone text,
  items jsonb not null default '[]',
  total_price numeric(10,2) not null default 0,
  discount numeric(10,2) default 0,
  payment_method text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- Acesso pela API do site (as regras de RLS abaixo limitam o que cada um pode fazer)
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.store_profile,
  public.testimonials, public.promotions to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.store_profile,
  public.testimonials, public.promotions to authenticated;
grant insert on public.orders to anon, authenticated;
grant select, update, delete on public.orders to authenticated;


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

-- 9) Cardápio inicial (de src/constants.ts) ----------------------------
insert into public.categories (id, name, icon, emoji, image_url) values
  ('marmitas', 'Tradicionais', null, '🍱', null),
  ('lasanhas', 'Lasanhas', null, '🍝', null),
  ('coxinhas', 'Coxinha e Kibe', null, '🍗', null),
  ('molhos', 'Molhos', null, '🍯', null),
  ('caldos', 'Caldos e Sopas', null, '🥣', null)
on conflict (id) do nothing;

insert into public.products (id, name, description, price, category_id, image_url, is_active, tags, type, ingredients) values
  ('cox-1', 'Coxinha de Frango Fit', '110g. Recheada com queijo. Opção com e sem glúten. Oferta: 1 un por R$ 9,00 ou 3 un por R$ 24,00!', 9, 'coxinhas', '/produtos/coxinha.jpg', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('cox-2', 'Kibe', '110g. Contém glúten. Oferta: 1 un por R$ 9,00 ou 3 salgados (coxinha e kibe) por R$ 24,00!', 9, 'coxinhas', '/produtos/kibe.jpg', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-1', 'Arroz branco, frango em cubos e legumes', '350g. Arroz branco soltinho com cubos de frango grelhados e mix de legumes da estação.', 21, 'marmitas', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-2', 'Arroz branco, carne moída e legumes', '350g. Arroz branco com carne moída magra refogada e legumes variados.', 21, 'marmitas', 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-3', 'Purê de cenoura com frango em cubos e brócolis', '350g. Purê de cenoura aveludado, frango em cubos e brócolis cozido no vapor.', 21, 'marmitas', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-4', 'Purê de cenoura com carne moída e brócolis', '350g. Purê de cenoura, carne moída magra e brócolis fresco.', 21, 'marmitas', 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-5', 'Escondidinho de aipim com carne moída', '350g. Massa de aipim cremosa recheada com carne moída magra.', 21, 'marmitas', 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-6', 'Escondidinho de aipim com frango desfiado', '350g. Massa de aipim cremosa recheada com frango desfiado temperado.', 21, 'marmitas', 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-7', 'Escondidinho de aipim com carne de panela', '350g. Massa de aipim cremosa recheada com carne de panela desfiada suculenta.', 21, 'marmitas', 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-8', 'Escondidinho de batata doce com frango', '350g. Massa de batata doce recheada com frango desfiado.', 21, 'marmitas', 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-9', 'Escondidinho de batata doce com carne moída', '350g. Massa de batata doce recheada com carne moída magra.', 21, 'marmitas', 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-10', 'Escondidinho de batata doce com carne de panela', '350g. Massa de batata doce recheada com carne de panela desfiada.', 21, 'marmitas', 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-11', 'Escondidinho de abóbora com carne moída', '350g. Massa de abóbora cabotiá recheada com carne moída magra.', 21, 'marmitas', 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-12', 'Escondidinho de abóbora com frango', '350g. Massa de abóbora cabotiá recheada com frango desfiado.', 21, 'marmitas', 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop', false, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-13', 'Escondidinho de abóbora com carne de panela', '350g. Massa de abóbora cabotiá recheada com carne de panela desfiada.', 21, 'marmitas', 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-14', 'Escondidinho de batata inglesa com carne moída', '350g. Massa de batata inglesa recheada com carne moída magra.', 21, 'marmitas', 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-15', 'Escondidinho de batata inglesa com frango', '350g. Massa de batata inglesa recheada com frango desfiado.', 21, 'marmitas', 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-16', 'Macarrão integral à bolonhesa', '350g. Macarrão integral com molho bolonhesa artesanal de carne magra.', 21, 'marmitas', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-17', 'Macarrão integral com frango ao molho de tomate', '350g. Macarrão integral com frango desfiado e molho de tomate artesanal.', 21, 'marmitas', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-18', 'Panqueca de frango com molho de tomate', '350g. Duas panquecas recheadas com frango e cobertas com molho de tomate.', 21, 'marmitas', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-19', 'Panqueca de carne moída com molho de tomate', '350g. Duas panquecas recheadas com carne moída e cobertas com molho de tomate.', 21, 'marmitas', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-20', 'Arroz integral, feijão, carne moída e legumes', '350g. Prato completo com arroz integral, feijão carioca, carne moída e legumes.', 21, 'marmitas', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-trad-21', 'Arroz integral, feijão, frango e legumes', '350g. Prato completo com arroz integral, feijão carioca, frango em cubos e legumes.', 21, 'marmitas', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-1', 'Strogonoff de frango com batata rústica e arroz branco', '350g. Strogonoff de frango com creme de leite light, arroz branco e batata rústica assada na airfryer.', 21, 'marmitas', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', array['Peito de frango', 'Creme de leite light', 'Champignon', 'Arroz branco', 'Batata rústica']::text[]),
  ('mar-2', 'Risoto de frango', '350g. Risoto cremoso de frango desfiado, ervilhas frescas e temperos naturais.', 21, 'marmitas', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', array['Arroz arbóreo', 'Frango desfiado', 'Ervilhas frescas', 'Parmesão light', 'Cebola', 'Alho']::text[]),
  ('mar-3', 'Yakisoba', '350g. Macarrão integral com legumes crocantes e tiras de frango suculentas ao molho shoyu light.', 21, 'marmitas', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-4', 'Almôndegas com molho de tomate e purê de batata', '350g. Almôndegas de patinho com molho de tomate artesanal e purê de batata cremoso.', 21, 'marmitas', 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', array['Carne moída (patinho)', 'Batata', 'Molho de tomate artesanal', 'Leite desnatado', 'Temperos']::text[]),
  ('mar-5', 'Almôndegas com macarrão e molho de tomate', '350g. Almôndegas de patinho com molho de tomate artesanal e macarrão integral.', 21, 'marmitas', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', array['Carne moída (patinho)', 'Macarrão integral', 'Molho de tomate artesanal', 'Manjericão']::text[]),
  ('mar-6', 'Arroz com cenoura e filé de frango acebolado', '350g. Arroz com cenoura e filé de frango acebolado suculento.', 21, 'marmitas', 'https://images.unsplash.com/photo-1594973557371-75971b7c6cce?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-7', 'Arroz com brócolis e filé de frango ao molho de mostarda', '350g. Arroz com brócolis e filé de frango ao molho de mostarda especial.', 21, 'marmitas', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-8', 'Panqueca de espinafre com carne ao molho branco', '350g. Panqueca de espinafre recheada com carne ao molho branco cremoso.', 21, 'marmitas', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-9', 'Panqueca de espinafre com frango ao molho branco', '350g. Panqueca de espinafre recheada com frango ao molho branco cremoso.', 21, 'marmitas', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-10', 'Polenta com ragu de carne de panela', '350g. Polenta cremosa com ragu de carne de panela desfiada.', 21, 'marmitas', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-11', 'Carreteiro', '350g. Arroz carreteiro tradicional em versão fit com carnes magras.', 21, 'marmitas', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mar-12', 'Purê de batata inglesa com frango à parmegiana fit', '350g. Purê de batata inglesa com frango à parmegiana fit (empanado e assado).', 21, 'marmitas', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('las-1', 'Lasanha de Berinjela Fit', '500g. Lasanha de berinjela com molho de tomate artesanal, queijo branco e manjericão.', 21, 'lasanhas', 'https://images.unsplash.com/photo-1619895092538-128341789043?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', array['Berinjela', 'Molho de tomate artesanal', 'Queijo branco light', 'Manjericão fresco']::text[]),
  ('las-2', 'Lasanha à Bolonhesa Integral', '500g. Massa integral, carne moída magra, molho de tomate artesanal e queijo light.', 21, 'lasanhas', 'https://images.unsplash.com/photo-1560717845-968823efbee1?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('cal-1', 'Caldo Verde Fit', '450g. Tradicional caldo verde com couve fresca, batata e paio light.', 21, 'caldos', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', array['Couve manteiga', 'Batata', 'Paio light', 'Caldo de legumes natural', 'Alho']::text[]),
  ('cal-2', 'Creme de Aipim com Frango', '450g. Creme aveludado de aipim com frango desfiado e temperos naturais.', 21, 'caldos', 'https://images.unsplash.com/photo-1594759077573-218329ec7d85?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', array['Aipim (mandioca)', 'Frango desfiado', 'Cebolinha', 'Salsa', 'Temperos naturais']::text[]),
  ('cal-3', 'Sopa de Feijão com Macarrão', '450g. Sopa nutritiva de feijão com macarrão e legumes.', 21, 'caldos', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', array['Feijão carioca', 'Macarrão ave-maria integral', 'Cenoura', 'Chuchu', 'Temperos']::text[]),
  ('cal-4', 'Caldo de Feijão com Bacon', '450g. Caldo de feijão batido com pedacinhos de bacon light.', 21, 'caldos', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('cal-5', 'Creme de Abóbora com Carne', '450g. Creme de abóbora cabotiá com carne desfiada suculenta.', 21, 'caldos', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('cal-6', 'Caldo de Lentilha (com ou sem calabresa)', '450g. Caldo de lentilha nutritivo (com ou sem calabresa).', 21, 'caldos', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('cal-7', 'Caldo de Abóbora com Alho Poró', '450g. Creme leve de abóbora com o toque especial do alho poró.', 21, 'caldos', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('cal-8', 'Canja de Galinha', '450g. Tradicional canja de galinha com legumes e arroz.', 21, 'caldos', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('cal-9', 'Caldo de Batata com Alho Poró e Bacon', '450g. Caldo cremoso de batata com alho poró e bacon crocante.', 21, 'caldos', 'https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mol-1', 'Ao Sugo com Manjericão (molho de tomate)', '450g. Molho de tomate fresco com manjericão.', 25, 'molhos', 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mol-2', 'Bechamel', '450g. Molho branco clássico.', 25, 'molhos', 'https://images.unsplash.com/photo-1589113182023-7176141d2872?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mol-3', 'Frango Desfiado ao Molho de Tomate', '450g. Frango desfiado suculento ao molho de tomate artesanal.', 35, 'molhos', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mol-4', 'Funghi', '450g. Molho cremoso de funghi secchi.', 35, 'molhos', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mol-5', 'Strogonoff', 'Molho de strogonoff tradicional.', 30, 'molhos', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop', false, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mol-6', 'Bolonhesa', '450g. Molho bolonhesa com carne moída magra.', 25, 'molhos', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mol-7', 'Carne de Panela', '450g. Molho de carne de panela desfiada.', 40, 'molhos', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[]),
  ('mol-8', '4 Queijos', '450g. Molho cremoso com mix de 4 queijos.', 40, 'molhos', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop', true, '{}'::text[], 'encomenda', '{}'::text[])
on conflict (id) do nothing;

insert into public.store_profile (id, name, description, phone, address, instagram_url, delivery_fee, bio, is_open, stats, profile_picture) values
  (1, 'Lev & Fit 🌿', null, '5548984968098', null, 'levfitcongelados', 0, 'Marmitas congeladas saudáveis 🥗
↠ Pedidos por direct ou WhatsApp
↠ Todas as opções podem ser feitas sem lactose
📍 Grande Florianópolis • 🏠 Retirada no local', true, '{"posts":66,"followers":"2.542","following":213}'::jsonb, null)
on conflict (id) do nothing;

insert into public.testimonials (id, name, comment, rating, avatar_url) values
  ('1', 'Mariana Silva', 'As marmitas são deliciosas e super práticas para o meu dia a dia corrido!', 5, 'https://i.pravatar.cc/150?u=mariana'),
  ('2', 'João Pedro', 'Melhor custo-benefício que já encontrei. O desconto progressivo ajuda muito!', 5, 'https://i.pravatar.cc/150?u=joao')
on conflict (id) do nothing;

insert into public.promotions (id, title, description, image_url, is_active, is_launch, cta_label) values
  ('lancamento-sucos', 'Chegaram os Sucos Lev & Fit!', 'Sucos naturais, feitos pra acompanhar suas marmitas. Peça junto no seu pedido!', 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?q=80&w=1080&auto=format&fit=crop', true, true, 'Quero provar'),
  ('1', 'Combo 10 Marmitas', '10 marmitas ou caldos (pode misturar) por R$ 200 — sai R$ 20,00 cada!', 'https://images.unsplash.com/photo-1543353071-873f17a7a088?q=80&w=1200&auto=format&fit=crop', true, false, null),
  ('2', 'Combo 15 Marmitas', '15 marmitas ou caldos (pode misturar) por R$ 285 — sai R$ 19,00 cada!', 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=1200&auto=format&fit=crop', true, false, null),
  ('3', 'Oferta Coxinha e Kibe', 'Leve 3 salgados (coxinha fit ou kibe, pode misturar) por R$ 24,00!', '/produtos/coxinha.jpg', true, false, null)
on conflict (id) do nothing;
