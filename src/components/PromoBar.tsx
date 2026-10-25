import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PRICING, formatBRL } from '../lib/pricing';

// Faixa fina no topo com as vantagens da loja (troca de frase sozinha). Some no painel admin.
const MESSAGES = [
  `10 marmitas ou caldos por ${formatBRL(PRICING.marmitaTiers.find(t => t.min === 10)!.unitPrice * 10)} • 15 por ${formatBRL(PRICING.marmitaTiers.find(t => t.min === 15)!.unitPrice * 15)}`,
  `${PRICING.coxinhaCombo.qty} salgados (coxinha ou kibe) por ${formatBRL(PRICING.coxinhaCombo.price)}`,
  `Primeiro pedido? ${PRICING.firstOrderCoupon.percent}% OFF com o cupom ${PRICING.firstOrderCoupon.code}`,
  'Muitas opções sem lactose',
];

export function PromoBar() {
  const { pathname } = useLocation();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI(n => (n + 1) % MESSAGES.length), 4500);
    return () => clearInterval(t);
  }, []);
  if (pathname.startsWith('/admin')) return null;
  return (
    <div className="bg-green-700 px-4 py-1.5 text-center text-xs font-semibold text-white" role="status" aria-live="polite">
      <span key={i} className="inline-block animate-in fade-in duration-500">{MESSAGES[i]}</span>
    </div>
  );
}
