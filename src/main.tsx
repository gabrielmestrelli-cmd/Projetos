import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Se o site atualizar enquanto alguém está com a página aberta, um arquivo antigo pode sumir.
// Nesse caso recarrega uma vez sozinho em vez de ficar tela branca.
window.addEventListener('vite:preloadError', () => {
  try {
    if (!sessionStorage.getItem('reloaded-after-update')) {
      sessionStorage.setItem('reloaded-after-update', '1');
      location.reload();
    }
  } catch { location.reload(); }
});

/** Se algo quebrar, mostra um aviso com botão de recarregar (nunca tela branca). */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  declare props: { children: ReactNode };
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('Erro no site:', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        <img src="/logo.png" alt="Lev & Fit" style={{ height: 64 }} />
        <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Opa, algo não carregou direito.</p>
        <button
          onClick={() => { try { sessionStorage.clear(); } catch { /* ok */ } location.reload(); }}
          style={{ background: '#16a34a', color: '#fff', border: 0, borderRadius: 12, padding: '12px 20px', fontSize: 16, fontWeight: 700 }}
        >
          Recarregar
        </button>
        <a href="https://wa.me/5548991864704" style={{ color: '#15803d', fontWeight: 600 }}>Pedir pelo WhatsApp</a>
        <small style={{ color: '#94a3b8', maxWidth: 320, wordBreak: 'break-word' }}>{String(this.state.error?.message || '')}</small>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
