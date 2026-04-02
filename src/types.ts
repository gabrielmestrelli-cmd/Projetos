export interface Category {
  id: string;
  name: string;
  icon?: string;
  image?: string;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  available: boolean;
  type: 'pronta-entrega' | 'encomenda';
  ingredients?: string[];
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export type OrderStatus = 'pending' | 'preparing' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  tableNumber?: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  total: number;
  discount: number;
  paymentMethod: 'pix' | 'cartao-link' | 'dinheiro';
  status: OrderStatus;
  createdAt: string;
}

export interface Testimonial {
  id: string;
  name: string;
  rating: number;
  comment: string;
  avatar: string;
  createdAt: string;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  image: string;
  active: boolean;
  createdAt: string;
}

export interface BusinessProfile {
  name: string;
  instagram: string;
  phone: string;
  bio: string;
  stats: {
    posts: number;
    followers: string;
    following: number;
  };
  profilePicture?: string;
  isOpen: boolean;
}

export interface MenuData {
  categories: Category[];
  products: Product[];
  testimonials: Testimonial[];
  promotions: Promotion[];
  profile: BusinessProfile;
}
