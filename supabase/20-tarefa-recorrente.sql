-- Tarefa recorrente: cada ocorrência é uma linha; as da mesma série compartilham 'serie'. recorrente=false encerra a renovação automática.
alter table public.pendencias add column if not exists serie text, add column if not exists recorrente boolean not null default false;
create index if not exists pendencias_serie_idx on public.pendencias (serie) where serie is not null;
alter table public.pendencias add column if not exists frequencia text not null default 'semanal';
