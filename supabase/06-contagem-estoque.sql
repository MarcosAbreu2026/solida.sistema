-- Contagem do estoque feita no site (aba Estoque): quem conta (estagiario do galpao etc.) digita a quantidade atual de cada item
-- num local (galpao, carros ou uma obra). Uma linha por data + local + item (contar de novo no mesmo dia substitui).
-- Valem no site por cima da planilha SL_FERRAMENTAS_SOLIDA_Rnn enquanto a data da contagem for mais nova que a "conferencia" do local na planilha.
-- Ler: qualquer pessoa liberada. Gravar: socio, administrativo, ferramentas, executor de ferramentas e estagiario de compras/ferramentas.
-- Apagar: quem contou ou a diretoria.

create table if not exists public.contagens_estoque (
  id bigint generated always as identity primary key,
  data date not null default current_date,
  local text not null,
  cod text not null,
  item text not null,
  atual numeric not null check (atual >= 0),
  obs text,
  responsavel text not null,
  criado_por uuid not null default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (data, local, cod)
);
create index if not exists contagens_estoque_data on public.contagens_estoque (data desc, id desc);

alter table public.contagens_estoque enable row level security;

drop policy if exists cont_ler on public.contagens_estoque;
create policy cont_ler on public.contagens_estoque for select to authenticated
  using (public.liberado());
drop policy if exists cont_criar on public.contagens_estoque;
create policy cont_criar on public.contagens_estoque for insert to authenticated
  with check (criado_por = auth.uid() and coalesce(public.minha_funcao() in ('socio', 'administrativo', 'ferramentas', 'executor_ferramentas', 'estagiario_compras'), false));
drop policy if exists cont_alterar on public.contagens_estoque;
create policy cont_alterar on public.contagens_estoque for update to authenticated
  using (coalesce(public.minha_funcao() in ('socio', 'administrativo', 'ferramentas', 'executor_ferramentas', 'estagiario_compras'), false))
  with check (criado_por = auth.uid() and coalesce(public.minha_funcao() in ('socio', 'administrativo', 'ferramentas', 'executor_ferramentas', 'estagiario_compras'), false));
drop policy if exists cont_apagar on public.contagens_estoque;
create policy cont_apagar on public.contagens_estoque for delete to authenticated
  using (criado_por = auth.uid() or public.eh_diretoria());
