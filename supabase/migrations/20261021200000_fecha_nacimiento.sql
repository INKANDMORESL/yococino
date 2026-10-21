-- Guardar la fecha de nacimiento en lugar de la edad.
-- La edad se calcula a partir de la fecha; solo se admiten mayores de 18 años.
alter table public.profiles add column if not exists fecha_nacimiento date;
alter table public.profiles drop column if exists edad;

-- Comprobación al guardar: fecha razonable y mayor de edad.
create or replace function public.comprobar_mayor_de_edad() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.fecha_nacimiento is not null then
    if new.fecha_nacimiento < date '1900-01-01' then
      raise exception 'Fecha de nacimiento no válida';
    end if;
    if new.fecha_nacimiento > (current_date - interval '18 years') then
      raise exception 'Yococino es solo para mayores de 18 años';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perfiles_mayor_de_edad on public.profiles;
create trigger perfiles_mayor_de_edad before insert or update of fecha_nacimiento on public.profiles
  for each row execute function public.comprobar_mayor_de_edad();
