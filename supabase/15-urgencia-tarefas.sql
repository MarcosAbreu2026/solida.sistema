-- Urgência da tarefa (pedido do Felipe, 10/11/2026): alta, média ou baixa. Usada no modo Lista das Tarefas. Já aplicado no Supabase em 10/11/2026.
alter table public.pendencias add column if not exists urgencia text check (urgencia in ('alta', 'media', 'baixa'));
