-- Executor da tarefa (pedido do Marcos, 19/11/2026): além do responsável, quem executa. Texto livre: nome de alguém da empresa (lista) ou de outra
-- pessoa; vazio = nenhum executor. Já aplicado no Supabase em 19/11/2026.
alter table public.pendencias add column if not exists executor text;
-- tarefas já existentes: o executor é o mesmo nome do responsável (sem responsável, fica sem executor)
update public.pendencias set executor = btrim(responsavel_nome) where executor is null and responsavel_nome is not null and btrim(responsavel_nome) <> '';
