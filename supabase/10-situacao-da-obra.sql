-- Situação da obra (andamento · pausada · finalizada) no topo da página de cada obra.
-- Todos leem (obras_cadastro_ler); só gravam sócios (Marcos, Márcio, Felipe) e a coordenação de operações (Simone).
-- Já aplicado no Supabase em 05/11/2026 (migração "situacao_da_obra_socio_e_coordenacao").

create or replace function public.pode_mudar_obra() returns boolean
language sql stable security definer set search_path to 'public'
as $$ select coalesce(public.minha_funcao() in ('socio', 'coord_operacoes'), false) $$;

drop policy if exists obras_cadastro_gravar on public.obras_cadastro;
create policy obras_cadastro_gravar on public.obras_cadastro for all
  using (public.pode_mudar_obra()) with check (public.pode_mudar_obra());

-- Mo465 parada e Mo344 ainda em andamento (ajuste pedido em 05/11/2026)
update public.obras_cadastro set situacao = 'pausada', atualizado_em = now() where codigo = 'Mo465';
update public.obras_cadastro set situacao = 'andamento', atualizado_em = now() where codigo = 'Mo344';
