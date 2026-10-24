# CLAUDE.md — Lev & Fit

Guia para o Claude Code (e qualquer IA) trabalhar neste repositório. **Descreve o código como ele é de verdade** — se mudar a arquitetura, atualize este arquivo.

## 1. O que é

App web de cardápio digital e pedidos da **Lev & Fit**, marmitas congeladas saudáveis da Grande Florianópolis.

- **Cardápio do cliente (`/#/`)** — `src/components/CustomerMenu.tsx`: perfil estilo Instagram, stories/promoções, categorias, detalhes do prato, carrinho com descontos progressivos, checkout que abre o WhatsApp e grava o pedido no Supabase. Aba "Meus pedidos" identifica o cliente pelo telefone.
- **Painel admin (`/#/admin`)** — `src/components/AdminPanel.tsx`: pedidos (Pendente → Preparando → Entregue / Cancelado), produtos, categorias, depoimentos, promoções, perfil da loja, QR Code de mesa. Toca som de caixa registradora em pedido novo.

## 2. Stack

- React 19 + TypeScript, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`, `@import "tailwindcss"` em `src/index.css` — **não criar `tailwind.config.js`**)
- Componentes shadcn em `components/ui/` (na **raiz**, não em `src/`), alias `@` = raiz do projeto
- `react-router-dom` v7 com **HashRouter** (URLs com `#`)
- `lucide-react`, `sonner`, `motion`, `qrcode.react`
- **Banco: só Supabase** (`src/lib/supabase.ts`). Não há Firebase, nem servidor Express, nem pasta `data/`.

## 3. Comandos

| Ação | Comando |
|---|---|
| Instalar | `npm install` |
| Rodar em desenvolvimento | `npm run dev` (porta 3000) |
| Checar tipos | `npm run lint` |
| Build de produção | `npm run build` → `dist/` |

Depois de qualquer alteração, rode `npm run lint` e `npm run build`.

## 4. Estrutura

```text
components/ui/          # shadcn (button, dialog, tabs, ...)
lib/utils.ts            # cn() (clsx + tailwind-merge)
src/
  App.tsx               # estado global, carga do Supabase, auth do admin, rotas
  components/
    CustomerMenu.tsx    # cardápio do cliente
    AdminPanel.tsx      # painel admin
  lib/
    supabase.ts         # cliente Supabase
    sound.ts            # som de caixa registradora (Web Audio, sem arquivo)
  constants.ts          # cardápio/perfil iniciais (fallback se o banco estiver vazio)
  types.ts              # tipos (Order, Product, Category, ...)
  productImages.ts
supabase/seguranca.sql  # regras RLS + função is_admin + pedidos_do_cliente
```

## 5. Dados e segurança

Tabelas no Supabase: `categories`, `products`, `store_profile` (linha `id = 1`), `testimonials`, `promotions`, `orders`, `admins`.

- O cardápio é lido do Supabase; `localStorage` (`menu_data`) só serve de cache para abrir rápido.
- **Admin** entra com e-mail e senha pelo **Supabase Auth**. Só quem está na tabela `admins` é admin (`is_admin()`). Nunca volte a usar senha escrita no código.
- **RLS** (ver `supabase/seguranca.sql`):
  - cardápio: leitura pública, escrita só admin;
  - `orders`: qualquer um pode **criar** pedido com `status = 'pending'`; só admin lê/altera;
  - cliente vê os próprios pedidos pela função `pedidos_do_cliente(telefone)`.
- Pedidos novos chegam ao admin em tempo real via `supabase.channel` (Realtime) na tabela `orders`.
- **Nunca** colocar a chave `service_role` ou chaves de IA no frontend (tudo com `VITE_` ou `define` vai parar no site). Recursos que precisam de chave secreta devem virar Supabase Edge Function.
- A geração de imagens com Gemini está **desativada** por esse motivo.

## 6. Variáveis de ambiente (`.env`)

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...   # chave publishable/anon, pode ser pública
```
