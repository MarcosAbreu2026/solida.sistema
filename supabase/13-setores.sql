-- Setores/departamentos cadastráveis (pedido do Felipe, 10/11/2026): o que a diretoria cria ou exclui aparece em todas as telas
-- (atas, pendências, tarefas, acessos…). Ler: qualquer pessoa liberada. Criar/alterar/excluir: diretoria.
create table if not exists public.setores (
  nome text primary key check (length(btrim(nome)) > 0),
  ordem int not null default 100,
  criado_em timestamptz not null default now()
);
alter table public.setores enable row level security;
drop policy if exists setores_ler on public.setores;
create policy setores_ler on public.setores for select to authenticated using (public.liberado());
drop policy if exists setores_criar on public.setores;
create policy setores_criar on public.setores for insert to authenticated with check (public.eh_diretoria());
drop policy if exists setores_alterar on public.setores;
create policy setores_alterar on public.setores for update to authenticated using (public.eh_diretoria()) with check (public.eh_diretoria());
drop policy if exists setores_apagar on public.setores;
create policy setores_apagar on public.setores for delete to authenticated using (public.eh_diretoria());
insert into public.setores (nome, ordem) values
 ('Operação',1),('Pós-obra',2),('Técnico / qualidade',3),('Suprimentos e compras',4),('Transporte e logística',5),('Ferramentas / EPI',6),('Projetos',7),
 ('Planejamento',8),('Comercial',9),('Orçamentos',10),('Marketing',11),('Novos negócios',12),('Financeiro',13),('RH',14),('Administrativo',15)
on conflict (nome) do nothing;
