/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HashRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import CustomerMenu from './components/CustomerMenu';
import AdminPanel from './components/AdminPanel';
import { Category, Product, Order, MenuData, Testimonial, Promotion, BusinessProfile } from './types';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS, INITIAL_TESTIMONIALS, INITIAL_PROMOTIONS, INITIAL_PROFILE } from './constants';
import { Leaf, Settings } from 'lucide-react';
import { supabase } from './lib/supabase';

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

    const savedOrders = localStorage.getItem('orders_data');
    if (savedOrders) {
      setOrders(JSON.parse(savedOrders));
    }

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
            type: 'pronta-entrega',
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
            deliveryFee: Number(profData.delivery_fee) || prev.deliveryFee
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

        // Fetch Orders
        const { data: ordData, error: ordError } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (ordData && !ordError) {
          const formattedOrders: Order[] = ordData.map(o => ({
            id: o.id,
            customerName: o.customer_name,
            customerPhone: o.customer_phone,
            items: o.items,
            total: o.total_price,
            discount: o.discount,
            paymentMethod: o.payment_method,
            status: o.status,
            createdAt: o.created_at,
          }));
          setOrders(formattedOrders);
          localStorage.setItem('orders_data', JSON.stringify(formattedOrders));
        }
      } catch (err) {
        console.error('Supabase fetch error:', err);
      }
    };

    fetchAllData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchAllData())
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

    // Sync with Supabase
    try {
      // Sync Categories
      for (const cat of newCategories) {
        await supabase.from('categories').upsert({
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          emoji: cat.emoji
        });
      }

      // Sync Products
      for (const prod of newProducts) {
        await supabase.from('products').upsert({
          id: prod.id,
          name: prod.name,
          description: prod.description,
          price: prod.price,
          category_id: prod.categoryId,
          image_url: prod.image,
          is_active: prod.available,
          tags: prod.tags
        });
      }

      // Sync Profile
      if (newProfile) {
        await supabase.from('store_profile').upsert({
          id: 1, // Assuming single profile
          name: newProfile.name,
          description: newProfile.description,
          phone: newProfile.phone,
          address: newProfile.address,
          instagram_url: newProfile.instagram,
          delivery_fee: newProfile.deliveryFee
        });
      }

      // Sync Testimonials
      if (newTestimonials) {
        for (const t of newTestimonials) {
          await supabase.from('testimonials').upsert({
            id: t.id,
            name: t.name,
            comment: t.comment,
            rating: t.rating,
            avatar_url: t.avatar,
            created_at: t.createdAt
          });
        }
      }

      // Sync Promotions
      if (newPromotions) {
        for (const p of newPromotions) {
          await supabase.from('promotions').upsert({
            id: p.id,
            title: p.title,
            description: p.description,
            image_url: p.image,
            is_active: p.active,
            created_at: p.createdAt
          });
        }
      }
    } catch (err) {
      console.error('Supabase sync error:', err);
    }
  };

  const addOrder = async (order: Order) => {
    // Generate a simple 4-digit order number
    const lastOrderNumber = localStorage.getItem('last_order_number') || '1000';
    const nextOrderNumber = (parseInt(lastOrderNumber) + 1).toString();
    localStorage.setItem('last_order_number', nextOrderNumber);
    
    const orderWithNumber = { ...order, orderNumber: nextOrderNumber };
    const newOrders = [orderWithNumber, ...orders];
    setOrders(newOrders);
    localStorage.setItem('orders_data', JSON.stringify(newOrders));

    // Save to Supabase (Background)
    try {
      await supabase
        .from('orders')
        .insert([
          {
            id: orderWithNumber.id,
            order_number: orderWithNumber.orderNumber,
            customer_name: orderWithNumber.customerName,
            customer_phone: orderWithNumber.customerPhone,
            items: orderWithNumber.items,
            total_price: orderWithNumber.total,
            discount: orderWithNumber.discount,
            payment_method: orderWithNumber.paymentMethod,
            status: orderWithNumber.status,
            created_at: orderWithNumber.createdAt,
          }
        ]);
    } catch (err) {
      console.error('Supabase save error:', err);
    }
  };

  const handleLogin = (phone: string) => {
    setUserPhone(phone);
    localStorage.setItem('user_phone', phone);
  };

  const handleLogout = () => {
    setUserPhone(null);
    localStorage.removeItem('user_phone');
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    const newOrders = orders.map(o => o.id === orderId ? { ...o, status } : o);
    setOrders(newOrders);
    localStorage.setItem('orders_data', JSON.stringify(newOrders));

    // Update Supabase
    try {
      await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);
    } catch (err) {
      console.error('Supabase update error:', err);
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
                <AdminPanel 
                  categories={categories} 
                  products={products} 
                  orders={orders}
                  testimonials={testimonials}
                  promotions={promotions}
                  profile={profile}
                  onUpdateMenu={updateMenu}
                  onUpdateOrderStatus={updateOrderStatus}
                />
              } 
            />
          </Routes>
        </main>
        <Toaster position="top-center" />
      </div>
    </Router>
  );
}

