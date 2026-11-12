-- Obras "em orçamento": criadas pelo setor ORC Obras Novas (Isabel e Leandro); só esse setor e a diretoria veem e gravam.
-- Já aplicado no Supabase em 12/11/2026.
alter table public.obras_cadastro drop constraint if exists obras_cadastro_situacao_check;
alter table public.obras_cadastro add constraint obras_cadastro_situacao_check check (situacao in ('andamento', 'pausada', 'finalizada', 'orcamento'));

create or replace function public.pode_orcamento_obras() returns boolean
language sql stable security definer set search_path to 'public'
as $$ select coalesce(public.eh_diretoria() or 'ORC Obras Novas' = any (coalesce((select setores from public.perfis where id = auth.uid()), '{}')), false) $$;

drop policy if exists obras_cadastro_ler on public.obras_cadastro;
create policy obras_cadastro_ler on public.obras_cadastro for select to authenticated
  using (public.liberado() and (situacao <> 'orcamento' or public.pode_orcamento_obras()));

drop policy if exists obras_cadastro_gravar on public.obras_cadastro;
create policy obras_cadastro_gravar on public.obras_cadastro for all
  using ((public.pode_mudar_obra() and situacao <> 'orcamento') or public.eh_diretoria())
  with check (public.pode_mudar_obra());

drop policy if exists obras_orcamento_gravar on public.obras_cadastro;
create policy obras_orcamento_gravar on public.obras_cadastro for all
  using (situacao = 'orcamento' and public.pode_orcamento_obras())
  with check (situacao = 'orcamento' and public.pode_orcamento_obras());

update public.perfis set setores = array_append(setores, 'ORC Obras Novas') where id = '5cf794ce-30ac-4271-8990-8b36cef1a693' and not ('ORC Obras Novas' = any (setores));
