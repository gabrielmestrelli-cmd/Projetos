/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import CustomerMenu from './components/CustomerMenu';
// O painel só é baixado por quem abre /admin (o cardápio fica mais leve)
const AdminPanel = lazy(() => import('./components/AdminPanel'));
import { Category, Product, Order, MenuData, Testimonial, Promotion, BusinessProfile } from './types';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_TESTIMONIALS, INITIAL_PROMOTIONS, INITIAL_PROFILE } from './constants';
import { Leaf, Settings } from 'lucide-react';
import { supabase } from './lib/supabase';
import { normalizePhone } from './lib/phone';
import { toast } from 'sonner';

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [profile, setProfile] = useState<BusinessProfile>(INITIAL_PROFILE);
  const [orders, setOrders] = useState<Order[]>([]);
  const [userPhone, setUserPhone] = useState<string | null>(localStorage.getItem('user_phone'));

  // Load data from localStorage on mount
  useEffect(() => {
    const savedMenu = localStorage.getItem('menu_data');
    let finalCategories = INITIAL_CATEGORIES;
    let finalProducts = INITIAL_PRODUCTS;
    let finalTestimonials = INITIAL_TESTIMONIALS;
    let finalPromotions = INITIAL_PROMOTIONS;
    let finalProfile = INITIAL_PROFILE;

    if (savedMenu) {
      const parsed = JSON.parse(savedMenu) as MenuData;
      // Sync categories from INITIAL_CATEGORIES to ensure icons and names match the latest version
      finalCategories = INITIAL_CATEGORIES.map(ic => {
        const saved = (parsed.categories || []).find(sc => sc.id === ic.id);
        return saved ? { ...ic, name: saved.name || ic.name } : ic;
      });
      
      // Sync descriptions from INITIAL_PRODUCTS to ensure "500g" and other updates are applied
      // while keeping user-modified fields like price or image if they were changed in admin
      finalProducts = (parsed.products || INITIAL_PRODUCTS).map(p => {
        const initial = INITIAL_PRODUCTS.find(ip => ip.id === p.id);
        if (initial && initial.description.includes('500g') && !p.description.includes('500g')) {
          return { ...p, description: initial.description };
        }
        return p;
      });

      finalTestimonials = parsed.testimonials || INITIAL_TESTIMONIALS;
      finalPromotions = parsed.promotions || INITIAL_PROMOTIONS;
      finalProfile = parsed.profile || INITIAL_PROFILE;
    }

    setCategories(finalCategories);
    setProducts(finalProducts);
    setTestimonials(finalTestimonials);
    setPromotions(finalPromotions);
    setProfile(finalProfile);

    localStorage.setItem('menu_data', JSON.stringify({ 
      categories: finalCategories, 
      products: finalProducts,
      testimonials: finalTestimonials,
      promotions: finalPromotions,
      profile: finalProfile
    }));

    // Pedidos antigos não ficam mais guardados no navegador (privacidade)
    localStorage.removeItem('orders_data');

    // Fetch from Supabase
    const fetchAllData = async () => {
      try {
        // Fetch Categories
        const { data: catData } = await supabase.from('categories').select('*');
        if (catData && catData.length > 0) {
          setCategories(catData.map(c => {
            const initial = INITIAL_CATEGORIES.find(ic => ic.id === c.id);
            return {
              id: c.id,
              name: c.name,
              icon: c.icon || initial?.icon || 'Utensils',
              emoji: c.emoji || initial?.emoji || '',
              image: c.image_url || initial?.image || ''
            };
          }));
        }

        // Fetch Products
        const { data: prodData } = await supabase.from('products').select('*');
        if (prodData && prodData.length > 0) {
          setProducts(prodData.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            price: Number(p.price),
            categoryId: p.category_id,
            image: p.image_url || '',
            available: p.is_active ?? true,
            type: p.type === 'pronta-entrega' ? 'pronta-entrega' : 'encomenda',
            ingredients: Array.isArray(p.ingredients) && p.ingredients.length ? p.ingredients : undefined,
            tags: p.tags || []
          })));
        }

        // Fetch Profile
        const { data: profData } = await supabase.from('store_profile').select('*').single();
        if (profData) {
          setProfile(prev => ({
            ...prev,
            name: profData.name || prev.name,
            description: profData.description || prev.description,
            phone: profData.phone || prev.phone,
            address: profData.address || prev.address,
            instagram: profData.instagram_url || prev.instagram,
            deliveryFee: profData.delivery_fee != null ? Number(profData.delivery_fee) : prev.deliveryFee,
            bio: profData.bio ?? prev.bio,
            isOpen: profData.is_open ?? prev.isOpen,
            stats: profData.stats ? { ...prev.stats, ...profData.stats } : prev.stats,
            profilePicture: profData.profile_picture ?? prev.profilePicture,
          }));
        }

        // Fetch Testimonials
        const { data: testData } = await supabase.from('testimonials').select('*');
        if (testData && testData.length > 0) {
          setTestimonials(testData.map(t => ({
            id: t.id,
            name: t.name,
            comment: t.comment,
            rating: t.rating,
            avatar: t.avatar_url || '',
            createdAt: t.created_at
          })));
        }

        // Fetch Promotions
        const { data: promData } = await supabase.from('promotions').select('*');
        if (promData && promData.length > 0) {
          setPromotions(promData.map(p => ({
            id: p.id,
            title: p.title,
            description: p.description,
            image: p.image_url || '',
            active: p.is_active ?? true,
            createdAt: p.created_at
          })));
        }

      } catch (err) {
        console.error('Supabase fetch error:', err);
      }
    };

    fetchAllData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_profile' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'testimonials' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'promotions' }, () => fetchAllData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ---- Admin: login de verdade pelo Supabase Auth ----
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setIsAdmin(false);
      } else {
        const { data: ok } = await supabase.rpc('is_admin');
        setIsAdmin(ok === true);
      }
      setAuthChecked(true);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setTimeout(check, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const adminLogin = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return 'Senha incorreta';
    const { data: ok } = await supabase.rpc('is_admin');
    if (ok !== true) {
      await supabase.auth.signOut();
      return 'Esta conta não tem permissão de administrador';
    }
    setIsAdmin(true);
    return null;
  };

  const adminLogout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  // ---- Pedidos: admin vê todos; cliente vê só os do próprio telefone ----
  useEffect(() => {
    let cancelled = false;
    const mapOrder = (o: any): Order => ({
      id: o.id,
      orderNumber: o.order_number,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      items: o.items,
      total: Number(o.total_price),
      discount: Number(o.discount) || 0,
      paymentMethod: o.payment_method,
      status: o.status,
      createdAt: o.created_at,
      deliveryType: o.delivery_type || undefined,
      address: o.address || undefined,
      deliveryFee: o.delivery_fee != null ? Number(o.delivery_fee) : undefined,
      notes: o.notes || undefined,
    });

    const fetchOrders = async () => {
      if (isAdmin) {
        const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        if (!cancelled && data && !error) setOrders(data.map(mapOrder));
      } else if (userPhone) {
        const { data, error } = await supabase.rpc('pedidos_do_cliente', { telefone: userPhone });
        if (!cancelled && Array.isArray(data) && !error) setOrders(data.map(mapOrder));
      } else {
        setOrders([]);
      }
    };

    fetchOrders();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    if (isAdmin) {
      channel = supabase
        .channel('orders-admin')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
        .subscribe();
    } else if (userPhone) {
      timer = setInterval(fetchOrders, 30000);
    }

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (timer) clearInterval(timer);
    };
  }, [isAdmin, userPhone]);

  // Save data to localStorage and Supabase when it changes
  const updateMenu = async (newCategories: Category[], newProducts: Product[], newTestimonials?: Testimonial[], newPromotions?: Promotion[], newProfile?: BusinessProfile) => {
    setCategories(newCategories);
    setProducts(newProducts);
    if (newTestimonials) setTestimonials(newTestimonials);
    if (newPromotions) setPromotions(newPromotions);
    if (newProfile) setProfile(newProfile);
    
    localStorage.setItem('menu_data', JSON.stringify({ 
      categories: newCategories, 
      products: newProducts,
      testimonials: newTestimonials || testimonials,
      promotions: newPromotions || promotions,
      profile: newProfile || profile
    }));

    // Salva no Supabase em lote (uma requisição por tabela)
    const results = await Promise.all([
      supabase.from('categories').upsert(newCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        emoji: cat.emoji,
        image_url: cat.image || null,
      }))),
      supabase.from('products').upsert(newProducts.map(prod => ({
        id: prod.id,
        name: prod.name,
        description: prod.description,
        price: prod.price,
        category_id: prod.categoryId,
        image_url: prod.image,
        is_active: prod.available,
        tags: prod.tags || [],
        type: prod.type || 'pronta-entrega',
        ingredients: prod.ingredients || [],
      }))),
      newProfile ? supabase.from('store_profile').upsert({
        id: 1,
        name: newProfile.name,
        description: newProfile.description,
        phone: newProfile.phone,
        address: newProfile.address,
        instagram_url: newProfile.instagram,
        delivery_fee: newProfile.deliveryFee ?? 0,
        bio: newProfile.bio,
        is_open: newProfile.isOpen,
        stats: newProfile.stats,
        profile_picture: newProfile.profilePicture || null,
      }) : null,
      newTestimonials ? supabase.from('testimonials').upsert(newTestimonials.map(t => ({
        id: t.id,
        name: t.name,
        comment: t.comment,
        rating: t.rating,
        avatar_url: t.avatar,
        created_at: t.createdAt,
      }))) : null,
      newPromotions ? supabase.from('promotions').upsert(newPromotions.map(p => ({
        id: p.id,
        title: p.title,
        description: p.description,
        image_url: p.image,
        is_active: p.active,
        created_at: p.createdAt,
      }))) : null,
    ]);

    const failed = results.find(r => r && r.error);
    if (failed?.error) {
      console.error('Supabase sync error:', failed.error);
      toast.error('Não foi possível salvar no banco', {
        description: failed.error.message.includes('row-level security')
          ? 'Sua conta não tem permissão. Entre de novo no painel.'
          : failed.error.message,
      });
      return false;
    }
    return true;
  };

  /** Grava o pedido e devolve o número dele (#1001...). */
  const addOrder = async (order: Order): Promise<string> => {
    const row = {
      id: order.id,
      customer_name: order.customerName,
      customer_phone: normalizePhone(order.customerPhone),
      items: order.items,
      total_price: order.total,
      discount: order.discount,
      payment_method: order.paymentMethod,
      delivery_type: order.deliveryType,
      address: order.address,
      delivery_fee: order.deliveryFee ?? 0,
      notes: order.notes,
    };

    let orderNumber: string | null = null;

    // 1º: função do banco que gera número único
    const { data, error } = await supabase.rpc('criar_pedido', { p: row });
    if (!error && data) {
      orderNumber = String(data);
    } else {
      console.warn('criar_pedido indisponível, usando insert direto:', error?.message);
      // 2º: insert simples (funciona mesmo antes de rodar o SQL novo)
      const fallbackNumber = order.id.slice(0, 6).toUpperCase();
      const { error: insertError } = await supabase.from('orders').insert([{
        id: row.id,
        order_number: fallbackNumber,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        items: row.items,
        total_price: row.total_price,
        discount: row.discount,
        payment_method: row.payment_method,
        status: 'pending',
        created_at: order.createdAt,
      }]);
      if (insertError) console.error('Supabase save error:', insertError);
      orderNumber = fallbackNumber;
    }

    setOrders(prev => [{ ...order, orderNumber }, ...prev]);
    return orderNumber;
  };

  const handleLogin = (phone: string) => {
    const clean = normalizePhone(phone);
    setUserPhone(clean);
    localStorage.setItem('user_phone', clean);
  };

  const handleLogout = () => {
    setUserPhone(null);
    localStorage.removeItem('user_phone');
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));

    // Update Supabase
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (error) {
      console.error('Supabase update error:', error);
      toast.error('Não foi possível mudar o status do pedido', { description: error.message });
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans">
        <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <div className="flex-1 md:flex-none flex justify-center md:justify-start">
              <Link to="/" className="flex items-center gap-2 font-bold text-xl text-green-600">
                <Leaf className="h-6 w-6" />
                <span>lev <span className="text-slate-900">& fit</span></span>
              </Link>
            </div>
            <nav className="flex items-center gap-4 absolute right-4 md:relative md:right-0">
              <Link to="/admin" className="text-slate-400 hover:text-green-600 transition-colors">
                <Settings className="h-5 w-5" />
              </Link>
            </nav>
          </div>
        </header>

        <main className="container mx-auto py-6 px-4">
          <Routes>
            <Route 
              path="/" 
              element={
                <CustomerMenu 
                  categories={categories} 
                  products={products} 
                  testimonials={testimonials}
                  promotions={promotions}
                  profile={profile}
                  orders={orders}
                  userPhone={userPhone}
                  onLogin={handleLogin}
                  onLogout={handleLogout}
                  onPlaceOrder={addOrder} 
                />
              } 
            />
            <Route 
              path="/admin/*" 
              element={
                <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-slate-400">Carregando painel...</div>}>
                <AdminPanel 
                  categories={categories} 
                  products={products} 
                  orders={orders}
                  testimonials={testimonials}
                  promotions={promotions}
                  profile={profile}
                  onUpdateMenu={updateMenu}
                  onUpdateOrderStatus={updateOrderStatus}
                  isAdmin={isAdmin}
                  authChecked={authChecked}
                  onAdminLogin={adminLogin}
                  onAdminLogout={adminLogout}
                />
                </Suspense>
              } 
            />
          </Routes>
        </main>
        <Toaster position="top-center" />
      </div>
    </Router>
  );
}

