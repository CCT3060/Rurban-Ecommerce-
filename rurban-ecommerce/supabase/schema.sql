-- ============================================================
-- RURBAN ECOMMERCE — Complete Database Schema for Supabase
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ────────────── 1. PROFILES ──────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text not null,
  phone text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin', 'warehouse_admin')),
  warehouse_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ────────────── 1B. WAREHOUSES ──────────────
create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  location text,
  manager_name text,
  manager_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_warehouse_fk
  foreign key (warehouse_id) references public.warehouses(id) on delete set null;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'user')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ────────────── 2. CATEGORIES ──────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  banner_url text,
  parent_id uuid references public.categories(id) on delete set null,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_categories_slug on public.categories(slug);
create index idx_categories_parent on public.categories(parent_id);

-- ────────────── 3. PRODUCTS ──────────────
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  short_description text,
  price numeric(10,2) not null default 0,
  sale_price numeric(10,2),
  sku text,
  stock int not null default 0,
  brand text,
  tags text[] default '{}',
  category_id uuid references public.categories(id) on delete set null,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive', 'draft')),
  is_featured boolean not null default false,
  is_trending boolean not null default false,
  is_new_arrival boolean not null default false,
  avg_rating numeric(3,2) not null default 0,
  review_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_products_slug on public.products(slug);
create index idx_products_category on public.products(category_id);
create index idx_products_warehouse on public.products(warehouse_id);
create index idx_products_status on public.products(status);
create index idx_products_featured on public.products(is_featured) where is_featured = true;
create index idx_products_trending on public.products(is_trending) where is_trending = true;

-- ────────────── 4. PRODUCT IMAGES ──────────────
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_product_images_product on public.product_images(product_id);

-- ────────────── 5. PRODUCT VARIANTS ──────────────
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  type text not null, -- 'size', 'color', etc.
  value text not null, -- 'XL', 'Red', etc.
  price_modifier numeric(10,2) not null default 0,
  stock int not null default 0,
  sku text,
  created_at timestamptz not null default now()
);

create index idx_product_variants_product on public.product_variants(product_id);

-- ────────────── 6. BANNERS ──────────────
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_url text not null,
  cta_text text,
  cta_link text,
  section text not null default 'hero' check (section in ('hero', 'category', 'sidebar', 'offers', 'flash_sale', 'seasonal')),
  sort_order int not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_banners_section on public.banners(section);

-- ────────────── 7. OFFERS ──────────────
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  type text not null check (type in ('percentage', 'fixed', 'bogo', 'category_discount', 'product_discount')),
  value numeric(10,2) not null default 0,
  image_url text,
  apply_to text not null default 'all' check (apply_to in ('all', 'category', 'product')),
  target_id uuid,
  start_date timestamptz not null default now(),
  end_date timestamptz not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  is_highlighted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ────────────── 8. COUPONS ──────────────
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(10,2) not null default 0,
  min_order_value numeric(10,2) not null default 0,
  max_uses int,
  used_count int not null default 0,
  expiry_date timestamptz not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_coupons_code on public.coupons(code);

-- ────────────── 9. ADDRESSES ──────────────
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Home',
  full_name text not null,
  phone text not null,
  street text not null,
  city text not null,
  state text not null,
  zip text not null,
  country text not null default 'India',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_addresses_user on public.addresses(user_id);

-- ────────────── 10. CART ITEMS ──────────────
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity int not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  unique(user_id, product_id, variant_id)
);

create index idx_cart_items_user on public.cart_items(user_id);

-- ────────────── 11. WISHLIST ITEMS ──────────────
create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create index idx_wishlist_items_user on public.wishlist_items(user_id);

-- ────────────── 12. ORDERS ──────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_number text not null unique,
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,
  shipping_cost numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  payment_method text,
  coupon_id uuid references public.coupons(id) on delete set null,
  shipping_address jsonb,
  billing_address jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_user on public.orders(user_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_number on public.orders(order_number);

-- ────────────── 13. ORDER ITEMS ──────────────
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  name text not null,
  price numeric(10,2) not null,
  quantity int not null default 1,
  image_url text,
  variant_info text,
  created_at timestamptz not null default now()
);

create index idx_order_items_order on public.order_items(order_id);

-- ────────────── 14. REVIEWS ──────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text,
  comment text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create index idx_reviews_product on public.reviews(product_id);

