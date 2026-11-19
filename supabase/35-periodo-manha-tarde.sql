-- Período do funcionário na obra (pedido do Marcos, 19/11/2026): dia inteiro, manhã ou tarde, em vez de 'meio dia'.
alter table public.agenda_pos add column if not exists periodo text not null default 'dia' check (periodo in ('dia','manha','tarde'));
alter table public.alocacao_obras add column if not exists periodo text not null default 'dia' check (periodo in ('dia','manha','tarde'));
