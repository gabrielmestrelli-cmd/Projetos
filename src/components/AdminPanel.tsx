import React, { useState, useMemo, useEffect } from 'react';
import { Category, Product, Order, OrderStatus, Testimonial, Promotion, BusinessProfile } from '../types';
import { ICON_MAP, INITIAL_TESTIMONIALS, INITIAL_PROMOTIONS, INITIAL_PROFILE } from '../constants';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, QrCode, CheckCircle2, Clock, XCircle, CookingPot, ChevronRight, Package, LayoutGrid, ClipboardList, User, Phone, CreditCard, Banknote, Landmark, Star, Loader2, MessageCircle, LogOut, Volume2, Bike, Store, MapPin, StickyNote, RefreshCw, Search, ImageOff } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { playCashRegister, preloadCashRegister } from '../lib/sound';
import { newId } from '../lib/id';

// Conta de admin no Supabase. O e-mail não é segredo; a senha é conferida pelo Supabase, nunca fica no código.
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) || 'bielmaestrelli@hotmail.com';
import { whatsappLink, maskPhone } from '../lib/phone';
import { formatBRL } from '../lib/pricing';
import { DEFAULT_DELIVERY, feeFor, geocode, formatKm } from '../lib/delivery';
import { DeliverySettings } from '../types';
import { supabase } from '../lib/supabase';

interface AdminPanelProps {
  categories: Category[];
  products: Product[];
  orders: Order[];
  testimonials: Testimonial[];
  promotions: Promotion[];
  profile: BusinessProfile;
  onUpdateMenu: (categories: Category[], products: Product[], testimonials?: Testimonial[], promotions?: Promotion[], profile?: BusinessProfile) => Promise<boolean>;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  isAdmin: boolean;
  authChecked: boolean;
  onAdminLogin: (email: string, password: string) => Promise<string | null>;
  onAdminLogout: () => void;
}

