-- Mais pedidas e regras de lactose (pedido do Conti em 25/10/2026). Tudo por etiqueta (tags), editável no painel.
create or replace function pg_temp.add_tag(pid text, tag text) returns void language sql as $$
  update public.products set tags = array_append(coalesce(tags, '{}'), tag)
  where id = pid and not (tag = any(coalesce(tags, '{}')));
$$;
select pg_temp.add_tag(id, 'mais pedida') from unnest(array['mar-7','mar-trad-7','mar-trad-13','mar-trad-2','mar-trad-21']) id;
select pg_temp.add_tag(id, 'só sem lactose') from unnest(array['mar-trad-8','mar-trad-9','mar-trad-10','mar-trad-1','mar-trad-2','mar-trad-20','mar-trad-21','mar-11','mar-3']) id;
select pg_temp.add_tag(id, 'só com lactose') from unnest(array['mar-trad-18','mar-trad-19','mar-8','mar-9','mar-7','mol-2','mol-8']) id;
update public.store_profile set bio = replace(bio, '↠ Todas as opções podem ser feitas sem lactose', '↠ Várias opções sem lactose') where id = 1;
select id, name, tags from public.products where array_length(tags, 1) > 0 order by id;
