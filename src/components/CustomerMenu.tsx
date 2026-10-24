import { createPortal } from 'react-dom';
import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Category, Product, Order, OrderItem, Testimonial, Promotion, BusinessProfile } from '../types';
import { ICON_MAP, INITIAL_TESTIMONIALS, INITIAL_PROMOTIONS, BUSINESS_CONFIG, CATEGORY_ORDER, INITIAL_PRODUCTS } from '../constants';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ShoppingCart, Plus, Minus, Search, Instagram, Star, Clock, Package, CheckCircle2, CreditCard, Landmark, Banknote, Grid, LayoutList, Heart, MessageCircle, Send, Bookmark, Home, User, Trash2, Leaf, Droplets, Info, Utensils, ClipboardList, Bike, Store, Loader2, AlertCircle, Sparkles, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { summarizeCart, isMarmita, isCoxinha, hasGlutenOption, formatBRL, PRICING } from '../lib/pricing';
import { maskPhone, isValidPhone, normalizePhone, whatsappLink } from '../lib/phone';
import { Textarea } from '@/components/ui/textarea';
import { newId } from '../lib/id';
import { DEFAULT_DELIVERY, feeFor, formatKm, mapLink } from '../lib/delivery';
import { StoryViewer, OffersCarousel, orderStories } from './Stories';
import { CategoryArt } from './CategoryIcons';
import { AddressForm, QuoteBox, useDeliveryQuote, loadSavedAddress, saveAddress, formatAddress, isAddressComplete, AddressFields } from './DeliveryAddress';

interface CustomerMenuProps {
  categories: Category[];
  products: Product[];
  testimonials: Testimonial[];
  promotions: Promotion[];
  /** stories que a loja postou no Instagram nas últimas 24 h */
  instagramStories?: Promotion[];
  profile: BusinessProfile;
  orders: Order[];
  userPhone: string | null;
  onLogin: (phone: string) => void;
  onLogout: () => void;
  onPlaceOrder: (order: Order) => Promise<string>;
}

