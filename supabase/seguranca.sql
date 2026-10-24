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

-- 4) "Meus pedidos" do cliente: busca só os pedidos daquele telefone ------
create or replace function public.pedidos_do_cliente(telefone text)
returns setof public.orders
language sql
stable
security definer
set search_path = public
as $$
  select * from public.orders
  where customer_phone = telefone
  order by created_at desc
  limit 50;
$$;
grant execute on function public.pedidos_do_cliente(text) to anon, authenticated;

-- =====================================================================
-- 5) CRIAR O ADMIN (faça depois de rodar o resto)
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
