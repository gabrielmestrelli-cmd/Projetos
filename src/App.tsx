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

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [profile, setProfile] = useState<BusinessProfile>(INITIAL_PROFILE);
  const [orders, setOrders] = useState<Order[]>([]);

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
      finalCategories = parsed.categories || INITIAL_CATEGORIES;
      
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
  }, []);

  // Save data to localStorage when it changes
  const updateMenu = (newCategories: Category[], newProducts: Product[], newTestimonials?: Testimonial[], newPromotions?: Promotion[], newProfile?: BusinessProfile) => {
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
  };

  const addOrder = (order: Order) => {
    const newOrders = [order, ...orders];
    setOrders(newOrders);
    localStorage.setItem('orders_data', JSON.stringify(newOrders));
  };

  const updateOrderStatus = (orderId: string, status: Order['status']) => {
    const newOrders = orders.map(o => o.id === orderId ? { ...o, status } : o);
    setOrders(newOrders);
    localStorage.setItem('orders_data', JSON.stringify(newOrders));
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

