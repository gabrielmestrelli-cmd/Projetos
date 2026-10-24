// Gera supabase/instalar.sql: cria todas as tabelas, aplica a segurança
// (supabase/seguranca.sql) e cadastra o cardápio que está em src/constants.ts.
// Uso: npx tsx scripts/gerar-sql-inicial.ts
import { readFileSync, writeFileSync } from 'node:fs';
import {
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_TESTIMONIALS,
  INITIAL_PROMOTIONS,
  INITIAL_PROFILE,
} from '../src/constants';

const q = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
};
const arr = (a?: string[]) =>
  a && a.length ? `array[${a.map(q).join(', ')}]::text[]` : `'{}'::text[]`;
const json = (o: unknown) => `${q(JSON.stringify(o))}::jsonb`;

const tables = `
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
`;

const security = readFileSync(new URL('../supabase/seguranca.sql', import.meta.url), 'utf8');

const p = INITIAL_PROFILE;
const seed = [
  '-- 9) Cardápio inicial (de src/constants.ts) ----------------------------',
  `insert into public.categories (id, name, icon, emoji, image_url) values`,
  INITIAL_CATEGORIES.map(c => `  (${q(c.id)}, ${q(c.name)}, ${q(c.icon)}, ${q(c.emoji)}, ${q(c.image)})`).join(',\n'),
  `on conflict (id) do nothing;`,
  '',
  `insert into public.products (id, name, description, price, category_id, image_url, is_active, tags, type, ingredients) values`,
  INITIAL_PRODUCTS.map(pr =>
    `  (${q(pr.id)}, ${q(pr.name)}, ${q(pr.description)}, ${q(pr.price)}, ${q(pr.categoryId)}, ${q(pr.image)}, ${q(pr.available)}, ${arr(pr.tags)}, ${q(pr.type)}, ${arr(pr.ingredients)})`
  ).join(',\n'),
  `on conflict (id) do nothing;`,
  '',
  `insert into public.store_profile (id, name, description, phone, address, instagram_url, delivery_fee, bio, is_open, stats, profile_picture) values`,
  `  (1, ${q(p.name)}, ${q(p.description)}, ${q(p.phone)}, ${q(p.address)}, ${q(p.instagram)}, ${q(p.deliveryFee ?? 0)}, ${q(p.bio)}, ${q(p.isOpen)}, ${json(p.stats)}, ${q(p.profilePicture)})`,
  `on conflict (id) do nothing;`,
  '',
  `insert into public.testimonials (id, name, comment, rating, avatar_url) values`,
  INITIAL_TESTIMONIALS.map(t => `  (${q(t.id)}, ${q(t.name)}, ${q(t.comment)}, ${q(t.rating)}, ${q(t.avatar)})`).join(',\n'),
  `on conflict (id) do nothing;`,
  '',
  `insert into public.promotions (id, title, description, image_url, is_active) values`,
  INITIAL_PROMOTIONS.map(pm => `  (${q(pm.id)}, ${q(pm.title)}, ${q(pm.description)}, ${q(pm.image)}, ${q(pm.active)})`).join(',\n'),
  `on conflict (id) do nothing;`,
].join('\n');

const header = `-- =====================================================================
-- Lev & Fit — INSTALAÇÃO COMPLETA para um projeto Supabase NOVO
-- Supabase > SQL Editor > New query > cole tudo > Run.
-- Cria as tabelas, a segurança e o cardápio. Pode rodar de novo sem duplicar nada.
-- (Arquivo gerado por scripts/gerar-sql-inicial.ts — não edite à mão)
-- =====================================================================
`;

const out = header + tables + '\n' +
  security.replace(/^-- =+\n-- Lev & Fit — Regras[\s\S]*?-- =+\n/, '') + '\n' + seed + '\n';
writeFileSync(new URL('../supabase/instalar.sql', import.meta.url), out);
console.log('supabase/instalar.sql gerado:',
  INITIAL_CATEGORIES.length, 'categorias,', INITIAL_PRODUCTS.length, 'produtos');
