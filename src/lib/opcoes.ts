import { Product } from '../types';

// Opções de lactose e a lista "Mais pedidas".
// Tudo é controlado pelas ETIQUETAS do produto no painel (aba Produtos → Etiquetas):
//   "só sem lactose"  → o prato é feito só sem lactose (sem botão de escolha)
//   "só com lactose"  → o prato só existe com lactose
//   "mais pedida"     → aparece na categoria "Mais pedidas"
// Sem etiqueta: marmitas e molhos deixam o cliente escolher com/sem lactose;
// caldos e sopas mostram o aviso "não contém lactose".

export type LactoseRule = 'escolha' | 'so-sem' | 'so-com' | 'nao-contem' | null;

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const tagsOf = (p: Pick<Product, 'tags'>) => (p.tags || []).map(norm);

export const MAIS_PEDIDAS_ID = 'mais-pedidas';

export const isMaisPedida = (p: Pick<Product, 'tags'>) => tagsOf(p).some(t => /^mais pedidas?$/.test(t));

export function lactoseRule(p: Pick<Product, 'tags' | 'categoryId'>): LactoseRule {
  const tags = tagsOf(p);
  if (tags.some(t => /^(so )?sem lactose$/.test(t) || t === 'zero lactose')) return 'so-sem';
  if (tags.some(t => /^(so )?com lactose$/.test(t) || t === 'contem lactose')) return 'so-com';
  if (p.categoryId === 'caldos') return 'nao-contem';
  if (p.categoryId === 'marmitas' || p.categoryId === 'molhos') return 'escolha';
  return null;
}

/** Observação que vai no carrinho quando o prato não tem escolha */
export function fixedLactoseNote(rule: LactoseRule): string | undefined {
  if (rule === 'so-sem') return 'Sem Lactose';
  if (rule === 'so-com') return 'Com Lactose';
  return undefined;
}

export const LACTOSE_INFO: Record<'so-sem' | 'so-com' | 'nao-contem', string> = {
  'so-sem': 'Este prato é feito somente sem lactose.',
  'so-com': 'Este prato é feito somente com lactose (não tem opção sem lactose).',
  'nao-contem': 'Não contém lactose.',
};
