import { OrderItem, Product } from '../types';

// Regras de desconto da Lev & Fit. Mude os valores aqui e o site inteiro acompanha.
export const PRICING = {
  marmitaTiers: [
    { min: 15, unitPrice: 19 },
    { min: 10, unitPrice: 20 },
  ],
  coxinhaCombo: { qty: 3, price: 24 },
};

/** Entra no combo de 10/15 unidades: marmitas tradicionais e caldos/sopas (mesma tabela no cardápio do Instagram). */
export const isMarmita = (item: { productId?: string; id?: string; categoryId?: string }) => {
  const id = item.productId ?? item.id ?? '';
  return item.categoryId === 'marmitas' || item.categoryId === 'caldos' || id.startsWith('mar-') || id.startsWith('cal-');
};

/** Salgados (coxinha e kibe): cada 3 saem pelo preço do combo. */
export const isCoxinha = (item: { productId?: string; id?: string; categoryId?: string }) =>
  item.categoryId === 'coxinhas' || (item.productId ?? item.id ?? '').startsWith('cox-');

/** Salgado que tem opção com/sem glúten (o kibe "contém glúten", então não tem). */
export const hasGlutenOption = (product: { id: string; categoryId?: string; description?: string }) =>
  isCoxinha(product) && !/cont[ée]m gl[úu]ten/i.test(product.description ?? '');

export interface CartSummary {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  marmitaCount: number;
  coxinhaCount: number;
  /** Preço da marmita com desconto (null = sem desconto ainda) */
  marmitaTierPrice: number | null;
  /** Quantas marmitas faltam para o próximo desconto */
  marmitasToNextTier: number | null;
  nextTierPrice: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function summarizeCart(cart: OrderItem[], products: Product[], deliveryFee = 0): CartSummary {
  const withCategory = cart.map(item => ({
    ...item,
    categoryId: products.find(p => p.id === item.productId)?.categoryId,
  }));

  let subtotal = 0;
  let marmitaCount = 0;
  let coxinhaCount = 0;
  const coxinhaPrices: number[] = [];

  for (const item of withCategory) {
    subtotal += item.price * item.quantity;
    if (isMarmita(item)) marmitaCount += item.quantity;
    else if (isCoxinha(item)) {
      coxinhaCount += item.quantity;
      for (let i = 0; i < item.quantity; i++) coxinhaPrices.push(item.price);
    }
  }

  // Marmitas: a partir de 10 / 15 unidades, cada uma sai pelo preço da faixa
  // (nunca cobra mais caro do que o preço normal do prato).
  const tier = PRICING.marmitaTiers.find(t => marmitaCount >= t.min) ?? null;
  let discount = 0;
  if (tier) {
    for (const item of withCategory) {
      if (isMarmita(item)) discount += Math.max(0, item.price - tier.unitPrice) * item.quantity;
    }
  }

  // Coxinhas: cada grupo de 3 sai por R$ 24 (aplica nas mais caras primeiro)
  const { qty, price } = PRICING.coxinhaCombo;
  coxinhaPrices.sort((a, b) => b - a);
  for (let i = 0; i + qty <= coxinhaPrices.length; i += qty) {
    const groupTotal = coxinhaPrices.slice(i, i + qty).reduce((s, p) => s + p, 0);
    discount += Math.max(0, groupTotal - price);
  }

  const sortedAsc = [...PRICING.marmitaTiers].sort((a, b) => a.min - b.min);
  const next = sortedAsc.find(t => marmitaCount < t.min) ?? null;

  subtotal = round2(subtotal);
  discount = round2(discount);
  const fee = cart.length > 0 ? round2(deliveryFee) : 0;

  return {
    subtotal,
    discount,
    deliveryFee: fee,
    total: round2(subtotal - discount + fee),
    marmitaCount,
    coxinhaCount,
    marmitaTierPrice: tier?.unitPrice ?? null,
    marmitasToNextTier: next ? next.min - marmitaCount : null,
    nextTierPrice: next?.unitPrice ?? null,
  };
}

export const formatBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
