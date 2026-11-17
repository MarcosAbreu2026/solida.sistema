-- Reuniões (17/11/2026): criadas e editadas no sistema; o computador do escritório leva cada uma para o Google Agenda do sistema (gcal_sync: pendente · ok · erro).
create table if not exists public.reunioes (
  id bigint generated always as identity primary key,
  nome text not null,
  titulo text not null,
  obra text,
  setor text,
  data date not null,
  ini text not null,
  fim text not null,
  local text,
  convidados uuid[] not null default '{}',
  emails_externos text[] not null default '{}',
  recorrente boolean not null default false,
  frequencia text,
  serie text,
  cancelada boolean not null default false,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  gcal_event_id text,
  gcal_sync text not null default 'pendente',
  gcal_erro text,
  gcal_sync_em timestamptz
);
create index if not exists reunioes_data_idx on public.reunioes (data);
alter table public.reunioes enable row level security;
create policy reun_ler on public.reunioes for select to authenticated using (
  public.liberado() and (criado_por = auth.uid() or auth.uid() = any (convidados) or public.eh_diretoria() or public.minha_funcao() = 'coletor'));
create policy reun_criar on public.reunioes for insert to authenticated with check (public.liberado() and criado_por = auth.uid());
create policy reun_editar on public.reunioes for update to authenticated using (
  public.liberado() and (criado_por = auth.uid() or auth.uid() = any (convidados) or public.eh_diretoria() or public.minha_funcao() = 'coletor'))
  with check (public.liberado());
create policy reun_apagar on public.reunioes for delete to authenticated using (
  public.liberado() and (criado_por = auth.uid() or auth.uid() = any (convidados) or public.eh_diretoria()));
