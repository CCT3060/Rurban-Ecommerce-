// ─── Backend API base URL ────────────────────────────────────────────────────
export const API_BASE = 'http://13.200.222.72';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Banner {
  id: string;
  title?: string;
  subtitle?: string;
  image_url: string;
  cta_text?: string;
  cta_link?: string;
  section: string;
}

export interface ProductImage {
  id: string;
  image_url: string;
  is_primary: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  short_description?: string | null;
  price: number;
  sale_price?: number | null;
  sku?: string | null;
  stock: number;
  brand?: string | null;
  tags?: string[];
  is_featured: boolean;
  is_trending: boolean;
  is_new_arrival: boolean;
  avg_rating?: number;
  review_count?: number;
  images: ProductImage[];
  category?: { name: string; slug: string } | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
  parent_id?: string | null;
  product_count: number;
}

export interface OrderItem {
  id: string;
  product_id: string | null;
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
  variant_info: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_status: string;
  payment_method: string | null;
  subtotal: number;
  discount: number;
  shipping_cost: number;
  total: number;
  shipping_address: Record<string, string> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
}

export interface PendingReview {
  order_id: string;
  product_id: string;
  product_name: string;
  image_url: string | null;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string;
  role: string;
  created_at: string;
  order_count: number;
  wishlist_count: number;
  total_saved: number;
}

export interface CheckoutPayload {
  items: { productId: string; quantity: number }[];
  shippingAddress: {
    firstName: string; lastName: string; phone: string;
    street: string; city: string; state: string; zip: string;
  };
  paymentMethod: string;
  notes?: string;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────
async function apiFetch<T>(path: string): Promise<T[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[API] ${path} responded with status ${res.status}`);
      return [];
    }
    const json = await res.json();
    return json.data ?? [];
  } catch (err) {
    console.warn(`[API] Failed to fetch ${path}:`, err);
    return [];
  }
}

async function authFetch<T>(
  path: string,
  token: string,
  method: string = 'GET',
  body?: object
): Promise<{ data?: T; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    clearTimeout(timer);
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? 'Request failed' };
    return { data: json.data ?? json };
  } catch (err) {
    return { error: 'Network error. Please try again.' };
  }
}

export const fetchBanners = (sections = 'hero,offers,flash_sale') =>
  apiFetch<Banner>(`/api/banners?sections=${sections}`);

export const fetchProducts = () =>
  apiFetch<Product>('/api/products');

export const fetchCategories = () =>
  apiFetch<Category>('/api/categories');

// ─── Authenticated API ────────────────────────────────────────────────────────
export const fetchProfile = (token: string) =>
  authFetch<UserProfile>('/api/mobile/profile', token);

export const updateProfile = (token: string, data: { full_name?: string; phone?: string }) =>
  authFetch<UserProfile>('/api/mobile/profile', token, 'PUT', data);

export const fetchOrders = (token: string): Promise<{ data?: { orders: Order[]; pending_reviews: PendingReview[] }; error?: string }> =>
  fetch(`${API_BASE}/api/mobile/orders`, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  }).then(async res => {
    const json = await res.json();
    if (!res.ok) return { error: json.error ?? 'Failed to fetch orders' };
    return { data: { orders: json.data ?? [], pending_reviews: json.pending_reviews ?? [] } };
  }).catch(() => ({ error: 'Network error' }));

export const placeOrder = (token: string, payload: CheckoutPayload) =>
  authFetch<{ id: string; order_number: string; total: number; status: string }>(
    '/api/mobile/checkout', token, 'POST', payload
  );

export const submitReview = (
  token: string,
  data: { product_id: string; rating: number; title?: string; comment?: string }
) => authFetch<{ id: string; rating: number }>('/api/mobile/reviews', token, 'POST', data);
