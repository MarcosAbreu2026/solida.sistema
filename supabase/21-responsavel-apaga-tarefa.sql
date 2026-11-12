-- Quem apaga uma tarefa: quem criou, o responsável ou a diretoria
alter policy pend_apagar on public.pendencias using (criado_por = auth.uid() or responsavel = auth.uid() or eh_diretoria());
