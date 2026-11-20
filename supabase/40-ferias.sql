-- Férias dos funcionários (pedido do Marcos, 20/11/2026): o RH lança o período; o quadro de alocação, a agenda do pós-obra e a
-- programação do dia usam para não contar como livre nem sugerir serviço a quem está de férias.
-- Ler: qualquer pessoa liberada. Lançar/alterar/apagar: diretoria e RH.
create table if not exists public.ferias (
  id bigint generated always as identity primary key,
  funcionario text not null,
  inicio date not null,
  fim date not null,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  check (fim >= inicio)
);
create index if not exists ferias_periodo on public.ferias (inicio, fim);
alter table public.ferias enable row level security;
create or replace function public.ferias_edita() returns boolean language sql stable security definer set search_path = public as $$
  select public.liberado() and (public.eh_diretoria() or coalesce(public.minha_funcao() = 'rh', false)) $$;
drop policy if exists ferias_ler on public.ferias;
create policy ferias_ler on public.ferias for select to authenticated using (public.liberado());
drop policy if exists ferias_criar on public.ferias;
create policy ferias_criar on public.ferias for insert to authenticated with check (public.ferias_edita());
drop policy if exists ferias_alterar on public.ferias;
create policy ferias_alterar on public.ferias for update to authenticated using (public.ferias_edita()) with check (public.ferias_edita());
drop policy if exists ferias_apagar on public.ferias;
create policy ferias_apagar on public.ferias for delete to authenticated using (public.ferias_edita());
