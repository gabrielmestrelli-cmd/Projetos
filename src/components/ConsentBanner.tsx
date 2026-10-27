import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getAdsConsent, onAdsConsentChange, setAdsConsent, type AdsConsent } from '../lib/metaPixel';

/**
 * No celular fica logo abaixo do cabeçalho (embaixo estão a barra de navegação, o "Ver sacola" e o WhatsApp);
 * no computador, no canto inferior esquerdo (o carrinho e o WhatsApp ficam à direita).
 * Barra de cookies de publicidade (Meta Pixel). Aparece só enquanto a pessoa não escolheu.
 * Nunca aparece no painel admin. A escolha pode ser mudada depois na página /#/privacidade.
 */
export function ConsentBanner() {
  const { pathname } = useLocation();
  const [consent, setConsent] = useState<AdsConsent>(() => getAdsConsent());
  useEffect(() => onAdsConsentChange(setConsent), []);

  if (consent !== null || pathname.startsWith('/admin') || pathname.startsWith('/privacidade')) return null;

  return (
    <div
      role="region"
      aria-label="Cookies de publicidade"
      className="fixed inset-x-3 top-[4.5rem] z-[60] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur md:inset-x-auto md:top-auto md:left-4 md:bottom-4"
    >
      <p className="text-xs leading-relaxed text-slate-600">
        Usamos cookies de publicidade da Meta (Facebook/Instagram) para medir nossos anúncios. Você escolhe.{' '}
        <Link to="/privacidade" className="font-semibold text-green-700 underline underline-offset-2">Saiba mais</Link>
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setAdsConsent('denied')}
          className="h-9 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 active:scale-95"
        >
          Recusar
        </button>
        <button
          type="button"
          onClick={() => setAdsConsent('granted')}
          className="h-9 flex-1 rounded-xl bg-green-600 text-sm font-bold text-white active:scale-95"
        >
          Aceitar
        </button>
      </div>
    </div>
  );
}
