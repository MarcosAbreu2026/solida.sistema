-- Quem vê cada tarefa (pendência). Pedido do Marcos/Felipe, 06/11/2026: "eu só tenho que ver a tarefa que é minha ou de quem eu sou responsável".
-- Vê a tarefa: o responsável; quem responde por ele (pendencias.gestores, deduzidos por obra e setor, ver 07-gestor-pendencia.sql);
-- quem criou; o gestor de obra / pós-obra para as tarefas da obra dele; a coordenação de operações para os setores dela; sócio,
-- administrativo e o coletor veem tudo. Antes, qualquer função que não fosse de obra via TODAS as tarefas dos setores da função
-- (a de Ferramentas via Operação, Transporte, Suprimentos e Pós-obra inteiros).
-- Já aplicado no Supabase em 06/11/2026 (migração "tarefas_so_do_responsavel_e_de_quem_ele_responde").

alter policy pend_ler on public.pendencias using (
  liberado() and (
    ve_tudo_de_atas()
    or responsavel = auth.uid()
    or auth.uid() = any (gestores)
    or criado_por = auth.uid()
    or (obra is not null and obra = any (minhas_obras()) and minha_funcao() in ('gestor_obra', 'posobra'))
    or (minha_funcao() = 'coord_operacoes' and setor is not null and setor = any (meus_departamentos()))
  )
);
