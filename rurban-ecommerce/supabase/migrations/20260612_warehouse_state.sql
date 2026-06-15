-- Add state column to warehouses table
alter table public.warehouses
  add column if not exists state text;

-- Add foreign key constraint to lookup_values for warehouse state
-- Drop existing constraint if it exists
do $$ begin
  execute 'alter table public.warehouses drop constraint if exists fk_warehouses_state';
exception when others then null;
end $$;

-- Create the constraint
