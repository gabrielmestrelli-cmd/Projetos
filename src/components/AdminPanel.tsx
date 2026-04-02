import React, { useState, useMemo, useEffect } from 'react';
import { Category, Product, Order, OrderStatus, Testimonial, Promotion, BusinessProfile } from '../types';
import { ICON_MAP, INITIAL_TESTIMONIALS, INITIAL_PROMOTIONS, INITIAL_PROFILE } from '../constants';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, QrCode, CheckCircle2, Clock, XCircle, CookingPot, ChevronRight, Package, LayoutGrid, ClipboardList, User, Phone, CreditCard, Banknote, Landmark, Star, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

interface AdminPanelProps {
  categories: Category[];
  products: Product[];
  orders: Order[];
  testimonials: Testimonial[];
  promotions: Promotion[];
  profile: BusinessProfile;
  onUpdateMenu: (categories: Category[], products: Product[], testimonials?: Testimonial[], promotions?: Promotion[], profile?: BusinessProfile) => void;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
}

export default function AdminPanel({ 
  categories, 
  products, 
  orders, 
  testimonials,
  promotions,
  profile,
  onUpdateMenu, 
  onUpdateOrderStatus 
}: AdminPanelProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('orders');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isTestimonialDialogOpen, setIsTestimonialDialogOpen] = useState(false);
  const [isPromotionDialogOpen, setIsPromotionDialogOpen] = useState(false);
  const [qrTableNumber, setQrTableNumber] = useState('1');
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        callback(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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

  const handleAutoGenerateImages = async () => {
    console.log('Iniciando handleAutoGenerateImages...');
    
    const productsToUpdate = products.filter(p => 
      !p.image || 
      p.image.includes('unsplash.com') || 
      p.image === '' ||
      p.image.includes('picsum.photos')
    );

    console.log('Produtos para atualizar:', productsToUpdate.length);

    if (productsToUpdate.length === 0) {
      toast.info('Todos os produtos já possuem imagens personalizadas.');
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY não encontrada no ambiente.');
      toast.error('Erro de configuração: Chave da IA não encontrada.');
      return;
    }

    setIsGeneratingImages(true);
    const ai = new GoogleGenAI({ apiKey });
    let updatedProducts = [...products];
    let successCount = 0;

    toast.loading('Iniciando geração de imagens com IA...', { id: 'ai-gen' });

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < productsToUpdate.length; i++) {
      const product = productsToUpdate[i];
      const prompt = `Professional food photography of a healthy meal prep container with a 500g portion of ${product.name}. ${product.description}. Bright, natural lighting, top-down view, clean background, high resolution.`;
      
      let retries = 0;
      const maxRetries = 3;
      let success = false;

      while (retries < maxRetries && !success) {
        try {
          console.log(`Gerando imagem para: ${product.name} (Tentativa ${retries + 1})`);
          toast.loading(`Gerando imagem ${i + 1}/${productsToUpdate.length}: ${product.name}`, { id: 'ai-gen' });
          
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
              parts: [{ text: prompt }],
            },
            config: {
              imageConfig: {
                aspectRatio: "1:1"
              }
            }
          });

          const imagePart = response.candidates[0].content.parts.find(p => p.inlineData);
          if (imagePart?.inlineData) {
            const base64 = `data:image/png;base64,${imagePart.inlineData.data}`;
            updatedProducts = updatedProducts.map(p => p.id === product.id ? { ...p, image: base64 } : p);
            successCount++;
            success = true;
            console.log(`Imagem gerada com sucesso para: ${product.name}`);
            
            // Delay maior entre sucessos para evitar estourar o limite de RPM (Requests Per Minute)
            await delay(5000);
          } else {
            console.warn(`Nenhuma imagem retornada para: ${product.name}`);
            success = true; // Não adianta tentar de novo se não veio nada
          }
        } catch (error: any) {
          console.error(`Erro ao gerar imagem para ${product.name}:`, error);
          
          const isQuotaError = error.status === 429 || 
                              (error.message && (error.message.includes('quota') || error.message.includes('RESOURCE_EXHAUSTED')));
          
          if (isQuotaError) {
            retries++;
            if (retries < maxRetries) {
              console.log(`Limite de cota atingido. Tentativa ${retries}/${maxRetries}. Aguardando 30s...`);
              toast.loading(`Limite atingido. Aguardando 30s para tentar ${product.name} novamente...`, { id: 'ai-gen' });
              await delay(30000); // Espera 30 segundos se bater no limite
            } else {
              toast.error(`Cota de IA esgotada. Não foi possível gerar imagem para ${product.name}.`, { id: 'ai-gen' });
              console.error('Limite de cota persistente. Interrompendo geração em massa.');
              // Se falhou 3 vezes por cota, provavelmente a cota diária acabou
              break; 
            }
          } else {
            toast.error(`Erro ao gerar imagem para ${product.name}`);
            break; // Outro tipo de erro, para de tentar este produto
          }
        }
      }
    }

    onUpdateMenu(categories, updatedProducts);
    setIsGeneratingImages(false);
    toast.dismiss('ai-gen');
    toast.success(`${successCount} imagens geradas com sucesso!`);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple password check - you can change this!
    if (password === 'admin123') {
      setIsLoggedIn(true);
      toast.success('Bem-vindo, Admin!');
    } else {
      toast.error('Senha incorreta');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md border-none shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-green-600 text-white p-8 text-center">
            <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CookingPot className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl font-bold">Painel de Controle</CardTitle>
            <CardDescription className="text-white/80">Acesso restrito para administração</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Senha de Acesso</Label>
                <Input 
                  id="password"
                  type="password" 
                  placeholder="Digite sua senha..." 
                  className="h-12 rounded-xl"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full h-12 bg-green-600 hover:bg-green-700 rounded-xl font-bold text-lg">
                Entrar no Painel
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-slate-50 p-4 text-center">
            <p className="text-xs text-slate-400 w-full">Dica: A senha padrão é <span className="font-bold">admin123</span></p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const handleSaveProduct = () => {
    if (!productForm.name || !productForm.categoryId || !productForm.price) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    let newProducts: Product[];
    if (editingProduct) {
      newProducts = products.map(p => p.id === editingProduct.id ? { ...editingProduct, ...productForm } as Product : p);
      toast.success('Produto atualizado');
    } else {
      const newProduct: Product = {
        id: Math.random().toString(36).substr(2, 9),
        ...productForm as Product,
      };
      newProducts = [...products, newProduct];
      toast.success('Produto adicionado');
    }

    onUpdateMenu(categories, newProducts);
    setIsProductDialogOpen(false);
    setEditingProduct(null);
    setProductForm({ name: '', description: '', price: 15, categoryId: '', available: true, image: '', type: 'pronta-entrega' });
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
        id: Math.random().toString(36).substr(2, 9),
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

  const handleDeleteProduct = (id: string) => {
    const newProducts = products.filter(p => p.id !== id);
    onUpdateMenu(categories, newProducts);
    toast.success('Produto removido');
  };

  const handleDeleteCategory = (id: string) => {
    if (products.some(p => p.categoryId === id)) {
      toast.error('Não é possível excluir uma categoria com produtos vinculados');
      return;
    }
    const newCategories = categories.filter(c => c.id !== id);
    onUpdateMenu(newCategories, products);
    toast.success('Categoria removida');
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
        id: Math.random().toString(36).substr(2, 9), 
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

  const handleSavePromotion = () => {
    if (!promotionForm.title || !promotionForm.description) {
      toast.error('Preencha o título e a descrição da promoção');
      return;
    }
    
    let newPromotions: Promotion[];
    if (editingPromotion) {
      newPromotions = promotions.map(p => p.id === editingPromotion.id ? { ...editingPromotion, ...promotionForm } as Promotion : p);
      toast.success('Promoção atualizada');
    } else {
      const newP: Promotion = { 
        id: Math.random().toString(36).substr(2, 9), 
        active: true,
        createdAt: new Date().toISOString(),
        ...promotionForm as Promotion 
      };
      newPromotions = [...promotions, newP];
      toast.success('Promoção adicionada');
    }
    
    onUpdateMenu(categories, products, testimonials, newPromotions);
    setIsPromotionDialogOpen(false);
    setEditingPromotion(null);
    setPromotionForm({ title: '', description: '', image: '' });
  };

  const handleSaveProfile = () => {
    onUpdateMenu(categories, products, testimonials, promotions, profileForm);
    toast.success('Perfil atualizado com sucesso!');
  };

  const handleDeleteTestimonial = (id: string) => {
    const newTestimonials = testimonials.filter(t => t.id !== id);
    onUpdateMenu(categories, products, newTestimonials, promotions);
    toast.success('Depoimento removido');
  };

  const handleDeletePromotion = (id: string) => {
    const newPromotions = promotions.filter(p => p.id !== id);
    onUpdateMenu(categories, products, testimonials, newPromotions);
    toast.success('Promoção removida');
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
      </div>

      <Tabs defaultValue="orders" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7 lg:w-[900px]">
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Pedidos</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Produtos</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Marmitas</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="promotions" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Promoções</span>
          </TabsTrigger>
          <TabsTrigger value="testimonials" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Feedback</span>
          </TabsTrigger>
          <TabsTrigger value="qrcode" className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            <span className="hidden sm:inline">QR Code</span>
          </TabsTrigger>
        </TabsList>

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
                      <div className="flex items-baseline font-black text-2xl tracking-tighter select-none">
                        <span className="text-green-600">L</span>
                        <span className="text-slate-900 text-lg mx-0.5">&</span>
                        <span className="text-slate-900">F</span>
                      </div>
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
            <CardHeader>
              <CardTitle>Pedidos Recentes</CardTitle>
              <CardDescription>Acompanhe e gerencie o status dos pedidos em tempo real.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Cliente</TableHead>
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
                        <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                          Nenhum pedido recebido ainda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              {order.createdAt ? (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {new Date(order.createdAt).toLocaleDateString('pt-BR')} {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-mono italic">Data não disponível</span>
                              )}
                              <span className="font-bold flex items-center gap-1">
                                <User className="h-3 w-3" /> {order.customerName}
                              </span>
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {order.customerPhone}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1">
                              {order.items.map((item, idx) => (
                                <div key={idx}>{item.quantity}x {item.name}</div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                              {order.discount > 0 && (
                                <span className="text-[10px] text-green-600">Desc: -{order.discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs">
                              {order.paymentMethod === 'pix' && <Landmark className="h-3 w-3" />}
                              {order.paymentMethod === 'cartao-link' && <CreditCard className="h-3 w-3" />}
                              {order.paymentMethod === 'dinheiro' && <Banknote className="h-3 w-3" />}
                              <span className="capitalize">{order.paymentMethod.replace('-', ' ')}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="text-right">
                            <Select 
                              value={order.status || 'pending'} 
                              onValueChange={(val) => onUpdateOrderStatus(order.id, val as OrderStatus)}
                            >
                              <SelectTrigger className="w-[130px] ml-auto">
                                <SelectValue />
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
        <TabsContent value="products" className="mt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h3 className="text-lg font-semibold">Gerenciar Produtos</h3>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                variant="outline" 
                className="flex-1 sm:flex-none border-green-200 text-green-700 hover:bg-green-50"
                onClick={handleAutoGenerateImages}
                disabled={isGeneratingImages}
              >
                {isGeneratingImages ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Gerar com IA
              </Button>
              <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
              <DialogTrigger render={
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => {
                  setEditingProduct(null);
                  setProductForm({ name: '', description: '', price: 15, categoryId: '', available: true, image: '', type: 'pronta-entrega' });
                }}>
                  <Plus className="mr-2 h-4 w-4" /> Novo Produto
                </Button>
              } />
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{editingProduct ? 'Editar Produto' : 'Adicionar Produto'}</DialogTitle>
                  <DialogDescription>Preencha as informações do produto para o cardápio.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nome do Produto</Label>
                    <Input id="name" value={productForm.name} onChange={(e) => setProductForm({...productForm, name: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="price">Preço (R$)</Label>
                      <Input id="price" type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({...productForm, price: parseFloat(e.target.value)})} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="type">Tipo de Entrega</Label>
                      <Select value={productForm.type || 'pronta-entrega'} onValueChange={(val) => setProductForm({...productForm, type: val as any})}>
                        <SelectTrigger id="type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pronta-entrega">Pronta Entrega</SelectItem>
                          <SelectItem value="encomenda">Por Encomenda</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select value={productForm.categoryId || ''} onValueChange={(val) => setProductForm({...productForm, categoryId: val})}>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="desc">Descrição</Label>
                    <Textarea id="desc" value={productForm.description} onChange={(e) => setProductForm({...productForm, description: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="image">URL da Imagem (Opcional)</Label>
                    <div className="flex gap-2">
                      <Input id="image" value={productForm.image} onChange={(e) => setProductForm({...productForm, image: e.target.value})} placeholder="https://..." />
                      <div className="relative">
                        <Input 
                          type="file" 
                          accept="image/*" 
                          className="absolute inset-0 opacity-0 cursor-pointer w-full" 
                          onChange={(e) => handleImageUpload(e, (base64) => setProductForm({...productForm, image: base64}))}
                        />
                        <Button type="button" variant="outline" size="sm">Upload</Button>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>Cancelar</Button>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={handleSaveProduct}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded bg-slate-100">
                            <img src={product.image} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{categories.find(c => c.id === product.categoryId)?.name}</TableCell>
                      <TableCell>{product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                      <TableCell>
                        {product.available ? <Badge className="bg-green-100 text-green-700 border-green-200">Disponível</Badge> : <Badge variant="destructive">Indisponível</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditingProduct(product);
                            setProductForm(product);
                            setIsProductDialogOpen(true);
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteProduct(product.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Promotions Tab */}
        <TabsContent value="promotions" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Gerenciar Promoções</h3>
            <Dialog open={isPromotionDialogOpen} onOpenChange={setIsPromotionDialogOpen}>
              <DialogTrigger render={
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => {
                  setEditingPromotion(null);
                  setPromotionForm({ title: '', description: '', image: '' });
                }}>
                  <Plus className="mr-2 h-4 w-4" /> Nova Promoção
                </Button>
              } />
              <DialogContent>
                <DialogHeader><DialogTitle>Promoção</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="promo-title">Título</Label>
                    <Input id="promo-title" value={promotionForm.title} onChange={(e) => setPromotionForm({...promotionForm, title: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="promo-desc">Descrição</Label>
                    <Textarea id="promo-desc" value={promotionForm.description} onChange={(e) => setPromotionForm({...promotionForm, description: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="promo-img">URL da Imagem</Label>
                    <div className="flex gap-2">
                      <Input id="promo-img" value={promotionForm.image} onChange={(e) => setPromotionForm({...promotionForm, image: e.target.value})} />
                      <div className="relative">
                        <Input 
                          type="file" 
                          accept="image/*" 
                          className="absolute inset-0 opacity-0 cursor-pointer w-full" 
                          onChange={(e) => handleImageUpload(e, (base64) => setPromotionForm({...promotionForm, image: base64}))}
                        />
                        <Button type="button" variant="outline" size="sm">Upload</Button>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPromotionDialogOpen(false)}>Cancelar</Button>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={handleSavePromotion}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {promotions.map(p => (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle className="text-sm">{p.title}</CardTitle>
                  <CardDescription className="text-xs">{p.description}</CardDescription>
                </CardHeader>
                <CardFooter className="justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingPromotion(p); setPromotionForm(p); setIsPromotionDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeletePromotion(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </CardFooter>
              </Card>
            ))}
          </div>
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

        {/* QR Code Tab */}
        <TabsContent value="qrcode" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Gerador de QR Code</CardTitle>
              <CardDescription>Gere QR codes para as mesas do seu estabelecimento.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-8 py-10">
              <div className="flex items-center gap-4 w-full max-w-xs">
                <Label htmlFor="table-num">Número da Mesa:</Label>
                <Input 
                  id="table-num" 
                  type="number" 
                  value={qrTableNumber} 
                  onChange={(e) => setQrTableNumber(e.target.value)} 
                />
              </div>
              
              <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-2xl shadow-xl border border-slate-100">
                <div className="bg-green-600 text-white px-4 py-1 rounded-full text-sm font-bold mb-2">
                  LOJA ONLINE
                </div>
                <QRCodeSVG 
                  value={`${window.location.origin}`} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
                <p className="text-xs text-slate-400 mt-2">Escaneie para ver o cardápio</p>
              </div>

              <div className="max-w-md text-center space-y-4">
                <p className="text-sm text-slate-500">
                  Imprima este QR Code e coloque na mesa {qrTableNumber}. 
                  Quando o cliente escanear, o cardápio abrirá automaticamente.
                </p>
                <Button variant="outline" onClick={() => window.print()}>
                  Imprimir QR Code
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
