-- Observadores e hierarquia das tarefas (pedido do Felipe, 10/11/2026):
-- 1) cada tarefa pode ter uma ou mais pessoas como OBSERVADORAS (pendencias.observadores): elas veem a tarefa (e anotam no chat), sem editar;
-- 2) quem é de um cargo abaixo não vê as tarefas do cargo acima, a não ser que seja observador: o gestor de obra / pós-obra não vê mais as tarefas
--    da obra que são de coordenação, diretoria etc.; a coordenação de operações não vê as da diretoria. O superior continua vendo as dos subordinados
--    (gestores, ver 07-gestor-pendencia.sql). Já aplicado no Supabase em 10/11/2026.
alter table public.pendencias add column if not exists observadores uuid[] not null default '{}';
create index if not exists pendencias_observadores on public.pendencias using gin (observadores);
create or replace function public.funcao_do(u uuid) returns text language sql stable security definer set search_path = public as $$ select funcao from public.perfis where id = u $$;
alter policy pend_ler on public.pendencias using (
  liberado() and (
    ve_tudo_de_atas()
    or responsavel = auth.uid()
    or auth.uid() = any (gestores)
    or auth.uid() = any (observadores)
    or criado_por = auth.uid()
    or (obra is not null and obra = any (minhas_obras()) and minha_funcao() in ('gestor_obra', 'posobra')
        and (responsavel is null or funcao_do(responsavel) in ('estagiario', 'encarregado', 'ajudante', 'gestor_obra', 'posobra', 'executor_ferramentas', 'estagiario_compras', 'orc_terceirizado')))
    or (minha_funcao() = 'coord_operacoes' and setor is not null and setor = any (meus_departamentos()) and (responsavel is null or funcao_do(responsavel) <> 'socio'))
  )
);
