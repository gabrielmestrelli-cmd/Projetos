// Desenhos das bolinhas de categoria (no lugar dos emojis, que não batiam com a comida)
import type { ReactElement } from 'react';

const Todos = () => (
  <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <circle cx="32" cy="34" r="22" fill="#F1F5F9" />
    <circle cx="32" cy="34" r="16" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
    <path d="M22 34 C22 28 27 25 32 25 C37 25 42 28 42 34 Z" fill="#F8E7B9" />
    <circle cx="27" cy="31" r="3" fill="#4E9A35" />
    <circle cx="34" cy="29" r="2.6" fill="#E2573B" />
    <circle cx="38" cy="32" r="2.4" fill="#F2A33A" />
    <path d="M9 18 V30 M6 18 V25 C6 28 12 28 12 25 V18" stroke="#64748B" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M55 18 C51 22 51 28 55 30 V46" stroke="#64748B" strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);

// Marmita: pote com arroz, frango e brócolis
const Tradicionais = () => (
  <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <rect x="9" y="20" width="46" height="30" rx="6" fill="#E2E8F0" />
    <rect x="12" y="23" width="40" height="24" rx="4" fill="#FFFFFF" />
    <rect x="12" y="23" width="22" height="24" rx="4" fill="#FBF6EA" />
    <circle cx="17" cy="29" r="1.6" fill="#EADFC4" /><circle cx="23" cy="33" r="1.6" fill="#EADFC4" /><circle cx="18" cy="39" r="1.6" fill="#EADFC4" /><circle cx="27" cy="41" r="1.6" fill="#EADFC4" /><circle cx="28" cy="29" r="1.6" fill="#EADFC4" />
    <rect x="36" y="26" width="7" height="6" rx="2" fill="#E9A657" />
    <rect x="43" y="30" width="6" height="6" rx="2" fill="#D98E3F" />
    <circle cx="40" cy="41" r="4" fill="#4E9A35" /><circle cx="45" cy="40" r="3.4" fill="#3F8A2C" />
    <rect x="41" y="42" width="2" height="4" rx="1" fill="#6FB24A" />
    <rect x="9" y="14" width="46" height="6" rx="3" fill="#86C15A" opacity="0.9" />
  </svg>
);

// Fatia de lasanha em camadas
const Lasanhas = () => (
  <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <ellipse cx="32" cy="50" rx="24" ry="5" fill="#E2E8F0" />
    <path d="M12 26 L44 18 L54 24 L22 33 Z" fill="#F6C453" />
    <path d="M14 27 C18 24 20 29 24 26 C28 23 30 28 34 25 C38 22 40 26 44 23" stroke="#E2573B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    <path d="M12 26 L22 33 V48 L12 41 Z" fill="#EBB44A" />
    <path d="M22 33 L54 24 V39 L22 48 Z" fill="#F2D27A" />
    <path d="M22 37 L54 28" stroke="#C8452D" strokeWidth="3" />
    <path d="M22 42 L54 33" stroke="#FFF4D6" strokeWidth="2.5" />
    <path d="M22 45 L54 36" stroke="#C8452D" strokeWidth="2.5" />
    <path d="M12 30 L22 37 M12 35 L22 42" stroke="#C8452D" strokeWidth="2.5" />
    <circle cx="40" cy="20" r="2" fill="#4E9A35" />
  </svg>
);

// Coxinha e kibe
const Salgados = () => (
  <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <ellipse cx="32" cy="52" rx="24" ry="4" fill="#E2E8F0" />
    <path d="M24 12 C30 20 38 30 38 40 C38 47 32 52 24 52 C16 52 10 47 10 40 C10 30 18 20 24 12 Z" fill="#E7A63B" />
    <path d="M24 12 C30 20 38 30 38 40 C38 47 32 52 24 52" fill="#D18E2A" opacity="0.5" />
    <circle cx="18" cy="38" r="1.3" fill="#B0741C" /><circle cx="26" cy="32" r="1.3" fill="#B0741C" /><circle cx="22" cy="45" r="1.3" fill="#B0741C" /><circle cx="30" cy="42" r="1.3" fill="#B0741C" />
    <ellipse cx="46" cy="42" rx="12" ry="8" transform="rotate(-25 46 42)" fill="#8B5A2B" />
    <ellipse cx="46" cy="42" rx="12" ry="8" transform="rotate(-25 46 42)" fill="none" stroke="#6E4520" strokeWidth="1.5" />
    <circle cx="43" cy="40" r="1.2" fill="#4E9A35" /><circle cx="49" cy="43" r="1.2" fill="#4E9A35" />
  </svg>
);

// Panela de molho de tomate com manjericão
const Molhos = () => (
  <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <path d="M10 28 H54 V44 C54 50 49 54 43 54 H21 C15 54 10 50 10 44 Z" fill="#94A3B8" />
    <rect x="4" y="30" width="8" height="4" rx="2" fill="#64748B" />
    <rect x="52" y="30" width="8" height="4" rx="2" fill="#64748B" />
    <ellipse cx="32" cy="28" rx="22" ry="6" fill="#CBD5E1" />
    <ellipse cx="32" cy="28" rx="19" ry="4.5" fill="#D9412B" />
    <circle cx="25" cy="27" r="2" fill="#B8321F" /><circle cx="37" cy="29" r="1.6" fill="#B8321F" />
    <path d="M38 24 C40 20 45 20 46 23 C43 24 40 25 38 24 Z" fill="#4E9A35" />
    <path d="M33 25 C33 21 36 19 39 20 C38 23 36 25 33 25 Z" fill="#3F8A2C" />
    <path d="M44 6 L32 26" stroke="#B07A45" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// Tigela de sopa com vapor
const Caldos = () => (
  <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
    <path d="M24 8 C21 12 27 14 24 18 M32 6 C29 10 35 12 32 16 M40 8 C37 12 43 14 40 18" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M8 30 H56 C56 44 46 54 32 54 C18 54 8 44 8 30 Z" fill="#F2A33A" />
    <path d="M8 30 H56 C56 33 55 36 54 38 H10 C9 36 8 33 8 30 Z" fill="#E08E22" />
    <ellipse cx="32" cy="30" rx="24" ry="5" fill="#F6C063" />
    <circle cx="24" cy="30" r="2.2" fill="#4E9A35" /><circle cx="34" cy="29" r="2" fill="#E2573B" /><circle cx="41" cy="31" r="1.8" fill="#4E9A35" />
    <rect x="24" y="54" width="16" height="4" rx="2" fill="#E08E22" />
  </svg>
);

const BY_ID: Record<string, () => ReactElement> = {
  all: Todos,
  marmitas: Tradicionais,
  lasanhas: Lasanhas,
  coxinhas: Salgados,
  molhos: Molhos,
  caldos: Caldos,
};

/** Desenho da categoria; procura também pelo nome para categorias novas. */
export function CategoryArt({ id, name }: { id: string; name?: string }) {
  const n = (name || '').toLowerCase();
  const Art =
    BY_ID[id] ||
    (/lasanh/.test(n) ? Lasanhas : /molho/.test(n) ? Molhos : /caldo|sopa/.test(n) ? Caldos : /coxinha|kibe|salgad/.test(n) ? Salgados : /marmit|tradic|fit/.test(n) ? Tradicionais : null);
  return Art ? <Art /> : null;
}
