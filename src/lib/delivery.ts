import { DeliverySettings } from '../types';

// Cálculo da taxa de entrega por distância.
// Serviços gratuitos, chamados direto do navegador (sem chave):
//  - ViaCEP / BrasilAPI: endereço e coordenadas pelo CEP
//  - Nominatim (OpenStreetMap): coordenadas do endereço com número
//  - OSRM: distância de carro pelas ruas

export const DEFAULT_DELIVERY: DeliverySettings = {
  mode: 'fixed',
  baseFee: 0,
  perKm: 1.5,
  includedKm: 3,
  maxKm: 25,
  freeAbove: 0,
};

export interface LatLng { lat: number; lng: number }

export interface CepAddress {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  coords?: LatLng;
}

export const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');
export const maskCep = (s: string) => {
  const d = onlyDigits(s).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

const withTimeout = async (url: string, ms = 8000) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
};

/** Endereço (e, quando houver, coordenadas) a partir do CEP. */
export async function lookupCep(cepRaw: string): Promise<CepAddress | null> {
  const cep = onlyDigits(cepRaw);
  if (cep.length !== 8) return null;

  const [via, brasil] = await Promise.allSettled([
    withTimeout(`https://viacep.com.br/ws/${cep}/json/`),
    withTimeout(`https://brasilapi.com.br/api/cep/v2/${cep}`),
  ]);

  const v = via.status === 'fulfilled' && !via.value?.erro ? via.value : null;
  const b = brasil.status === 'fulfilled' ? brasil.value : null;
  if (!v && !b) return null;

  const lat = Number(b?.location?.coordinates?.latitude);
  const lng = Number(b?.location?.coordinates?.longitude);

  return {
    cep,
    street: v?.logradouro || b?.street || '',
    neighborhood: v?.bairro || b?.neighborhood || '',
    city: v?.localidade || b?.city || '',
    state: v?.uf || b?.state || '',
    coords: Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 ? { lat, lng } : undefined,
  };
}

/** Coordenadas de um endereço (rua + número + cidade). */
export async function geocode(parts: { street?: string; number?: string; neighborhood?: string; city?: string; state?: string; free?: string }): Promise<LatLng | null> {
  const base = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br';
  const tries: string[] = [];
  if (parts.street && parts.city) {
    const street = [parts.number, parts.street].filter(Boolean).join(' ');
    tries.push(`${base}&street=${encodeURIComponent(street)}&city=${encodeURIComponent(parts.city)}${parts.state ? `&state=${encodeURIComponent(parts.state)}` : ''}`);
  }
  const free = parts.free || [parts.street, parts.number, parts.neighborhood, parts.city, parts.state].filter(Boolean).join(', ');
  if (free) tries.push(`${base}&q=${encodeURIComponent(free)}`);

  for (const url of tries) {
    try {
      const res = await withTimeout(url);
      if (Array.isArray(res) && res[0]) return { lat: Number(res[0].lat), lng: Number(res[0].lon) };
    } catch { /* tenta o próximo */ }
  }
  return null;
}

/** Distância em linha reta (km). */
export function straightKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Distância de carro pelas ruas (km). Se o serviço falhar, estima pela linha reta × 1,35. */
export async function drivingKm(from: LatLng, to: LatLng): Promise<{ km: number; estimated: boolean }> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
    const res = await withTimeout(url, 8000);
    const meters = res?.routes?.[0]?.distance;
    if (typeof meters === 'number' && meters > 0) return { km: meters / 1000, estimated: false };
  } catch { /* usa a estimativa */ }
  return { km: straightKm(from, to) * 1.35, estimated: true };
}

export interface FeeResult {
  fee: number;
  /** fora do raio de entrega */
  outOfRange: boolean;
  free: boolean;
}

const roundTo50 = (n: number) => Math.ceil(n * 2) / 2;

/** Taxa de entrega para uma distância e um valor de pedido. */
export function feeFor(settings: DeliverySettings, km: number | null, orderValue: number): FeeResult {
  if (settings.freeAbove > 0 && orderValue >= settings.freeAbove) {
    const out = settings.mode === 'per_km' && km !== null && settings.maxKm > 0 && km > settings.maxKm;
    return { fee: 0, outOfRange: out, free: !out };
  }
  if (settings.mode === 'fixed') return { fee: settings.baseFee, outOfRange: false, free: settings.baseFee === 0 };
  if (km === null) return { fee: settings.baseFee, outOfRange: false, free: false };
  if (settings.maxKm > 0 && km > settings.maxKm) return { fee: 0, outOfRange: true, free: false };
  const extra = Math.max(0, km - settings.includedKm) * settings.perKm;
  return { fee: roundTo50(settings.baseFee + extra), outOfRange: false, free: false };
}

export const formatKm = (km: number) =>
  `${km.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: km < 10 ? 1 : 0 })} km`;
