-- Celular da obra (desenho do Marcos, 04/11/2026): o celular fica na obra e estagiário, encarregado e gestor lançam
-- o executado do dia (por item da meta), o efetivo (até 12h) e o diário de obra. O ponto continua no Sólides.
-- Uma linha por obra + dia + tipo + item (lançar de novo no mesmo dia substitui). Efetivo e diário usam item = ''.
-- Ler: qualquer pessoa liberada. Gravar: liberado e não ajudante. Apagar: quem lançou ou a diretoria.

create table if not exists public.registros_obra (
  id bigint generated always as identity primary key,
  obra text not null,
  data date not null default current_date,
  tipo text not null check (tipo in ('executado', 'efetivo', 'diario')),
  item text not null default '',
  valor numeric,
  dados jsonb,
  texto text,
  papel text,
  responsavel text,
  criado_por uuid not null default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (obra, data, tipo, item)
);
create index if not exists registros_obra_data on public.registros_obra (data desc, obra);

alter table public.registros_obra enable row level security;

drop policy if exists reg_obra_ler on public.registros_obra;
create policy reg_obra_ler on public.registros_obra for select to authenticated
  using (public.liberado());
drop policy if exists reg_obra_criar on public.registros_obra;
create policy reg_obra_criar on public.registros_obra for insert to authenticated
  with check (criado_por = auth.uid() and public.liberado() and coalesce(public.minha_funcao() <> 'ajudante', false));
drop policy if exists reg_obra_alterar on public.registros_obra;
create policy reg_obra_alterar on public.registros_obra for update to authenticated
  using (public.liberado() and coalesce(public.minha_funcao() <> 'ajudante', false))
  with check (criado_por = auth.uid() and public.liberado() and coalesce(public.minha_funcao() <> 'ajudante', false));
drop policy if exists reg_obra_apagar on public.registros_obra;
create policy reg_obra_apagar on public.registros_obra for delete to authenticated
  using (criado_por = auth.uid() or public.eh_diretoria());
