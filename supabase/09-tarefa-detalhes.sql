-- Detalhes da tarefa (pedido do Felipe, 04/11/2026): clicar na tarefa abre uma janela com título, responsável, gestor, prazo,
-- concluir, excluir e um chat para anotar coisas. As notas ficam em pendencias_notas; o gestor pode ser trocado à mão
-- (pendencias.gestores_manual = true: o cálculo automático pelas obras/setores não mexe mais nele até voltar para "automático").

alter table public.pendencias add column if not exists gestores_manual boolean not null default false;

create table if not exists public.pendencias_notas (
  id bigint generated always as identity primary key,
  pendencia_id bigint not null references public.pendencias (id) on delete cascade,
  texto text not null check (length(btrim(texto)) > 0),
  autor uuid not null default auth.uid(),
  autor_nome text not null default '',
  criado_em timestamptz not null default now()
);
create index if not exists pendencias_notas_pend on public.pendencias_notas (pendencia_id, criado_em);
alter table public.pendencias_notas enable row level security;

-- quem enxerga a pendência (regras de pend_ler) lê e escreve as notas dela
drop policy if exists notas_ler on public.pendencias_notas;
create policy notas_ler on public.pendencias_notas for select to authenticated
  using (exists (select 1 from public.pendencias p where p.id = pendencia_id));
drop policy if exists notas_criar on public.pendencias_notas;
create policy notas_criar on public.pendencias_notas for insert to authenticated
  with check (autor = auth.uid() and exists (select 1 from public.pendencias p where p.id = pendencia_id));
drop policy if exists notas_apagar on public.pendencias_notas;
create policy notas_apagar on public.pendencias_notas for delete to authenticated
  using (autor = auth.uid() or public.eh_diretoria());

-- gestor escolhido à mão não é recalculado
create or replace function public.pendencia_define_gestor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' or new.responsavel is distinct from old.responsavel or new.obra is distinct from old.obra or new.setor is distinct from old.setor)
     and not coalesce(new.gestores_manual, false) then
    new.gestores := public.gestores_da_pendencia(new.responsavel, new.obra, new.setor);
    new.gestores_nome := (select string_agg(nome, ', ' order by nome) from public.perfis where id = any (new.gestores));
  end if;
  return new;
end $$;

create or replace function public.recalcular_gestores_pendencias() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.pendencias p set gestores = public.gestores_da_pendencia(p.responsavel, p.obra, p.setor) where p.responsavel is not null and p.status = 'aberta' and not p.gestores_manual;
  update public.pendencias p set gestores_nome = (select string_agg(nome, ', ' order by nome) from public.perfis where id = any (p.gestores)) where p.status = 'aberta' and not p.gestores_manual;
  return null;
end $$;
