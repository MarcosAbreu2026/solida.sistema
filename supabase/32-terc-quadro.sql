-- Cards (Kanban) do Orçamento Terceirizado Laranja (pedido do Marcos, 19/11/2026): cada card é um item a contratar/comprar
-- (ex.: "louças e metais") ligado a uma obra/projeto, e anda pelas colunas. As tarefas ficam DENTRO do card (tabela pendencias, coluna os = código TL-###).
-- Ler: qualquer pessoa liberada. Criar/alterar/apagar: diretoria, orçamento terceirizado, orçamento de obras novas, planejamento e coordenação de operações.

create table if not exists public.terc_quadro (
  id bigint generated always as identity primary key,
  codigo text not null default '',
  projeto text not null,
  titulo text not null default '',
  status text not null default 'solicitado' check (status in ('solicitado','cotacao','arq_aguardando','cliente_aguardando','pagamento_enviado','pagamento_aguardando','entrega_aguardando','ja_temos','concluido')),
  descricao text,
  fotos text[] not null default '{}',
  d_concluido date,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists terc_quadro_status on public.terc_quadro (status);
alter table public.terc_quadro enable row level security;

create or replace function public.terc_quadro_edita() returns boolean language sql stable security definer set search_path = public as $$
  select public.liberado() and (public.eh_diretoria() or coalesce(public.minha_funcao() in ('orc_terceirizado','orc_obras_novas','planejamento','coord_operacoes'), false)) $$;

drop policy if exists tq_ler on public.terc_quadro;
create policy tq_ler on public.terc_quadro for select to authenticated using (public.liberado());
drop policy if exists tq_criar on public.terc_quadro;
create policy tq_criar on public.terc_quadro for insert to authenticated with check (public.terc_quadro_edita());
drop policy if exists tq_alterar on public.terc_quadro;
create policy tq_alterar on public.terc_quadro for update to authenticated using (public.terc_quadro_edita()) with check (public.terc_quadro_edita());
drop policy if exists tq_apagar on public.terc_quadro;
create policy tq_apagar on public.terc_quadro for delete to authenticated using (public.terc_quadro_edita());

create or replace function public.terc_quadro_antes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.codigo, '') = '' then new.codigo := 'TL-' || lpad(new.id::text, 3, '0'); end if;
  new.atualizado_em := now();
  if new.status = 'concluido' and new.d_concluido is null then new.d_concluido := current_date; end if;
  if new.status <> 'concluido' then new.d_concluido := null; end if;
  return new;
end $$;
drop trigger if exists terc_quadro_antes on public.terc_quadro;
create trigger terc_quadro_antes before insert or update on public.terc_quadro for each row execute function public.terc_quadro_antes();

insert into storage.buckets (id, name, public) values ('terc-fotos', 'terc-fotos', false) on conflict (id) do nothing;
drop policy if exists terc_fotos_ler on storage.objects;
create policy terc_fotos_ler on storage.objects for select to authenticated using (bucket_id = 'terc-fotos' and public.liberado());
drop policy if exists terc_fotos_gravar on storage.objects;
create policy terc_fotos_gravar on storage.objects for insert to authenticated with check (bucket_id = 'terc-fotos' and public.terc_quadro_edita());
drop policy if exists terc_fotos_apagar on storage.objects;
create policy terc_fotos_apagar on storage.objects for delete to authenticated using (bucket_id = 'terc-fotos' and public.terc_quadro_edita());
