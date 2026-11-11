-- Horário da tarefa na Agenda (pedido do Felipe, 11/11/2026): a Agenda deixa de mostrar as funções nos horários e passa a mostrar as TAREFAS
-- como cartões na grade do dia, no horário (hora, 'HH:MM') e pelo tempo (duracao, minutos) que a pessoa definir. Já aplicado no Supabase em 11/11/2026.
alter table public.pendencias add column if not exists hora text;
alter table public.pendencias add column if not exists duracao integer;
