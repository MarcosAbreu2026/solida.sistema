-- Gestor do pós-obra (função posobra, ex.: Ênio) é o "administrativo" do pós-obra (pedido do Marcos, 19/11/2026):
-- vê, edita e apaga tudo do pós-obra: OS (já era), tarefas das OS e do PO, relatos e o cadastro dos POs.
create or replace function public.eh_gestor_posobra() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.minha_funcao() = 'posobra', false) $$;
create or replace function public.pend_e_posobra(p_setor text, p_os text, p_obra text) returns boolean language sql immutable as $$
  select coalesce(p_setor = 'Pós-obra' or p_os ilike 'OS-%' or p_obra ilike 'po%', false) $$;
drop policy if exists pend_ler_posobra on public.pendencias;
create policy pend_ler_posobra on public.pendencias for select to authenticated using (public.liberado() and public.eh_gestor_posobra() and public.pend_e_posobra(setor, os, obra));
drop policy if exists pend_editar_posobra on public.pendencias;
create policy pend_editar_posobra on public.pendencias for update to authenticated using (public.liberado() and public.eh_gestor_posobra() and public.pend_e_posobra(setor, os, obra)) with check (public.liberado() and public.eh_gestor_posobra() and public.pend_e_posobra(setor, os, obra));
drop policy if exists pend_apagar_posobra on public.pendencias;
create policy pend_apagar_posobra on public.pendencias for delete to authenticated using (public.liberado() and public.eh_gestor_posobra() and public.pend_e_posobra(setor, os, obra));
drop policy if exists notas_apagar_posobra on public.pendencias_notas;
create policy notas_apagar_posobra on public.pendencias_notas for delete to authenticated using (public.eh_gestor_posobra() and exists (select 1 from public.pendencias p where p.id = pendencias_notas.pendencia_id and public.pend_e_posobra(p.setor, p.os, p.obra)));
drop policy if exists obras_cadastro_posobra_ins on public.obras_cadastro;
create policy obras_cadastro_posobra_ins on public.obras_cadastro for insert to authenticated with check (public.eh_gestor_posobra() and tipo = 'pos');
drop policy if exists obras_cadastro_posobra_upd on public.obras_cadastro;
create policy obras_cadastro_posobra_upd on public.obras_cadastro for update to authenticated using (public.eh_gestor_posobra() and tipo = 'pos') with check (public.eh_gestor_posobra() and tipo = 'pos');
drop policy if exists obras_cadastro_posobra_del on public.obras_cadastro;
create policy obras_cadastro_posobra_del on public.obras_cadastro for delete to authenticated using (public.eh_gestor_posobra() and tipo = 'pos');
