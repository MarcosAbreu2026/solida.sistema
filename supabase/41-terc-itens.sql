-- Acompanhamento dos terceirizados (cinza e laranja) por obra (pedido do Marcos, 20/11/2026): reproduz no sistema a planilha
-- <obra>_TERCERIZADOS_R<nn>.xlsx. A base (item, orçado, loja, datas) vem da planilha lida do Drive (projetos.json); esta tabela guarda o que
-- o sistema preenche por cima: loja cotando, prazo do fornecedor, data limite para fechar, loja fechada, contrato e a situação.
-- Ler: qualquer pessoa liberada (gestor e estagiário de obra acompanham o status dos itens das suas obras).
-- Alterar: as mesmas funções do quadro do Orçamento Terceirizado (terc_quadro_edita).
-- Valores (orçado, fechado, forma de pagamento): tabela à parte; só vê quem lida com custo (sócio, financeiro, orçamento terceirizado, planejamento, coordenação).

create table if not exists public.terc_itens (
  id bigint generated always as identity primary key,
  obra text not null,
  escopo text not null check (escopo in ('cinza','laranja')),
  chave text not null,
  cod text,
  item text not null,
  quantidade numeric,
  unidade text,
  no_orcamento boolean,
  prazo_padrao date,
  prazo_fornecedor text,
  data_limite date,
  loja_cotando text,
  vendedor text,
  loja_fechada text,
  situacao text,
  contrato text not null default 'nao' check (contrato in ('nao','elaborando','enviado','assinado')),
  obs text,
  atualizado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now(),
  unique (obra, escopo, chave)
);
create index if not exists terc_itens_obra on public.terc_itens (obra);
alter table public.terc_itens enable row level security;

create table if not exists public.terc_itens_valores (
  obra text not null,
  escopo text not null check (escopo in ('cinza','laranja')),
  chave text not null,
  valor_orcado numeric,
  valor_fechado numeric,
  forma_pagamento text,
  atualizado_em timestamptz not null default now(),
  primary key (obra, escopo, chave)
);
alter table public.terc_itens_valores enable row level security;

create or replace function public.terc_valores_ve() returns boolean language sql stable security definer set search_path = public as $$
  select public.liberado() and (public.ve_valores() or coalesce(public.minha_funcao() in ('orc_terceirizado','orc_obras_novas','planejamento','coord_operacoes'), false)) $$;
revoke execute on function public.terc_valores_ve() from public, anon;
grant execute on function public.terc_valores_ve() to authenticated;

drop policy if exists ti_ler on public.terc_itens;
create policy ti_ler on public.terc_itens for select to authenticated using (public.liberado());
drop policy if exists ti_criar on public.terc_itens;
create policy ti_criar on public.terc_itens for insert to authenticated with check (public.terc_quadro_edita());
drop policy if exists ti_alterar on public.terc_itens;
create policy ti_alterar on public.terc_itens for update to authenticated using (public.terc_quadro_edita()) with check (public.terc_quadro_edita());
drop policy if exists ti_apagar on public.terc_itens;
create policy ti_apagar on public.terc_itens for delete to authenticated using (public.terc_quadro_edita());

drop policy if exists tv_ler on public.terc_itens_valores;
create policy tv_ler on public.terc_itens_valores for select to authenticated using (public.terc_valores_ve());
drop policy if exists tv_criar on public.terc_itens_valores;
create policy tv_criar on public.terc_itens_valores for insert to authenticated with check (public.terc_quadro_edita() and public.terc_valores_ve());
drop policy if exists tv_alterar on public.terc_itens_valores;
create policy tv_alterar on public.terc_itens_valores for update to authenticated using (public.terc_quadro_edita() and public.terc_valores_ve()) with check (public.terc_quadro_edita() and public.terc_valores_ve());
drop policy if exists tv_apagar on public.terc_itens_valores;
create policy tv_apagar on public.terc_itens_valores for delete to authenticated using (public.terc_quadro_edita() and public.terc_valores_ve());

create or replace function public.terc_itens_antes() returns trigger language plpgsql security definer set search_path = public as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists terc_itens_antes on public.terc_itens;
create trigger terc_itens_antes before insert or update on public.terc_itens for each row execute function public.terc_itens_antes();

-- função de gatilho: ninguém precisa chamá-la pela API
revoke execute on function public.terc_itens_antes() from public, anon, authenticated;
