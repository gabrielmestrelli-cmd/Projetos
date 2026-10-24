# CLAUDE.md — Lev & Fit

Guia para o Claude Code (e qualquer IA) trabalhar neste repositório. **Descreve o código como ele é de verdade** — se mudar a arquitetura, atualize este arquivo.

## 1. O que é

App web de cardápio digital e pedidos da **Lev & Fit**, marmitas congeladas saudáveis da Grande Florianópolis.

- **Cardápio do cliente (`/#/`)** — `src/components/CustomerMenu.tsx`: perfil estilo Instagram, promoções, categorias, detalhes do prato (opção com/sem lactose nas marmitas, com/sem glúten nas coxinhas), **um único carrinho** (gaveta de baixo no celular, lateral no computador) salvo no navegador, checkout com entrega/retirada, endereço, taxa, pagamento e observações. Ao enviar, grava o pedido no Supabase e abre o WhatsApp da loja com a mensagem pronta. Aba "Meus pedidos" identifica o cliente pelo telefone.
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
Se mudar `supabase/seguranca.sql` ou o cardápio inicial, rode `npx tsx scripts/gerar-sql-inicial.ts` para atualizar o `instalar.sql`.

O painel admin é carregado sob demanda (`React.lazy`), e as bibliotecas ficam em arquivos separados (`manualChunks` no `vite.config.ts`).

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
    pricing.ts          # REGRAS DE DESCONTO e total do carrinho (summarizeCart)
    phone.ts            # máscara, validação e link do WhatsApp
    id.ts               # newId() (UUID com plano B fora de https)
    sound.ts            # toca public/sounds/caixa-registradora.mp3 (plano B: som sintético)
  constants.ts          # cardápio/perfil iniciais (fallback se o banco estiver vazio)
  types.ts              # tipos (Order, Product, Category, ...)
  productImages.ts
public/                 # logo.png, logo-icone.png, perfil.jpg, favicon, ícones do celular, sounds/
supabase/instalar.sql   # INSTALAÇÃO COMPLETA num projeto novo (tabelas + segurança + cardápio)
supabase/seguranca.sql  # só regras RLS/funções (para um banco que já tem as tabelas)
scripts/gerar-sql-inicial.ts  # gera o instalar.sql a partir de seguranca.sql + constants.ts
```

## 5. Regras de negócio

- Todos os produtos são **sob encomenda** (`type = 'encomenda'`), que é o padrão para produto novo.

- **Descontos** ficam só em `src/lib/pricing.ts` (`PRICING`):
  - 10+ marmitas → R$ 20 cada; 15+ → R$ 19 cada (nunca mais caro que o preço normal do prato);
  - coxinhas: cada 3 saem por R$ 24.
  - Marmita = categoria `marmitas` ou id `mar-*`; coxinha = categoria `coxinhas` ou id `cox-*`.
- **Taxa de entrega** = `profile.deliveryFee` (editável no admin), só quando o cliente escolhe Entrega. Se for 0, aparece "a combinar".
- **Número do pedido** é gerado pelo banco (`criar_pedido`, sequência a partir de #1001). Se a função não existir, o app grava direto e usa os 6 primeiros caracteres do id.
- **Telefones** são gravados só com números e sem o 55 (`normalizePhone`). Use `whatsappLink()` para qualquer link de WhatsApp.
- Nunca montar texto de URL na mão: sempre `encodeURIComponent` (o `&` de "Lev & Fit" quebrava a mensagem).

## 6. Dados e segurança

Tabelas no Supabase: `categories`, `products`, `store_profile` (linha `id = 1`), `testimonials`, `promotions`, `orders`, `admins`.

- O cardápio é lido do Supabase; `localStorage` (`menu_data`) só serve de cache para abrir rápido.
- **Admin**: o painel pede **só a senha**; o e-mail fica fixo em `VITE_ADMIN_EMAIL` (padrão `bielmaestrelli@hotmail.com`) e o login é feito pelo **Supabase Auth**. Para trocar a senha, mude a senha desse usuário no Supabase, não no código. Só quem está na tabela `admins` é admin (`is_admin()`). Nunca volte a usar senha escrita no código.
- **RLS** (ver `supabase/seguranca.sql`):
  - cardápio: leitura pública, escrita só admin;
  - `orders`: qualquer um pode **criar** pedido (pela função `criar_pedido`, que força `status = 'pending'`); só admin lê/altera;
  - cliente vê os próprios pedidos pela função `pedidos_do_cliente(telefone)`.
- `store_profile` guarda também `bio`, `is_open`, `stats` (publicações/seguidores) e `profile_picture`.
- `orders` guarda também `delivery_type`, `address`, `delivery_fee` e `notes`.
- O app salva **só os itens que mudaram** (compara com o estado atual) em um `upsert` por tabela, e mostra aviso se der erro. Nunca reenviar a lista inteira: um painel aberto há tempo sobrescreveria mudanças feitas no banco. Não engolir erros do Supabase: ele devolve `{ error }` em vez de lançar exceção.
- Fotos enviadas no admin são reduzidas para 900px / JPEG 80% antes de salvar.
- Pedidos novos chegam ao admin em tempo real via `supabase.channel` (Realtime) na tabela `orders`.
- **Nunca** colocar a chave `service_role` ou chaves de IA no frontend (tudo com `VITE_` ou `define` vai parar no site). Recursos que precisam de chave secreta devem virar Supabase Edge Function.
- A geração de imagens com Gemini está **desativada** por esse motivo.

## 7. Variáveis de ambiente (`.env`)

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...   # chave publishable/anon, pode ser pública
```

Sem essas duas variáveis o site abre só com o cardápio padrão de `constants.ts` e não grava nada.

## 8. Publicação

- No ar em **https://levfit-congelados.vercel.app** (conta Vercel `bobmendes`; o domínio aponta para o projeto mais recente, hoje `racing-gust-kzxj11i`).
- O site é estático: `npm run build` gera `dist/`, que é enviado com `vercel deploy dist --prod` (precisa `vercel login`). As variáveis `VITE_*` são embutidas no build, então o `.env` precisa estar certo **antes** do build.
- Não usar `cleanUrls` no `vercel.json`: com ele a página inicial dá 404.
