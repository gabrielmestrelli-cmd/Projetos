-- Avaliações reais do Google (copiadas em 24/10/2026) + nota da loja
alter table public.testimonials add column if not exists source text;
alter table public.store_profile add column if not exists google jsonb;
begin;
delete from public.testimonials where id in ('1','2');
insert into public.testimonials (id, name, comment, rating, avatar_url, created_at, source) values
('g-01', 'Paula Alicia Lessa Paulo', 'uma deliciaaaa! a coxinha o tempero, tudo <3', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjU4j3DmMMoYSj842FJpGbnBgIultl3gGWbFBeVNt-JT7tVkxYtyMA=w96-h96-p-rp-mo-br100', '2026-10-17T12:00:00-03:00', 'google'),
('g-02', 'Greice Balbinot', 'Refeições com um sabor incrível e preparo impecável. E ainda tem a praticidade de ter refeições prontas à mão sempre que precisar! Adorei! 😍👏🏻👏🏻👏🏻', 5, 'https://lh3.googleusercontent.com/a/ACg8ocJNRsFhsM45PzVKSvxPI3DI19VdGd4cj77PebmmZjXSP52F0A=w96-h96-p-rp-mo-br100', '2026-10-23T11:53:00-03:00', 'google'),
('g-03', 'Jefferson da Silva Bitencourt', 'Minha experiência com a Lev&Fit foi excelente! Produtos de ótima qualidade e um atendimento nota 10, sempre com muita atenção e cordialidade. Dá gosto encontrar uma empresa que realmente se preocupa com seus clientes. Estão de parabéns pelo trabalho! Recomendo de olhos fechados! 👏🏼', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjUkGk9ympHvKegFndxB-lTkr41XgPtrjBCED3nPVDbOAcASVwE=w96-h96-p-rp-mo-br100', '2026-10-23T11:46:00-03:00', 'google'),
('g-04', 'Sheila S. Bitencourt', 'Perfeita. Comida deliciosa, feita com cuidado e amor.', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjXFegCZMlGqpdE1BkX9wxfB1AuypJVl-LIywD4Y4q-YC1RktF4F=w96-h96-p-rp-mo-br100', '2026-10-23T11:39:00-03:00', 'google'),
('g-05', 'Renata Arêas', 'Comida leve, saborosa e bem apresentável. Eu adoro!', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjVYWyQ_2H5ZxzqbUGy4p-1LZYWCHvDCGTW6SDm5s99i10r54I_SdQ=w96-h96-p-rp-mo-br100', '2026-10-23T11:32:00-03:00', 'google'),
('g-06', 'Eduardo Arêas', 'As melhores marmitas do Sul', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjVor9ApVD-96p2QkjHVaC0rjQKOnABlTe1ynQmNLxVWNf_1r7Fhjw=w96-h96-p-rp-mo-br100', '2026-10-23T11:25:00-03:00', 'google'),
('g-07', 'Gustavo Melo', 'A melhor marmita de todas! Depois que conheci a Lev&Fit não consigo mais viver sem ❤️❤️❤️

Recomendo muito!!!!', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjWg5mYYEL0y4cCvYZpvyqc8eR26ka2se7fHcKQQyb9hfrIs6Wk=w96-h96-p-rp-mo-br100', '2026-10-23T11:18:00-03:00', 'google'),
('g-08', 'Edna Hoffmann Soares', 'Perfeitas!! Práticas e saborosas!', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjWgh34-cBPg7J_A8f450QYyZLKAeq43NBqEjsb36gFencWSUQ4=w96-h96-p-rp-mo-br100', '2026-10-22T11:11:00-03:00', 'google'),
('g-09', 'Pedro Zabot', 'Marmitas ótimas para o dia a dia, porções bem equilibradas para uma boa alimentação, sempre que peço nunca perde a qualidade! Recomendo 100%.', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjUsgBlQa_EUs9mXVJ58EHzrNQwfPi5iONJLsBrzKph7FGPwiXQ=w96-h96-p-rp-mo-br100', '2026-10-21T11:04:00-03:00', 'google'),
('g-10', 'Julia Eulalia', 'Sou cliente da Lev&Fit desde o comecinho, então tenho propriedade pra dizer o quanto as marmitas são gostosas! Além de deliciosas, trouxeram muito mais praticidade pra minha rotina. Não troco por nada e sigo com eles sempre! ❤️', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjW1qPI14dVuPZHKFpGEiZ5iqvO9kxXGTEnSBbMMvvOKVj5jTLrbQg=w96-h96-p-rp-mo-br100', '2026-10-21T10:57:00-03:00', 'google'),
('g-11', 'Fernanda Bassoli Pedroso', 'Marmita gostosa e super prática!! Atendimento excelente.', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjW0EchhAcOr9xFd3zBsO8HjcxcqKrousaotCOsWIHHDw6yP1StR=w96-h96-p-rp-mo-br100', '2026-10-20T10:50:00-03:00', 'google'),
('g-12', 'Rafael Mendes', 'Comida muito saborosa. E a embalagem é muito boa também!', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjUE-37b7an6tFTuWx6YhUP0cXw9NDmxv5e8L5anrh_i-y8UiJaq=w96-h96-p-rp-mo-br100', '2026-10-17T10:43:00-03:00', 'google'),
('g-13', 'Ester Ferreira', 'Marmitas maravilhosas! Capricho em cada detalhe', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjWoYYczPdK4moq7RxlLE3XMssUmG6j-MgO-pUcUvn62fJ1BHryL=w96-h96-p-rp-mo-br100', '2026-10-17T10:36:00-03:00', 'google'),
('g-14', 'Dra Kelly Tatematsu', 'Simplesmente maravilhosas as marmitinhas! O sabor, a embalagem, o capricho fazem toda a diferença.', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjUopi89Ivf-gjEqnzpdHPpm2IZ5cXCRMHxKtXa_cLXfIFEr-M8=w96-h96-p-rp-mo-br100', '2026-10-17T10:29:00-03:00', 'google'),
('g-15', 'Maria Eduarda Souza', 'Amo! As melhores marmitas que já comi na vida!!!', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjUhlz5dUTHKyMHLuMaYrZ2Bh446C0VSHZOPrRzrU4aNEZYUBKFr-g=w96-h96-p-rp-mo-br100', '2026-10-17T10:22:00-03:00', 'google'),
('g-16', 'Ana Claudia Galvan', 'Adoro as marmitas fit! São saborosas, bem preparadas e com ingredientes de qualidade. As porções são ótimas, práticas para o dia a dia e ajudam muito quem busca manter uma alimentação saudável sem abrir mão do sabor. Dá para perceber o cuidado e o carinho em cada refeição. Super recomendo! 👏🥗💚', 5, 'https://lh3.googleusercontent.com/a/ACg8ocKkxhL-WlSKc1dCq80NQXSnGtPGFqf5AVmqgOO1SLUDnDxzqK8=w96-h96-p-rp-mo-br100', '2026-10-17T10:15:00-03:00', 'google'),
('g-17', 'Guilherme Perottoni', 'Marmita bem servida e bem temperada, a melhor marmita congelada de Floripa.', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjVkMqetF_J5aobGNMNLeiXlyzCVIrhnMM_7Qsq0lyG40j_6S916oQ=w96-h96-p-rp-mo-br100', '2026-10-17T10:08:00-03:00', 'google'),
('g-18', 'Daniela Bittencourt', 'Comida deliciosa, super recomendo.', 5, 'https://lh3.googleusercontent.com/a/ACg8ocLDHInXihzk_sLBempH-Aql8ZUKSOpQq-Ikz-m6jjHVXKYM=w96-h96-p-rp-mo-br100', '2026-10-17T10:01:00-03:00', 'google'),
('g-19', 'Família RNM', 'Comida deliciosa e bem feita! Sempre temos no freezer. Recomendo muito!', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjWEI_6qX7iezpfaPxoJddd3JCCQOyceWpJxV0GZViS5i02F6h4=w96-h96-p-rp-mo-br100', '2026-10-17T09:54:00-03:00', 'google'),
('g-20', 'Heitor', 'Marmitas muito boas, saborosas e preparadas com capricho! Ótima opção para quem busca praticidade sem abrir mão de uma alimentação equilibrada no dia a dia.
Sucesso sempre! 👏❤️', 5, 'https://lh3.googleusercontent.com/a/ACg8ocJPN_1XFHJTdSC0O_Uh1XJyv2MSLbQahml757yG8cA3LOtltw=w96-h96-p-rp-mo-br100', '2026-10-17T09:47:00-03:00', 'google'),
('g-21', 'Arthur D', 'Ótimo atendimento e qualidade de marmitas fit', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjW509dfHmkkd7ddDHCUFScmzJoCbciC3rXKwTOep48PkXfKkhmWXg=w96-h96-p-rp-mo-br100', '2026-10-17T09:40:00-03:00', 'google'),
('g-22', 'Gabriel Guthiá', 'Os melhores, variedade e sabor!', 5, 'https://lh3.googleusercontent.com/a/ACg8ocJTvfLLbBhU58bL19LqVjz7IczGM_BEv63aZt_TtpHh8Th_=w96-h96-p-rp-mo-br100', '2026-10-17T09:33:00-03:00', 'google'),
('g-23', 'marianna', 'Eu amei a experiência com a Lev&Fit, sempre me salva nos dias corridos e o sabor é surreal, não parece comida congelada', 5, 'https://lh3.googleusercontent.com/a/ACg8ocLWhxUjnfMoe8BDQudY0hpsc2MneOZiLPmwhVGpS0v-1IhB-w=w96-h96-p-rp-mo-br100', '2026-10-17T09:26:00-03:00', 'google'),
('g-24', 'Stephany Bitencourt', 'Excelentes marmitas! Sabor maravilhoso. Custo benefício ótimo', 5, 'https://lh3.googleusercontent.com/a/ACg8ocL909LJl5e9nR9LjtQKfAxQwFdZKA7RdHrqKknS4FyE67FHoQ=w96-h96-p-rp-mo-br100', '2026-10-17T09:19:00-03:00', 'google'),
('g-25', 'Jordana Gindri', 'Maravilhosas, super indico', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjVYsIfxfA_DEU5J00YG0Cs2Uno1d_1HeOhTncCn1PaCHFYoIdh4=w96-h96-p-rp-mo-br100', '2026-10-17T09:12:00-03:00', 'google'),
('g-26', 'Fernanda Perottoni', 'Comida deliciosa, muito bem preparada, tempero na medida certa e porção generosa! Tudo fresquinho e feito com muito capricho. Recomendo demais! 😋👏', 5, 'https://lh3.googleusercontent.com/a/ACg8ocIjdPHfyno7p-P_RsLXhc_9MtH-BRE_rfyDjvZJGuIJIXGEoQ=w96-h96-p-rp-mo-br100', '2026-10-17T09:05:00-03:00', 'google'),
('g-27', 'Klara Werner', 'Todos os meses faço pedido, e sempre sou surpreendida.

A facilidade abrir o freezer, escolher um prato e comer um alimento fresco e saudável, não tem preço.

As vezes o pessoal aqui de casa me pede uma marmita e outra, e quem prova se apaixona.

Sou fã das marmitas oferecidas pela casa, bem como já solicitei marmitas de forma personalizada e a qualidade, sabor e aparência são sempre de primeira.

Recomendo de olhas fechados!', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjUGpNbM9Wm2HsMVGO2x0SJy8bxQ5e2YhwehajX729qK9rxbYutMRQ=w96-h96-p-rp-mo-br100', '2026-10-17T08:58:00-03:00', 'google'),
('g-28', 'Andre Koenig', 'Marmitas muito saborosas, bem preparadas e com ótima qualidade! Dá pra perceber o cuidado em cada detalhe.', 5, 'https://lh3.googleusercontent.com/a-/ALV-UjVuAYn2qndpKv0-JiCGLxePpCeYffrKr4zGHNqEz1foe2VMmNhosg=w96-h96-p-rp-mo-br100', '2026-10-17T08:51:00-03:00', 'google'),
('g-29', 'Letícia Arêas', 'As melhores marmitas que já comi! Muito mais fácil manter bons hábitos organizando a alimentação! 🤍', 5, 'https://lh3.googleusercontent.com/a/ACg8ocKmUdBdHvSYQrt4c6bSfRHULUVFIeqzJRDxablIkAxnSRaqgA=w96-h96-p-rp-mo-br100', '2026-10-17T08:44:00-03:00', 'google'),
('g-30', 'Marina Paulo', 'Empresa excelente! Tudo preparado com muito cuidado, limpeza e entrega impecável! Pedimos todo mês para os jantares da família!', 5, 'https://lh3.googleusercontent.com/a/ACg8ocK_TQCC1S-9K0XP4tkQxuNbP5sguPXVQShh_xljh348t_1vOw=w96-h96-p-rp-mo-br100', '2026-10-17T08:37:00-03:00', 'google')
on conflict (id) do update set name = excluded.name, comment = excluded.comment, rating = excluded.rating, avatar_url = excluded.avatar_url, source = excluded.source;
update public.store_profile set google = '{"rating": 5, "total": 31, "reviewUrl": "https://g.page/r/CfS1dySmIPbgEBM/review", "mapsUrl": "https://maps.google.com/?cid=16210179806715164148"}'::jsonb where id = 1;
update public.promotions set is_active = false where id = 'lancamento-sucos';
update public.promotions set image_url = '/produtos/combo-10.jpg?v=2' where id = '1';
update public.promotions set image_url = '/produtos/combo-15.jpg?v=2' where id = '2';
update public.promotions set image_url = '/produtos/salgados.jpg' where id = '3';
commit;
select count(*) as avaliacoes from public.testimonials where source = 'google';
