-- Fix RLS recursion on public.profiles and admin policies.
-- Root cause: admin policies referenced public.profiles inside policy expressions,
-- and profiles itself had an admin policy that referenced public.profiles again.

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

grant execute on function public.is_admin_user() to anon, authenticated, service_role;

drop policy if exists "Admins have full access to profiles" on public.profiles;
drop policy if exists "Admins have full access to categories" on public.categories;
drop policy if exists "Admins have full access to products" on public.products;
drop policy if exists "Admins have full access to product_images" on public.product_images;
drop policy if exists "Admins have full access to product_variants" on public.product_variants;
drop policy if exists "Admins have full access to banners" on public.banners;
drop policy if exists "Admins have full access to offers" on public.offers;
drop policy if exists "Admins have full access to coupons" on public.coupons;
drop policy if exists "Admins have full access to orders" on public.orders;
drop policy if exists "Admins have full access to order_items" on public.order_items;
drop policy if exists "Admins have full access to reviews" on public.reviews;
drop policy if exists "Admins have full access to homepage_sections" on public.homepage_sections;
drop policy if exists "Admins have full access to testimonials" on public.testimonials;
drop policy if exists "Admins have full access to settings" on public.settings;
drop policy if exists "Admins have full access to content_pages" on public.content_pages;
drop policy if exists "Admins have full access to social_links" on public.social_links;
drop policy if exists "Admins have full access to newsletters" on public.newsletters;
drop policy if exists "Admins have full access to addresses" on public.addresses;

create policy "Admins have full access to profiles"
on public.profiles for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to categories"
on public.categories for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to products"
on public.products for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to product_images"
on public.product_images for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to product_variants"
on public.product_variants for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to banners"
on public.banners for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to offers"
on public.offers for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to coupons"
on public.coupons for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to orders"
on public.orders for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to order_items"
on public.order_items for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to reviews"
on public.reviews for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to homepage_sections"
on public.homepage_sections for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to testimonials"
on public.testimonials for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to settings"
on public.settings for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to content_pages"
on public.content_pages for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to social_links"
on public.social_links for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to newsletters"
on public.newsletters for all
using (public.is_admin_user())
with check (public.is_admin_user());

create policy "Admins have full access to addresses"
on public.addresses for all
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "Admin can delete images" on storage.objects;
drop policy if exists "Admin can update images" on storage.objects;

create policy "Admin can delete images"
on storage.objects for delete
using (public.is_admin_user());

create policy "Admin can update images"
on storage.objects for update
using (public.is_admin_user());

