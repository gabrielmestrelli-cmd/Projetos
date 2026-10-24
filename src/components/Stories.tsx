import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles } from 'lucide-react';
import { Promotion } from '../types';

const STORY_MS = 5000;
const SEEN_KEY = 'stories_seen';

const loadSeen = (): string[] => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
};
const markSeen = (id: string) => {
  try {
    const seen = new Set(loadSeen()); seen.add(id);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-100)));
  } catch { /* ignore */ }
};

/** Lançamentos primeiro, depois as outras ofertas ativas. */
export const orderStories = (promos: Promotion[]) =>
  promos.filter(p => p.active).sort((a, b) => Number(!!b.isLaunch) - Number(!!a.isLaunch));

export function StoryRing({ stories, onOpen }: { stories: Promotion[]; onOpen: (index: number) => void }) {
  const [seen, setSeen] = useState<string[]>(loadSeen);
  useEffect(() => {
    const onSeen = () => setSeen(loadSeen());
    window.addEventListener('stories-seen', onSeen);
    return () => window.removeEventListener('stories-seen', onSeen);
  }, []);
  if (stories.length === 0) return null;
  return (
    <div className="scrollbar-hide flex gap-4 overflow-x-auto px-4 py-3">
      {stories.map((s, i) => {
        const isSeen = seen.includes(s.id);
        return (
          <button key={s.id} onClick={() => onOpen(i)} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5" aria-label={`Ver story: ${s.title}`}>
            <span className={`rounded-full p-[2.5px] ${isSeen ? 'bg-slate-200' : s.isLaunch ? 'bg-gradient-to-tr from-lime-400 via-green-500 to-emerald-700' : 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600'}`}>
              <span className="block rounded-full border-2 border-white bg-white">
                <img src={s.image} alt="" className="h-16 w-16 rounded-full object-cover" referrerPolicy="no-referrer" />
              </span>
            </span>
            <span className="w-full truncate text-center text-[11px] font-medium text-slate-700">
              {s.isLaunch ? 'Lançamento' : s.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function StoryViewer({ stories, startIndex, onClose, onCta }: {
  stories: Promotion[];
  startIndex: number;
  onClose: () => void;
  onCta: (story: Promotion) => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const paused = useRef(false);
  const last = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null);
  const story = stories[index];

  const next = useCallback(() => {
    setProgress(0);
    setIndex(i => {
      if (i + 1 >= stories.length) { onClose(); return i; }
      return i + 1;
    });
  }, [stories.length, onClose]);
  const prev = () => { setProgress(0); setIndex(i => Math.max(0, i - 1)); };

  useEffect(() => {
    if (!story) return;
    markSeen(story.id);
    window.dispatchEvent(new Event('stories-seen'));
  }, [story]);

  useEffect(() => {
    let raf = 0;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (t: number) => {
      if (last.current !== null && !paused.current) {
        setProgress(p => {
          const np = p + (t - (last.current as number)) / (reduce ? STORY_MS * 1.6 : STORY_MS);
          if (np >= 1) { setTimeout(next, 0); return 1; }
          return np;
        });
      }
      last.current = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); last.current = null; };
  }, [index, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [next, onClose]);

  if (!story) return null;

  const onPointerDown = (e: ReactPointerEvent) => {
    paused.current = true;
    touchStart.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    paused.current = false;
    const s = touchStart.current;
    touchStart.current = null;
    if (!s) return;
    const dy = e.clientY - s.y;
    const dx = e.clientX - s.x;
    if (dy > 80 && Math.abs(dy) > Math.abs(dx)) { onClose(); return; }
    if (Date.now() - s.t > 350) return; // segurou para pausar
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.3) prev(); else next();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black" role="dialog" aria-modal="true" aria-label={story.title}>
      <div className="relative h-full w-full max-w-md select-none overflow-hidden bg-black sm:h-[92vh] sm:rounded-3xl">
        <img src={story.image} alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" draggable={false} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />

        {/* barrinhas */}
        <div className="absolute inset-x-3 top-3 z-20 flex gap-1" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
          {stories.map((s, i) => (
            <div key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35">
              <div className="h-full bg-white" style={{ width: `${(i < index ? 1 : i === index ? progress : 0) * 100}%` }} />
            </div>
          ))}
        </div>

        <div className="absolute inset-x-3 z-20 flex items-center gap-2" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
          <img src="/logo-icone.png" alt="" className="h-8 w-8 rounded-full bg-white object-contain p-1" />
          <span className="text-sm font-semibold text-white drop-shadow">levfitcongelados</span>
          <button onClick={onClose} className="ml-auto rounded-full p-2 text-white" aria-label="Fechar">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* área de toque */}
        <div className="absolute inset-0 z-10" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { paused.current = false; }} />

        <div className="absolute inset-x-0 bottom-0 z-20 space-y-3 p-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
          {story.isLaunch ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-lime-400 px-3 py-1 text-xs font-black uppercase tracking-wide text-green-950">
              <Sparkles className="h-3.5 w-3.5" /> Lançamento
            </span>
          ) : (
            <span className="inline-block rounded-full bg-red-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Oferta</span>
          )}
          <h2 className="text-3xl font-black leading-tight text-white drop-shadow" style={{ textWrap: 'balance' }}>{story.title}</h2>
          {story.description && <p className="text-base text-white/90">{story.description}</p>}
          <button
            onClick={() => { onCta(story); onClose(); }}
            className="mt-2 w-full rounded-2xl bg-white py-3.5 text-base font-bold text-green-700 active:scale-[0.98]"
          >
            {story.ctaLabel || (story.isLaunch ? 'Quero provar' : 'Aproveitar oferta')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Faixa de ofertas no começo da página: passa sozinha e abre o story ao tocar. */
export function OffersCarousel({ offers, onOpen }: { offers: Promotion[]; onOpen: (index: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const pausedUntil = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const cards = [...el.querySelectorAll<HTMLElement>('[data-offer]')];
      const center = el.scrollLeft + el.clientWidth / 2;
      let best = 0, dist = Infinity;
      cards.forEach((c, i) => {
        const d = Math.abs(c.offsetLeft - el.offsetLeft + c.offsetWidth / 2 - center);
        if (d < dist) { dist = d; best = i; }
      });
      setActive(best);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [offers.length]);

  useEffect(() => {
    if (offers.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      const el = ref.current;
      if (!el || Date.now() < pausedUntil.current) return;
      const cards = el.querySelectorAll<HTMLElement>('[data-offer]');
      const next = (active + 1) % cards.length;
      el.scrollTo({ left: cards[next].offsetLeft - el.offsetLeft - 16, behavior: 'smooth' });
    }, 4500);
    return () => clearInterval(t);
  }, [active, offers.length]);

  if (offers.length === 0) return null;
  const pause = () => { pausedUntil.current = Date.now() + 8000; };

  return (
    <div className="mx-auto max-w-4xl">
      <div
        ref={ref}
        onPointerDown={pause}
        onTouchStart={pause}
        className="scrollbar-hide flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 pt-3"
      >
        {offers.map((o, i) => (
          <button
            key={o.id}
            data-offer
            onClick={() => onOpen(i)}
            className="relative h-40 w-[88%] shrink-0 snap-center overflow-hidden rounded-3xl text-left shadow-md sm:h-48 sm:w-[60%]"
            aria-label={`Ver oferta: ${o.title}`}
          >
            <img src={o.image} alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" />
            <div className={`absolute inset-0 bg-gradient-to-r ${o.isLaunch ? 'from-green-950/85 via-green-900/50' : 'from-black/75 via-black/40'} to-transparent`} />
            <div className="relative flex h-full max-w-[78%] flex-col justify-center gap-1.5 p-5">
              {o.isLaunch ? (
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-lime-400 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-green-950">
                  <Sparkles className="h-3 w-3" /> Lançamento
                </span>
              ) : (
                <span className="w-fit rounded-full bg-red-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Oferta</span>
              )}
              <h3 className="text-xl font-black leading-tight text-white sm:text-2xl" style={{ textWrap: 'balance' }}>{o.title}</h3>
              {o.description && <p className="line-clamp-2 text-sm text-white/85">{o.description}</p>}
              <span className={`mt-1 text-sm font-bold ${o.isLaunch ? 'text-lime-300' : 'text-white'}`}>
                {o.ctaLabel || (o.isLaunch ? 'Quero provar' : 'Ver oferta')} →
              </span>
            </div>
          </button>
        ))}
      </div>
      {offers.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-1">
          {offers.map((o, i) => (
            <span key={o.id} className={`h-1.5 rounded-full transition-all ${i === active ? 'w-5 bg-green-600' : 'w-1.5 bg-slate-300'}`} />
          ))}
        </div>
      )}
    </div>
  );
}
