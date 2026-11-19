-- Quadro de alocação das obras em andamento (pedido do Marcos, 19/11/2026): quem vai para qual obra em qual dia (Operações).
-- Ler: qualquer pessoa liberada. Mexer: diretoria, coordenação de operações, planejamento e gestor de obra.
create table if not exists public.alocacao_obras (
  id bigint generated always as identity primary key,
  data date not null,
  obra text not null,
  pessoa text not null,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (data, obra, pessoa)
);
create index if not exists alocacao_obras_data on public.alocacao_obras (data);
alter table public.alocacao_obras enable row level security;
create or replace function public.alocacao_edita() returns boolean language sql stable security definer set search_path = public as $$
  select public.liberado() and (public.eh_diretoria() or coalesce(public.minha_funcao() in ('coord_operacoes','planejamento','gestor_obra'), false)) $$;
drop policy if exists aloc_ler on public.alocacao_obras;
create policy aloc_ler on public.alocacao_obras for select to authenticated using (public.liberado());
drop policy if exists aloc_criar on public.alocacao_obras;
create policy aloc_criar on public.alocacao_obras for insert to authenticated with check (public.alocacao_edita());
drop policy if exists aloc_alterar on public.alocacao_obras;
create policy aloc_alterar on public.alocacao_obras for update to authenticated using (public.alocacao_edita()) with check (public.alocacao_edita());
drop policy if exists aloc_apagar on public.alocacao_obras;
create policy aloc_apagar on public.alocacao_obras for delete to authenticated using (public.alocacao_edita());
