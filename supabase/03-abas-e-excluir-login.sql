-- Abas por função e exclusão de login (migração "abas_por_funcao_e_excluir_login", aplicada em 16/10/2026)
-- funcao_abas(funcao, abas[]): a diretoria escolhe as abas de cada função em Acessos; sem linha = padrão do código (funcoes.js).
-- excluir_login(id): só diretoria; não exclui a si mesma, o coletor nem a última pessoa da diretoria; apaga o login
-- (os dados da pessoa saem junto por cascata) e solta as referências de pedidos e lançamentos.
create table if not exists public.funcao_abas (
  funcao text primary key,
  abas text[] not null default '{}',
  atualizado_em timestamptz not null default now()
);
alter table public.funcao_abas enable row level security;
create policy funcao_abas_ler on public.funcao_abas for select to authenticated using (true);
create policy funcao_abas_gravar on public.funcao_abas for all to authenticated using (public.eh_diretoria()) with check (public.eh_diretoria());
-- função public.excluir_login(p_id uuid): código completo na migração do painel do Supabase › Database › Migrations
