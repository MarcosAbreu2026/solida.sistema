-- Cargo da tarefa (pedido do Marcos, 19/11/2026): associa a tarefa a um cargo (id da função) para ver as tarefas de cada cargo.
alter table public.pendencias add column if not exists cargo text;
