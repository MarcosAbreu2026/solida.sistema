-- Guia de movimentacao do galpao (SL_MOVIMENTACAO_R01, pagina 1)
-- movimentacoes_galpao: uma linha por movimentacao (item, qtd, origem, destino, obs). Origem/destino: GALPAO, nome da obra, MANUTENCAO ou DESCARTE.
-- movimentacoes_fotos: foto da folha preenchida (o arquivo fica no bucket "fotos", pasta = id de quem enviou).
-- Quem ve e registra: socio, administrativo, ferramentas, executor de ferramentas e estagiario de compras/ferramentas (galpao).
-- Apagar: quem registrou ou a diretoria. Sem editar: errou, apaga e registra de novo.

create table if not exists public.movimentacoes_galpao (
  id bigint generated always as identity primary key,
  data date not null default current_date,
  responsavel text not null,
  item text not null,
  qtd numeric not null check (qtd > 0),
  origem text not null,
  destino text not null,
  obs text,
  criado_por uuid not null default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists movimentacoes_galpao_data on public.movimentacoes_galpao (data desc, id desc);

create table if not exists public.movimentacoes_fotos (
  id bigint generated always as identity primary key,
  data date not null default current_date,
  responsavel text not null,
  obs text,
  caminho text not null,
  criado_por uuid not null default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists movimentacoes_fotos_data on public.movimentacoes_fotos (data desc, id desc);

alter table public.movimentacoes_galpao enable row level security;
alter table public.movimentacoes_fotos enable row level security;

drop policy if exists mov_ler on public.movimentacoes_galpao;
create policy mov_ler on public.movimentacoes_galpao for select to authenticated
  using (coalesce(public.minha_funcao() in ('socio', 'administrativo', 'ferramentas', 'executor_ferramentas', 'estagiario_compras'), false));
drop policy if exists mov_criar on public.movimentacoes_galpao;
create policy mov_criar on public.movimentacoes_galpao for insert to authenticated
  with check (criado_por = auth.uid() and coalesce(public.minha_funcao() in ('socio', 'administrativo', 'ferramentas', 'executor_ferramentas', 'estagiario_compras'), false));
drop policy if exists mov_apagar on public.movimentacoes_galpao;
create policy mov_apagar on public.movimentacoes_galpao for delete to authenticated
  using (criado_por = auth.uid() or public.eh_diretoria());

drop policy if exists movfoto_ler on public.movimentacoes_fotos;
create policy movfoto_ler on public.movimentacoes_fotos for select to authenticated
  using (coalesce(public.minha_funcao() in ('socio', 'administrativo', 'ferramentas', 'executor_ferramentas', 'estagiario_compras'), false));
drop policy if exists movfoto_criar on public.movimentacoes_fotos;
create policy movfoto_criar on public.movimentacoes_fotos for insert to authenticated
  with check (criado_por = auth.uid() and coalesce(public.minha_funcao() in ('socio', 'administrativo', 'ferramentas', 'executor_ferramentas', 'estagiario_compras'), false));
drop policy if exists movfoto_apagar on public.movimentacoes_fotos;
create policy movfoto_apagar on public.movimentacoes_fotos for delete to authenticated
  using (criado_por = auth.uid() or public.eh_diretoria());
