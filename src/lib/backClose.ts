import { useEffect, useRef } from 'react';

// Botão/gesto "voltar" do celular fecha a janela aberta (produto, carrinho, story...)
// em vez de sair do site. Cada janela aberta ganha uma entrada no histórico;
// fechar pelo X tira essa entrada de novo. Uma pilha garante que só a janela de cima fecha.

type Entry = { id: number; close: () => void };
const stack: Entry[] = [];
let seq = 0;
let ignorePops = 0;
let listening = false;

function onPop() {
  if (ignorePops > 0) { ignorePops--; return; }
  const top = stack.pop();
  top?.close();
}

export function useBackToClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    if (!listening) { window.addEventListener('popstate', onPop); listening = true; }
    const entry: Entry = { id: ++seq, close: () => closeRef.current() };
    stack.push(entry);
    try { window.history.pushState({ ...(window.history.state || {}), levfitModal: entry.id }, ''); } catch { /* ignore */ }
    return () => {
      const i = stack.indexOf(entry);
      if (i === -1) return; // já saiu da pilha pelo "voltar"
      stack.splice(i, 1);
      // Fechou pelo X / fora da janela: tira a entrada que criamos do histórico
      if (window.history.state?.levfitModal === entry.id) {
        ignorePops++;
        window.history.back();
      }
    };
  }, [open]);
}
