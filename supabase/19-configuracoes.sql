-- Configurações (pedido do Felipe, 11/11/2026): uma página Configurações, com uma seção por aba, onde a diretoria define quem vê cada aba, quem vê cada
-- bloco dentro da aba e opções como "ver atas só do próprio departamento ou de todos". Tudo guardado na tabela configuracoes (chave -> valor jsonb):
--   pagina.<id>                  lista de funções que veem a aba (sem a chave = padrão do código)
--   secao.<pagina>.<bloco>       lista de funções que veem o bloco dentro da aba
--   opcao.atas.escopo_todos      funções que veem as atas de todos os departamentos (as demais só as do próprio departamento)
-- Ler: qualquer pessoa liberada. Gravar: diretoria. Já aplicado no Supabase em 11/11/2026.
create table if not exists public.configuracoes (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
alter table public.configuracoes enable row level security;
drop policy if exists config_ler on public.configuracoes;
create policy config_ler on public.configuracoes for select to authenticated using (public.liberado());
drop policy if exists config_criar on public.configuracoes;
create policy config_criar on public.configuracoes for insert to authenticated with check (public.eh_diretoria());
drop policy if exists config_alterar on public.configuracoes;
create policy config_alterar on public.configuracoes for update to authenticated using (public.eh_diretoria()) with check (public.eh_diretoria());
drop policy if exists config_apagar on public.configuracoes;
create policy config_apagar on public.configuracoes for delete to authenticated using (public.eh_diretoria());
create or replace function public.ve_atas_de_todos() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select valor ? public.minha_funcao() from public.configuracoes where chave = 'opcao.atas.escopo_todos'), false)
$$;
alter policy atas_ler on public.atas using (
  liberado() and (
    ve_tudo_de_atas()
    or ve_atas_de_todos()
    or criado_por = auth.uid()
    or (obra is not null and obra = any (minhas_obras()))
    or (not funcao_de_obra() and setor is not null and setor = any (meus_departamentos()))
  )
);