-- ────────────── 15. HOMEPAGE SECTIONS ──────────────
create table public.homepage_sections (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  type text not null,
  sort_order int not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  config jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ────────────── 16. TESTIMONIALS ──────────────
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text,
  comment text not null,
  rating int not null default 5 check (rating between 1 and 5),
  designation text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ────────────── 17. SETTINGS ──────────────
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value text not null default '',
  type text not null default 'text' check (type in ('text', 'image', 'json', 'number', 'boolean')),
  "group" text not null default 'general',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_settings_key on public.settings(key);

-- ────────────── 18. CONTENT PAGES ──────────────
create table public.content_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content text not null default '',
  meta_title text,
  meta_description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_content_pages_slug on public.content_pages(slug);

-- ────────────── 19. SOCIAL LINKS ──────────────
create table public.social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  url text not null,
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ────────────── 20. NEWSLETTERS ──────────────
create table public.newsletters (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  created_at timestamptz not null default now()
);

-- ────────────── Updated at trigger for all tables ──────────────
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply trigger to all tables with updated_at
do $$ 
declare
  t text;
begin
  for t in 
    select table_name from information_schema.columns 
    where column_name = 'updated_at' 
    and table_schema = 'public'
    and table_name != 'profiles'
  loop
    execute format('
      create trigger set_updated_at
        before update on public.%I
        for each row execute procedure public.update_updated_at()
    ', t);
  end loop;
end $$;

-- Profiles trigger
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at();

-- ────────────── Row Level Security ──────────────

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.banners enable row level security;
alter table public.offers enable row level security;
alter table public.coupons enable row level security;
alter table public.addresses enable row level security;
alter table public.cart_items enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews enable row level security;
alter table public.homepage_sections enable row level security;
alter table public.testimonials enable row level security;
alter table public.settings enable row level security;
alter table public.content_pages enable row level security;
alter table public.social_links enable row level security;
alter table public.newsletters enable row level security;

-- PUBLIC READ policies (for storefront)
create policy "Public can view active categories" on public.categories for select using (status = 'active');
create policy "Public can view active products" on public.products for select using (status = 'active');
create policy "Public can view product images" on public.product_images for select using (true);
create policy "Public can view product variants" on public.product_variants for select using (true);
create policy "Public can view active banners" on public.banners for select using (status = 'active');
create policy "Public can view active offers" on public.offers for select using (status = 'active');
create policy "Public can view active coupons" on public.coupons for select using (status = 'active');
create policy "Public can view approved reviews" on public.reviews for select using (status = 'approved');
create policy "Public can view active sections" on public.homepage_sections for select using (status = 'active');
create policy "Public can view active testimonials" on public.testimonials for select using (status = 'active');
create policy "Public can view settings" on public.settings for select using (true);
create policy "Public can view active content" on public.content_pages for select using (status = 'active');
create policy "Public can view social links" on public.social_links for select using (true);

-- USER policies
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can manage own addresses" on public.addresses for all using (auth.uid() = user_id);
create policy "Users can manage own cart" on public.cart_items for all using (auth.uid() = user_id);
create policy "Users can manage own wishlist" on public.wishlist_items for all using (auth.uid() = user_id);
create policy "Users can view own orders" on public.orders for select using (auth.uid() = user_id);
create policy "Users can create orders" on public.orders for insert with check (auth.uid() = user_id);
create policy "Users can view own order items" on public.order_items for select using (
  exists (select 1 from public.orders where orders.id = order_items.order_id and orders.user_id = auth.uid())
);
create policy "Users can create reviews" on public.reviews for insert with check (auth.uid() = user_id);
create policy "Users can update own reviews" on public.reviews for update using (auth.uid() = user_id);
create policy "Users can subscribe newsletter" on public.newsletters for insert with check (true);

-- ADMIN policies (admin can do everything)
create policy "Admins have full access to profiles" on public.profiles for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to categories" on public.categories for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to products" on public.products for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to product_images" on public.product_images for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to product_variants" on public.product_variants for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to banners" on public.banners for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to offers" on public.offers for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to coupons" on public.coupons for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to orders" on public.orders for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to order_items" on public.order_items for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to reviews" on public.reviews for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to homepage_sections" on public.homepage_sections for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to testimonials" on public.testimonials for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to settings" on public.settings for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to content_pages" on public.content_pages for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to social_links" on public.social_links for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to newsletters" on public.newsletters for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admins have full access to addresses" on public.addresses for all using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ────────────── Storage Buckets ──────────────
-- Run these in a separate query
insert into storage.buckets (id, name, public) values ('products', 'products', true);
insert into storage.buckets (id, name, public) values ('banners', 'banners', true);
insert into storage.buckets (id, name, public) values ('categories', 'categories', true);
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
insert into storage.buckets (id, name, public) values ('content', 'content', true);

-- Storage policies
create policy "Public can view all images" on storage.objects for select using (true);
create policy "Authenticated users can upload" on storage.objects for insert with check (auth.role() = 'authenticated');
create policy "Admin can delete images" on storage.objects for delete using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can update images" on storage.objects for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- ────────────── Default Settings ──────────────
insert into public.settings (key, value, type, "group") values
  ('site_name', 'Rurban Ecommerce', 'text', 'general'),
  ('site_tagline', 'Premium Products, Unbeatable Value', 'text', 'general'),
  ('site_logo', '/logo.png', 'image', 'general'),
  ('site_favicon', '/favicon.ico', 'image', 'general'),
  ('contact_email', 'support@rurban.com', 'text', 'contact'),
  ('contact_phone', '+91 123 456 7890', 'text', 'contact'),
  ('contact_address', 'Mumbai, Maharashtra, India', 'text', 'contact'),
  ('currency', 'INR', 'text', 'general'),
  ('currency_symbol', '₹', 'text', 'general'),
  ('tax_rate', '18', 'number', 'tax'),
  ('shipping_free_above', '999', 'number', 'shipping'),
  ('shipping_flat_rate', '49', 'number', 'shipping'),
  ('meta_title', 'Rurban Ecommerce — Premium Products, Unbeatable Value', 'text', 'seo'),
  ('meta_description', 'Discover premium products at Rurban Ecommerce. Shop trending products, exclusive offers, and enjoy fast delivery.', 'text', 'seo');

-- ────────────── Default Content Pages ──────────────
insert into public.content_pages (slug, title, content, meta_title, meta_description) values
  ('about', 'About Us', '<h2>Welcome to Rurban Ecommerce</h2><p>We are a premium ecommerce platform dedicated to bringing you the best products at unbeatable prices. Our curated collection features everything from electronics and fashion to home essentials and beauty products.</p><h3>Our Mission</h3><p>To make premium products accessible to everyone while providing an exceptional shopping experience.</p><h3>Why Choose Us?</h3><ul><li>Quality products from trusted brands</li><li>Competitive prices and regular offers</li><li>Fast and reliable delivery</li><li>Exceptional customer service</li><li>Easy returns and exchanges</li></ul>', 'About Us | Rurban Ecommerce', 'Learn about Rurban Ecommerce — our mission, values, and commitment to quality.'),
  ('contact', 'Contact Us', '<h2>Get in Touch</h2><p>We are here to help! Reach out to us through any of the following channels:</p><h3>Customer Support</h3><p>Email: support@rurban.com<br/>Phone: +91 123 456 7890<br/>Hours: Mon-Sat, 9 AM - 6 PM IST</p><h3>Office Address</h3><p>Rurban Ecommerce Pvt. Ltd.<br/>123, Business Park<br/>Mumbai, Maharashtra 400001<br/>India</p>', 'Contact Us | Rurban Ecommerce', 'Contact Rurban Ecommerce — we are here to help with orders, products, and support.'),
  ('privacy-policy', 'Privacy Policy', '<h2>Privacy Policy</h2><p>At Rurban Ecommerce, we take your privacy seriously. This policy describes how we collect, use, and protect your personal information.</p><h3>Information We Collect</h3><p>We collect information you provide when creating an account, placing orders, or contacting us. This includes your name, email, phone number, and shipping address.</p><h3>How We Use Your Information</h3><p>We use your information to process orders, improve our services, send relevant communications, and provide customer support.</p><h3>Data Protection</h3><p>We implement industry-standard security measures to protect your personal information from unauthorized access or disclosure.</p>', 'Privacy Policy | Rurban Ecommerce', 'Read the Rurban Ecommerce privacy policy.'),
  ('terms', 'Terms & Conditions', '<h2>Terms & Conditions</h2><p>By using Rurban Ecommerce, you agree to the following terms and conditions.</p><h3>Account</h3><p>You are responsible for maintaining the security of your account credentials. You must provide accurate information when creating an account.</p><h3>Orders & Payments</h3><p>All prices are listed in INR. We reserve the right to modify prices without notice. Orders are subject to availability.</p><h3>Shipping & Delivery</h3><p>We aim to deliver orders within 5-7 business days. Delivery times may vary based on location and availability.</p><h3>Returns & Refunds</h3><p>We offer a 7-day return policy for most products. Items must be in original condition with packaging intact.</p>', 'Terms & Conditions | Rurban Ecommerce', 'Read the terms and conditions for using Rurban Ecommerce.');

-- ────────────── Default Homepage Sections ──────────────
insert into public.homepage_sections (title, subtitle, type, sort_order, status) values
  ('Hero Slider', null, 'hero_slider', 1, 'active'),
  ('Shop by Category', 'Browse our curated collections', 'featured_categories', 2, 'active'),
  ('Flash Sale', 'Limited time offers', 'flash_sale', 3, 'active'),
  ('Featured Products', 'Handpicked just for you', 'best_selling', 4, 'active'),
  ('Offer Banners', null, 'offer_banners', 5, 'active'),
  ('Trending Now', 'What everyone''s buying', 'trending', 6, 'active'),
  ('New Arrivals', 'Fresh additions to our collection', 'new_arrivals', 7, 'active'),
  ('Best Deals', 'Save big on these offers', 'discount_offers', 8, 'active'),
  ('Recommended For You', 'Products you might love', 'recommended', 9, 'active'),
  ('Testimonials', 'What our customers say', 'testimonials', 10, 'active'),
  ('Newsletter', 'Subscribe for updates', 'newsletter', 11, 'active');

-- ────────────── Default Testimonials ──────────────
insert into public.testimonials (name, comment, rating, designation, sort_order) values
  ('Priya Sharma', 'Amazing quality products and super fast delivery. Rurban is now my go-to store!', 5, 'Verified Buyer', 1),
  ('Rahul Verma', 'The customer service is exceptional. They helped me find exactly what I needed.', 5, 'Verified Buyer', 2),
  ('Anita Desai', 'Great selection of products and the prices are very competitive. Highly recommended!', 4, 'Verified Buyer', 3);