export default function CustomerMenu({ 
  categories, 
  products, 
  testimonials, 
  promotions, 
  instagramStories = [],
  profile, 
  orders,
  userPhone,
  onLogin,
  onLogout,
  onPlaceOrder 
}: CustomerMenuProps) {
  const [searchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<OrderItem[]>(() => {
    try {
      const saved = localStorage.getItem('cart');
      return saved ? (JSON.parse(saved) as OrderItem[]) : [];
    } catch {
      return [];
    }
  });
  const [viewMode, setViewMode] = useState<'feed' | 'grid'>('feed');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [detailGluten, setDetailGluten] = useState<'com' | 'sem'>('com');
  const [detailLactose, setDetailLactose] = useState<'com' | 'sem'>('com');
  
  // Checkout fields
  const [customerName, setCustomerName] = useState(localStorage.getItem('customer_name') || '');
  const [customerPhone, setCustomerPhone] = useState(maskPhone(userPhone || ''));
  const [deliveryType, setDeliveryType] = useState<'entrega' | 'retirada'>(
    (localStorage.getItem('delivery_type') as 'entrega' | 'retirada') || 'entrega'
  );
  const [addressFields, setAddressFields] = useState<AddressFields>(() => loadSavedAddress());
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [storyIndex, setStoryIndex] = useState<number | null>(null);
  // Qual lista o visualizador mostra: ofertas do site ou stories do Instagram
  const [storyList, setStoryList] = useState<'offers' | 'instagram'>('offers');
  const [isFeeOpen, setIsFeeOpen] = useState(false);
  const [loginPhone, setLoginPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao-link' | 'dinheiro'>('pix');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('menu');

  // Filter orders for the current user
  const myOrders = useMemo(() => {
    if (!userPhone) return [];
    const me = normalizePhone(userPhone);
    return orders.filter(o => normalizePhone(o.customerPhone) === me);
  }, [orders, userPhone]);

  // Carrinho não some se a página recarregar
  useEffect(() => {
    try { localStorage.setItem('cart', JSON.stringify(cart)); } catch { /* sem espaço */ }
  }, [cart]);

  // Se um produto saiu do cardápio ou mudou de preço, o carrinho acompanha
  useEffect(() => {
    if (products.length === 0) return;
    setCart(prev => {
      const next = prev
        .filter(item => products.some(p => p.id === item.productId && p.available))
        .map(item => {
          const p = products.find(pr => pr.id === item.productId)!;
          return p.price !== item.price || p.name !== item.name ? { ...item, price: p.price, name: p.name } : item;
        });
      const changed = next.length !== prev.length || next.some((it, i) => it !== prev[i]);
      return changed ? next : prev;
    });
  }, [products]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const isNew = (product: Product) =>
    product.tags?.includes('novidade') ||
    (product.id.startsWith('mar-') && parseInt(product.id.split('-')[1]) > 4) ||
    (product.id.startsWith('cal-') && parseInt(product.id.split('-')[1]) > 2) ||
    (product.id.startsWith('mol-') && parseInt(product.id.split('-')[1]) > 2);

  /** Peso escrito na descrição (ex.: "350g"), para o selo do prato */
  const weightOf = (product: Product) => product.description.match(/\b(\d{2,4})\s?(g|kg|ml|l)\b/i)?.[0].replace(/\s/, '') ?? null;

  const hasOptions = (product: Product) => hasGlutenOption(product) || product.categoryId === 'marmitas';

  const stories = useMemo(() => orderStories(promotions), [promotions]);

  const handleStoryCta = (story: Promotion) => {
    // Se existir categoria de sucos e o story for de lançamento, abre ela
    const juice = categories.find(c => /suco/i.test(c.name));
    if (story.isLaunch && juice) setSelectedCategory(juice.id);
    setActiveTab('menu');
    setTimeout(() => document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Ordem do cardápio pedida pela loja: tradicionais, (lasanhas), caldos e sopas, molhos, lanches.
  // Categoria nova (que não está na lista) vai para o fim, na ordem em que foi criada.
  const rankOf = (categoryId: string) => {
    const i = CATEGORY_ORDER.indexOf(categoryId);
    return i === -1 ? CATEGORY_ORDER.length + categories.findIndex(c => c.id === categoryId) : i;
  };
  // Dentro da categoria: a ordem do cardápio do Instagram (constants.ts); pratos novos depois, por nome
  const productRank = (id: string) => {
    const i = INITIAL_PRODUCTS.findIndex(p => p.id === id);
    return i === -1 ? 9999 : i;
  };
  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => rankOf(a.id) - rankOf(b.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories],
  );

  const filteredProducts = useMemo(() => {
    const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const q = norm(searchQuery.trim());
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const matchesSearch = !q || norm(p.name).includes(q) || norm(p.description).includes(q);
      return matchesCategory && matchesSearch && p.available;
    }).sort((a, b) =>
      rankOf(a.categoryId) - rankOf(b.categoryId) ||
      productRank(a.id) - productRank(b.id) ||
      a.name.localeCompare(b.name, 'pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, categories, selectedCategory, searchQuery]);

  // Em "Todos" (sem busca), um título separa cada categoria ao rolar a lista
  const showSections = selectedCategory === 'all' && !searchQuery.trim();
  const sectionHeader = (product: Product, idx: number, mode: 'feed' | 'grid') => {
    if (!showSections) return null;
    if (idx > 0 && filteredProducts[idx - 1].categoryId === product.categoryId) return null;
    const cat = categories.find(c => c.id === product.categoryId);
    if (!cat) return null;
    return (
      <div
        className={`flex items-center gap-2.5 bg-slate-50/80 px-4 py-3 ${mode === 'grid' ? 'col-span-3 md:col-span-4' : 'md:col-span-2 md:rounded-xl md:mt-2'}`}
        id={`secao-${cat.id}`}
      >
        <span className="h-8 w-8 shrink-0"><CategoryArt id={cat.id} name={cat.name} /></span>
        <h2 className="text-base font-black uppercase tracking-wide text-slate-800">{cat.name}</h2>
      </div>
    );
  };

  // iPhone (Safari): depois que um painel/janela fecha e libera a rolagem, as barras fixas
  // às vezes ficam fora do lugar. Uma rolagem de 1px força o Safari a reposicionar.
  useEffect(() => {
    let locked = false;
    const nudge = () => requestAnimationFrame(() => { window.scrollBy(0, 1); window.scrollBy(0, -1); });
    const check = () => {
      const now = getComputedStyle(document.body).overflow === 'hidden' || getComputedStyle(document.documentElement).overflow === 'hidden' || document.body.style.position === 'fixed';
      if (locked && !now) { nudge(); setTimeout(nudge, 350); }
      locked = now;
    };
    const mo = new MutationObserver(check);
    mo.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'] });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    return () => mo.disconnect();
  }, []);

  // Avaliações: as mais novas primeiro
  const google = profile.google;
  const reviews = useMemo(
    () => [...testimonials].filter(t => t.comment?.trim()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [testimonials],
  );

  const addToCart = (product: Product, quantity: number = 1, notes?: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && item.notes === notes);
      if (existing) {
        return prev.map(item => 
          (item.productId === product.id && item.notes === notes)
            ? { ...item, quantity: item.quantity + quantity } 
            : item
        );
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        price: product.price, 
        quantity: quantity,
        notes: notes
      }];
    });
    toast.success(`${quantity > 1 ? `${quantity}x ` : ''}${product.name}${notes ? ` (${notes})` : ''} adicionado ao carrinho`);
  };

  const removeFromCart = (productId: string, notes?: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId && item.notes === notes);
      if (existing && existing.quantity > 1) {
        return prev.map(item => 
          (item.productId === productId && item.notes === notes)
            ? { ...item, quantity: item.quantity - 1 } 
            : item
        );
      }
      return prev.filter(item => !(item.productId === productId && item.notes === notes));
    });
  };

  const updateQuantity = (productId: string, quantity: number, notes?: string) => {
    if (quantity < 1) {
      clearItemFromCart(productId, notes);
      return;
    }
    setCart(prev => prev.map(item => 
      (item.productId === productId && item.notes === notes)
        ? { ...item, quantity } 
        : item
    ));
  };

  const clearItemFromCart = (productId: string, notes?: string) => {
    setCart(prev => prev.filter(item => !(item.productId === productId && item.notes === notes)));
    toast.info('Item removido do carrinho');
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const deliverySettings = profile.delivery ?? DEFAULT_DELIVERY;
  const quote = useDeliveryQuote(deliverySettings, addressFields);
  const feeResult = feeFor(deliverySettings, quote.status === 'ok' ? quote.km : null);
  // Taxa "a combinar" quando é por km e ainda não deu pra calcular
  const feeUnknown = deliverySettings.mode === 'per_km' && quote.status !== 'ok';
  const deliveryFee = deliveryType === 'entrega' && !feeUnknown && !feeResult.outOfRange ? feeResult.fee : 0;
  const summary = summarizeCart(cart, products, deliveryFee);
  const { subtotal, discount, total, marmitaCount, coxinhaCount } = summary;

  const unitPriceLabel = (item: OrderItem) => {
    const product = products.find(p => p.id === item.productId);
    const ref = { productId: item.productId, categoryId: product?.categoryId };
    if (isMarmita(ref) && summary.marmitaTierPrice !== null && summary.marmitaTierPrice < item.price) {
      return `${formatBRL(summary.marmitaTierPrice)} cada (combo)`;
    }
    if (isCoxinha(ref) && coxinhaCount >= PRICING.coxinhaCombo.qty) {
      return `${formatBRL(item.price)} cada • ${PRICING.coxinhaCombo.qty} por ${formatBRL(PRICING.coxinhaCombo.price)}`;
    }
    return `${formatBRL(item.price)} cada`;
  };

  const paymentLabel = (m: Order['paymentMethod']) =>
    m === 'pix' ? 'PIX' : m === 'cartao-link' ? 'Cartão (link)' : 'Dinheiro';

  const handlePlaceOrder = async () => {
    if (isSubmitting) return;
    if (cart.length === 0) {
      toast.error('Seu carrinho está vazio');
      return;
    }
    if (!customerName.trim()) {
      toast.error('Informe seu nome');
      return;
    }
    if (!isValidPhone(customerPhone)) {
      toast.error('Informe um WhatsApp válido com DDD', { description: 'Exemplo: (48) 99999-8888' });
      return;
    }
    if (deliveryType === 'entrega' && !isAddressComplete(addressFields)) {
      toast.error('Complete o endereço de entrega', { description: 'CEP, rua, número e cidade' });
      return;
    }
    if (deliveryType === 'entrega' && feeResult.outOfRange) {
      toast.error('Esse endereço fica fora da área de entrega', { description: 'Escolha retirar no local ou chame a gente no WhatsApp.' });
      return;
    }
    if (deliveryType === 'entrega' && quote.status === 'loading') {
      toast.info('Calculando a entrega, só um instante…');
      return;
    }

    setIsSubmitting(true);
    try {
      localStorage.setItem('customer_name', customerName.trim());
      localStorage.setItem('delivery_type', deliveryType);
      if (deliveryType === 'entrega') saveAddress(addressFields);
    } catch { /* ignore */ }

    const phone = normalizePhone(customerPhone);
    if (!userPhone) onLogin(phone);

    const newOrder: Order = {
      id: newId(),
      customerName: customerName.trim(),
      customerPhone: phone,
      items: [...cart],
      total,
      discount,
      paymentMethod,
      status: 'pending',
      createdAt: new Date().toISOString(),
      deliveryType,
      address: deliveryType === 'entrega' ? formatAddress(addressFields) : undefined,
      deliveryFee,
      deliveryKm: deliveryType === 'entrega' && quote.status === 'ok' && quote.km !== null ? quote.km : undefined,
      notes: orderNotes.trim() || undefined,
    };

    const orderNumber = await onPlaceOrder(newOrder);

    const line = '--------------------------------';
    const message = [
      '*🥗 NOVO PEDIDO - Lev & Fit*',
      `*Pedido #${orderNumber}*`,
      line,
      `*👤 Cliente:* ${newOrder.customerName}`,
      `*📱 WhatsApp:* ${maskPhone(phone)}`,
      `*💳 Pagamento:* ${paymentLabel(paymentMethod)}`,
      deliveryType === 'entrega'
        ? `*🛵 Entrega:* ${newOrder.address}${newOrder.deliveryKm ? ` (${formatKm(newOrder.deliveryKm)})` : ''}${quote.status === 'ok' && quote.point ? `\n*📍 Mapa:* ${mapLink(quote.point)}` : ''}`
        : '*🏠 Retirada no local*',
      line,
      '*🛒 Itens:*',
      ...cart.map(item => `• ${item.quantity}x ${item.name}${item.notes ? ` _(${item.notes})_` : ''}`),
      line,
      `Subtotal: ${formatBRL(subtotal)}`,
      discount > 0 ? `Desconto: -${formatBRL(discount)}` : '',
      deliveryType === 'entrega'
        ? (deliveryFee > 0 ? `Taxa de entrega: ${formatBRL(deliveryFee)}` : 'Taxa de entrega: a combinar')
        : '',
      `*💰 TOTAL: ${formatBRL(total)}*`,
      newOrder.notes ? `\n*📝 Observações:* ${newOrder.notes}` : '',
      '',
      'Aguardando confirmação! ✨',
    ].filter(Boolean).join('\n');

    setCart([]);
    setOrderNotes('');
    setIsCartOpen(false);
    setIsSubmitting(false);
    toast.success(`Pedido #${orderNumber} registrado! Abrindo o WhatsApp...`);

    const shopPhone = profile.phone || BUSINESS_CONFIG.phone;
    setTimeout(() => {
      window.location.href = whatsappLink(shopPhone, message);
    }, 600);
  };

  const cartBody = (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader className="px-6 pt-6 pb-3">
        <SheetTitle className="flex items-center gap-2 text-2xl font-bold">
          <ShoppingCart className="h-6 w-6 text-green-600" />
          Seu pedido
        </SheetTitle>
        <SheetDescription className="text-sm">
          {summary.marmitaTierPrice !== null ? (
            <span className="block font-bold text-green-700">
              Combo ativo: marmitas e caldos por {formatBRL(summary.marmitaTierPrice)} cada 🎉
              {summary.marmitasToNextTier !== null && summary.nextTierPrice !== null && (
                <span className="block font-medium text-slate-500">
                  Mais {summary.marmitasToNextTier} e cada uma sai por {formatBRL(summary.nextTierPrice)}
                </span>
              )}
            </span>
          ) : summary.marmitasToNextTier !== null && summary.nextTierPrice !== null && marmitaCount > 0 ? (
            <span className="block">
              Faltam <strong>{summary.marmitasToNextTier} marmitas ou caldos</strong> para pagar {formatBRL(summary.nextTierPrice)} em cada
            </span>
          ) : (
            <span className="block">10 marmitas ou caldos saem por R$ 20 cada, 15 por R$ 19 cada</span>
          )}
          {coxinhaCount >= PRICING.coxinhaCombo.qty && (
            <span className="block font-bold text-orange-600">Oferta salgados: 3 por {formatBRL(PRICING.coxinhaCombo.price)} 🥟</span>
          )}
        </SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 pb-4">
        {!profile.isOpen && (
          <div className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Estamos fechados agora. Você pode mandar o pedido e respondemos assim que abrirmos.
          </div>
        )}

        {cart.length === 0 ? (
          <p className="py-10 text-center text-slate-500">Seu carrinho está vazio.</p>
        ) : (
          <div className="space-y-3">
            {cart.map(item => (
              <div key={`${item.productId}-${item.notes || ''}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-slate-900">
                    {item.name}
                    {item.notes && <span className="ml-1 text-green-600">({item.notes})</span>}
                  </h4>
                  <p className="text-xs text-slate-500">{unitPriceLabel(item)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <div className="flex items-center rounded-xl border border-slate-100 bg-white p-1 shadow-sm">
                    <Button variant="ghost" size="icon" aria-label="Diminuir" className="h-8 w-8 rounded-lg text-slate-500" onClick={() => removeFromCart(item.productId, item.notes)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-7 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Aumentar"
                      className="h-8 w-8 rounded-lg text-green-600"
                      onClick={() => updateQuantity(item.productId, item.quantity + 1, item.notes)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="icon" aria-label="Remover" className="h-9 w-9 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => clearItemFromCart(item.productId, item.notes)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <h3 className="font-bold text-slate-900">Seus dados</h3>
          <div className="space-y-1.5">
            <Label htmlFor="checkout-name" className="text-xs font-bold uppercase text-slate-500">Nome</Label>
            <Input id="checkout-name" autoComplete="name" placeholder="Como podemos te chamar?" className="h-11 rounded-xl border-none bg-slate-50" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="checkout-phone" className="text-xs font-bold uppercase text-slate-500">WhatsApp</Label>
            <Input id="checkout-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(48) 99999-8888" className="h-11 rounded-xl border-none bg-slate-50" value={customerPhone} onChange={e => setCustomerPhone(maskPhone(e.target.value))} />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-slate-900">Como quer receber?</h3>
          <div className="grid grid-cols-2 gap-2">
            <Button variant={deliveryType === 'entrega' ? 'default' : 'outline'} className={`h-16 flex-col gap-1 rounded-2xl ${deliveryType === 'entrega' ? 'bg-green-600 hover:bg-green-700' : 'bg-white'}`} onClick={() => setDeliveryType('entrega')}>
              <Bike className="h-5 w-5" />
              <span className="text-xs font-bold">
                Entrega{deliverySettings.mode === 'fixed' ? (deliverySettings.baseFee > 0 ? ` • ${formatBRL(deliverySettings.baseFee)}` : '') : ' • por km'}
              </span>
            </Button>
            <Button variant={deliveryType === 'retirada' ? 'default' : 'outline'} className={`h-16 flex-col gap-1 rounded-2xl ${deliveryType === 'retirada' ? 'bg-green-600 hover:bg-green-700' : 'bg-white'}`} onClick={() => setDeliveryType('retirada')}>
              <Store className="h-5 w-5" />
              <span className="text-xs font-bold">Retirar no local</span>
            </Button>
          </div>
          {deliveryType === 'entrega' ? (
            <div className="space-y-3">
              <AddressForm value={addressFields} onChange={setAddressFields} idPrefix="checkout" />
              <QuoteBox settings={deliverySettings} quote={quote} />
            </div>
          ) : profile.address ? (
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">📍 {profile.address}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-slate-900">Pagamento</h3>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'pix', label: 'PIX', Icon: Landmark },
              { id: 'cartao-link', label: 'Cartão (link)', Icon: CreditCard },
              { id: 'dinheiro', label: 'Dinheiro', Icon: Banknote },
            ] as const).map(({ id, label, Icon }) => (
              <Button key={id} variant={paymentMethod === id ? 'default' : 'outline'} className={`h-16 flex-col gap-1 rounded-2xl ${paymentMethod === id ? 'bg-green-600 hover:bg-green-700' : 'bg-white'}`} onClick={() => setPaymentMethod(id)}>
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-bold">{label}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="checkout-notes" className="text-xs font-bold uppercase text-slate-500">Observações (opcional)</Label>
          <Textarea id="checkout-notes" rows={2} placeholder="Ex.: troco para R$ 100, portão azul, sem cebola..." className="rounded-xl border-none bg-slate-50" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} />
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-100 bg-white px-6 pt-4 pb-6">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="tabular-nums">{formatBRL(subtotal)}</span></div>
          {discount > 0 && (
            <div className="flex justify-between font-bold text-green-600"><span>Descontos</span><span className="tabular-nums">- {formatBRL(discount)}</span></div>
          )}
          {deliveryType === 'entrega' && (
            <div className="flex justify-between text-slate-500">
              <span>Entrega</span>
              <span className="tabular-nums">
                {feeResult.outOfRange ? 'fora da área' : deliveryFee > 0 ? formatBRL(deliveryFee) : 'a combinar'}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 text-2xl font-black text-slate-900">
            <span>Total</span>
            <span className="text-green-600 tabular-nums">{formatBRL(total)}</span>
          </div>
        </div>
        <Button
          className="h-14 w-full rounded-2xl bg-green-600 text-lg font-bold shadow-lg transition-transform hover:bg-green-700 active:scale-95"
          onClick={handlePlaceOrder}
          disabled={isSubmitting || cart.length === 0}
        >
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enviar pedido pelo WhatsApp'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white pb-24 sm:rounded-2xl sm:shadow-sm sm:ring-1 sm:ring-slate-100">
      {/* Endereço de entrega sempre à vista (como nos apps de delivery) */}
      <button
        type="button"
        onClick={() => setIsFeeOpen(true)}
        className="flex w-full items-center gap-3 border-b border-amber-100 bg-amber-50/70 px-4 py-2.5 text-left transition-colors hover:bg-amber-50 sm:rounded-t-2xl sm:px-6"
      >
        <MapPin className="h-5 w-5 shrink-0 text-slate-700" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium text-slate-500">Endereço de entrega</span>
          <span className="block truncate text-sm font-bold text-slate-900">
            {isAddressComplete(addressFields)
              ? [addressFields.street, addressFields.number].filter(Boolean).join(', ') + (addressFields.neighborhood ? ` - ${addressFields.neighborhood}` : '')
              : 'Será que entrega?'}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-green-700 shadow-sm">
          {!isAddressComplete(addressFields) && addressFields.lat == null
            ? 'Calcular'
            : quote.status === 'loading'
              ? 'Calculando…'
              : feeResult.outOfRange
                ? 'Fora da área'
                : quote.status === 'ok' && feeResult.fee > 0
                  ? formatBRL(feeResult.fee)
                  : deliverySettings.mode === 'fixed' && deliverySettings.baseFee > 0
                    ? formatBRL(deliverySettings.baseFee)
                    : 'A combinar'}
        </span>
      </button>
      {/* Instagram Style Header */}
      <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">@{profile.instagram}</h1>
          <CheckCircle2 className="h-4 w-4 text-blue-500 fill-blue-500" />
        </div>
        <div className="flex items-center gap-4 text-slate-700">
          <button aria-label="Buscar" onClick={() => {
            setActiveTab('menu');
            setTimeout(() => {
              document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
              searchInputRef.current?.focus();
            }, 50);
          }}>
            <Search className="w-6 h-6" />
          </button>
          <button aria-label="Carrinho" className="relative" onClick={() => setIsCartOpen(true)}>
            <ShoppingCart className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{cartCount}</span>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 md:px-8 md:pt-6">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-5 md:gap-12 mb-6 text-center md:text-left">
          <div className="relative flex-shrink-0">
            <button
              type="button"
              aria-label={instagramStories.length ? 'Ver os stories do Instagram' : 'Ver as novidades'}
              className={`block h-24 w-24 md:h-36 md:w-36 rounded-full p-[3px] cursor-pointer ${instagramStories.length ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600' : stories.length ? 'bg-gradient-to-tr from-lime-400 via-green-500 to-emerald-700' : 'bg-slate-200'}`}
              onClick={() => {
                if (instagramStories.length) { setStoryList('instagram'); setStoryIndex(0); }
                else if (stories.length) { setStoryList('offers'); setStoryIndex(0); }
                else window.open(`https://instagram.com/${profile.instagram}`, '_blank');
              }}
            >
              <div className="h-full w-full rounded-full border-2 border-white overflow-hidden bg-white flex items-center justify-center">
                {profile.profilePicture ? (
                  <img src={profile.profilePicture} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <img src="/perfil.jpg" alt="Lev & Fit" className="w-full h-full object-cover" />
                )}
              </div>
            </button>
          </div>
          <div className="flex-1 space-y-4 w-full">
            <div className="flex flex-col md:flex-row md:items-center items-center gap-3 md:gap-4">
              <div className="hidden md:flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900">@{profile.instagram}</h1>
                <CheckCircle2 className="h-4 w-4 text-blue-500 fill-blue-500" />
              </div>
              <div className="flex gap-2 w-full md:w-auto justify-center md:justify-start">
                <Button 
                  variant="default" 
                  size="sm" 
                  className="h-9 px-4 bg-green-600 hover:bg-green-700 font-bold rounded-lg text-xs flex-1 md:flex-none"
                  onClick={() => {
                    setActiveTab('menu');
                    document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Pedir Agora
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 px-3 font-semibold border-slate-200 hover:bg-slate-50 rounded-lg text-xs flex-1 md:flex-none flex items-center justify-center gap-1"
                  onClick={() => window.open(whatsappLink(profile.phone || BUSINESS_CONFIG.phone), '_blank')}
                >
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-9 px-3 font-semibold border-slate-200 hover:bg-slate-50 rounded-lg text-xs flex-1 md:flex-none flex items-center justify-center gap-1"
                  onClick={() => window.open(`https://instagram.com/${profile.instagram}`, '_blank')}
                >
                  <Instagram className="h-3 w-3" />
                  Instagram
                </Button>
              </div>
            </div>
            <div className="hidden md:flex gap-8 text-sm py-1">
              <span><strong>{profile.stats.posts}</strong> publicações</span>
              <span><strong>{profile.stats.followers}</strong> seguidores</span>
              <span><strong>{profile.stats.following}</strong> seguindo</span>
            </div>
            <div className="hidden md:block space-y-0.5">
              <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {profile.bio}
              </div>
              {profile.google && (
                <button type="button" onClick={() => document.getElementById('avaliacoes')?.scrollIntoView({ behavior: 'smooth' })} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {profile.google.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} no Google • {profile.google.total} avaliações
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Stats & Bio */}
        <div className="md:hidden space-y-4 mb-6">
          <div className="flex justify-around border-t border-b border-slate-50 py-3 text-center">
            <div className="flex flex-col">
              <span className="font-bold text-slate-900">{profile.stats.posts}</span>
              <span className="text-[11px] text-slate-500 uppercase tracking-tight">publicações</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900">{profile.stats.followers}</span>
              <span className="text-[11px] text-slate-500 uppercase tracking-tight">seguidores</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900">{profile.stats.following}</span>
              <span className="text-[11px] text-slate-500 uppercase tracking-tight">seguindo</span>
            </div>
          </div>
          <div className="space-y-0.5 px-1 text-center md:text-left">
            <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {profile.bio}
            </div>
            {profile.google && (
              <button type="button" onClick={() => document.getElementById('avaliacoes')?.scrollIntoView({ behavior: 'smooth' })} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {profile.google.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} no Google • {profile.google.total} avaliações
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Tabs */}
      <AnimatePresence mode="wait">
        {activeTab === 'menu' ? (
          <motion.div
            key="menu"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-0 pb-24"
          >
            {/* Ofertas logo abaixo do perfil */}
            <OffersCarousel offers={stories} onOpen={i => { setStoryList('offers'); setStoryIndex(i); }} />


            {/* Status + calcular entrega */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-4 md:px-8">
              {profile.isOpen ? (
                <span className="flex items-center gap-1.5 font-bold text-green-600">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-600" />
                  Aberto agora
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-bold text-red-600">
                  <span className="h-2 w-2 rounded-full bg-red-600" />
                  Fechado no momento
                </span>
              )}
              <button onClick={() => setIsFeeOpen(true)} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Bike className="h-4 w-4 text-green-600" />
                {deliverySettings.mode === 'fixed'
                  ? (deliverySettings.baseFee > 0 ? `Entrega ${formatBRL(deliverySettings.baseFee)}` : 'Entrega a combinar')
                  : 'Calcular entrega'}
              </button>
            </div>

      {/* Stories Style Categories */}
      {/* Até 6 bolinhas cabem inteiras na tela do celular; com mais, a fileira rola */}
      <div
        className={`${categories.length + 1 <= 6 ? 'grid gap-1 px-2 sm:flex sm:justify-center sm:gap-6 sm:px-4' : 'flex gap-3 overflow-x-auto px-4 scrollbar-hide'} py-5 sm:py-6 border-b border-slate-100`}
        style={categories.length + 1 <= 6 ? { gridTemplateColumns: `repeat(${categories.length + 1}, minmax(0, 1fr))` } : undefined}
      >
        <button
          onClick={() => setSelectedCategory('all')}
          className="flex min-w-0 flex-col items-center gap-1.5 flex-shrink-0 group"
        >
          <div className={`w-[52px] h-[52px] sm:w-16 sm:h-16 rounded-full p-[2px] ${selectedCategory === 'all' ? 'ring-2 ring-green-500' : 'border border-slate-200'} transition-all duration-300`}>
            <div className="w-full h-full rounded-full bg-white p-0.5">
              <div className={`h-full w-full rounded-full p-1.5 sm:p-2 ${selectedCategory === 'all' ? 'bg-green-50' : 'bg-slate-50'} transition-colors`}>
                <CategoryArt id="all" />
              </div>
            </div>
          </div>
          <span className={`w-full text-center text-[10px] sm:text-[11px] leading-tight transition-all ${selectedCategory === 'all' ? 'font-black text-green-600' : 'font-medium text-slate-500'}`}>
            TODOS
          </span>
        </button>
        {orderedCategories.map((cat) => {
          const Icon = cat.icon ? ICON_MAP[cat.icon] : Package;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="flex min-w-0 flex-col items-center gap-1.5 flex-shrink-0 group"
            >
              <div className={`w-[52px] h-[52px] sm:w-16 sm:h-16 rounded-full p-[2px] ${selectedCategory === cat.id ? 'ring-2 ring-green-500' : 'border border-slate-200'} transition-all duration-300`}>
                <div className="w-full h-full rounded-full bg-white p-0.5">
                  <div className={`w-full h-full rounded-full flex items-center justify-center overflow-hidden text-2xl ${selectedCategory === cat.id ? 'bg-green-50' : 'bg-slate-50'} transition-colors`}>
                    {CategoryArt({ id: cat.id, name: cat.name }) ? (
                      <span className="block h-full w-full p-1.5 sm:p-2"><CategoryArt id={cat.id} name={cat.name} /></span>
                    ) : cat.image ? (
                      <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : cat.emoji ? (
                      cat.emoji
                    ) : (
                      <Icon className="w-7 h-7 text-slate-400" />
                    )}
                  </div>
                </div>
              </div>
              <span className={`w-full text-center text-[10px] sm:text-[11px] leading-tight transition-all ${selectedCategory === cat.id ? 'font-black text-green-600' : 'font-medium text-slate-500'}`}>
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* View Mode Tabs & Search Bar (Sticky Container) */}
      <div id="produtos" className="sticky top-16 bg-white z-30 border-b border-slate-100 scroll-mt-16">
        <div className="flex max-w-xs mx-auto relative">
          <button 
            onClick={() => setViewMode('grid')}
            className={`flex-1 flex items-center justify-center py-3 transition-all relative z-10 ${viewMode === 'grid' ? 'text-slate-900' : 'text-slate-400'}`}
          >
            <Grid className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setViewMode('feed')}
            className={`flex-1 flex items-center justify-center py-3 transition-all relative z-10 ${viewMode === 'feed' ? 'text-slate-900' : 'text-slate-400'}`}
          >
            <LayoutList className="w-6 h-6" />
          </button>
          <motion.div 
            layoutId="viewModeTab"
            className="absolute bottom-0 h-0.5 bg-slate-900"
            initial={false}
            animate={{ 
              left: viewMode === 'grid' ? '0%' : '50%',
              width: '50%'
            }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        </div>

        {/* Search Bar (Inside Sticky) */}
        <div className="px-4 py-3 bg-white">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              ref={searchInputRef}
              placeholder="O que você quer comer hoje?" 
              className="pl-10 h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500 shadow-none transition-all focus:bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Products Display */}
      <div className="md:px-4 md:py-4">
        <AnimatePresence>
          {viewMode === 'feed' ? (
            <div className="divide-y divide-slate-100 md:grid md:grid-cols-2 md:gap-x-4 md:divide-y-0">
              {filteredProducts.map((product, idx) => (<Fragment key={product.id}>{sectionHeader(product, idx, 'feed')}
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white p-4 flex gap-4 items-start hover:bg-slate-50 transition-colors cursor-pointer md:border-b md:border-slate-100"
                >
                  <div className="flex-1 space-y-3" onClick={() => setSelectedProduct(product)}>
                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-900 text-base leading-tight flex items-center gap-1.5">
                        {product.name}
                        {product.ingredients && <Info className="w-3.5 h-3.5 text-slate-400" />}
                      </h3>
                      {weightOf(product) && (
                        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] px-2 h-5 font-bold">
                          ⚖️ {weightOf(product)}
                        </Badge>
                      )}
                      <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                        {product.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-green-700 text-lg">{formatBRL(product.price)}</span>
                        {isNew(product) ? (
                          <Badge className="w-fit bg-purple-100 text-purple-700 border-none text-[9px] px-2 h-5 font-bold">NOVIDADE ✨</Badge>
                        ) : null}
                      </div>
                      <Button 
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 h-9 px-4 rounded-lg font-bold shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasOptions(product)) {
                            setSelectedProduct(product);
                          } else {
                            addToCart(product);
                          }
                        }}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                    {product.type === 'pronta-entrega' && (
                      <Badge className="bg-green-50 text-green-700 border-none text-[9px] px-2 h-5 w-fit">Pronta Entrega</Badge>
                    )}
                  </div>
                  <div 
                    className="relative w-28 h-28 md:w-36 md:h-36 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 shadow-sm border border-slate-100"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </motion.div>
              </Fragment>))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5 p-0.5 md:grid-cols-4 md:gap-1">
              {filteredProducts.map((product, idx) => (<Fragment key={product.id}>{sectionHeader(product, idx, 'grid')}
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative aspect-square group cursor-pointer"
                  onClick={() => setSelectedProduct(product)}
                >
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div 
                    className="absolute bottom-1 right-1 bg-green-600 rounded-lg p-1 shadow-lg z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasOptions(product)) {
                        setSelectedProduct(product);
                      } else {
                        addToCart(product);
                      }
                    }}
                  >
                    <Plus className="text-white w-4 h-4" />
                  </div>
                  <div className="absolute top-1 left-1 flex flex-col gap-1">
                    <Badge className="bg-black/60 backdrop-blur-sm text-white border-none text-[8px] px-1 h-4">
                      R$ {product.price.toFixed(0)}
                    </Badge>
                    {weightOf(product) && (
                      <Badge className="bg-slate-800/80 backdrop-blur-sm text-white border-none text-[8px] px-1 h-4 font-bold">
                        {weightOf(product)}
                      </Badge>
                    )}
                    {isNew(product) && (
                      <Badge className="bg-purple-600/80 backdrop-blur-sm text-white border-none text-[7px] px-1 h-3.5 font-bold">
                        NEW
                      </Badge>
                    )}
                  </div>
                </motion.div>
              </Fragment>))}
            </div>
          )}
        </AnimatePresence>
            </div>
            {/* Avaliações reais do Google */}
            {reviews.length > 0 && (
              <section id="avaliacoes" className="mt-6 scroll-mt-20 border-t border-slate-100 px-4 py-10 md:px-8" aria-labelledby="avaliacoes-titulo">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-1">
                    <h2 id="avaliacoes-titulo" className="text-xl font-bold text-slate-900">O que os clientes dizem</h2>
                    {google && (
                      <a href={google.mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-slate-600 hover:underline">
                        <span className="text-2xl font-black text-slate-900 tabular-nums">{google.rating.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                        <span className="flex text-amber-400" aria-label={`${google.rating} de 5 estrelas`}>
                          {[0, 1, 2, 3, 4].map(i => <Star key={i} className={`h-4 w-4 ${i < Math.round(google.rating) ? 'fill-amber-400' : ''}`} />)}
                        </span>
                        <span>{google.total} avaliações no Google</span>
                      </a>
                    )}
                  </div>
                  {google?.reviewUrl && (
                    <a
                      href={google.reviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800"
                    >
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> Avaliar no Google
                    </a>
                  )}
                </div>
                <div className="scrollbar-hide -mx-4 mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
                  {reviews.map(r => (
                    <article key={r.id} className="flex w-[280px] shrink-0 snap-start flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 font-bold text-green-700">
                          {r.name.charAt(0).toUpperCase()}
                          {r.avatar && (
                            <img src={r.avatar} alt="" className="absolute inset-0 h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }} />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{r.name}</p>
                          <span className="flex text-amber-400" aria-label={`${r.rating} de 5 estrelas`}>
                            {[0, 1, 2, 3, 4].map(i => <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? 'fill-amber-400' : ''}`} />)}
                          </span>
                        </div>
                        {r.source === 'google' && <span className="ml-auto text-[11px] font-semibold text-slate-400">Google</span>}
                      </div>
                      <p className="line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-slate-600">{r.comment}</p>
                    </article>
                  ))}
                </div>
                {google?.mapsUrl && (
                  <a href={google.mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-green-700 hover:underline">
                    Ver todas as avaliações no Google →
                  </a>
                )}
              </section>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="orders"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 space-y-6 max-w-xl mx-auto py-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Meus Pedidos</h2>
              {userPhone && (
                <Button variant="ghost" size="sm" onClick={onLogout} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                  Sair
                </Button>
              )}
            </div>

            {!userPhone ? (
              <div className="text-center py-12 space-y-6 bg-slate-50 rounded-3xl p-8 border border-slate-100">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <User className="w-10 h-10 text-green-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Acesse seus pedidos</h3>
                  <p className="text-slate-500 text-sm">Informe seu WhatsApp para visualizar seu histórico de compras.</p>
                </div>
                <div className="space-y-3">
                  <Input 
                    placeholder="(00) 00000-0000" 
                    className="h-12 rounded-2xl bg-white border-slate-200 text-center text-lg font-medium"
                    type="tel"
                    inputMode="tel"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(maskPhone(e.target.value))}
                  />
                  <Button 
                    className="w-full h-12 bg-green-600 hover:bg-green-700 rounded-2xl font-bold text-base shadow-lg shadow-green-100"
                    onClick={() => {
                      if (!isValidPhone(loginPhone)) {
                        toast.error('Informe um WhatsApp válido com DDD');
                        return;
                      }
                      onLogin(loginPhone);
                      setCustomerPhone(maskPhone(loginPhone));
                    }}
                  >
                    Entrar
                  </Button>
                </div>
              </div>
            ) : myOrders.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <ClipboardList className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-slate-500">Você ainda não fez nenhum pedido.</p>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('menu')}
                  className="border-green-600 text-green-600 hover:bg-green-50"
                >
                  Ver Cardápio
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {myOrders.map((order) => (
                  <Card key={order.id} className="overflow-hidden border-slate-100 shadow-sm">
                    <CardHeader className="bg-slate-50/50 py-3 px-4">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-green-700">Pedido #{order.orderNumber || order.id.slice(0, 4).toUpperCase()}</span>
                          {order.createdAt ? (
                            <span className="text-[10px] text-slate-400">
                              {new Date(order.createdAt).toLocaleDateString('pt-BR')} {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Data não disponível</span>
                          )}
                        </div>
                        <Badge className={
                          order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                          order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }>
                          {order.status === 'delivered' ? 'Entregue' :
                           order.status === 'preparing' ? 'Preparando' :
                           order.status === 'cancelled' ? 'Cancelado' :
                           'Pendente'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-slate-600">{item.quantity}x {item.name}{item.notes ? ` (${item.notes})` : ''}</span>
                            <span className="font-medium tabular-nums">{formatBRL(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center font-bold">
                        <span>Total</span>
                        <span className="text-green-600 tabular-nums">{formatBRL(order.total)}</span>
                      </div>
                      {order.discount > 0 && (
                        <p className="text-right text-xs text-green-600">Você economizou {formatBRL(order.discount)}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {createPortal(<>
      {/* Barra "Ver sacola" (celular) */}
      <AnimatePresence>
        {cartCount > 0 && activeTab === 'menu' && !isCartOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-20 left-4 right-4 z-40 md:hidden"
          >
            <Button onClick={() => setIsCartOpen(true)} className="flex h-14 w-full items-center justify-between rounded-2xl border-2 border-white/20 bg-green-600 px-6 font-bold text-white shadow-2xl hover:bg-green-700">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-white/20 px-2 py-1 text-xs tabular-nums">{cartCount}</div>
                <span>Ver sacola</span>
              </div>
              <span className="tabular-nums">{formatBRL(total)}</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      </>, document.body)}

      {/* Botão do carrinho (computador) */}
      {cartCount > 0 && !isCartOpen && (
        <div className="fixed bottom-6 right-6 z-40 hidden md:block">
          <Button size="lg" onClick={() => setIsCartOpen(true)} className="h-16 rounded-full border-4 border-white bg-green-600 px-8 shadow-2xl hover:bg-green-700">
            <ShoppingCart className="mr-2 h-6 w-6" />
            Carrinho ({cartCount})
            <span className="ml-4 text-xl font-bold tabular-nums">{formatBRL(total)}</span>
          </Button>
        </div>
      )}

      {/* Um único carrinho para celular e computador */}
      <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
        <SheetContent
          side={isDesktop ? 'right' : 'bottom'}
          className={isDesktop
            ? 'w-full gap-0 border-none p-0 shadow-2xl sm:max-w-md'
            : 'mx-auto gap-0 overflow-hidden rounded-t-[2rem] border-none p-0 shadow-2xl data-[side=bottom]:h-[92dvh] sm:max-w-lg'}
        >
          {cartBody}
        </SheetContent>
      </Sheet>

      {storyIndex !== null && (storyList === 'instagram' ? instagramStories : stories).length > 0 && (
        <StoryViewer
          stories={storyList === 'instagram' ? instagramStories : stories}
          startIndex={Math.max(0, storyIndex)}
          onClose={() => setStoryIndex(null)}
          onCta={handleStoryCta}
        />
      )}

      <Dialog open={isFeeOpen} onOpenChange={setIsFeeOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-green-600" /> Calcular entrega</DialogTitle>
            <DialogDescription>
              {deliverySettings.mode === 'per_km'
                ? 'Use sua localização ou coloque o CEP e o número para ver a distância e o valor exatos.'
                : 'Confira o valor da entrega para o seu endereço.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <AddressForm value={addressFields} onChange={setAddressFields} idPrefix="calc" />
            <QuoteBox settings={deliverySettings} quote={quote} />
            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => { saveAddress(addressFields); setDeliveryType('entrega'); setIsFeeOpen(false); }}>
              Usar esse endereço no pedido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => {
        if (!open) {
          setSelectedProduct(null);
          setDetailQuantity(1);
          setDetailGluten('com');
          setDetailLactose('com');
        }
      }}>
        <DialogContent className="p-0 overflow-hidden sm:max-w-md bg-white border-none shadow-2xl">
          {selectedProduct && (
            <div className="flex flex-col">
              <div className="relative aspect-square sm:aspect-video overflow-hidden">
                <img 
                  src={selectedProduct.image} 
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex gap-2 mb-2">
                      <Badge className="bg-green-600 text-white border-none">
                        {selectedProduct.type === 'pronta-entrega' ? 'Pronta Entrega' : 'Sob Encomenda'}
                      </Badge>
                      {weightOf(selectedProduct) && (
                        <Badge className="bg-slate-800 text-white border-none">
                          ⚖️ {weightOf(selectedProduct)}
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-white text-2xl font-bold leading-tight">{selectedProduct.name}</h2>
                  </div>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Info className="w-3 h-3" />
                    Descrição
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    {selectedProduct.description}
                  </p>
                </div>

                {selectedProduct.ingredients && selectedProduct.ingredients.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Utensils className="w-3 h-3" />
                      Ingredientes
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedProduct.ingredients.map((ingredient, idx) => (
                        <Badge key={idx} variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-none px-3 py-1 text-[11px] font-medium">
                          {ingredient}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedProduct.categoryId === 'marmitas' && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Droplets className="w-3 h-3" />
                      Opção de Lactose
                    </h3>
                    <div className="flex gap-2">
                      <Button 
                        variant={detailLactose === 'com' ? 'default' : 'outline'}
                        className={`flex-1 rounded-xl h-11 font-bold ${detailLactose === 'com' ? 'bg-slate-900' : 'text-slate-600'}`}
                        onClick={() => setDetailLactose('com')}
                      >
                        Com Lactose
                      </Button>
                      <Button 
                        variant={detailLactose === 'sem' ? 'default' : 'outline'}
                        className={`flex-1 rounded-xl h-11 font-bold ${detailLactose === 'sem' ? 'bg-blue-600' : 'text-slate-600'}`}
                        onClick={() => setDetailLactose('sem')}
                      >
                        Sem Lactose
                      </Button>
                    </div>
                  </div>
                )}

                {hasGlutenOption(selectedProduct) && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Leaf className="w-3 h-3" />
                      Opção de Massa
                    </h3>
                    <div className="flex gap-2">
                      <Button 
                        variant={detailGluten === 'com' ? 'default' : 'outline'}
                        className={`flex-1 rounded-xl h-11 font-bold ${detailGluten === 'com' ? 'bg-slate-900' : 'text-slate-600'}`}
                        onClick={() => setDetailGluten('com')}
                      >
                        Com Glúten
                      </Button>
                      <Button 
                        variant={detailGluten === 'sem' ? 'default' : 'outline'}
                        className={`flex-1 rounded-xl h-11 font-bold ${detailGluten === 'sem' ? 'bg-green-600' : 'text-slate-600'}`}
                        onClick={() => setDetailGluten('sem')}
                      >
                        Sem Glúten
                      </Button>
                    </div>
                  </div>
                )}

                <div className="pt-4 space-y-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400 font-medium">Preço unitário</span>
                      <span className="text-2xl font-bold text-green-700">{formatBRL(selectedProduct.price)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-lg text-slate-400"
                        onClick={() => setDetailQuantity(prev => Math.max(1, prev - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Select 
                        value={detailQuantity.toString()} 
                        onValueChange={(val) => setDetailQuantity(parseInt(val))}
                      >
                        <SelectTrigger className="h-10 w-12 border-none bg-transparent p-0 font-bold text-lg focus:ring-0 shadow-none justify-center">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="min-w-[4rem]">
                          {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                            <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-lg text-green-600"
                        onClick={() => setDetailQuantity(prev => prev + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-14 rounded-xl font-bold shadow-lg shadow-green-200 transition-all active:scale-95 text-lg"
                    onClick={() => {
                      let notes: string | undefined = undefined;
                      if (hasGlutenOption(selectedProduct)) {
                        notes = detailGluten === 'com' ? 'Com Glúten' : 'Sem Glúten';
                      } else if (selectedProduct.categoryId === 'marmitas') {
                        notes = detailLactose === 'com' ? 'Com Lactose' : 'Sem Lactose';
                      }
                      
                      addToCart(selectedProduct, detailQuantity, notes);
                      setSelectedProduct(null);
                      setDetailQuantity(1);
                      setDetailGluten('com');
                      setDetailLactose('com');
                    }}
                  >
                    Adicionar {detailQuantity > 1 ? `${detailQuantity} itens` : 'à sacola'} • {formatBRL(selectedProduct.price * detailQuantity)}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Discreet Footer with Admin Link */}
      <footer className="py-8 px-4 border-t border-slate-50 text-center space-y-2">
        <p className="text-xs text-slate-300">© {new Date().getFullYear()} Lev & Fit - Marmitas Congeladas</p>
        <Link to="/admin" className="text-[10px] text-slate-100 hover:text-green-600 transition-colors opacity-10 hover:opacity-100">
          Painel Administrativo
        </Link>
      </footer>
      {/* Barras fixas vão direto no <body>: no iPhone, elemento fixo dentro da página às vezes "sobe" junto ao rolar */}
      {createPortal(<>
      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-t border-slate-100 px-6 py-2 flex justify-around items-center md:hidden safe-area-bottom">
        <button 
          onClick={() => {
            setActiveTab('menu');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center gap-1 transition-all relative ${activeTab === 'menu' ? 'text-green-600' : 'text-slate-400'}`}
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-medium">Início</span>
          {activeTab === 'menu' && (
            <motion.div 
              layoutId="activeTab"
              className="absolute -bottom-1 w-1 h-1 bg-green-600 rounded-full"
            />
          )}
        </button>
        <a 
          href={`https://instagram.com/${profile.instagram}`}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-center gap-1 text-slate-400"
        >
          <Instagram className="w-6 h-6" />
          <span className="text-[10px] font-medium">Instagram</span>
        </a>
        
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative flex flex-col items-center gap-1 text-slate-400"
        >
          <ShoppingCart className="w-6 h-6" />
          <span className="text-[10px] font-medium">Carrinho</span>
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 px-0.5 text-[10px] font-bold text-white">
              {cartCount}
            </span>
          )}
        </button>

        <button 
          onClick={() => setActiveTab('orders')}
          className={`flex flex-col items-center gap-1 transition-all relative ${activeTab === 'orders' ? 'text-green-600' : 'text-slate-400'}`}
        >
          <ClipboardList className="w-6 h-6" />
          <span className="text-[10px] font-medium">Pedidos</span>
          {activeTab === 'orders' && (
            <motion.div 
              layoutId="activeTab"
              className="absolute -bottom-1 w-1 h-1 bg-green-600 rounded-full"
            />
          )}
        </button>
      </div>

      {/* Floating WhatsApp Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label="Falar no WhatsApp"
        onClick={() => window.open(whatsappLink(profile.phone || BUSINESS_CONFIG.phone), '_blank')}
        className={`fixed right-6 z-40 ${cartCount > 0 && activeTab === 'menu' ? 'bottom-40 md:bottom-28' : 'bottom-24 md:bottom-6'} bg-green-500 text-white p-4 rounded-full shadow-2xl flex items-center justify-center hover:bg-green-600 transition-colors`}
      >
        <MessageCircle className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
      </motion.button>
      </>, document.body)}
    </div>
  );
}
