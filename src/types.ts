export interface Category {
  id: string;
  name: string;
  icon?: string;
  image?: string;
  emoji?: string;
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
  tags?: string[];
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
  orderNumber?: string;
  tableNumber?: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  total: number;
  discount: number;
  paymentMethod: 'pix' | 'cartao-link' | 'dinheiro';
  status: OrderStatus;
  createdAt: string;
  deliveryType?: 'entrega' | 'retirada';
  address?: string;
  deliveryFee?: number;
  /** Distância calculada até o cliente, em km */
  deliveryKm?: number;
  notes?: string;
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
  /** Lançamento: aparece em destaque no topo e como primeiro story */
  isLaunch?: boolean;
  /** Texto do botão do story (ex.: "Quero provar") */
  ctaLabel?: string;
  createdAt: string;
}

export interface DeliverySettings {
  /** 'fixed' = taxa fixa; 'per_km' = calculada pela distância */
  mode: 'fixed' | 'per_km';
  /** Taxa fixa, ou valor de saída no modo por km */
  baseFee: number;
  /** R$ por km rodado além dos km inclusos */
  perKm: number;
  /** Km já inclusos na taxa de saída */
  includedKm: number;
  /** Distância máxima atendida (0 = sem limite) */
  maxKm: number;
  /** Entrega grátis a partir deste valor de pedido (0 = nunca) */
  freeAbove: number;
  /** Ponto de saída das entregas */
  originLabel?: string;
  originLat?: number;
  originLng?: number;
}

export interface BusinessProfile {
  name: string;
  instagram: string;
  phone: string;
  bio: string;
  description?: string;
  address?: string;
  deliveryFee?: number;
  delivery?: DeliverySettings;
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
