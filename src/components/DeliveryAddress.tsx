import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, MapPin, AlertCircle, CheckCircle2, LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeliverySettings } from '../types';
import { lookupCep, geocode, reverseGeocode, drivingKm, feeFor, maskCep, onlyDigits, formatKm, mapLink, LatLng, Precision } from '../lib/delivery';
import { formatBRL } from '../lib/pricing';

export interface AddressFields {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  /** Ponto exato vindo do GPS do celular ("usar minha localização"). Some se o cliente mudar o endereço. */
  lat?: number;
  lng?: number;
}

export const EMPTY_ADDRESS: AddressFields = { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' };

export const formatAddress = (a: AddressFields) =>
  [
    [a.street, a.number].filter(Boolean).join(', ') + (a.complement ? ` - ${a.complement}` : ''),
    a.neighborhood,
    [a.city, a.state].filter(Boolean).join('/'),
    a.cep ? `CEP ${maskCep(a.cep)}` : '',
  ].filter(Boolean).join(' - ');

export const isAddressComplete = (a: AddressFields) =>
  onlyDigits(a.cep).length === 8 && a.street.trim() !== '' && a.number.trim() !== '' && a.city.trim() !== '';

export type QuoteStatus = 'idle' | 'loading' | 'ok' | 'not_found' | 'no_origin';

export interface Quote {
  status: QuoteStatus;
  km: number | null;
  /** distância pela linha reta (o serviço de rotas falhou) */
  estimated?: boolean;
  /** onde o endereço caiu no mapa, para o cliente conferir */
  point?: LatLng;
  precision?: Precision;
}

const STORAGE_KEY = 'customer_address_v2';

export function loadSavedAddress(): AddressFields {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY_ADDRESS, ...JSON.parse(raw) } : EMPTY_ADDRESS;
  } catch {
    return EMPTY_ADDRESS;
  }
}

export function saveAddress(a: AddressFields) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); } catch { /* sem espaço */ }
}

/**
 * Calcula a distância da loja até o endereço sempre que CEP + número mudarem.
 * Só roda no modo "por km" e quando a loja tem ponto de saída configurado.
 */
