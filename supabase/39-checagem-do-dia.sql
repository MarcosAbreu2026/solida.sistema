-- Checagem do dia (pedido do Marcos, 20/11/2026): no painel "Dia a dia" do pós-obra e das obras, o dia útil anterior mostra o que estava
-- programado e a pessoa marca "feito" ou "não feito". Uma marca por escopo (posobra · operacao), dia e chave (obra).
-- Ler: qualquer pessoa liberada. Marcar: diretoria, pós-obra, coordenação de operações, gestor de obra e planejamento.
create table if not exists public.checagem_dia (
  id bigint generated always as identity primary key,
  escopo text not null,
  data date not null,
  chave text not null,
  feito boolean not null,
  por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  unique (escopo, data, chave)
);
alter table public.checagem_dia enable row level security;
create or replace function public.checagem_edita() returns boolean language sql stable security definer set search_path = public as $$
  select public.liberado() and (public.eh_diretoria() or coalesce(public.minha_funcao() in ('posobra','coord_operacoes','gestor_obra','planejamento'), false)) $$;
drop policy if exists chk_ler on public.checagem_dia;
create policy chk_ler on public.checagem_dia for select to authenticated using (public.liberado());
drop policy if exists chk_gravar on public.checagem_dia;
create policy chk_gravar on public.checagem_dia for all to authenticated using (public.checagem_edita()) with check (public.checagem_edita());
alter table public.checagem_dia add column if not exists qtd numeric;   -- quantidade feita no item, quando diferente da meta (20/11/2026)
