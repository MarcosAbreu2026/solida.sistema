-- Função da tarefa (pedido do Felipe, 10/11/2026): cada tarefa (pendência) pode ser ligada a uma função do quadro de funções da pessoa
-- (ex.: "Compatibilizações"). Na Agenda, o card da função tem uma bolinha por dia da semana que fica verde quando a tarefa daquele dia é concluída.
-- Já aplicado no Supabase em 10/11/2026.
alter table public.pendencias add column if not exists funcao_tarefa text;
