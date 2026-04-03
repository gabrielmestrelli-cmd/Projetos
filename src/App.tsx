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

  // Load data from Supabase on mount
  useEffect(() => {
    const fetchSupabaseData = async () => {
      // Fetch categories
      const { data: catData } = await supabase.from('categories').select('*');
      if (catData && catData.length > 0) setCategories(catData);
      else setCategories(INITIAL_CATEGORIES);

      // Fetch products
      const { data: prodData } = await supabase.from('products').select('*');
      if (prodData && prodData.length > 0) setProducts(prodData);
      else setProducts(INITIAL_PRODUCTS);

      // Fetch orders
      const { data: orderData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (orderData) {
         // Convert snake_case from DB back to the Order format App expects
         const formattedOrders: Order[] = orderData.map((o: any) => ({
           id: o.id,
           customerName: o.customer_name,
           customerPhone: o.customer_phone,
           items: o.items,
           total: o.total_price,
           discount: 0,
           paymentMethod: 'pix',
           status: o.status,
           createdAt: o.created_at
         }));
         setOrders(formattedOrders);
      }

      // Fetch profile
      const { data: profileData } = await supabase.from('store_profile').select('*').eq('id', 1).single();
      if (profileData) {
        setProfile({
          name: profileData.name || INITIAL_PROFILE.name,
          instagram: profileData.instagram_url || INITIAL_PROFILE.instagram,
          phone: profileData.phone || INITIAL_PROFILE.phone,
          bio: profileData.description || INITIAL_PROFILE.bio,
          stats: INITIAL_PROFILE.stats, // Stats are static for now or can be added to DB later
          isOpen: true
        });
      } else {
        setProfile(INITIAL_PROFILE);
      }
    };

    fetchSupabaseData();
  }, []);

  const updateMenu = async (newCategories: Category[], newProducts: Product[], newTestimonials?: Testimonial[], newPromotions?: Promotion[], newProfile?: BusinessProfile) => {
    // Optimistic UI update
    setCategories(newCategories);
    setProducts(newProducts);
    if (newTestimonials) setTestimonials(newTestimonials);
    if (newPromotions) setPromotions(newPromotions);
    if (newProfile) setProfile(newProfile);
    
    // Persist to Supabase
    if (newCategories.length > 0) {
      await supabase.from('categories').upsert(newCategories);
    }
    if (newProducts.length > 0) {
      await supabase.from('products').upsert(newProducts);
    }
    if (newProfile) {
      await supabase.from('store_profile').upsert({
        id: 1,
        name: newProfile.name,
        instagram_url: newProfile.instagram,
        phone: newProfile.phone,
        description: newProfile.bio
      });
    }
  };

  const addOrder = async (order: Order) => {
    // Optimistic UI update
    const newOrders = [order, ...orders];
    setOrders(newOrders);
    
    // Persist to Supabase
    await supabase.from('orders').insert([{
      id: order.id,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      customer_address: '',
      items: order.items,
      total_price: order.total,
      status: order.status
    }]);
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    // Optimistic UI update
    const newOrders = orders.map(o => o.id === orderId ? { ...o, status } : o);
    setOrders(newOrders);
    
    // Persist to Supabase
    await supabase.from('orders').update({ status }).eq('id', orderId);
  };

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans">
        <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl text-green-600">
              <Leaf className="h-6 w-6" />
              <span>Lev <span className="text-slate-900">& Fit</span></span>
            </Link>
            <nav className="flex items-center gap-4">
              {/* Visible settings icon for admin access */}
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

