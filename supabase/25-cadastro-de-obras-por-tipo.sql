-- Cadastro de obras por tipo (13/11/2026): obra · obra em orçamento · pós-obra; cliente e endereço obrigatórios (no sistema), arquitetura opcional.
-- Quem cadastra, edita e muda a situação: diretoria + setores ORC Obras Novas, Pós-obra e ORC Terceirizado Laranja. Só a diretoria exclui.

-- 1) colunas novas
alter table public.obras_cadastro
  add column if not exists tipo text,
  add column if not exists cliente text,
  add column if not exists endereco text,
  add column if not exists arquitetura text;

-- 2) tipo dos cadastros que já existem; pós-obra não tem situação de orçamento (o orçamento é da OS)
update public.obras_cadastro set tipo = case
  when codigo ~* '^mo' and situacao in ('orcamento', 'nao_fechado') then 'orcamento'
  when codigo ~* '^mo' then 'obra'
  else 'pos' end
where tipo is null;
update public.obras_cadastro set situacao = 'andamento' where tipo = 'pos' and situacao = 'orcamento';
update public.obras_cadastro set situacao = 'finalizada' where tipo = 'pos' and situacao = 'nao_fechado';
update public.obras_cadastro set cliente = nome where cliente is null and nome is not null;
alter table public.obras_cadastro alter column tipo set default 'obra';
alter table public.obras_cadastro alter column tipo set not null;

-- 3) situações permitidas por tipo
alter table public.obras_cadastro drop constraint if exists obras_cadastro_situacao_check;
alter table public.obras_cadastro drop constraint if exists obras_cadastro_tipo_situacao_check;
alter table public.obras_cadastro drop constraint if exists obras_cadastro_tipo_valido;
alter table public.obras_cadastro add constraint obras_cadastro_tipo_valido check (tipo in ('obra', 'orcamento', 'pos'));
alter table public.obras_cadastro add constraint obras_cadastro_tipo_situacao_check check (
  (tipo in ('obra', 'pos') and situacao in ('andamento', 'pausada', 'finalizada'))
  or (tipo = 'orcamento' and situacao in ('solicitacao', 'orcamento', 'com_arquitetura', 'com_fornecedor', 'nao_fechado')));

-- 4) quem pode mexer
create or replace function public.pode_cadastro_obras() returns boolean
language sql stable security definer set search_path to 'public'
as $$ select coalesce(public.eh_diretoria() or exists (select 1 from public.perfis p where p.id = auth.uid() and p.setores && array['ORC Obras Novas', 'Pós-obra', 'ORC Terceirizado Laranja']), false) $$;

drop policy if exists obras_cadastro_ler on public.obras_cadastro;
drop policy if exists obras_cadastro_gravar on public.obras_cadastro;
drop policy if exists obras_orcamento_gravar on public.obras_cadastro;
drop policy if exists obras_pos_gravar on public.obras_cadastro;
drop policy if exists obras_cadastro_inserir on public.obras_cadastro;
drop policy if exists obras_cadastro_alterar on public.obras_cadastro;
drop policy if exists obras_cadastro_apagar on public.obras_cadastro;

-- ver: todos veem obras e pós-obras; obra em orçamento só diretoria e os setores acima
create policy obras_cadastro_ler on public.obras_cadastro for select to authenticated
  using (public.liberado() and (tipo <> 'orcamento' or public.pode_cadastro_obras()));
-- criar e alterar (inclui mudar a situação): diretoria, os setores acima e a coordenação de operações (fora das obras em orçamento)
create policy obras_cadastro_inserir on public.obras_cadastro for insert to authenticated
  with check (public.pode_cadastro_obras() or (public.pode_mudar_obra() and tipo <> 'orcamento'));
create policy obras_cadastro_alterar on public.obras_cadastro for update to authenticated
  using (public.pode_cadastro_obras() or (public.pode_mudar_obra() and tipo <> 'orcamento'))
  with check (public.pode_cadastro_obras() or (public.pode_mudar_obra() and tipo <> 'orcamento'));
-- excluir: só a diretoria (e a coordenação, fora das obras em orçamento, como já era)
create policy obras_cadastro_apagar on public.obras_cadastro for delete to authenticated
  using (public.eh_diretoria() or (public.pode_mudar_obra() and tipo <> 'orcamento'));
