// Meta Pixel da Lev & Fit — ÚNICO lugar do site que fala com o Meta.
//
// Regras:
// - Só carrega o script do Meta depois que a pessoa aceita os cookies de publicidade (ConsentBanner).
// - Nunca carrega nem envia nada no painel (/#/admin).
// - Rastreamento automático do Meta desligado (autoConfig e PageView por mudança de histórico),
//   para não duplicar os eventos que enviamos à mão.
// - Cada evento leva um eventID único (prepara a futura Conversions API, que usa o mesmo ID para não contar 2x).
// - Nunca enviar dados pessoais (nome, telefone, endereço, observações).

export const META_PIXEL_ID = '1462507210271506';

const CONSENT_KEY = 'levfit_consent_ads'; // 'granted' | 'denied'
export type AdsConsent = 'granted' | 'denied' | null;

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: unknown;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

// ---------- consentimento ----------

const listeners = new Set<(c: AdsConsent) => void>();

export function getAdsConsent(): AdsConsent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch {
    return null;
  }
}

export function setAdsConsent(value: 'granted' | 'denied') {
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* navegador sem armazenamento: vale só nesta visita */ }
  memoryConsent = value;
  if (value === 'granted') {
    if (loadPixel()) window.fbq?.('consent', 'grant');
    flushPageView();
  } else {
    revokePixel();
  }
  listeners.forEach(fn => fn(value));
}

/** Para a barra de consentimento e a página de privacidade acompanharem a escolha. */
export function onAdsConsentChange(fn: (c: AdsConsent) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// Guarda a escolha também em memória (caso o navegador bloqueie o localStorage)
let memoryConsent: AdsConsent = null;
const consentNow = (): AdsConsent => getAdsConsent() ?? memoryConsent;

// ---------- carregamento ----------

const isAdminRoute = () => (window.location.hash || '').startsWith('#/admin');
let loaded = false;

/** Carrega o Pixel uma única vez, só com consentimento e fora do painel. Devolve true se está pronto. */
function loadPixel(): boolean {
  if (loaded) return true;
  if (typeof window === 'undefined' || consentNow() !== 'granted' || isAdminRoute()) return false;

  // Código base oficial do Meta (fbevents.js), reescrito sem minificação
  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;

    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
  }

  // O site usa o histórico do navegador para o "voltar" fechar janelas: sem isso cada janela viraria um PageView
  window.fbq.disablePushState = true;
  // Desliga eventos automáticos (cliques em botão etc.) que duplicariam os nossos
  window.fbq('set', 'autoConfig', false, META_PIXEL_ID);
  window.fbq('init', META_PIXEL_ID);
  loaded = true;
  return true;
}

/** Retira o consentimento: para de enviar e apaga os cookies do Meta neste site. */
function revokePixel() {
  if (loaded) window.fbq?.('consent', 'revoke');
  for (const name of ['_fbp', '_fbc']) {
    const host = window.location.hostname;
    document.cookie = `${name}=; Max-Age=0; path=/`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=${host}`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=.${host}`;
  }
}

// ---------- envio ----------

const newEventId = (event: string) =>
  `${event}.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}`;

function track(event: string, params: Record<string, unknown>, eventID = newEventId(event)) {
  if (consentNow() !== 'granted' || isAdminRoute()) return;
  if (!loadPixel()) return;
  window.fbq?.('track', event, params, { eventID });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PixelItem {
  id: string;
  quantity: number;
  item_price: number;
}

/** Junta itens do mesmo produto (ex.: com e sem lactose) num só, somando as quantidades. */
function mergeItems(items: PixelItem[]): PixelItem[] {
  const map = new Map<string, PixelItem>();
  for (const it of items) {
    if (!it.id || it.quantity <= 0) continue;
    const prev = map.get(it.id);
    if (prev) prev.quantity += it.quantity;
    else map.set(it.id, { id: it.id, quantity: it.quantity, item_price: round2(it.item_price) });
  }
  return [...map.values()];
}

// PageView: uma vez por carregamento do site, quando a pessoa está no cardápio.
let pageViewWanted = false;
let pageViewSent = false;

function flushPageView() {
  if (!pageViewWanted || pageViewSent || consentNow() !== 'granted' || isAdminRoute()) return;
  if (!loadPixel()) return;
  pageViewSent = true;
  window.fbq?.('track', 'PageView', {}, { eventID: newEventId('PageView') });
}

/** Chamado pelo cardápio quando ele aparece na tela. Sem consentimento, fica guardado até a pessoa aceitar. */
export function pageViewCardapio() {
  pageViewWanted = true;
  flushPageView();
}

/** O cardápio saiu da tela (ex.: foi para o painel): aceitar depois não gera PageView fora dele. */
export function leftCardapio() {
  pageViewWanted = false;
}

export function trackViewContent(p: { id: string; name: string; price: number; category?: string }) {
  track('ViewContent', {
    content_ids: [p.id],
    content_name: p.name,
    content_category: p.category || '',
    content_type: 'product',
    value: round2(p.price),
    currency: 'BRL',
  });
}

/** Só o que foi adicionado NESTA ação (não o carrinho inteiro). */
export function trackAddToCart(p: { id: string; price: number }, quantity: number) {
  if (quantity <= 0) return;
  track('AddToCart', {
    content_ids: [p.id],
    contents: [{ id: p.id, quantity, item_price: round2(p.price) }],
    content_type: 'product',
    value: round2(p.price * quantity),
    currency: 'BRL',
  });
}

/** Botões de WhatsApp para tirar dúvidas (nunca o de finalizar pedido). */
export function trackContact(origem: 'cabecalho' | 'flutuante') {
  track('Contact', { content_name: origem });
}

/**
 * Pedido válido sendo enviado para o WhatsApp.
 * value = produtos com descontos de combo e cupom, SEM a taxa de entrega.
 * O eventID usa o id do pedido: o mesmo pedido nunca conta duas vezes.
 */
const checkoutsSent = new Set<string>();
export function trackInitiateCheckout(orderId: string, items: PixelItem[], valueAfterDiscounts: number) {
  if (checkoutsSent.has(orderId)) return;
  const contents = mergeItems(items);
  if (contents.length === 0) return;
  checkoutsSent.add(orderId);
  track('InitiateCheckout', {
    content_ids: contents.map(c => c.id),
    contents,
    content_type: 'product',
    num_items: contents.reduce((s, c) => s + c.quantity, 0),
    value: round2(valueAfterDiscounts),
    currency: 'BRL',
  }, `InitiateCheckout.${orderId}`);
}

// Quem já tinha aceitado em outra visita: o Pixel é carregado quando o cardápio pedir o PageView
// (não aqui, para nunca carregar no painel).
