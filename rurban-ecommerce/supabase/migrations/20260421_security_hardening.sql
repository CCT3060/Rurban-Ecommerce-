-- Security hardening migration
-- 1) Never trust signup metadata for privileged role assignment.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'user'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 2) Prevent users from elevating privileges through self profile updates.
create or replace function public.prevent_profile_privilege_changes()
returns trigger as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if old.role is distinct from new.role then
      raise exception 'Role changes are not allowed for self updates';
    end if;

    if old.warehouse_id is distinct from new.warehouse_id then
      raise exception 'Warehouse assignment changes are not allowed for self updates';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_profile_privilege_fields on public.profiles;
create trigger protect_profile_privilege_fields
  before update on public.profiles
  for each row execute procedure public.prevent_profile_privilege_changes();
