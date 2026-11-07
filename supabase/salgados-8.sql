-- Lev & Fit — textos da nova oferta de salgados (novembro/2026)
-- Regra nova: a partir de 3 salgados (coxinha e kibe, pode misturar), cada um sai por R$ 8,00.
-- Troca só a frase da oferta nas descrições; o resto do texto fica igual. Pode rodar de novo sem problema.

update public.products
set description = replace(replace(description,
  'ou 3 un por R$ 24,00!', '; a partir de 3 salgados (coxinha e kibe), R$ 8,00 cada!'),
  'ou 3 salgados (coxinha e kibe) por R$ 24,00!', '; a partir de 3 salgados (coxinha e kibe), R$ 8,00 cada!')
where description like '%R$ 24,00%';

update public.products
set description = replace(description, 'R$ 9,00 ; a partir', 'R$ 9,00; a partir')
where description like '%R$ 9,00 ; a partir%';

update public.promotions
set description = 'A partir de 3 salgados (coxinha fit ou kibe, pode misturar), cada um sai por R$ 8,00!'
where id = '3';
