-- Quadro de OS do pós-obra (pedido do Felipe, 09/11/2026): cada cartão é uma OS (PO tal + assunto) e anda pelas colunas
-- Solicitação > Análise > Orçamento > Falta agendar > Agendado > Em execução > Concluído. Cada coluna tem a sua data (quadro de datas).
-- Nas colunas em andamento a OS tem responsável e data limite, e isso vira pendência dele (tabela pendencias, origem 'os_quadro').
-- Ler: qualquer pessoa liberada. Criar/alterar/apagar: diretoria, pós-obra e coordenação de operações.

create table if not exists public.os_quadro (
  id bigint generated always as identity primary key,
  codigo text not null default '',
  cliente text not null,
  assunto text not null default '',
  status text not null default 'solicitacao' check (status in ('solicitacao','analise','orcamento','falta_agendar','agendado','execucao','concluido')),
  problema text,
  solucao text,
  fotos text[] not null default '{}',
  responsavel uuid references public.perfis (id) on delete set null,
  responsavel_nome text,
  data_limite date,
  d_solicitacao date default current_date,
  d_analise date, d_orcamento date, d_agendamento date, d_execucao date, d_concluido date,
  pendencia_id bigint,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists os_quadro_status on public.os_quadro (status);
alter table public.os_quadro enable row level security;

create or replace function public.os_quadro_edita() returns boolean language sql stable security definer set search_path = public as $$
  select public.liberado() and (public.eh_diretoria() or coalesce(public.minha_funcao() in ('posobra','coord_operacoes'), false)) $$;

drop policy if exists osq_ler on public.os_quadro;
create policy osq_ler on public.os_quadro for select to authenticated using (public.liberado());
drop policy if exists osq_criar on public.os_quadro;
create policy osq_criar on public.os_quadro for insert to authenticated with check (public.os_quadro_edita());
drop policy if exists osq_alterar on public.os_quadro;
create policy osq_alterar on public.os_quadro for update to authenticated using (public.os_quadro_edita()) with check (public.os_quadro_edita());
drop policy if exists osq_apagar on public.os_quadro;
create policy osq_apagar on public.os_quadro for delete to authenticated using (public.os_quadro_edita());

-- código OS-001… automático; data da coluna preenchida ao entrar nela (se ainda vazia); pendência do responsável
create or replace function public.os_quadro_antes() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.codigo, '') = '' then new.codigo := 'OS-' || lpad(new.id::text, 3, '0'); end if;
  new.atualizado_em := now();
  if new.status = 'solicitacao' and new.d_solicitacao is null then new.d_solicitacao := current_date; end if;
  if new.status = 'analise' and new.d_analise is null then new.d_analise := current_date; end if;
  if new.status = 'orcamento' and new.d_orcamento is null then new.d_orcamento := current_date; end if;
  if new.status = 'agendado' and new.d_agendamento is null then new.d_agendamento := current_date; end if;
  if new.status = 'execucao' and new.d_execucao is null then new.d_execucao := current_date; end if;
  if new.status = 'concluido' and new.d_concluido is null then new.d_concluido := current_date; end if;
  if new.responsavel is not null then new.responsavel_nome := (select nome from public.perfis where id = new.responsavel); end if;
  return new;
end $$;
drop trigger if exists os_quadro_antes on public.os_quadro;
create trigger os_quadro_antes before insert or update on public.os_quadro for each row execute function public.os_quadro_antes();

create or replace function public.os_quadro_pendencia() returns trigger language plpgsql security definer set search_path = public as $$
declare pid bigint; rotulo text; texto text;
begin
  rotulo := case new.status when 'solicitacao' then 'Solicitação' when 'analise' then 'Análise' when 'orcamento' then 'Orçamento' when 'falta_agendar' then 'Falta agendar'
    when 'agendado' then 'Agendado' when 'execucao' then 'Em execução' else 'Concluído' end;
  texto := new.cliente || ', ' || coalesce(nullif(new.assunto, ''), new.codigo) || ' (' || new.codigo || ' · ' || rotulo || ')';
  pid := new.pendencia_id;
  if new.status = 'concluido' then
    if pid is not null then update public.pendencias set status = 'feita', concluida_em = now() where id = pid and status <> 'feita'; end if;
  elsif new.responsavel is not null or new.data_limite is not null then
    if pid is null then
      insert into public.pendencias (descricao, responsavel, responsavel_nome, responsavel_tipo, prazo, status, obra, os, origem, criado_por)
        values (texto, new.responsavel, new.responsavel_nome, 'solida', new.data_limite, 'aberta', new.cliente, new.codigo, 'os_quadro', coalesce(new.criado_por, auth.uid()))
        returning id into pid;
      update public.os_quadro set pendencia_id = pid where id = new.id;
    else
      update public.pendencias set descricao = texto, responsavel = new.responsavel, responsavel_nome = new.responsavel_nome, prazo = new.data_limite, obra = new.cliente, os = new.codigo,
        status = 'aberta', concluida_em = null where id = pid;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists os_quadro_pendencia on public.os_quadro;
create trigger os_quadro_pendencia after insert or update on public.os_quadro for each row execute function public.os_quadro_pendencia();

-- fotos das OS (bucket privado; o caminho é <id da OS>/<arquivo>)
insert into storage.buckets (id, name, public) values ('os-fotos', 'os-fotos', false) on conflict (id) do nothing;
drop policy if exists os_fotos_ler on storage.objects;
create policy os_fotos_ler on storage.objects for select to authenticated using (bucket_id = 'os-fotos' and public.liberado());
drop policy if exists os_fotos_gravar on storage.objects;
create policy os_fotos_gravar on storage.objects for insert to authenticated with check (bucket_id = 'os-fotos' and public.os_quadro_edita());
drop policy if exists os_fotos_apagar on storage.objects;
create policy os_fotos_apagar on storage.objects for delete to authenticated using (bucket_id = 'os-fotos' and public.os_quadro_edita());
