-- Gestor da pendência (pedido do Felipe, 04/11/2026): pendência de estagiário também aparece para o gestor dele.
-- Quem cria a pendência (na ata ou avulsa) só escolhe o responsável; os gestores são deduzidos (pendencias.gestores uuid[], gestores_nome).
-- Ninguém cadastra "gestor": a diretoria só marca, em Acessos, as OBRAS / PÓS-OBRAS (perfis.obras) e os SETORES (perfis.setores, conforme o
-- organograma R07) de cada pessoa. Vale para estagiário de obra, estagiário de compras e estagiário/orçamento terceirizado. Ordem:
--   1) pendência de uma obra ou pós-obra → gestor de obra / do pós-obra que acompanha essa obra;
--   2) pendência de um setor → gestores que têm esse setor;
--   3) senão pelo próprio responsável: estagiário de obra → gestores das obras dele; os demais → gestores dos setores dele;
--   4) sem setor cadastrado: Compras → função ferramentas; Orçamento terceirizado → função planejamento.
-- O gestor vê e atualiza a pendência (e lê a ata dela). Mudou obras/setores/função/ativo de alguém → os gestores das pendências
-- abertas são recalculados sozinhos. (Migrações "gestor_da_pendencia", "gestores_pela_obra", "gestores_inclui_posobra",
-- "setores_das_pessoas_e_gestor_por_setor" e "gestores_obra_so_gestor_de_obra".)

alter table public.perfis add column if not exists setores text[] not null default '{}';
alter table public.pendencias add column if not exists gestores uuid[] not null default '{}';
alter table public.pendencias add column if not exists gestores_nome text;
create index if not exists pendencias_gestores on public.pendencias using gin (gestores);

create or replace function public.gestores_da_pendencia(resp uuid, obra_p text, setor_p text) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare f text; o text[]; s text[]; r uuid[] := '{}';
  nao_gestor text[] := array['estagiario','estagiario_compras','orc_terceirizado','ajudante','encarregado','executor_ferramentas','coletor','socio'];
begin
  if resp is null then return '{}'; end if;
  select funcao, obras, setores into f, o, s from public.perfis where id = resp;
  if f not in ('estagiario', 'estagiario_compras', 'orc_terceirizado') then return '{}'; end if;
  if obra_p is not null then
    select coalesce(array_agg(id order by nome), '{}') into r from public.perfis
      where ativo and funcao in ('gestor_obra', 'posobra') and obras && array[obra_p];
  end if;
  if cardinality(r) = 0 and setor_p is not null then
    select coalesce(array_agg(id order by nome), '{}') into r from public.perfis
      where ativo and id <> resp and not (funcao = any (nao_gestor)) and setores && array[setor_p];
  end if;
  if cardinality(r) = 0 then
    if f = 'estagiario' then
      select coalesce(array_agg(id order by nome), '{}') into r from public.perfis where ativo and funcao in ('gestor_obra', 'posobra') and obras && o;
    end if;
    if cardinality(r) = 0 then
      select coalesce(array_agg(id order by nome), '{}') into r from public.perfis
        where ativo and id <> resp and not (funcao = any (nao_gestor)) and setores && s;
    end if;
  end if;
  if cardinality(r) = 0 then
    if f = 'estagiario_compras' then select coalesce(array_agg(id order by nome), '{}') into r from public.perfis where funcao = 'ferramentas' and ativo;
    elsif f = 'orc_terceirizado' then select coalesce(array_agg(id order by nome), '{}') into r from public.perfis where funcao = 'planejamento' and ativo;
    end if;
  end if;
  return coalesce(r, '{}');
end $$;

create or replace function public.pendencia_define_gestor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.responsavel is distinct from old.responsavel or new.obra is distinct from old.obra or new.setor is distinct from old.setor then
    new.gestores := public.gestores_da_pendencia(new.responsavel, new.obra, new.setor);
    new.gestores_nome := (select string_agg(nome, ', ' order by nome) from public.perfis where id = any (new.gestores));
  end if;
  return new;
end $$;
drop trigger if exists pend_gestor on public.pendencias;
create trigger pend_gestor before insert or update of responsavel, obra, setor on public.pendencias for each row execute function public.pendencia_define_gestor();

create or replace function public.recalcular_gestores_pendencias() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.pendencias p set gestores = public.gestores_da_pendencia(p.responsavel, p.obra, p.setor) where p.responsavel is not null and p.status = 'aberta';
  update public.pendencias p set gestores_nome = (select string_agg(nome, ', ' order by nome) from public.perfis where id = any (p.gestores)) where p.status = 'aberta';
  return null;
end $$;
drop trigger if exists perfil_recalcula_gestores on public.perfis;
create trigger perfil_recalcula_gestores after update of obras, setores, funcao, ativo on public.perfis for each statement execute function public.recalcular_gestores_pendencias();
revoke execute on function public.gestores_da_pendencia(uuid, text, text), public.pendencia_define_gestor(), public.recalcular_gestores_pendencias() from public, anon, authenticated;

alter policy pend_ler on public.pendencias using (liberado() and (ve_tudo_de_atas() or responsavel = auth.uid() or auth.uid() = any (gestores) or criado_por = auth.uid()
  or (obra is not null and obra = any (minhas_obras())) or (not funcao_de_obra() and setor is not null and setor = any (meus_departamentos()))));
alter policy pend_editar on public.pendencias using (responsavel = auth.uid() or auth.uid() = any (gestores) or criado_por = auth.uid() or eh_diretoria())
  with check (responsavel = auth.uid() or auth.uid() = any (gestores) or criado_por = auth.uid() or eh_diretoria());
alter policy atas_ler on public.atas using (liberado() and (ve_tudo_de_atas() or criado_por = auth.uid() or (obra is not null and obra = any (minhas_obras()))
  or (not funcao_de_obra() and setor is not null and setor = any (meus_departamentos()))
  or exists (select 1 from public.pendencias p where p.ata_id = atas.id and (p.responsavel = auth.uid() or auth.uid() = any (p.gestores)))));

-- setores iniciais conforme o organograma R07 (a diretoria ajusta em Acessos)
update public.perfis set setores = array['Suprimentos e compras'] where funcao in ('compras', 'estagiario_compras') and setores = '{}';
update public.perfis set setores = array['Transporte e logística', 'Suprimentos e compras'] where funcao = 'ferramentas' and setores = '{}';
update public.perfis set setores = array['Planejamento'] where funcao = 'planejamento' and setores = '{}';
update public.perfis set setores = array['Planejamento'] where nome = 'Julia' and funcao = 'orc_terceirizado' and setores = '{}';
update public.perfis set setores = array['Projetos', 'Orçamentos'] where funcao = 'projetos' and setores = '{}';
update public.perfis set setores = array['Orçamentos'] where nome = 'Leandro' and funcao = 'orc_terceirizado' and setores = '{}';
update public.perfis set setores = array['Financeiro'] where funcao = 'financeiro' and setores = '{}';
update public.perfis set setores = array['Pós-obra'] where funcao = 'posobra' and setores = '{}';
