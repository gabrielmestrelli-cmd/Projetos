import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Category, Product, Order, OrderItem, Testimonial, Promotion, BusinessProfile } from '../types';
import { ICON_MAP, INITIAL_TESTIMONIALS, INITIAL_PROMOTIONS, BUSINESS_CONFIG } from '../constants';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ShoppingCart, Plus, Minus, Search, Instagram, Star, Clock, Package, CheckCircle2, CreditCard, Landmark, Banknote, Grid, LayoutList, Heart, MessageCircle, Send, Bookmark, Home, User, Trash2, Leaf, Droplets, Info, Utensils, ClipboardList } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface CustomerMenuProps {
  categories: Category[];
  products: Product[];
  testimonials: Testimonial[];
  promotions: Promotion[];
  profile: BusinessProfile;
  onPlaceOrder: (order: Order) => void;
}

export default function CustomerMenu({ categories, products, testimonials, promotions, profile, onPlaceOrder }: CustomerMenuProps) {
  const [searchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [viewMode, setViewMode] = useState<'feed' | 'grid'>('feed');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [detailGluten, setDetailGluten] = useState<'com' | 'sem'>('com');
  const [detailLactose, setDetailLactose] = useState<'com' | 'sem'>('com');
  
  // Checkout fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao-link' | 'dinheiro'>('pix');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'orders'>('menu');
  const [myOrders, setMyOrders] = useState<Order[]>([]);

  // Load my orders from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('my_orders');
    if (saved) {
      setMyOrders(JSON.parse(saved));
    }
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch && p.available;
    });
  }, [products, selectedCategory, searchQuery]);

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

  // Bulk Discount Logic
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  const calculateTotal = () => {
    let subtotal = 0;
    let marmitaCount = 0;
    let coxinhaCount = 0;
    let discount = 0;

    cart.forEach(item => {
      subtotal += item.price * item.quantity;
      if (item.productId.startsWith('mar-')) {
        marmitaCount += item.quantity;
      } else if (item.productId.startsWith('cox-')) {
        coxinhaCount += item.quantity;
      }
    });

    // 1. Coxinha Discount: 3 for R$ 24 (Standard is R$ 9 each, so R$ 27 for 3)
    // Discount = R$ 3 for every 3 coxinhas
    const coxinhaDiscountGroups = Math.floor(coxinhaCount / 3);
    discount += coxinhaDiscountGroups * 3;

    // 2. Marmita Bulk Discount
    // 10+ marmitas = R$ 20 each (R$ 1 discount per unit)
    // 15+ marmitas = R$ 19 each (R$ 2 discount per unit)
    let marmitaUnitPrice = 21;
    if (marmitaCount >= 15) {
      marmitaUnitPrice = 19;
      discount += marmitaCount * 2;
    } else if (marmitaCount >= 10) {
      marmitaUnitPrice = 20;
      discount += marmitaCount * 1;
    }

    const total = subtotal - discount;
    
    return { 
      subtotal, 
      discount, 
      total, 
      marmitaUnitPrice,
      marmitaCount,
      coxinhaCount,
      hasMarmitaDiscount: marmitaCount >= 10,
      hasCoxinhaDiscount: coxinhaCount >= 3
    };
  };

  const { subtotal, discount, total, marmitaUnitPrice, marmitaCount, coxinhaCount } = calculateTotal();

  const handlePlaceOrder = () => {
    if (!customerName || !customerPhone) {
      toast.error('Por favor, preencha seu nome e telefone');
      return;
    }
    if (cart.length === 0) {
      toast.error('Seu carrinho está vazio');
      return;
    }

    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      customerName,
      customerPhone,
      items: [...cart],
      total,
      discount,
      paymentMethod,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    onPlaceOrder(newOrder);

    // Save to my orders
    const updatedMyOrders = [newOrder, ...myOrders];
    setMyOrders(updatedMyOrders);
    localStorage.setItem('my_orders', JSON.stringify(updatedMyOrders));

    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    toast.success('Pedido enviado com sucesso!');
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Instagram Style Header */}
      <div className="bg-white sticky top-0 z-40 px-4 py-3 border-b border-slate-100 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{profile.instagram}</h1>
          <CheckCircle2 className="h-4 w-4 text-blue-500 fill-blue-500" />
        </div>
        <div className="flex items-center gap-4 text-slate-700">
          <Search className="w-6 h-6" />
          <ShoppingCart className="w-6 h-6" onClick={() => setIsCartOpen(true)} />
        </div>
      </div>

      <div className="px-4 pt-4 md:pt-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-5 md:gap-12 mb-6">
          <div className="relative flex-shrink-0">
            <div 
              className="h-20 w-20 md:h-36 md:w-36 rounded-full p-[2.5px] bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 cursor-pointer"
              onClick={() => window.open(`https://instagram.com/${profile.instagram}`, '_blank')}
            >
              <div className="h-full w-full rounded-full border-2 border-white overflow-hidden bg-white flex items-center justify-center">
                {profile.profilePicture ? (
                  <img src={profile.profilePicture} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-baseline font-black text-2xl md:text-4xl tracking-tighter select-none">
                    <span className="text-green-600">L</span>
                    <span className="text-slate-900 text-lg md:text-2xl mx-0.5">&</span>
                    <span className="text-slate-900">F</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900">{profile.instagram}</h1>
                <CheckCircle2 className="h-4 w-4 text-blue-500 fill-blue-500" />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  size="sm" 
                  className="h-8 px-4 bg-green-600 hover:bg-green-700 font-bold rounded-lg text-xs flex-1 md:flex-none"
                  onClick={() => {
                    setActiveTab('menu');
                    document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Pedir Agora
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="h-8 px-3 font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg text-xs flex-1 md:flex-none flex items-center gap-1"
                  onClick={() => window.open(`https://wa.me/${profile.phone.replace(/\D/g, '')}`, '_blank')}
                >
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="h-8 px-3 font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg text-xs flex-1 md:flex-none flex items-center gap-1"
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
              <p className="font-bold text-sm md:text-base text-slate-900">{profile.name}</p>
              <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {profile.bio}
                <div className="mt-1">
                  <a 
                    href={`https://instagram.com/${profile.instagram}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Instagram className="h-3 w-3" />
                    @{profile.instagram}
                  </a>
                </div>
                <br />
                {profile.isOpen ? (
                  <span className="text-green-600 font-bold">● Aberto agora</span>
                ) : (
                  <span className="text-red-600 font-bold">● Fechado no momento</span>
                )}
              </div>
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
          <div className="space-y-0.5 px-1">
            <p className="font-bold text-sm text-slate-900">{profile.name}</p>
            <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {profile.bio}
              <br />
              {profile.isOpen ? (
                <span className="text-green-600 font-bold">● Aberto agora</span>
              ) : (
                <span className="text-red-600 font-bold">● Fechado no momento</span>
              )}
            </div>
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
            className="space-y-0"
          >
            {/* iFood Style Banners (Instagram Highlights style) */}
      {promotions.length > 0 && (
        <div className="px-4 overflow-x-auto flex gap-3 scrollbar-hide py-2">
          {promotions.filter(p => p.active).map((promo) => (
            <div key={promo.id} className="min-w-[280px] h-32 relative rounded-2xl overflow-hidden shadow-sm flex-shrink-0">
              <img src={promo.image} className="absolute inset-0 w-full h-full object-cover" alt={promo.title} />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex flex-col justify-center p-4">
                <Badge className="w-fit bg-red-500 text-white border-none mb-1 text-[10px]">OFERTA</Badge>
                <h3 className="text-white font-bold text-lg leading-tight">{promo.title}</h3>
                <p className="text-white/80 text-xs">{promo.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stories Style Categories */}
      <div className="flex gap-4 overflow-x-auto py-6 scrollbar-hide px-4 border-b border-slate-100">
        <button
          onClick={() => setSelectedCategory('all')}
          className="flex flex-col items-center gap-2 flex-shrink-0 group"
        >
          <div className={`w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr ${selectedCategory === 'all' ? 'from-yellow-400 via-red-500 to-purple-600' : 'from-slate-200 to-slate-200'} transition-all`}>
            <div className="w-full h-full rounded-full bg-white p-0.5">
              <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <Package className="w-7 h-7" />
              </div>
            </div>
          </div>
          <span className={`text-[11px] ${selectedCategory === 'all' ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
            Todos
          </span>
        </button>
        {categories.map((cat) => {
          const Icon = cat.icon ? ICON_MAP[cat.icon] : Package;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="flex flex-col items-center gap-2 flex-shrink-0 group"
            >
              <div className={`w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr ${selectedCategory === cat.id ? 'from-yellow-400 via-red-500 to-purple-600' : 'from-slate-200 to-slate-200'} transition-all`}>
                <div className="w-full h-full rounded-full bg-white p-0.5">
                  <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-600 overflow-hidden">
                    {cat.image ? (
                      <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Icon className="w-7 h-7" />
                    )}
                  </div>
                </div>
              </div>
              <span className={`text-[11px] ${selectedCategory === cat.id ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* View Mode Tabs & Search Bar (Sticky Container) */}
      <div id="produtos" className="sticky top-[53px] md:top-0 bg-white z-30 border-b border-slate-100">
        <div className="flex">
          <button 
            onClick={() => setViewMode('grid')}
            className={`flex-1 flex items-center justify-center py-3 border-b-2 transition-all ${viewMode === 'grid' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}
          >
            <Grid className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setViewMode('feed')}
            className={`flex-1 flex items-center justify-center py-3 border-b-2 transition-all ${viewMode === 'feed' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}
          >
            <LayoutList className="w-6 h-6" />
          </button>
        </div>

        {/* Search Bar (Inside Sticky) */}
        <div className="px-4 py-3 bg-white">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="O que você quer comer hoje?" 
              className="pl-10 h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-green-500 shadow-none transition-all focus:bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Products Display */}
      <div className="max-w-xl mx-auto md:py-4">
        <AnimatePresence>
          {viewMode === 'feed' ? (
            <div className="divide-y divide-slate-100">
              {filteredProducts.map((product) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white p-4 flex gap-4 items-start hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex-1 space-y-3" onClick={() => setSelectedProduct(product)}>
                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-900 text-base leading-tight flex items-center gap-1.5">
                        {product.name}
                        {product.ingredients && <Info className="w-3.5 h-3.5 text-slate-400" />}
                      </h3>
                      {product.description.includes('500g') && (
                        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] px-2 h-5 font-bold">
                          ⚖️ 500g
                        </Badge>
                      )}
                      <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">
                        {product.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-green-700 text-lg">R$ {product.price.toFixed(2)}</span>
                        {(product.id.startsWith('mar-') && parseInt(product.id.split('-')[1]) > 4) || 
                         (product.id.startsWith('cal-') && parseInt(product.id.split('-')[1]) > 2) ||
                         (product.id.startsWith('mol-') && parseInt(product.id.split('-')[1]) > 2) ? (
                          <Badge className="w-fit bg-purple-100 text-purple-700 border-none text-[9px] px-2 h-5 font-bold">NOVIDADE ✨</Badge>
                        ) : null}
                      </div>
                      <Button 
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 h-9 px-4 rounded-lg font-bold shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (product.id.startsWith('cox-') || product.categoryId === 'marmitas') {
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
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5 p-0.5">
              {filteredProducts.map((product) => (
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
                      if (product.id.startsWith('cox-') || product.categoryId === 'marmitas') {
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
                    {product.description.includes('500g') && (
                      <Badge className="bg-slate-800/80 backdrop-blur-sm text-white border-none text-[8px] px-1 h-4 font-bold">
                        500g
                      </Badge>
                    )}
                    {((product.id.startsWith('mar-') && parseInt(product.id.split('-')[1]) > 4) || 
                      (product.id.startsWith('cal-') && parseInt(product.id.split('-')[1]) > 2) ||
                      (product.id.startsWith('mol-') && parseInt(product.id.split('-')[1]) > 2)) && (
                      <Badge className="bg-purple-600/80 backdrop-blur-sm text-white border-none text-[7px] px-1 h-3.5 font-bold">
                        NEW
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
            </div>
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
              <Badge variant="outline" className="text-slate-500">
                {myOrders.length} pedidos
              </Badge>
            </div>

            {myOrders.length === 0 ? (
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
                          <span className="text-xs font-mono text-slate-500">#{order.id}</span>
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
                            <span className="text-slate-600">{item.quantity}x {item.name}</span>
                            <span className="font-medium">R$ {(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center font-bold">
                        <span>Total</span>
                        <span className="text-green-600">R$ {order.total.toFixed(2)}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 text-right">
                        {new Date(order.createdAt).toLocaleDateString('pt-BR')} às {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-20 left-4 right-4 z-50 md:hidden"
          >
            <Sheet>
              <SheetTrigger render={
                <Button className="w-full h-14 bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-2xl flex items-center justify-between px-6 font-bold border-2 border-white/20 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 px-2 py-1 rounded-lg text-xs">
                      {cartCount}
                    </div>
                    <span>Ver Sacola</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/80 text-xs font-normal">Total</span>
                    <span>R$ {total.toFixed(2)}</span>
                  </div>
                </Button>
              } />
              <SheetContent side="bottom" className="h-[92vh] rounded-t-[2.5rem] sm:max-w-lg mx-auto border-none shadow-2xl p-0 overflow-hidden">
                <div className="h-1.5 w-12 bg-slate-200 rounded-full mx-auto mt-3 mb-2" />
                <div className="px-6 pb-6 h-full flex flex-col">
                  <SheetHeader className="pb-4">
                    <SheetTitle className="flex items-center gap-2 text-2xl font-bold">
                      <ShoppingCart className="h-6 w-6 text-green-600" />
                      Carrinho
                    </SheetTitle>
                    <SheetDescription className="text-sm">
                      {marmitaCount >= 15 ? (
                        <span className="text-green-600 font-bold">Combo 15+ marmitas: R$ 19,00 cada! 🎉</span>
                      ) : marmitaCount >= 10 ? (
                        <span className="text-blue-600 font-bold">Combo 10+ marmitas: R$ 20,00 cada!</span>
                      ) : (
                        "Adicione 10 ou 15 marmitas para ganhar descontos!"
                      )}
                      {coxinhaCount >= 3 && (
                        <span className="block text-orange-600 font-bold">Oferta Coxinha: 3 por R$ 24,00! 🥟</span>
                      )}
                    </SheetDescription>
                  </SheetHeader>
                  
                  <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={`${item.productId}-${item.notes || ''}`} className="flex items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <div className="flex-1">
                            <h4 className="font-bold text-sm text-slate-900">
                              {item.name}
                              {item.notes && <span className="text-green-600 ml-1">({item.notes})</span>}
                            </h4>
                            <p className="text-xs text-slate-500">
                              {item.productId.startsWith('mar-') ? (
                                <>R$ {marmitaUnitPrice.toFixed(2)} cada</>
                              ) : item.productId.startsWith('cox-') && coxinhaCount >= 3 ? (
                                <>R$ 8,00 cada (Oferta 3 por 24)</>
                              ) : (
                                <>R$ {item.price.toFixed(2)} cada</>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-slate-100">
                              <button 
                                onClick={() => removeFromCart(item.productId, item.notes)}
                                className="p-1 hover:bg-slate-50 rounded-lg transition-colors text-slate-400"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <Select 
                                value={item.quantity.toString()} 
                                onValueChange={(val) => updateQuantity(item.productId, parseInt(val), item.notes)}
                              >
                                <SelectTrigger className="h-7 w-10 border-none bg-transparent p-0 font-bold text-sm focus:ring-0 shadow-none justify-center">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="min-w-[4rem]">
                                  {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                                    <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button 
                                onClick={() => {
                                  const p = products.find(prod => prod.id === item.productId);
                                  if (p) addToCart(p, 1, item.notes);
                                }}
                                className="p-1 hover:bg-slate-50 rounded-lg transition-colors text-green-600"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
                              onClick={() => clearItemFromCart(item.productId, item.notes)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Seus Dados</label>
                        <Input 
                          placeholder="Seu Nome" 
                          className="h-12 rounded-xl bg-slate-50 border-slate-100"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                        />
                        <Input 
                          placeholder="Seu WhatsApp" 
                          className="h-12 rounded-xl bg-slate-50 border-slate-100"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Pagamento</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['pix', 'cartao-link', 'dinheiro'].map((method) => (
                            <button
                              key={method}
                              onClick={() => setPaymentMethod(method as any)}
                              className={`py-3 rounded-xl text-[10px] font-bold border transition-all uppercase ${paymentMethod === method ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-200' : 'bg-white border-slate-100 text-slate-600'}`}
                            >
                              {method.replace('-', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>Subtotal</span>
                        <span>R$ {subtotal.toFixed(2)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-sm text-green-600 font-medium">
                          <span>Descontos Aplicados</span>
                          <span>- R$ {discount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold text-slate-900">
                        <span>Total</span>
                        <span>R$ {total.toFixed(2)}</span>
                      </div>
                    </div>
                    <Button 
                      className="w-full h-14 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-green-100"
                      onClick={handlePlaceOrder}
                      disabled={!customerName || !customerPhone || cart.length === 0}
                    >
                      Finalizar Pedido
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-100 px-10 py-3 flex items-center justify-between md:hidden safe-area-bottom">
        <button className="text-slate-900 transition-transform active:scale-90">
          <Home className="w-7 h-7" />
        </button>
        <button className="text-slate-400 transition-transform active:scale-90">
          <Search className="w-7 h-7" />
        </button>
        <button className="text-slate-400 transition-transform active:scale-90">
          <Plus className="w-7 h-7 border-2 border-slate-400 rounded-lg p-0.5" />
        </button>
        <Sheet>
          <SheetTrigger render={
            <button className="relative text-slate-400 transition-transform active:scale-90">
              <ShoppingCart className="w-7 h-7" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center border-2 border-white animate-in zoom-in">
                  {cartCount}
                </span>
              )}
            </button>
          } />
          <SheetContent side="bottom" className="h-[92vh] rounded-t-[2.5rem] sm:max-w-lg mx-auto border-none shadow-2xl p-0 overflow-hidden">
            <div className="h-1.5 w-12 bg-slate-200 rounded-full mx-auto mt-3 mb-2" />
            <div className="px-6 pb-6 h-full flex flex-col">
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-2 text-2xl font-bold">
                  <ShoppingCart className="h-6 w-6 text-green-600" />
                  Carrinho
                </SheetTitle>
                <SheetDescription className="text-sm">
                  <div className="space-y-1">
                    {marmitaCount >= 15 ? (
                      <span className="block text-green-600 font-bold">Combo 15+ marmitas: R$ 19,00 cada! 🎉</span>
                    ) : marmitaCount >= 10 ? (
                      <span className="block text-blue-600 font-bold">Combo 10+ marmitas: R$ 20,00 cada!</span>
                    ) : (
                      <span className="block">Adicione 10 ou 15 marmitas para ganhar descontos!</span>
                    )}
                    {coxinhaCount >= 3 && (
                      <span className="block text-orange-600 font-bold">Oferta Coxinha: 3 por R$ 24,00! 🥟</span>
                    )}
                  </div>
                </SheetDescription>
              </SheetHeader>
              
              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={`${item.productId}-${item.notes || ''}`} className="flex items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex-1">
                        <h4 className="font-bold text-sm text-slate-900">
                          {item.name}
                          {item.notes && <span className="text-green-600 ml-1">({item.notes})</span>}
                        </h4>
                        <p className="text-xs text-slate-500">
                          {item.productId.startsWith('mar-') ? (
                            <>R$ {marmitaUnitPrice.toFixed(2)} cada</>
                          ) : item.productId.startsWith('cox-') && coxinhaCount >= 3 ? (
                            <>R$ 8,00 cada (Oferta 3 por 24)</>
                          ) : (
                            <>R$ {item.price.toFixed(2)} cada</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-slate-100">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg text-slate-400"
                            onClick={() => removeFromCart(item.productId, item.notes)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Select 
                            value={item.quantity.toString()} 
                            onValueChange={(val) => updateQuantity(item.productId, parseInt(val), item.notes)}
                          >
                            <SelectTrigger className="h-8 w-10 border-none bg-transparent p-0 font-bold text-sm focus:ring-0 shadow-none justify-center">
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
                            className="h-8 w-8 rounded-lg text-green-600"
                            onClick={() => {
                              const p = products.find(prod => prod.id === item.productId);
                              if (p) addToCart(p, 1, item.notes);
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
                          onClick={() => clearItemFromCart(item.productId, item.notes)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900">Seus Dados</h3>
                  <div className="grid gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-bold text-slate-500 uppercase">Nome Completo</Label>
                      <Input id="name" placeholder="Como podemos te chamar?" className="rounded-xl bg-slate-50 border-none h-11" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs font-bold text-slate-500 uppercase">WhatsApp</Label>
                      <Input id="phone" placeholder="(00) 00000-0000" className="rounded-xl bg-slate-50 border-none h-11" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900">Pagamento</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <Button 
                      variant={paymentMethod === 'pix' ? 'default' : 'outline'} 
                      className={`flex-col h-20 gap-1 rounded-2xl ${paymentMethod === 'pix' ? 'bg-green-600' : 'bg-white'}`}
                      onClick={() => setPaymentMethod('pix')}
                    >
                      <Landmark className="h-5 w-5" />
                      <span className="text-[10px] font-bold">PIX</span>
                    </Button>
                    <Button 
                      variant={paymentMethod === 'cartao-link' ? 'default' : 'outline'} 
                      className={`flex-col h-20 gap-1 rounded-2xl ${paymentMethod === 'cartao-link' ? 'bg-green-600' : 'bg-white'}`}
                      onClick={() => setPaymentMethod('cartao-link')}
                    >
                      <CreditCard className="h-5 w-5" />
                      <span className="text-[10px] font-bold">Cartão</span>
                    </Button>
                    <Button 
                      variant={paymentMethod === 'dinheiro' ? 'default' : 'outline'} 
                      className={`flex-col h-20 gap-1 rounded-2xl ${paymentMethod === 'dinheiro' ? 'bg-green-600' : 'bg-white'}`}
                      onClick={() => setPaymentMethod('dinheiro')}
                    >
                      <Banknote className="h-5 w-5" />
                      <span className="text-[10px] font-bold">Dinheiro</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="pt-6 space-y-4 bg-white">
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Subtotal</span>
                    <span>R$ {subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 font-bold">
                      <span>Descontos Aplicados</span>
                      <span>- R$ {discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-2xl font-black text-slate-900">
                    <span>Total</span>
                    <span className="text-green-600">
                      R$ {total.toFixed(2)}
                    </span>
                  </div>
                </div>
                <Button 
                  className="w-full h-14 bg-green-600 hover:bg-green-700 text-lg font-bold rounded-2xl shadow-lg transition-transform active:scale-95"
                  onClick={handlePlaceOrder}
                >
                  Finalizar Pedido
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <button className="text-slate-400 transition-transform active:scale-90">
          <User className="w-7 h-7" />
        </button>
      </div>

      {/* Desktop Floating Cart Button */}
      <div className="hidden md:block">
        {cartCount > 0 && (
          <div className="fixed bottom-6 right-6 z-50">
            <Sheet>
              <SheetTrigger render={
                <Button size="lg" className="h-16 rounded-full bg-green-600 shadow-2xl hover:bg-green-700 border-4 border-white px-8">
                  <ShoppingCart className="mr-2 h-6 w-6" />
                  Carrinho ({cartCount})
                  <span className="ml-4 font-bold text-xl">
                    R$ {total.toFixed(2)}
                  </span>
                </Button>
              } />
              <SheetContent side="right" className="w-full sm:max-w-md border-none shadow-2xl">
                <SheetHeader className="pb-4">
                  <SheetTitle className="flex items-center gap-2 text-2xl">
                    <ShoppingCart className="h-6 w-6 text-green-600" />
                    Seu Pedido
                  </SheetTitle>
                  <SheetDescription>
                    <div className="space-y-1 mt-2">
                      {marmitaCount >= 15 ? (
                        <Badge className="bg-green-100 text-green-700 border-none">Combo 15+ marmitas: R$ 19,00 cada! 🎉</Badge>
                      ) : marmitaCount >= 10 ? (
                        <Badge className="bg-blue-100 text-blue-700 border-none">Combo 10+ marmitas: R$ 20,00 cada!</Badge>
                      ) : (
                        <p className="text-xs text-slate-500">Adicione 10 ou 15 marmitas para ganhar descontos!</p>
                      )}
                      {coxinhaCount >= 3 && (
                        <Badge className="bg-orange-100 text-orange-700 border-none ml-1">Oferta Coxinha: 3 por R$ 24,00! 🥟</Badge>
                      )}
                    </div>
                  </SheetDescription>
                </SheetHeader>
                
                <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={`${item.productId}-${item.notes || ''}`} className="flex items-center justify-between gap-4 bg-slate-50 p-3 rounded-2xl">
                        <div className="flex-1">
                          <h4 className="font-bold text-sm">
                            {item.name}
                            {item.notes && <span className="text-green-600 ml-1">({item.notes})</span>}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {item.productId.startsWith('mar-') ? (
                              <>R$ {marmitaUnitPrice.toFixed(2)} cada</>
                            ) : item.productId.startsWith('cox-') && coxinhaCount >= 3 ? (
                              <>R$ 8,00 cada (Oferta 3 por 24)</>
                            ) : (
                              <>R$ {item.price.toFixed(2)} cada</>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-100">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg text-slate-400"
                              onClick={() => removeFromCart(item.productId, item.notes)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Select 
                              value={item.quantity.toString()} 
                              onValueChange={(val) => updateQuantity(item.productId, parseInt(val), item.notes)}
                            >
                              <SelectTrigger className="h-8 w-10 border-none bg-transparent p-0 font-bold text-sm focus:ring-0 shadow-none justify-center">
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
                              className="h-8 w-8 rounded-lg text-green-600"
                              onClick={() => {
                                const p = products.find(prod => prod.id === item.productId);
                                if (p) addToCart(p, 1, item.notes);
                              }}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl"
                            onClick={() => clearItemFromCart(item.productId, item.notes)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-lg">Seus Dados</h3>
                    <div className="grid gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="name-desktop">Nome Completo</Label>
                        <Input id="name-desktop" placeholder="Como podemos te chamar?" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="phone-desktop">WhatsApp</Label>
                        <Input id="phone-desktop" placeholder="(00) 00000-0000" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-lg">Forma de Pagamento</h3>
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        variant={paymentMethod === 'pix' ? 'default' : 'outline'} 
                        className={`flex-col h-20 gap-1 ${paymentMethod === 'pix' ? 'bg-green-600' : ''}`}
                        onClick={() => setPaymentMethod('pix')}
                      >
                        <Landmark className="h-5 w-5" />
                        <span className="text-[10px]">PIX</span>
                      </Button>
                      <Button 
                        variant={paymentMethod === 'cartao-link' ? 'default' : 'outline'} 
                        className={`flex-col h-20 gap-1 ${paymentMethod === 'cartao-link' ? 'bg-green-600' : ''}`}
                        onClick={() => setPaymentMethod('cartao-link')}
                      >
                        <CreditCard className="h-5 w-5" />
                        <span className="text-[10px]">Cartão (Link)</span>
                      </Button>
                      <Button 
                        variant={paymentMethod === 'dinheiro' ? 'default' : 'outline'} 
                        className={`flex-col h-20 gap-1 ${paymentMethod === 'dinheiro' ? 'bg-green-600' : ''}`}
                        onClick={() => setPaymentMethod('dinheiro')}
                      >
                        <Banknote className="h-5 w-5" />
                        <span className="text-[10px]">Dinheiro</span>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="pt-6 space-y-4">
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>Subtotal</span>
                      <span>R$ {subtotal.toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600 font-medium">
                        <span>Descontos Aplicados</span>
                        <span>- R$ {discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-2xl font-black">
                      <span>Total</span>
                      <span className="text-green-600">
                        R$ {total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <Button 
                    className="w-full h-14 bg-green-600 hover:bg-green-700 text-xl font-bold rounded-2xl shadow-lg"
                    onClick={handlePlaceOrder}
                  >
                    Finalizar Pedido
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        )}
      </div>
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
                      {selectedProduct.description.includes('500g') && (
                        <Badge className="bg-slate-800 text-white border-none">
                          ⚖️ 500g
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

                {selectedProduct.id.startsWith('cox-') && (
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
                      <span className="text-2xl font-bold text-green-700">R$ {selectedProduct.price.toFixed(2)}</span>
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
                      if (selectedProduct.id.startsWith('cox-')) {
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
                    Adicionar {detailQuantity > 1 ? `${detailQuantity} itens` : 'à Sacola'} • R$ {(selectedProduct.price * detailQuantity).toFixed(2)}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Discreet Footer with Admin Link */}
      <footer className="py-8 px-4 border-t border-slate-50 text-center space-y-2">
        <p className="text-xs text-slate-300">© 2024 Lev & Fit - Marmitas Congeladas</p>
        <Link to="/admin" className="text-[10px] text-slate-100 hover:text-green-600 transition-colors opacity-10 hover:opacity-100">
          Painel Administrativo
        </Link>
      </footer>
      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-t border-slate-100 px-6 py-2 flex justify-around items-center md:hidden">
        <button 
          onClick={() => setActiveTab('menu')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'menu' ? 'text-green-600' : 'text-slate-400'}`}
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-medium">Início</span>
        </button>
        <button 
          onClick={() => setIsCartOpen(true)}
          className="flex flex-col items-center gap-1 text-slate-400 relative"
        >
          <ShoppingCart className="w-6 h-6" />
          <span className="text-[10px] font-medium">Carrinho</span>
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
              {cart.reduce((acc, item) => acc + item.quantity, 0)}
            </span>
          )}
        </button>
        <button 
          onClick={() => setActiveTab('orders')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'orders' ? 'text-green-600' : 'text-slate-400'}`}
        >
          <ClipboardList className="w-6 h-6" />
          <span className="text-[10px] font-medium">Pedidos</span>
        </button>
      </div>

      {/* Floating WhatsApp Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => window.open(`https://wa.me/${profile.phone.replace(/\D/g, '')}`, '_blank')}
        className="fixed bottom-24 right-6 z-50 bg-green-500 text-white p-4 rounded-full shadow-2xl flex items-center justify-center hover:bg-green-600 transition-colors"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
        </span>
      </motion.button>
    </div>
  );
}