export function useDeliveryQuote(settings: DeliverySettings, address: AddressFields): Quote {
  const [quote, setQuote] = useState<Quote>({ status: 'idle', km: null });
  const seq = useRef(0);
  const origin: LatLng | null =
    settings.originLat != null && settings.originLng != null ? { lat: settings.originLat, lng: settings.originLng } : null;

  const gps: LatLng | null = address.lat != null && address.lng != null ? { lat: address.lat, lng: address.lng } : null;
  const key = `${onlyDigits(address.cep)}|${address.number.trim()}|${address.street.trim()}|${address.city.trim()}|${gps?.lat}|${gps?.lng}|${settings.mode}|${origin?.lat}|${origin?.lng}`;

  useEffect(() => {
    if (settings.mode !== 'per_km') { setQuote({ status: 'idle', km: null }); return; }
    if (!origin) { setQuote({ status: 'no_origin', km: null }); return; }
    const hasAddress = onlyDigits(address.cep).length === 8 && !!address.number.trim();
    if (!gps && !hasAddress) { setQuote({ status: 'idle', km: null }); return; }

    const my = ++seq.current;
    setQuote({ status: 'loading', km: null });
    const t = setTimeout(async () => {
      let point: LatLng | null = gps;
      let precision: Precision = 'gps';
      if (!point) {
        const cepInfo = await lookupCep(address.cep).catch(() => null);
        const found = await geocode({
          street: address.street || cepInfo?.street,
          number: address.number,
          neighborhood: address.neighborhood || cepInfo?.neighborhood,
          city: address.city || cepInfo?.city,
          state: address.state || cepInfo?.state,
        }).catch(() => null);
        if (found) { point = found; precision = found.precision; }
        else if (cepInfo?.coords) { point = cepInfo.coords; precision = 'aproximado'; }
      }
      if (my !== seq.current) return;
      if (!point) { setQuote({ status: 'not_found', km: null }); return; }
      const { km, estimated } = await drivingKm(origin, point);
      if (my !== seq.current) return;
      setQuote({ status: 'ok', km, estimated, point, precision });
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return quote;
}

/** Campos de endereço com preenchimento automático pelo CEP. */
export function AddressForm({ value, onChange, idPrefix = 'addr' }: { value: AddressFields; onChange: (a: AddressFields) => void; idPrefix?: string }) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState('');
  const numberRef = useRef<HTMLInputElement>(null);
  const lastCep = useRef(onlyDigits(value.cep));

  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState('');
  // Mudou rua, CEP ou cidade na mão: o ponto do GPS deixa de valer.
  // O número não: depois do GPS a pessoa só completa o número da casa.
  const set = (patch: Partial<AddressFields>) => {
    const movesPoint = ['cep', 'street', 'city'].some(k => k in patch);
    onChange({ ...value, ...patch, ...(movesPoint ? { lat: undefined, lng: undefined } : {}) });
  };

  const useMyLocation = () => {
    setGpsError('');
    if (!('geolocation' in navigator)) { setGpsError('Seu navegador não deixa pegar a localização. Preencha o endereço.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const found = await reverseGeocode(point);
        setLocating(false);
        lastCep.current = onlyDigits(found?.cep || '');
        onChange({
          ...value,
          cep: found?.cep || value.cep,
          street: found?.street || value.street,
          number: found?.number || value.number,
          neighborhood: found?.neighborhood || value.neighborhood,
          city: found?.city || value.city,
          state: found?.state || value.state,
          lat: point.lat,
          lng: point.lng,
        });
        if (!found?.number) setTimeout(() => numberRef.current?.focus(), 50);
      },
      err => {
        setLocating(false);
        setGpsError(err.code === err.PERMISSION_DENIED
          ? 'Você não liberou a localização. Pode preencher o endereço abaixo.'
          : 'Não consegui pegar sua localização agora. Preencha o endereço abaixo.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const onCep = async (raw: string) => {
    const masked = maskCep(raw);
    set({ cep: masked });
    const digits = onlyDigits(masked);
    setCepError('');
    if (digits.length !== 8 || digits === lastCep.current) return;
    lastCep.current = digits;
    setCepLoading(true);
    const info = await lookupCep(digits).catch(() => null);
    setCepLoading(false);
    if (!info) { setCepError('CEP não encontrado. Preencha o endereço abaixo.'); return; }
    onChange({
      ...value,
      lat: undefined,
      lng: undefined,
      cep: masked,
      street: info.street || value.street,
      neighborhood: info.neighborhood || value.neighborhood,
      city: info.city || value.city,
      state: info.state || value.state,
    });
    setTimeout(() => numberRef.current?.focus(), 50);
  };

  const field = 'h-11 rounded-xl border-none bg-slate-50';
  const label = 'text-xs font-bold uppercase text-slate-500';

  return (
    <div className="grid gap-3">
      <Button type="button" variant="outline" className="h-11 rounded-xl border-green-200 bg-green-50 font-semibold text-green-800 hover:bg-green-100" onClick={useMyLocation} disabled={locating}>
        {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
        {locating ? 'Pegando sua localização…' : value.lat != null ? 'Localização pega pelo GPS ✓ (tocar para atualizar)' : 'Usar minha localização (mais preciso)'}
      </Button>
      {gpsError && <p className="text-xs text-amber-700">{gpsError}</p>}
      <p className="text-center text-xs text-slate-400">ou digite o endereço</p>
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-cep`} className={label}>CEP</Label>
          <Input id={`${idPrefix}-cep`} inputMode="numeric" autoComplete="postal-code" placeholder="88000-000" className={field} value={value.cep} onChange={e => onCep(e.target.value)} />
        </div>
        <a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noreferrer" className="pb-3 text-xs text-slate-400 underline">Não sei o CEP</a>
      </div>
      {cepLoading && <p className="flex items-center gap-1 text-xs text-slate-500"><Loader2 className="h-3 w-3 animate-spin" /> Buscando endereço…</p>}
      {cepError && <p className="text-xs text-amber-700">{cepError}</p>}
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-street`} className={label}>Rua</Label>
        <Input id={`${idPrefix}-street`} autoComplete="address-line1" className={field} value={value.street} onChange={e => set({ street: e.target.value })} />
      </div>
      <div className="grid grid-cols-[110px_1fr] gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-number`} className={label}>Número</Label>
          <Input id={`${idPrefix}-number`} ref={numberRef} inputMode="numeric" className={field} value={value.number} onChange={e => set({ number: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-compl`} className={label}>Complemento</Label>
          <Input id={`${idPrefix}-compl`} autoComplete="address-line2" placeholder="Apto, bloco…" className={field} value={value.complement} onChange={e => set({ complement: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1fr] gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-bairro`} className={label}>Bairro</Label>
          <Input id={`${idPrefix}-bairro`} className={field} value={value.neighborhood} onChange={e => set({ neighborhood: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-city`} className={label}>Cidade</Label>
          <Input id={`${idPrefix}-city`} autoComplete="address-level2" className={field} value={value.city} onChange={e => set({ city: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

const PRECISION_TEXT: Record<Precision, string> = {
  gps: 'pela sua localização',
  exato: 'pelo número da casa',
  rua: 'pela rua (sem o número exato)',
  aproximado: 'pelo CEP/bairro (aproximado)',
};

/** Caixa com a distância e o valor da entrega. */
export function QuoteBox({ settings, quote }: { settings: DeliverySettings; quote: Quote; orderValue?: number }) {
  if (settings.mode === 'fixed') {
    const r = feeFor(settings, null);
    return (
      <div className="flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-800">
        <MapPin className="h-4 w-4 shrink-0" />
        {r.fee > 0 ? <>Taxa de entrega: <strong>{formatBRL(r.fee)}</strong></> : 'Taxa de entrega a combinar pelo WhatsApp'}
      </div>
    );
  }
  if (quote.status === 'idle') {
    return <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Toque em "Usar minha localização" ou coloque o CEP e o número para calcular a entrega.</p>;
  }
  if (quote.status === 'loading') {
    return <p className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Calculando a distância…</p>;
  }
  if (quote.status === 'no_origin' || quote.status === 'not_found' || quote.km === null) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        {quote.status === 'not_found'
          ? 'Não achamos esse endereço no mapa. Toque em "Usar minha localização" ou confira o CEP e o número. Se não der, a taxa é combinada pelo WhatsApp.'
          : 'Taxa de entrega a combinar pelo WhatsApp.'}
      </div>
    );
  }
  const r = feeFor(settings, quote.km);
  const exact = quote.precision === 'gps' || quote.precision === 'exato';
  const mapa = quote.point ? (
    <a href={mapLink(quote.point)} target="_blank" rel="noreferrer" className="font-semibold underline">Ver no mapa</a>
  ) : null;
  if (r.outOfRange) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Fica a {formatKm(quote.km)} da gente, fora da área de entrega (até {formatKm(settings.maxKm)}). Escolha retirar no local ou chame no WhatsApp. {mapa}</span>
      </div>
    );
  }
  return (
    <div className={`flex items-start gap-2 rounded-xl p-3 text-sm ${exact ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>
      {exact ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span className="space-y-1">
        <span className="block">
          {quote.estimated ? 'Cerca de ' : ''}{formatKm(quote.km)} até você • entrega <strong>{r.fee > 0 ? formatBRL(r.fee) : 'a combinar'}</strong>
        </span>
        <span className="block text-xs">
          Calculado {quote.precision ? PRECISION_TEXT[quote.precision] : ''}. {mapa}
          {!exact && ' Se o ponto não for a sua casa, toque em "Usar minha localização" para acertar o valor.'}
        </span>
      </span>
    </div>
  );
}
