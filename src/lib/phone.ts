export const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');

/** Telefone só com números, sem o 55 do Brasil (ex.: 48999998888) */
export const normalizePhone = (s: string) => {
  let d = onlyDigits(s);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d;
};

/** Celular brasileiro válido: DDD + 8 ou 9 dígitos */
export const isValidPhone = (s: string) => {
  const d = normalizePhone(s);
  return d.length === 10 || d.length === 11;
};

/** Máscara (48) 99999-8888 enquanto o cliente digita */
export const maskPhone = (s: string) => {
  const d = normalizePhone(s).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

/** Link do WhatsApp para um número (adiciona o 55 quando falta) */
export const whatsappLink = (phone: string, text?: string) => {
  let d = onlyDigits(phone);
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
};
