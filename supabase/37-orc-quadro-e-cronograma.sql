-- CRM de orçamentos novos (Kanban) + cronograma geral de obras (pedido do Marcos, 19/11/2026).
-- 1) orc_quadro: cada card é um orçamento (código Mo###) que anda pelas colunas; as tarefas ficam DENTRO do card (tabela pendencias, coluna os = OQ-###).
--    Ler: qualquer pessoa liberada. Mexer: diretoria, orçamento de obras novas, planejamento.
-- 2) orc_quadro_valor: o valor do orçamento é sensível (só sócios veem), por isso fica em tabela à parte, só da diretoria.
-- 3) cronograma_obras: coordenação, gestores, estagiário, encarregado e início/fim de cada obra ou pós-obra (semana S01 = semana do início).
--    Ler: qualquer pessoa liberada. Mexer: diretoria, coordenação de operações e planejamento.

create table if not exists public.orc_quadro (
  id bigint generated always as identity primary key,
  codigo text not null default '',
  obra text not null,
  cliente text,
  arquitetura text,
  titulo text not null default '',
  status text not null default 'solicitacao' check (status in ('solicitacao','em_orcamento','arquitetura','fornecedor','cliente','fechado','nao_fechou')),
  viavel boolean not null default false,
  prazo date,
  inicio_previsto date,
  meses numeric(4,1),
  fim_previsto date,
  responsavel text,
  descricao text,
  d_fechado date,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists orc_quadro_status on public.orc_quadro (status);
alter table public.orc_quadro enable row level security;

create or replace function public.orc_quadro_edita() returns boolean language sql stable security definer set search_path = public as $$
  select public.liberado() and (public.eh_diretoria() or coalesce(public.minha_funcao() in ('orc_obras_novas','planejamento'), false)) $$;

drop policy if exists oq_ler on public.orc_quadro;
create policy oq_ler on public.orc_quadro for select to authenticated using (public.liberado());
drop policy if exists oq_criar on public.orc_quadro;
create policy oq_criar on public.orc_quadro for insert to authenticated with check (public.orc_quadro_edita());
drop policy if exists oq_alterar on public.orc_quadro;
create policy oq_alterar on public.orc_quadro for update to authenticated using (public.orc_quadro_edita()) with check (public.orc_quadro_edita());
drop policy if exists oq_apagar on public.orc_quadro;
create policy oq_apagar on public.orc_quadro for delete to authenticated using (public.orc_quadro_edita());

create or replace function public.orc_quadro_antes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.codigo, '') = '' then new.codigo := 'OQ-' || lpad(new.id::text, 3, '0'); end if;
  new.atualizado_em := now();
  if new.status = 'fechado' and new.d_fechado is null then new.d_fechado := current_date; end if;
  if new.status <> 'fechado' then new.d_fechado := null; end if;
  return new;
end $$;
drop trigger if exists orc_quadro_antes on public.orc_quadro;
create trigger orc_quadro_antes before insert or update on public.orc_quadro for each row execute function public.orc_quadro_antes();

create table if not exists public.orc_quadro_valor (
  orc_id bigint primary key references public.orc_quadro(id) on delete cascade,
  valor numeric(14,2)
);
alter table public.orc_quadro_valor enable row level security;
drop policy if exists oqv_diretoria on public.orc_quadro_valor;
create policy oqv_diretoria on public.orc_quadro_valor for all to authenticated using (public.eh_diretoria()) with check (public.eh_diretoria());

create table if not exists public.cronograma_obras (
  codigo text primary key,
  coord text,
  gestor1 text,
  gestor2 text,
  estagiario text,
  encarregado text,
  inicio date,
  fim date,
  atualizado_em timestamptz not null default now()
);
alter table public.cronograma_obras enable row level security;
create or replace function public.cronograma_edita() returns boolean language sql stable security definer set search_path = public as $$
  select public.liberado() and (public.eh_diretoria() or coalesce(public.minha_funcao() in ('coord_operacoes','planejamento'), false)) $$;
drop policy if exists cg_ler on public.cronograma_obras;
create policy cg_ler on public.cronograma_obras for select to authenticated using (public.liberado());
drop policy if exists cg_gravar on public.cronograma_obras;
create policy cg_gravar on public.cronograma_obras for all to authenticated using (public.cronograma_edita()) with check (public.cronograma_edita());

-- Cronograma que estava na planilha R106 (18/11/2026): S01 = semana do início; datas em segunda-feira
insert into public.cronograma_obras (codigo, coord, gestor1, gestor2, estagiario, encarregado, inicio, fim) values
  ('Mo358', 'Simone', 'Larissa', null, 'Augusto', 'Carlos', date '2026-09-07' - 7*92, date '2026-11-30'),
  ('Mo465', 'Simone', null, null, 'Augusto', null, date '2026-09-07' - 7*34, date '2026-09-28'),
  ('Mo531', 'Simone', 'Rose', null, 'Taísa', 'Wanderson', date '2026-09-07' - 7*23, date '2026-11-30'),
  ('Mo533', 'Simone', 'Larissa', null, 'Thaissa', 'Carlos', date '2026-09-07' - 7*19, date '2027-01-18'),
  ('Mo566', 'Simone', null, null, 'Pedro', null, date '2026-09-07' - 7*1, date '2026-11-30'),
  ('Mo581', 'Simone', 'Rose', null, 'Taísa', null, date '2026-09-28', date '2026-12-21'),
  ('Mo602', 'Simone', null, null, 'Augusto', 'Maurílio', date '2026-11-16', date '2027-01-11'),
  ('Po415', 'Marcio', null, 'Enio', 'Augusto', null, date '2026-10-05', date '2026-11-30')
on conflict (codigo) do nothing;

-- Orçamentos que o Marcos acha viáveis de fechar (início em 07/12/2026)
update public.obras_cadastro set cliente = 'Ana Paula e Flávio', nome = 'Ana Paula e Flávio', arquitetura = 'PKB' where codigo = 'Mo605';
insert into public.obras_cadastro (codigo, nome, situacao, tipo, cliente, arquitetura)
  values ('Mo612', 'Liessin Leblon', 'orcamento', 'orcamento', 'Liessin Leblon', 'Sofia')
  on conflict (codigo) do nothing;

insert into public.orc_quadro (obra, cliente, arquitetura, titulo, status, viavel, inicio_previsto, meses, fim_previsto)
select c.codigo, coalesce(c.cliente, c.nome), c.arquitetura, '',
  case c.situacao when 'solicitacao' then 'solicitacao' when 'com_arquitetura' then 'arquitetura' when 'com_fornecedor' then 'fornecedor' when 'nao_fechado' then 'nao_fechou' else 'em_orcamento' end,
  c.codigo in ('Mo605','Mo606','Mo612'),
  case when c.codigo in ('Mo605','Mo606','Mo612') then date '2026-12-07' end,
  case c.codigo when 'Mo605' then 7 when 'Mo606' then 3 end,
  case c.codigo when 'Mo605' then date '2027-07-05' when 'Mo606' then date '2027-03-01' when 'Mo612' then date '2027-01-30' end
from public.obras_cadastro c
where c.tipo = 'orcamento' and c.situacao <> 'nao_fechado'
  and not exists (select 1 from public.orc_quadro q where q.obra = c.codigo);
