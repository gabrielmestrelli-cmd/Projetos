-- =====================================================================
-- Lev & Fit — segurança dos pedidos (novembro/2026)
-- Rode este arquivo inteiro no SQL Editor do Supabase (pode rodar de novo sem problema).
-- O mesmo conteúdo já está em supabase/seguranca.sql (instalação nova).
--
-- 1) Pedido só entra pela função criar_pedido (antes dava para gravar direto na tabela).
-- 2) criar_pedido confere tudo no servidor: preço de cada produto vem do banco,
--    descontos (marmitas 10/15, salgados a partir de 3) e cupom PRIMEIRO5 são recalculados,
--    e tem limite de pedidos por telefone e por minuto (contra pedido falso em massa).
--    As regras são as mesmas de src/lib/pricing.ts: mudou lá, mude aqui.
-- 3) "Meus pedidos" (pedidos_do_cliente) devolve só número, data, status, itens e total:
--    não mostra mais nome, endereço nem observações para quem digitar o telefone de outra pessoa.
-- =====================================================================

-- 1) Sem gravação direta na tabela de pedidos (só a função criar_pedido, que roda como dona da tabela)
drop policy if exists "cliente cria pedido" on public.orders;

-- 2) Criar pedido conferindo preços, descontos, cupom e limite de pedidos
create or replace function public.criar_pedido(p jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n text;
  tel text := public.norm_tel(p->>'customer_phone');
  it jsonb;
  prod record;
  qtd int;
  itens jsonb := '[]'::jsonb;
  subtotal numeric := 0;
  qtd_marmitas int := 0;
  qtd_salgados int := 0;
  preco_faixa numeric;
  desconto numeric := 0;
  cupom numeric := 0;
  taxa numeric;
  e_marmita boolean;
  e_salgado boolean;
begin
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'Pedido sem itens';
  end if;
  if jsonb_array_length(p->'items') > 60 then
    raise exception 'Pedido com itens demais';
  end if;
  if length(tel) < 10 or length(tel) > 11 then
    raise exception 'Telefone inválido';
  end if;
  if length(coalesce(p->>'customer_name', '')) > 120
     or length(coalesce(p->>'address', '')) > 500
     or length(coalesce(p->>'notes', '')) > 1000 then
    raise exception 'Texto grande demais';
  end if;

  -- Limite: 3 pedidos por telefone em 10 minutos e 60 pedidos no total em 10 minutos
  perform pg_advisory_xact_lock(hashtext('criar_pedido'));
  if (select count(*) from public.orders where customer_phone = tel and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'Muitos pedidos seguidos deste WhatsApp. Aguarde alguns minutos ou fale com a loja.';
  end if;
  if (select count(*) from public.orders where created_at > now() - interval '10 minutes') >= 60 then
    raise exception 'Muitos pedidos agora. Tente de novo em alguns minutos ou fale com a loja.';
  end if;

  -- Itens: nome e preço sempre do cardápio do banco
  for it in select * from jsonb_array_elements(p->'items') loop
    select id, name, price, category_id into prod
      from public.products where id = it->>'productId' and is_active;
    if not found then
      raise exception 'Produto indisponível: %', coalesce(it->>'name', it->>'productId');
    end if;
    qtd := case when (it->>'quantity') ~ '^[0-9]{1,3}$' then (it->>'quantity')::int else 0 end;
    if qtd < 1 or qtd > 200 then
      raise exception 'Quantidade inválida: %', prod.name;
    end if;
    e_marmita := prod.category_id in ('marmitas', 'caldos') or prod.id like 'mar-%' or prod.id like 'cal-%';
    e_salgado := not e_marmita and (prod.category_id = 'coxinhas' or prod.id like 'cox-%');
    if e_marmita then qtd_marmitas := qtd_marmitas + qtd; end if;
    if e_salgado then qtd_salgados := qtd_salgados + qtd; end if;
    subtotal := subtotal + prod.price * qtd;
    itens := itens || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'productId', prod.id,
      'name', prod.name,
      'price', prod.price,
      'quantity', qtd,
      'notes', nullif(left(coalesce(it->>'notes', ''), 200), '')
    )));
  end loop;

  -- Marmitas e caldos: 15+ → R$ 19 cada; 10+ → R$ 20 cada (nunca mais caro que o preço normal)
  preco_faixa := case when qtd_marmitas >= 15 then 19 when qtd_marmitas >= 10 then 20 else null end;
  -- Salgados (coxinha e kibe, pode misturar): a partir de 3 → R$ 8 cada
  for it in select * from jsonb_array_elements(itens) loop
    select id, price, category_id into prod from public.products where id = it->>'productId';
    e_marmita := prod.category_id in ('marmitas', 'caldos') or prod.id like 'mar-%' or prod.id like 'cal-%';
    e_salgado := not e_marmita and (prod.category_id = 'coxinhas' or prod.id like 'cox-%');
    if e_marmita and preco_faixa is not null then
      desconto := desconto + greatest(0, prod.price - preco_faixa) * (it->>'quantity')::int;
    elsif e_salgado and qtd_salgados >= 3 then
      desconto := desconto + greatest(0, prod.price - 8) * (it->>'quantity')::int;
    end if;
  end loop;
  desconto := round(desconto, 2);

  -- Cupom PRIMEIRO5: 5% nos produtos (já com os combos), só para WhatsApp sem pedido anterior
  if upper(coalesce(p->>'coupon', '')) = 'PRIMEIRO5'
     and not exists (select 1 from public.orders where customer_phone = tel and status <> 'cancelled') then
    cupom := round((subtotal - desconto) * 5 / 100, 2);
  end if;

  -- Taxa de entrega é calculada no navegador (mapa); aqui só um limite de segurança
  taxa := least(greatest(coalesce((p->>'delivery_fee')::numeric, 0), 0), 150);

  n := nextval('public.pedido_numero_seq')::text;
  insert into public.orders
  select (jsonb_populate_record(null::public.orders,
    p || jsonb_build_object(
      'order_number', n,
      'status', 'pending',
      'customer_phone', tel,
      'items', itens,
      'discount', desconto + cupom,
      'delivery_fee', taxa,
      'total_price', round(subtotal - desconto - cupom + taxa, 2),
      'created_at', now()
    ))).*;
  return n;
end;
$$;
grant execute on function public.criar_pedido(jsonb) to anon, authenticated;

-- 3) "Meus pedidos": só o necessário para o cliente acompanhar (sem nome, endereço e observações)
drop function if exists public.pedidos_do_cliente(text);
create function public.pedidos_do_cliente(telefone text)
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', id,
    'order_number', order_number,
    'customer_phone', customer_phone,
    'items', items,
    'total_price', total_price,
    'discount', discount,
    'status', status,
    'created_at', created_at
  )
  from public.orders
  where length(public.norm_tel(telefone)) >= 10
    and public.norm_tel(customer_phone) = public.norm_tel(telefone)
  order by created_at desc
  limit 50;
$$;
grant execute on function public.pedidos_do_cliente(text) to anon, authenticated;
