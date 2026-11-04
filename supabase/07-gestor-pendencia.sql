-- Gestor da pendência (pedido do Felipe, 04/11/2026): pendência de estagiário também aparece para o gestor dele.
-- Quem cria a pendência (na ata ou avulsa) só escolhe o responsável; o gestor é deduzido:
--   * responsável é estagiário de obra → gestor de obra que acompanha a obra da pendência (perfis.obras); sem isso, o gestor cadastrado da pessoa;
--   * responsável é estagiário de compras/ferramentas ou de orçamento → o gestor cadastrado da pessoa (perfis.gestor_id).
-- O gestor vê e atualiza a pendência. Cadastro do gestor de cada pessoa: perfis.gestor_id (a diretoria muda na tela Equipe).

alter table public.perfis add column if not exists gestor_id uuid references public.perfis (id) on delete set null;
alter table public.pendencias add column if not exists gestor uuid references public.perfis (id) on delete set null;
alter table public.pendencias add column if not exists gestor_nome text;
create index if not exists pendencias_gestor on public.pendencias (gestor);

create or replace function public.gestor_da_pendencia(resp uuid, obra_p text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare f text; g uuid;
begin
  if resp is null then return null; end if;
  select funcao, gestor_id into f, g from public.perfis where id = resp;
  if f = 'estagiario' and obra_p is not null then
    select id into g from public.perfis where funcao = 'gestor_obra' and ativo and obra_p = any (obras) order by nome limit 1;
    if g is not null then return g; end if;
    select gestor_id into g from public.perfis where id = resp;
    return g;
  end if;
  if f in ('estagiario', 'estagiario_compras', 'orc_terceirizado') then return g; end if;
  return null;
end $$;

create or replace function public.pendencia_define_gestor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.responsavel is distinct from old.responsavel or new.obra is distinct from old.obra then
    new.gestor := public.gestor_da_pendencia(new.responsavel, new.obra);
    new.gestor_nome := (select nome from public.perfis where id = new.gestor);
  end if;
  return new;
end $$;
drop trigger if exists pend_gestor on public.pendencias;
create trigger pend_gestor before insert or update of responsavel, obra on public.pendencias for each row execute function public.pendencia_define_gestor();
revoke execute on function public.gestor_da_pendencia(uuid, text), public.pendencia_define_gestor() from public, anon, authenticated;

-- o gestor lê e atualiza a pendência (e lê a ata de onde ela veio)
alter policy pend_ler on public.pendencias using (liberado() and (ve_tudo_de_atas() or responsavel = auth.uid() or gestor = auth.uid() or criado_por = auth.uid()
  or (obra is not null and obra = any (minhas_obras())) or (not funcao_de_obra() and setor is not null and setor = any (meus_departamentos()))));
alter policy pend_editar on public.pendencias using (responsavel = auth.uid() or gestor = auth.uid() or criado_por = auth.uid() or eh_diretoria())
  with check (responsavel = auth.uid() or gestor = auth.uid() or criado_por = auth.uid() or eh_diretoria());
alter policy atas_ler on public.atas using (liberado() and (ve_tudo_de_atas() or criado_por = auth.uid() or (obra is not null and obra = any (minhas_obras()))
  or (not funcao_de_obra() and setor is not null and setor = any (meus_departamentos()))
  or exists (select 1 from public.pendencias p where p.ata_id = atas.id and (p.responsavel = auth.uid() or p.gestor = auth.uid()))));

-- gestores já conhecidos: Pedro (galpão) → Felipe Paiva (ferramentas); Julia (orçamento terceirizado) → Mariana C. (planejamento)
update public.perfis set gestor_id = (select id from public.perfis where funcao = 'ferramentas' limit 1) where funcao = 'estagiario_compras' and gestor_id is null;
update public.perfis set gestor_id = (select id from public.perfis where funcao = 'planejamento' limit 1) where nome = 'Julia' and funcao = 'orc_terceirizado' and gestor_id is null;
-- pendências que já existem
update public.pendencias set gestor = public.gestor_da_pendencia(responsavel, obra) where responsavel is not null and gestor is null;
update public.pendencias p set gestor_nome = (select nome from public.perfis where id = p.gestor) where gestor is not null;

-- tela Acessos: ao mudar o gestor de alguém ou as obras de um gestor, a diretoria recalcula os gestores das pendências abertas
create or replace function public.recalcular_gestores() returns void language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.eh_diretoria(), false) then raise exception 'Só a diretoria'; end if;
  update public.pendencias p set gestor = public.gestor_da_pendencia(p.responsavel, p.obra) where p.responsavel is not null and p.status = 'aberta';
  update public.pendencias p set gestor_nome = (select nome from public.perfis where id = p.gestor) where p.status = 'aberta';
end $$;
revoke execute on function public.recalcular_gestores() from public, anon;
grant execute on function public.recalcular_gestores() to authenticated;