export default function AdminPanel({ 
  categories, 
  products, 
  orders, 
  testimonials,
  promotions,
  profile,
  onUpdateMenu, 
  onUpdateOrderStatus,
  isAdmin,
  authChecked,
  onAdminLogin,
  onAdminLogout
}: AdminPanelProps) {
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isTestimonialDialogOpen, setIsTestimonialDialogOpen] = useState(false);
  const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState(false);

  // Reduz a foto para no máximo 900px e JPEG ~80%: fica leve pro banco e pro celular do cliente
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Escolha um arquivo de imagem');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 900;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          callback(reader.result as string);
          return;
        }
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => toast.error('Não foi possível ler essa imagem');
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Product Form State
  const [productForm, setProductForm] = useState<Partial<Product>>({
    name: '',
    description: '',
    price: 15,
    categoryId: '',
    available: true,
    image: '',
    type: 'pronta-entrega',
  });

  // Category Form State
  const [categoryForm, setCategoryForm] = useState<Partial<Category>>({
    name: '',
    icon: '',
    image: '',
  });

  // Testimonial Form State
  const [testimonialForm, setTestimonialForm] = useState<Partial<Testimonial>>({
    name: '',
    comment: '',
    rating: 5,
    avatar: '',
  });

  // Promotion Form State
  const [promotionForm, setPromotionForm] = useState<Partial<Promotion>>({
    title: '',
    description: '',
    image: '',
  });

  // Profile Form State
  const [profileForm, setProfileForm] = useState<BusinessProfile>(profile || INITIAL_PROFILE);
  // Deixa o som da caixa pronto: o navegador libera áudio no primeiro clique na página
  useEffect(() => {
    if (!isAdmin) return;
    const unlock = () => { preloadCashRegister(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [isAdmin]);
  // Quando o perfil chega do banco, atualiza o formulário
  useEffect(() => {
    if (profile) setProfileForm(profile);
  }, [profile]);
  const [prevOrdersCount, setPrevOrdersCount] = useState(orders.length);
  const [orderSearch, setOrderSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const newOrder = orders[0];
    const isFresh = newOrder && newOrder.status === 'pending' &&
      Date.now() - new Date(newOrder.createdAt).getTime() < 2 * 60 * 1000;
    if (orders.length > prevOrdersCount && isFresh) {
      toast.success(`Novo pedido de ${newOrder.customerName}!`, {
        description: `Pedido #${newOrder.orderNumber || ''} • ${formatBRL(newOrder.total)}`,
        duration: 10000,
        action: {
          label: 'Ver Pedido',
          onClick: () => setActiveTab('orders')
        }
      });
      
      // Play a notification sound if possible
      playCashRegister();
    }
    setPrevOrdersCount(orders.length);
  }, [orders, prevOrdersCount]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    const error = await onAdminLogin(ADMIN_EMAIL, password);
    setIsLoggingIn(false);
    if (error) {
      toast.error(error);
    } else {
      setPassword('');
      toast.success('Bem-vindo, Admin!');
    }
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md border-none shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-green-600 text-white p-8 text-center">
            <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
              <img src="/logo-icone.png" alt="Lev & Fit" className="w-12 h-12 object-contain" />
            </div>
            <CardTitle className="text-2xl font-bold">Painel de Controle</CardTitle>
            <CardDescription className="text-white/80">Acesso restrito para administração</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleLogin} className="space-y-4">
              {/* campo escondido: ajuda o gerenciador de senhas do navegador */}
              <input type="hidden" name="username" autoComplete="username" value={ADMIN_EMAIL} readOnly />
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input 
                  id="password"
                  type="password" 
                  autoComplete="current-password"
                  autoFocus
                  placeholder="Digite a senha do painel" 
                  className="h-12 rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={isLoggingIn} className="w-full h-12 bg-green-600 hover:bg-green-700 rounded-xl font-bold text-lg">
                {isLoggingIn ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Entrar no Painel'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-slate-50 p-4 text-center">
            <p className="text-xs text-slate-400 w-full">Acesso restrito à equipe Lev & Fit.</p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const emptyProductForm: Partial<Product> = { name: '', description: '', price: 21, categoryId: '', available: true, image: '', type: 'encomenda', tags: [], ingredients: [] };

  const openNewProduct = () => {
    setEditingProduct(null);
    setConfirmDeleteId(null);
    setProductForm({ ...emptyProductForm, categoryId: productCategoryFilter !== 'all' ? productCategoryFilter : '' });
    setIsProductDialogOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setConfirmDeleteId(null);
    setProductForm({ ...product, tags: product.tags || [], ingredients: product.ingredients || [] });
    setIsProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    const name = (productForm.name || '').trim();
    const price = Number(productForm.price);
    if (!name) { toast.error('Coloque o nome do produto'); return; }
    if (!productForm.categoryId) { toast.error('Escolha a categoria'); return; }
    if (!Number.isFinite(price) || price <= 0) { toast.error('Coloque um preço maior que zero'); return; }

    const clean: Partial<Product> = {
      ...productForm,
      name,
      price: Math.round(price * 100) / 100,
      description: (productForm.description || '').trim(),
      tags: (productForm.tags || []).map(t => t.trim()).filter(Boolean),
      ingredients: (productForm.ingredients || []).map(t => t.trim()).filter(Boolean),
    };

    const newProducts: Product[] = editingProduct
      ? products.map(p => p.id === editingProduct.id ? { ...editingProduct, ...clean } as Product : p)
      : [...products, { ...(clean as Product), id: newId() }];

    const ok = await onUpdateMenu(categories, newProducts);
    if (ok) {
      toast.success(editingProduct ? 'Produto atualizado' : 'Produto adicionado');
      setIsProductDialogOpen(false);
      setEditingProduct(null);
    }
  };

  const toggleProductAvailable = async (product: Product, available: boolean) => {
    const ok = await onUpdateMenu(categories, products.map(p => p.id === product.id ? { ...p, available } : p));
    if (ok) toast.success(available ? `${product.name} voltou pro cardápio` : `${product.name} escondido do cardápio`);
  };

  const handleSaveCategory = () => {
    if (!categoryForm.name) {
      toast.error('Preencha o nome da categoria');
      return;
    }

    let newCategories: Category[];
    if (editingCategory) {
      newCategories = categories.map(c => c.id === editingCategory.id ? { ...editingCategory, ...categoryForm } as Category : c);
      toast.success('Categoria atualizada');
    } else {
      const newCategory: Category = {
        id: newId(),
        ...categoryForm as Category,
      };
      newCategories = [...categories, newCategory];
      toast.success('Categoria adicionada');
    }

    onUpdateMenu(newCategories, products);
    setIsCategoryDialogOpen(false);
    setEditingCategory(null);
    setCategoryForm({ name: '', icon: '', image: '' });
  };

  const handleDeleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      toast.error('Não foi possível apagar o produto', { description: error.message });
      return;
    }
    await onUpdateMenu(categories, products.filter(p => p.id !== id));
    setConfirmDeleteId(null);
    setIsProductDialogOpen(false);
    setEditingProduct(null);
    toast.success('Produto apagado');
  };

  const handleDeleteCategory = async (id: string) => {
    if (products.some(p => p.categoryId === id)) {
      toast.error('Não é possível excluir uma categoria com produtos vinculados');
      return;
    }
    const newCategories = categories.filter(c => c.id !== id);
    onUpdateMenu(newCategories, products);
    
    try {
      await supabase.from('categories').delete().eq('id', id);
      toast.success('Categoria removida');
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  const handleSaveTestimonial = () => {
    if (!testimonialForm.name || !testimonialForm.comment) {
      toast.error('Preencha o nome e o comentário do depoimento');
      return;
    }
    
    let newTestimonials: Testimonial[];
    if (editingTestimonial) {
      newTestimonials = testimonials.map(t => t.id === editingTestimonial.id ? { ...editingTestimonial, ...testimonialForm } as Testimonial : t);
      toast.success('Depoimento atualizado');
    } else {
      const newT: Testimonial = { 
        id: newId(), 
        createdAt: new Date().toISOString(),
        ...testimonialForm as Testimonial 
      };
      newTestimonials = [...testimonials, newT];
      toast.success('Depoimento adicionado');
    }
    
    onUpdateMenu(categories, products, newTestimonials, promotions);
    setIsTestimonialDialogOpen(false);
    setEditingTestimonial(null);
    setTestimonialForm({ name: '', comment: '', rating: 5, avatar: '' });
  };

  const handleSavePromotion = async () => {
    if (!promotionForm.title?.trim()) {
      toast.error('Coloque o título');
      return;
    }
    if (!promotionForm.image) {
      toast.error('Escolha uma foto para o story');
      return;
    }
    const clean = { ...promotionForm, title: promotionForm.title.trim(), description: (promotionForm.description || '').trim() };
    const newPromotions: Promotion[] = editingPromotion
      ? promotions.map(p => p.id === editingPromotion.id ? { ...editingPromotion, ...clean } as Promotion : p)
      : [...promotions, { id: newId(), active: true, createdAt: new Date().toISOString(), ...clean } as Promotion];
    const ok = await onUpdateMenu(categories, products, testimonials, newPromotions);
    if (!ok) return;
    toast.success(editingPromotion ? 'Story atualizado' : 'Story criado');
    setIsPromotionDialogOpen(false);
    setEditingPromotion(null);
    setPromotionForm({ title: '', description: '', image: '' });
  };

  const togglePromotion = async (promo: Promotion, active: boolean) => {
    const ok = await onUpdateMenu(categories, products, testimonials, promotions.map(p => p.id === promo.id ? { ...p, active } : p));
    if (ok) toast.success(active ? 'Story publicado' : 'Story escondido');
  };

  const handleSaveProfile = async () => {
    const ok = await onUpdateMenu(categories, products, testimonials, promotions, profileForm);
    if (ok) toast.success('Perfil salvo');
  };

  const delivery: DeliverySettings = profileForm.delivery ?? { ...DEFAULT_DELIVERY, baseFee: profileForm.deliveryFee || 0 };
  const setDelivery = (patch: Partial<DeliverySettings>) =>
    setProfileForm(f => {
      const cur = f.delivery ?? { ...DEFAULT_DELIVERY, baseFee: f.deliveryFee || 0 };
      const next = { ...cur, ...patch };
      return { ...f, delivery: next, deliveryFee: next.mode === 'fixed' ? next.baseFee : f.deliveryFee };
    });
  const locateOrigin = async () => {
    const label = (delivery.originLabel || profileForm.address || '').trim();
    if (!label) { toast.error('Escreva o endereço de onde saem as entregas'); return; }
    setLocating(true);
    const point = await geocode({ free: label }).catch(() => null);
    setLocating(false);
    if (!point) { toast.error('Não achei esse endereço no mapa', { description: 'Tente "Rua, número, bairro, cidade".' }); return; }
    setDelivery({ originLabel: label, originLat: point.lat, originLng: point.lng });
    toast.success('Ponto de saída encontrado. Confira no mapa e salve.');
  };

  const handleDeleteTestimonial = async (id: string) => {
    const newTestimonials = testimonials.filter(t => t.id !== id);
    onUpdateMenu(categories, products, newTestimonials, promotions);
    
    try {
      await supabase.from('testimonials').delete().eq('id', id);
      toast.success('Depoimento removido');
    } catch (err) {
      console.error('Error deleting testimonial:', err);
    }
  };

  const handleDeletePromotion = async (id: string) => {
    const newPromotions = promotions.filter(p => p.id !== id);
    onUpdateMenu(categories, products, testimonials, newPromotions);
    
    try {
      await supabase.from('promotions').delete().eq('id', id);
      toast.success('Promoção removida');
    } catch (err) {
      console.error('Error deleting promotion:', err);
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="mr-1 h-3 w-3" /> Pendente</Badge>;
      case 'preparing': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><CookingPot className="mr-1 h-3 w-3" /> Preparando</Badge>;
      case 'delivered': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="mr-1 h-3 w-3" /> Entregue</Badge>;
      case 'cancelled': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="mr-1 h-3 w-3" /> Cancelado</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Painel Administrativo</h2>
          <p className="text-slate-500">Gerencie seu cardápio, pedidos e configurações.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => playCashRegister()}>
            <Volume2 className="mr-2 h-4 w-4" /> Testar som 💰
          </Button>
          <Button variant="outline" onClick={onAdminLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </div>

      <Tabs defaultValue="orders" className="w-full min-w-0" onValueChange={setActiveTab}>
        <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="flex w-max sm:grid sm:w-full sm:grid-cols-6 lg:w-[900px]">
            <TabsTrigger value="orders" className="flex items-center gap-2 min-w-[100px] sm:min-w-0 relative">
              <ClipboardList className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Pedidos</span>
              {orders.filter(o => o.status === 'pending').length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {orders.filter(o => o.status === 'pending').length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2 min-w-[100px] sm:min-w-0">
              <Package className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-2 min-w-[100px] sm:min-w-0">
              <LayoutGrid className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Categorias</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2 min-w-[100px] sm:min-w-0">
              <User className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="promotions" className="flex items-center gap-2 min-w-[100px] sm:min-w-0">
              <Star className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Stories</span>
            </TabsTrigger>
            <TabsTrigger value="testimonials" className="flex items-center gap-2 min-w-[100px] sm:min-w-0">
              <User className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Feedback</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Perfil</CardTitle>
              <CardDescription>Personalize como sua marca aparece para os clientes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome da Marca</Label>
                    <Input 
                      value={profileForm.name} 
                      onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instagram (sem @)</Label>
                    <Input 
                      value={profileForm.instagram} 
                      onChange={(e) => setProfileForm({...profileForm, instagram: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp (com DDD)</Label>
                    <Input 
                      value={profileForm.phone} 
                      onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Endereço</Label>
                    <Input 
                      value={profileForm.address || ''} 
                      onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input 
                      type="checkbox" 
                      id="isOpen"
                      checked={profileForm.isOpen}
                      onChange={(e) => setProfileForm({...profileForm, isOpen: e.target.checked})}
                      className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                    />
                    <Label htmlFor="isOpen">Loja Aberta Agora</Label>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Bio / Descrição</Label>
                    <Textarea 
                      rows={4}
                      value={profileForm.bio} 
                      onChange={(e) => setProfileForm({...profileForm, bio: e.target.value})}
                      placeholder="Use \n para pular linha"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Publicações</Label>
                      <Input 
                        type="number"
                        value={profileForm.stats.posts} 
                        onChange={(e) => setProfileForm({...profileForm, stats: {...profileForm.stats, posts: parseInt(e.target.value)}})}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Seguidores</Label>
                      <Input 
                        value={profileForm.stats.followers} 
                        onChange={(e) => setProfileForm({...profileForm, stats: {...profileForm.stats, followers: e.target.value}})}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Seguindo</Label>
                      <Input 
                        type="number"
                        value={profileForm.stats.following} 
                        onChange={(e) => setProfileForm({...profileForm, stats: {...profileForm.stats, following: parseInt(e.target.value)}})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <Label>Foto de Perfil</Label>
                <div className="flex items-center gap-6">
                  <div className="h-24 w-24 rounded-full border-2 border-slate-100 overflow-hidden bg-slate-50 flex items-center justify-center">
                    {profileForm.profilePicture ? (
                      <img src={profileForm.profilePicture} className="w-full h-full object-cover" />
                    ) : (
                      <img src="/perfil.jpg" alt="Logo padrão" className="w-full h-full object-cover" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <Input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, (base64) => setProfileForm({...profileForm, profilePicture: base64}))}
                    />
                    <p className="text-xs text-slate-500">Recomendado: 500x500px</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4 rounded-2xl border p-4">
                <div>
                  <h4 className="font-semibold">Entrega</h4>
                  <p className="text-sm text-slate-500">Escolha se a taxa é fixa ou calculada pela distância até o cliente.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([['fixed', 'Taxa fixa'], ['per_km', 'Por km']] as const).map(([m, label]) => (
                    <Button key={m} type="button" variant={delivery.mode === m ? 'default' : 'outline'} className={delivery.mode === m ? 'bg-green-600 hover:bg-green-700' : ''} onClick={() => setDelivery({ mode: m })}>
                      {label}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor="dl-base" className="text-xs">{delivery.mode === 'fixed' ? 'Taxa (R$)' : 'Saída (R$)'}</Label>
                    <Input id="dl-base" type="number" inputMode="decimal" step="0.5" min="0" value={delivery.baseFee} onChange={e => setDelivery({ baseFee: Math.max(0, parseFloat(e.target.value) || 0) })} />
                  </div>
                  {delivery.mode === 'per_km' && (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor="dl-perkm" className="text-xs">R$ por km</Label>
                        <Input id="dl-perkm" type="number" inputMode="decimal" step="0.1" min="0" value={delivery.perKm} onChange={e => setDelivery({ perKm: Math.max(0, parseFloat(e.target.value) || 0) })} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="dl-incl" className="text-xs">Km inclusos</Label>
                        <Input id="dl-incl" type="number" inputMode="decimal" step="0.5" min="0" value={delivery.includedKm} onChange={e => setDelivery({ includedKm: Math.max(0, parseFloat(e.target.value) || 0) })} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="dl-max" className="text-xs">Atende até (km)</Label>
                        <Input id="dl-max" type="number" inputMode="decimal" step="1" min="0" value={delivery.maxKm} onChange={e => setDelivery({ maxKm: Math.max(0, parseFloat(e.target.value) || 0) })} />
                      </div>
                    </>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="dl-free" className="text-xs">Grátis acima de (R$)</Label>
                    <Input id="dl-free" type="number" inputMode="decimal" step="10" min="0" value={delivery.freeAbove} onChange={e => setDelivery({ freeAbove: Math.max(0, parseFloat(e.target.value) || 0) })} />
                  </div>
                </div>
                <p className="text-xs text-slate-400">Deixe 0 em "Grátis acima de" ou "Atende até" para não usar. Na taxa fixa, 0 vira "a combinar".</p>

                {delivery.mode === 'per_km' && (
                  <>
                    <div className="space-y-1">
                      <Label htmlFor="dl-origin" className="text-xs">De onde saem as entregas</Label>
                      <div className="flex gap-2">
                        <Input id="dl-origin" placeholder="Rua, número, bairro, cidade" value={delivery.originLabel ?? profileForm.address ?? ''} onChange={e => setDelivery({ originLabel: e.target.value, originLat: undefined, originLng: undefined })} />
                        <Button type="button" variant="outline" onClick={locateOrigin} disabled={locating}>
                          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                          <span className="ml-1">Localizar</span>
                        </Button>
                      </div>
                      {delivery.originLat != null && delivery.originLng != null ? (
                        <a className="text-xs text-green-700 underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${delivery.originLat}&mlon=${delivery.originLng}#map=17/${delivery.originLat}/${delivery.originLng}`}>
                          Ponto encontrado. Ver no mapa
                        </a>
                      ) : (
                        <p className="text-xs text-amber-700">Clique em Localizar antes de salvar. Sem o ponto de saída, a entrega fica "a combinar".</p>
                      )}
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-slate-500">Como fica a taxa</p>
                      <div className="grid grid-cols-4 gap-2 text-center text-sm">
                        {[2, 5, 10, 15].map(km => {
                          const r = feeFor({ ...delivery, freeAbove: 0 }, km, 0);
                          return (
                            <div key={km} className="rounded-lg bg-white p-2">
                              <div className="text-xs text-slate-400">{formatKm(km)}</div>
                              <div className="font-semibold tabular-nums">{r.outOfRange ? 'não atende' : formatBRL(r.fee)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50/50 border-t py-4 flex justify-end">
              <Button onClick={handleSaveProfile} className="bg-green-600 hover:bg-green-700">
                Salvar Alterações do Perfil
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        <TabsContent value="orders" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Pedidos Recentes</CardTitle>
                <CardDescription>Acompanhe e gerencie o status dos pedidos em tempo real.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-48">
                  <ClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Nº, nome ou telefone" 
                    className="pl-9 h-9 rounded-lg text-xs"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº / Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                          Nenhum pedido recebido ainda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders
                        .filter(o => {
                          const q = orderSearch.trim().toLowerCase();
                          if (!q) return true;
                          return (o.orderNumber || '').toLowerCase().includes(q)
                            || o.customerName.toLowerCase().includes(q)
                            || o.customerPhone.includes(q.replace(/\D/g, '') || '§');
                        })
                        .map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-green-700">#{order.orderNumber || order.id.slice(0, 4).toUpperCase()}</span>
                              {order.createdAt ? (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(order.createdAt).toLocaleDateString('pt-BR')} {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-mono italic">Data não disponível</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold flex items-center gap-1 text-sm">
                                {order.customerName}
                              </span>
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                {maskPhone(order.customerPhone)}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  aria-label="Abrir conversa no WhatsApp"
                                  className="h-6 w-6 text-green-600" 
                                  onClick={() => window.open(whatsappLink(order.customerPhone, `Olá ${order.customerName}! Sobre seu pedido #${order.orderNumber || ''} da Lev & Fit:`), '_blank')}
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </Button>
                              </span>
                              {order.deliveryType && (
                                <span className="mt-1 flex items-start gap-1 text-xs text-slate-600">
                                  {order.deliveryType === 'entrega'
                                    ? <><Bike className="mt-0.5 h-3 w-3 shrink-0" /><span className="max-w-[220px]">{order.address || 'Entrega'}</span></>
                                    : <><Store className="mt-0.5 h-3 w-3 shrink-0" /> Retirada</>}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1">
                              {order.items.map((item, idx) => (
                                <div key={idx}>
                                  <span className="font-semibold">{item.quantity}x</span> {item.name}
                                  {item.notes && (
                                    <span className={`ml-1 rounded px-1 font-bold ${item.notes.startsWith('Sem') ? 'bg-blue-100 text-blue-700' : 'text-slate-500'}`}>
                                      {item.notes}
                                    </span>
                                  )}
                                </div>
                              ))}
                              {order.notes && (
                                <div className="mt-1 flex items-start gap-1 rounded bg-amber-50 p-1 text-amber-800">
                                  <StickyNote className="mt-0.5 h-3 w-3 shrink-0" /> {order.notes}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="tabular-nums">{formatBRL(order.total)}</span>
                              {order.discount > 0 && (
                                <span className="text-[10px] text-green-600">Desc: -{formatBRL(order.discount)}</span>
                              )}
                              {!!order.deliveryFee && order.deliveryFee > 0 && (
                                <span className="text-[10px] text-slate-500">Entrega: {formatBRL(order.deliveryFee)}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs">
                              {order.paymentMethod === 'pix' && <Landmark className="h-3 w-3" />}
                              {order.paymentMethod === 'cartao-link' && <CreditCard className="h-3 w-3" />}
                              {order.paymentMethod === 'dinheiro' && <Banknote className="h-3 w-3" />}
                              <span>{order.paymentMethod === 'pix' ? 'PIX' : order.paymentMethod === 'cartao-link' ? 'Cartão (link)' : 'Dinheiro'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="text-right">
                            <Select 
                              value={order.status || 'pending'} 
                              onValueChange={(val) => onUpdateOrderStatus(order.id, val as OrderStatus)}
                            >
                              <SelectTrigger className="w-[130px] ml-auto" aria-label="Mudar status">
                                <SelectValue>
                                  {(v: string) => ({ pending: 'Pendente', preparing: 'Preparando', delivered: 'Entregue', cancelled: 'Cancelado' } as Record<string, string>)[v] ?? v}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pendente</SelectItem>
                                <SelectItem value="preparing">Preparando</SelectItem>
                                <SelectItem value="delivered">Entregue</SelectItem>
                                <SelectItem value="cancelled">Cancelado</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="mt-6 min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Produtos</h3>
              <p className="text-sm text-slate-500">Toque em um produto para editar nome, preço, foto e descrição.</p>
            </div>
            <Button className="bg-green-600 hover:bg-green-700" onClick={openNewProduct}>
              <Plus className="mr-2 h-4 w-4" /> Novo produto
            </Button>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input placeholder="Buscar produto" className="pl-9" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
            </div>
            <div className="flex min-w-0 gap-1 overflow-x-auto pb-1">
              {[{ id: 'all', name: 'Todos' }, ...categories].map(c => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={productCategoryFilter === c.id ? 'default' : 'outline'}
                  className={`shrink-0 ${productCategoryFilter === c.id ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  onClick={() => setProductCategoryFilter(c.id)}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          </div>

          {(() => {
            const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
            const q = norm(productSearch.trim());
            const list = products
              .filter(p => productCategoryFilter === 'all' || p.categoryId === productCategoryFilter)
              .filter(p => !q || norm(p.name).includes(q));
            if (list.length === 0) {
              return <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">Nenhum produto encontrado.</p>;
            }
            return (
              <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map(product => (
                  <div key={product.id} className={`flex min-w-0 items-center gap-3 rounded-xl border bg-white p-3 ${product.available ? '' : 'opacity-60'}`}>
                    <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => openEditProduct(product)}>
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                        {product.image
                          ? <img src={product.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          : <ImageOff className="h-5 w-5 text-slate-300" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{product.name}</p>
                        <p className="text-sm font-bold text-green-700 tabular-nums">{formatBRL(product.price)}</p>
                        <p className="truncate text-xs text-slate-400">{categories.find(c => c.id === product.categoryId)?.name || 'Sem categoria'}</p>
                      </div>
                    </button>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditProduct(product)}>
                        <Edit className="mr-1 h-3.5 w-3.5" /> Editar
                      </Button>
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Switch checked={product.available} onCheckedChange={(v) => toggleProductAvailable(product, v)} aria-label="Mostrar no cardápio" />
                        {product.available ? 'No cardápio' : 'Escondido'}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <Dialog open={isProductDialogOpen} onOpenChange={(open) => { setIsProductDialogOpen(open); if (!open) setConfirmDeleteId(null); }}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Editar produto' : 'Novo produto'}</DialogTitle>
                <DialogDescription>As mudanças aparecem no cardápio assim que você salvar.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                    {productForm.image
                      ? <img src={productForm.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      : <ImageOff className="h-6 w-6 text-slate-300" />}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="relative inline-flex cursor-pointer">
                      <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-slate-50">Trocar foto</span>
                      <input type="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => handleImageUpload(e, (base64) => setProductForm(f => ({ ...f, image: base64 })))} />
                    </label>
                    {productForm.image && (
                      <button type="button" className="text-left text-xs text-red-500 hover:underline" onClick={() => setProductForm(f => ({ ...f, image: '' }))}>Remover foto</button>
                    )}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="prod-name">Nome</Label>
                  <Input id="prod-name" value={productForm.name || ''} onChange={(e) => setProductForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="prod-price">Preço (R$)</Label>
                    <Input id="prod-price" type="number" inputMode="decimal" step="0.01" min="0" value={productForm.price ?? ''} onChange={(e) => setProductForm(f => ({ ...f, price: e.target.value === '' ? undefined : parseFloat(e.target.value) }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="prod-category">Categoria</Label>
                    <Select value={productForm.categoryId || ''} onValueChange={(val) => setProductForm(f => ({ ...f, categoryId: val as string }))}>
                      <SelectTrigger id="prod-category">
                        <SelectValue placeholder="Escolha...">{(v: string) => categories.find(c => c.id === v)?.name ?? 'Escolha...'}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="prod-desc">Descrição</Label>
                  <Textarea id="prod-desc" rows={3} value={productForm.description || ''} onChange={(e) => setProductForm(f => ({ ...f, description: e.target.value }))} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="prod-ingredients">Ingredientes (separados por vírgula)</Label>
                  <Input id="prod-ingredients" placeholder="Frango, Batata doce, Brócolis" value={(productForm.ingredients || []).join(', ')} onChange={(e) => setProductForm(f => ({ ...f, ingredients: e.target.value.split(',') }))} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="prod-type">Tipo</Label>
                    <Select value={productForm.type || 'encomenda'} onValueChange={(val) => setProductForm(f => ({ ...f, type: val as Product['type'] }))}>
                      <SelectTrigger id="prod-type">
                        <SelectValue>{(v: string) => (v === 'encomenda' ? 'Sob encomenda' : 'Pronta entrega')}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pronta-entrega">Pronta entrega</SelectItem>
                        <SelectItem value="encomenda">Sob encomenda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="prod-tags">Etiquetas</Label>
                    <Input id="prod-tags" placeholder="novidade, low carb" value={(productForm.tags || []).join(', ')} onChange={(e) => setProductForm(f => ({ ...f, tags: e.target.value.split(',') }))} />
                  </div>
                </div>

                <label className="flex items-center justify-between rounded-xl border p-3">
                  <span>
                    <span className="block text-sm font-medium">Mostrar no cardápio</span>
                    <span className="block text-xs text-slate-500">Desligue quando acabar o estoque</span>
                  </span>
                  <Switch checked={productForm.available ?? true} onCheckedChange={(v) => setProductForm(f => ({ ...f, available: v }))} />
                </label>

                <details className="text-sm">
                  <summary className="cursor-pointer text-slate-500">Usar link de imagem</summary>
                  <Input className="mt-2" placeholder="https://..." value={productForm.image?.startsWith('data:') ? '' : (productForm.image || '')} onChange={(e) => setProductForm(f => ({ ...f, image: e.target.value }))} />
                </details>
              </div>

              {confirmDeleteId && editingProduct ? (
                <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-800">Apagar <strong>{editingProduct.name}</strong> de vez? Para só tirar do cardápio, use "Mostrar no cardápio".</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Voltar</Button>
                    <Button variant="destructive" onClick={() => handleDeleteProduct(editingProduct.id)}>Apagar produto</Button>
                  </div>
                </div>
              ) : (
                <DialogFooter className="gap-2 sm:justify-between">
                  {editingProduct ? (
                    <Button variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => setConfirmDeleteId(editingProduct.id)}>
                      <Trash2 className="mr-1 h-4 w-4" /> Apagar
                    </Button>
                  ) : <span />}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>Cancelar</Button>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={handleSaveProduct}>Salvar</Button>
                  </div>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Promotions Tab */}
        <TabsContent value="promotions" className="mt-6 min-w-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Stories e ofertas</h3>
              <p className="text-sm text-slate-500">Aparecem como stories no topo do cardápio. Marque como lançamento para ganhar o destaque grande.</p>
            </div>
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => { setEditingPromotion(null); setPromotionForm({ title: '', description: '', image: '', isLaunch: false, ctaLabel: '' }); setIsPromotionDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> Novo story
            </Button>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            {promotions.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">Nenhum story ainda.</p>}
            {[...promotions].sort((x, y) => Number(!!y.isLaunch) - Number(!!x.isLaunch)).map(p => (
              <div key={p.id} className={`flex min-w-0 items-center gap-3 rounded-xl border bg-white p-3 ${p.active ? '' : 'opacity-60'}`}>
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => { setEditingPromotion(p); setPromotionForm(p); setIsPromotionDialogOpen(true); }}>
                  <span className={`shrink-0 rounded-full p-[2px] ${p.isLaunch ? 'bg-gradient-to-tr from-lime-400 to-emerald-700' : 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600'}`}>
                    <img src={p.image} alt="" className="h-14 w-14 rounded-full border-2 border-white object-cover" referrerPolicy="no-referrer" />
                  </span>
                  <span className="min-w-0">
                    {p.isLaunch && <span className="mb-0.5 inline-block rounded bg-lime-100 px-1.5 text-[10px] font-bold uppercase text-lime-800">Lançamento</span>}
                    <span className="block truncate font-semibold">{p.title}</span>
                    <span className="block truncate text-xs text-slate-500">{p.description}</span>
                  </span>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditingPromotion(p); setPromotionForm(p); setIsPromotionDialogOpen(true); }}>
                    <Edit className="mr-1 h-3.5 w-3.5" /> Editar
                  </Button>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Switch checked={p.active} onCheckedChange={(v) => togglePromotion(p, v)} aria-label="Publicar story" />
                    {p.active ? 'No ar' : 'Escondido'}
                  </label>
                </div>
              </div>
            ))}
          </div>

          <Dialog open={isPromotionDialogOpen} onOpenChange={setIsPromotionDialogOpen}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>{editingPromotion ? 'Editar story' : 'Novo story'}</DialogTitle>
                <DialogDescription>Use uma foto em pé (formato de story) para ficar melhor no celular.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100">
                    {promotionForm.image ? <img src={promotionForm.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <ImageOff className="h-6 w-6 text-slate-300" />}
                  </div>
                  <label className="relative inline-flex cursor-pointer">
                    <span className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-slate-50">{promotionForm.image ? 'Trocar foto' : 'Escolher foto'}</span>
                    <input type="file" accept="image/*" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => handleImageUpload(e, (base64) => setPromotionForm(f => ({ ...f, image: base64 })))} />
                  </label>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="promo-title">Título</Label>
                  <Input id="promo-title" value={promotionForm.title || ''} onChange={(e) => setPromotionForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="promo-desc">Texto</Label>
                  <Textarea id="promo-desc" rows={3} value={promotionForm.description || ''} onChange={(e) => setPromotionForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="promo-cta">Texto do botão</Label>
                  <Input id="promo-cta" placeholder={promotionForm.isLaunch ? 'Quero provar' : 'Aproveitar oferta'} value={promotionForm.ctaLabel || ''} onChange={(e) => setPromotionForm(f => ({ ...f, ctaLabel: e.target.value }))} />
                </div>
                <label className="flex items-center justify-between rounded-xl border p-3">
                  <span>
                    <span className="block text-sm font-medium">É um lançamento</span>
                    <span className="block text-xs text-slate-500">Vira o primeiro story e ganha o banner grande no cardápio</span>
                  </span>
                  <Switch checked={!!promotionForm.isLaunch} onCheckedChange={(v) => setPromotionForm(f => ({ ...f, isLaunch: v }))} />
                </label>
                <details className="text-sm">
                  <summary className="cursor-pointer text-slate-500">Usar link de imagem</summary>
                  <Input className="mt-2" placeholder="https://..." value={promotionForm.image?.startsWith('data:') ? '' : (promotionForm.image || '')} onChange={(e) => setPromotionForm(f => ({ ...f, image: e.target.value }))} />
                </details>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                {editingPromotion ? (
                  <Button variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => { handleDeletePromotion(editingPromotion.id); setIsPromotionDialogOpen(false); }}>
                    <Trash2 className="mr-1 h-4 w-4" /> Apagar
                  </Button>
                ) : <span />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsPromotionDialogOpen(false)}>Cancelar</Button>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={handleSavePromotion}>Salvar</Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Testimonials Tab */}
        <TabsContent value="testimonials" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Gerenciar Feedback</h3>
            <Dialog open={isTestimonialDialogOpen} onOpenChange={setIsTestimonialDialogOpen}>
              <DialogTrigger render={
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => {
                  setEditingTestimonial(null);
                  setTestimonialForm({ name: '', text: '', rating: 5, avatar: '' });
                }}>
                  <Plus className="mr-2 h-4 w-4" /> Novo Feedback
                </Button>
              } />
              <DialogContent>
                <DialogHeader><DialogTitle>Feedback do Cliente</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="t-name">Nome do Cliente</Label>
                    <Input id="t-name" value={testimonialForm.name} onChange={(e) => setTestimonialForm({...testimonialForm, name: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="t-comment">Comentário</Label>
                    <Textarea id="t-comment" value={testimonialForm.comment} onChange={(e) => setTestimonialForm({...testimonialForm, comment: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="t-avatar">URL do Avatar (Opcional)</Label>
                    <div className="flex gap-2">
                      <Input id="t-avatar" value={testimonialForm.avatar} onChange={(e) => setTestimonialForm({...testimonialForm, avatar: e.target.value})} />
                      <div className="relative">
                        <Input 
                          type="file" 
                          accept="image/*" 
                          className="absolute inset-0 opacity-0 cursor-pointer w-full" 
                          onChange={(e) => handleImageUpload(e, (base64) => setTestimonialForm({...testimonialForm, avatar: base64}))}
                        />
                        <Button type="button" variant="outline" size="sm">Upload</Button>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsTestimonialDialogOpen(false)}>Cancelar</Button>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={handleSaveTestimonial}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {testimonials.map(t => (
              <Card key={t.id}>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-100">
                      <img src={t.avatar} alt={t.name} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{t.name}</CardTitle>
                      <div className="flex text-yellow-400">
                        {[...Array(t.rating)].map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
                      </div>
                    </div>
                  </div>
                  <CardDescription className="text-xs italic">"{t.comment}"</CardDescription>
                </CardHeader>
                <CardFooter className="justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingTestimonial(t); setTestimonialForm(t); setIsTestimonialDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteTestimonial(t.id)}><Trash2 className="h-4 w-4" /></Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Gerenciar Categorias</h3>
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
              <DialogTrigger render={
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => {
                  setEditingCategory(null);
                  setCategoryForm({ name: '', icon: '' });
                }}>
                  <Plus className="mr-2 h-4 w-4" /> Nova Categoria
                </Button>
              } />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCategory ? 'Editar Categoria' : 'Adicionar Categoria'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="cat-name">Nome da Categoria</Label>
                    <Input id="cat-name" value={categoryForm.name} onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Ícone da Categoria</Label>
                    <div className="grid grid-cols-5 gap-2 p-2 border rounded-md max-h-[200px] overflow-y-auto">
                      {Object.keys(ICON_MAP).map((iconName) => {
                        const Icon = ICON_MAP[iconName];
                        return (
                          <Button
                            key={iconName}
                            variant={categoryForm.icon === iconName ? 'default' : 'outline'}
                            size="icon"
                            className={categoryForm.icon === iconName ? 'bg-green-600' : ''}
                            onClick={() => setCategoryForm({ ...categoryForm, icon: iconName })}
                            title={iconName}
                          >
                            <Icon className="h-4 w-4" />
                          </Button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Label htmlFor="cat-icon-custom" className="text-xs text-slate-500">Ou digite o nome:</Label>
                      <Input 
                        id="cat-icon-custom" 
                        placeholder="Ex: Coffee" 
                        className="h-8 text-xs"
                        value={categoryForm.icon}
                        onChange={(e) => setCategoryForm({...categoryForm, icon: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cat-image">URL da Imagem (Opcional)</Label>
                    <div className="flex gap-2">
                      <Input id="cat-image" value={categoryForm.image} onChange={(e) => setCategoryForm({...categoryForm, image: e.target.value})} placeholder="https://..." />
                      <div className="relative">
                        <Input 
                          type="file" 
                          accept="image/*" 
                          className="absolute inset-0 opacity-0 cursor-pointer w-full" 
                          onChange={(e) => handleImageUpload(e, (base64) => setCategoryForm({...categoryForm, image: base64}))}
                        />
                        <Button type="button" variant="outline" size="sm">Upload</Button>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Cancelar</Button>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={handleSaveCategory}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Produtos Vinculados</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => {
                    const Icon = cat.icon ? ICON_MAP[cat.icon] : null;
                    return (
                      <TableRow key={cat.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {Icon && <Icon className="h-4 w-4 text-green-600" />}
                            {cat.name}
                          </div>
                        </TableCell>
                        <TableCell>{products.filter(p => p.categoryId === cat.id).length} itens</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => {
                              setEditingCategory(cat);
                              setCategoryForm(cat);
                              setIsCategoryDialogOpen(true);
                            }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteCategory(cat.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
