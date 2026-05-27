-- Warehouse support migration

create table if not exists public.warehouses (
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

do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      add column if not exists warehouse_id uuid references public.warehouses(id) on delete set null;

    alter table public.profiles
      drop constraint if exists profiles_role_check;

    alter table public.profiles
      add constraint profiles_role_check check (role in ('user', 'admin', 'warehouse_admin'));

    create index if not exists idx_profiles_warehouse on public.profiles(warehouse_id);
  end if;

  if to_regclass('public.products') is not null then
    alter table public.products
      add column if not exists warehouse_id uuid references public.warehouses(id) on delete set null;

    create index if not exists idx_products_warehouse on public.products(warehouse_id);
  end if;

  if to_regclass('public.categories') is not null then
    alter table public.categories
      add column if not exists warehouse_id uuid references public.warehouses(id) on delete set null;

    create index if not exists idx_categories_warehouse on public.categories(warehouse_id);
  end if;
end $$;
