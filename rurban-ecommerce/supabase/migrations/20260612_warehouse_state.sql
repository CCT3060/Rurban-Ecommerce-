-- Add state column to warehouses table
alter table public.warehouses
  add column if not exists state text;
