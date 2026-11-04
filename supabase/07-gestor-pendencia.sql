-- Gestor da pendência (pedido do Felipe, 04/11/2026): pendência de estagiário também aparece para o gestor dele.
-- Quem cria a pendência (na ata ou avulsa) só escolhe o responsável; os gestores são deduzidos (pendencias.gestores uuid[], gestores_nome):
--   * responsável é estagiário de obra → os gestores de obra que acompanham a obra da pendência (perfis.obras); pendência sem obra: as obras do estagiário;
--   * estagiário de compras e ferramentas → função ferramentas; estagiário de orçamento terceirizado → função planejamento (gestor do setor).
-- Ninguém cadastra gestor: só as obras de cada pessoa (tela Acessos). O gestor vê e atualiza a pendência (e lê a ata dela).
-- Mudou obras/função/ativo de alguém → os gestores das pendências abertas são recalculados sozinhos. (Migrações "gestor_da_pendencia" e "gestores_pela_obra".)

alter table public.pendencias add column if not exists gestores uuid[] not null default '{}';
alter table public.pendencias add column if not exists gestores_nome text;
create index if not exists pendencias_gestores on public.pendencias using gin (gestores);

create or replace function public.gestores_da_pendencia(resp uuid, obra_p text) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare f text; o text[]; r uuid[];
begin
  if resp is null then return '{}'; end if;
  select funcao, obras into f, o from public.perfis where id = resp;
  if f = 'estagiario' then
    select coalesce(array_agg(id order by nome), '{}') into r from public.perfis
      where funcao = 'gestor_obra' and ativo and obras && (case when obra_p is not null then array[obra_p] else o end);
  elsif f = 'estagiario_compras' then
    select coalesce(array_agg(id order by nome), '{}') into r from public.perfis where funcao = 'ferramentas' and ativo;
  elsif f = 'orc_terceirizado' then
    select coalesce(array_agg(id order by nome), '{}') into r from public.perfis where funcao = 'planejamento' and ativo;
  else r := '{}'; end if;
  return coalesce(r, '{}');
end $$;

create or replace function public.pendencia_define_gestor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.responsavel is distinct from old.responsavel or new.obra is distinct from old.obra then
    new.gestores := public.gestores_da_pendencia(new.responsavel, new.obra);
    new.gestores_nome := (select string_agg(nome, ', ' order by nome) from public.perfis where id = any (new.gestores));
  end if;
  return new;
end $$;
drop trigger if exists pend_gestor on public.pendencias;
create trigger pend_gestor before insert or update of responsavel, obra on public.pendencias for each row execute function public.pendencia_define_gestor();

create or replace function public.recalcular_gestores_pendencias() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.pendencias p set gestores = public.gestores_da_pendencia(p.responsavel, p.obra) where p.responsavel is not null and p.status = 'aberta';
  update public.pendencias p set gestores_nome = (select string_agg(nome, ', ' order by nome) from public.perfis where id = any (p.gestores)) where p.status = 'aberta';
  return null;
end $$;
drop trigger if exists perfil_recalcula_gestores on public.perfis;
create trigger perfil_recalcula_gestores after update of obras, funcao, ativo on public.perfis for each statement execute function public.recalcular_gestores_pendencias();
revoke execute on function public.gestores_da_pendencia(uuid, text), public.pendencia_define_gestor(), public.recalcular_gestores_pendencias() from public, anon, authenticated;

alter policy pend_ler on public.pendencias using (liberado() and (ve_tudo_de_atas() or responsavel = auth.uid() or auth.uid() = any (gestores) or criado_por = auth.uid()
  or (obra is not null and obra = any (minhas_obras())) or (not funcao_de_obra() and setor is not null and setor = any (meus_departamentos()))));
alter policy pend_editar on public.pendencias using (responsavel = auth.uid() or auth.uid() = any (gestores) or criado_por = auth.uid() or eh_diretoria())
  with check (responsavel = auth.uid() or auth.uid() = any (gestores) or criado_por = auth.uid() or eh_diretoria());
alter policy atas_ler on public.atas using (liberado() and (ve_tudo_de_atas() or criado_por = auth.uid() or (obra is not null and obra = any (minhas_obras()))
  or (not funcao_de_obra() and setor is not null and setor = any (meus_departamentos()))
  or exists (select 1 from public.pendencias p where p.ata_id = atas.id and (p.responsavel = auth.uid() or auth.uid() = any (p.gestores)))));
