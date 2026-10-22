-- Comensales en casa para la lista de la compra (la persona de la cuenta cuenta como un adulto). Idempotente.
alter table public.profiles add column if not exists compra_adultos smallint not null default 1;
alter table public.profiles add column if not exists compra_peques smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_compra_adultos_rango') then
    alter table public.profiles add constraint profiles_compra_adultos_rango check (compra_adultos between 1 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_compra_peques_rango') then
    alter table public.profiles add constraint profiles_compra_peques_rango check (compra_peques is null or compra_peques between 0 and 10);
  end if;
end;
$$;
