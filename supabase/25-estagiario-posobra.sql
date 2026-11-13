-- Função "Estagiário do pós-obra" (id estagiario_posobra), pedido do Marcos em 13/11/2026: o Pedro é estagiário do pós-obra, sob o Ênio (função posobra).
-- No código (app/js/funcoes.js) a função já existe e vê a aba Pós-Obra. Aqui fica o que o banco precisa:
--  1) quadro de OS do pós-obra: o estagiário do pós-obra também lança e move as OS (antes só diretoria, posobra e coord_operacoes);
--  2) gestor da tarefa: as tarefas dele passam a ter o gestor do pós-obra (Ênio) como "quem responde por ele", como já é com o estagiário de obra e o de compras.
-- Depois de rodar, na aba Acessos (diretoria) trocar a função do Pedro para "Estagiário do pós-obra" e conferir que o Ênio está como "Gestor do pós-obra".
-- Aplicar no Supabase (SQL Editor ou migração "estagiario_posobra"). Ainda NÃO aplicado: o conector do Supabase estava fora do ar em 13/11/2026.

create or replace function public.os_quadro_edita() returns boolean language sql stable security definer set search_path = public as $$
  select public.liberado() and (public.eh_diretoria() or coalesce(public.minha_funcao() in ('posobra','estagiario_posobra','coord_operacoes'), false)) $$;

create or replace function public.gestores_da_pendencia(resp uuid, obra_p text, setor_p text) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare f text; o text[]; s text[]; r uuid[] := '{}';
  nao_gestor text[] := array['estagiario','estagiario_compras','estagiario_posobra','orc_terceirizado','ajudante','encarregado','executor_ferramentas','coletor','socio'];
begin
  if resp is null then return '{}'; end if;
  select funcao, obras, setores into f, o, s from public.perfis where id = resp;
  if f not in ('estagiario', 'estagiario_compras', 'estagiario_posobra', 'orc_terceirizado') then return '{}'; end if;
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
    elsif f = 'estagiario_posobra' then select coalesce(array_agg(id order by nome), '{}') into r from public.perfis where funcao = 'posobra' and ativo;
    end if;
  end if;
  return coalesce(r, '{}');
end $$;
