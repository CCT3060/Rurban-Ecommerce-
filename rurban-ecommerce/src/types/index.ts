// ────────────── Database Types ──────────────

export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: "user" | "admin" | "warehouse_admin";
  warehouse_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  location: string | null;
  manager_name: string | null;
  manager_email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  banner_url: string | null;
  parent_id: string | null;
  warehouse_id?: string | null;
  status: "active" | "inactive";
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Relations
  parent?: Category | null;
  subcategories?: Category[];
  product_count?: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  sale_price: number | null;
  sku: string | null;
  stock: number;
  brand: string | null;
  tags: string[];
  category_id: string;
  warehouse_id?: string | null;
  status: "active" | "inactive" | "draft";
  is_featured: boolean;
  is_trending: boolean;
  is_new_arrival: boolean;
  avg_rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
  // Relations
  category?: Category;
  images?: ProductImage[];
  variants?: ProductVariant[];
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  type: string; // e.g., "size", "color"
  value: string; // e.g., "XL", "Red"
  price_modifier: number;
  stock: number;
  sku: string | null;
  created_at: string;
}

export interface Banner {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string;
  cta_text: string | null;
  cta_link: string | null;
  section: string;
  sort_order: number;
  status: "active" | "inactive";
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: string;
  title: string;
  description: string | null;
  type: "percentage" | "fixed" | "bogo" | "category_discount" | "product_discount";
  value: number;
  image_url: string | null;
  apply_to: "all" | "category" | "product";
  target_id: string | null;
  start_date: string;
  end_date: string;
  status: "active" | "inactive";
  is_highlighted: boolean;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_value: number;
  max_uses: number | null;
  used_count: number;
  expiry_date: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  created_at: string;
  // Relations
  product?: Product;
  variant?: ProductVariant;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  // Relations
  product?: Product;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  subtotal: number;
  discount: number;
  tax: number;
  shipping_cost: number;
  total: number;
  status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
  payment_status: "pending" | "paid" | "failed" | "refunded";
  payment_method: string | null;
  coupon_id: string | null;
  shipping_address: Address | null;
  billing_address: Address | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  items?: OrderItem[];
  user?: Profile;
  coupon?: Coupon;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  price: number;
  quantity: number;
  image_url: string | null;
  variant_info: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  product_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
  // Relations
  user?: Profile;
  product?: Product;
}

export interface HomepageSection {
  id: string;
  title: string | null;
  subtitle: string | null;
  type: string;
  sort_order: number;
  status: "active" | "inactive";
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Testimonial {
  id: string;
  name: string;
  avatar_url: string | null;
  comment: string;
  rating: number;
  designation: string | null;
  status: "active" | "inactive";
  sort_order: number;
  created_at: string;
}

export interface SiteSetting {
  id: string;
  key: string;
  value: string;
  type: "text" | "image" | "json" | "number" | "boolean";
  group: string;
  created_at: string;
  updated_at: string;
}

export interface ContentPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

export interface Newsletter {
  id: string;
  email: string;
  status: "active" | "unsubscribed";
  created_at: string;
}

// ────────────── Utility Types ──────────────

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  totalPages: number;
}

export interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  totalUsers: number;
  totalProducts: number;
  recentOrders: Order[];
  topProducts: (Product & { total_sold: number })[];
  lowStockProducts: Product[];
  revenueData: { month: string; revenue: number }[];
}
