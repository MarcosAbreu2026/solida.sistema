-- Sistema Sólida no Supabase — rodar uma vez no SQL Editor do projeto.
-- Logins por usuário e senha, criados pelos sócios (ver 02-login-por-usuario.sql).
-- definir a função (tela Equipe). O que cada função vê segue app/js/funcoes.js; valores só para quem "vê valores".

-- ---------------------------------------------------------------- perfis (um por pessoa)
create table if not exists public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  nome text not null default '',
  funcao text,                         -- null = aguardando liberação da diretoria
  obras text[] not null default '{}',  -- obras que acompanha (funções de obra)
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- funções que veem valores (faturamento, lucro, diárias): sócio e financeiro
create or replace function public.minha_funcao() returns text language sql stable security definer set search_path = public as
  $$ select funcao from public.perfis where id = auth.uid() and ativo $$;
create or replace function public.eh_diretoria() returns boolean language sql stable security definer set search_path = public as
  $$ select coalesce(public.minha_funcao() = 'socio', false) $$;
create or replace function public.ve_valores() returns boolean language sql stable security definer set search_path = public as
  $$ select coalesce(public.minha_funcao() in ('socio', 'financeiro'), false) $$;
create or replace function public.minhas_obras() returns text[] language sql stable security definer set search_path = public as
  $$ select obras from public.perfis where id = auth.uid() $$;
create or replace function public.liberado() returns boolean language sql stable security definer set search_path = public as
  $$ select public.minha_funcao() is not null $$;

-- conta nova: só @construcaosolida.com (antes de criar); depois, cria o perfil sem função
create or replace function public.nova_conta() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) not like '%@construcaosolida.com' then
    raise exception 'Use o seu e-mail @construcaosolida.com';
  end if;
  return new;
end $$;
create or replace function public.criar_perfil() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, email, nome) values (new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)))
    on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_conta on auth.users;
create trigger ao_criar_conta before insert on auth.users for each row execute function public.nova_conta();
drop trigger if exists depois_criar_conta on auth.users;
create trigger depois_criar_conta after insert on auth.users for each row execute function public.criar_perfil();

-- funções de gatilho ninguém chama pela API; as das regras, só quem está logado
revoke execute on function public.nova_conta() from public, anon, authenticated;
revoke execute on function public.criar_perfil() from public, anon, authenticated;
revoke execute on function public.minha_funcao(), public.eh_diretoria(), public.ve_valores(), public.minhas_obras(), public.liberado() from public, anon;
grant execute on function public.minha_funcao(), public.eh_diretoria(), public.ve_valores(), public.minhas_obras(), public.liberado() to authenticated;

alter table public.perfis enable row level security;
drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select using (auth.uid() = id or public.liberado());
drop policy if exists perfis_diretoria on public.perfis;
create policy perfis_diretoria on public.perfis for update using (public.eh_diretoria());
drop policy if exists perfis_proprio_nome on public.perfis;
-- a própria pessoa só muda o nome (função e obras quem muda é a diretoria)
create policy perfis_proprio_nome on public.perfis for update using (auth.uid() = id)
  with check (auth.uid() = id and funcao is not distinct from public.minha_funcao() and obras = public.minhas_obras());

-- ---------------------------------------------------------------- tarefas da semana (feito / não feito)
create table if not exists public.tarefas_marcadas (
  pessoa uuid not null references public.perfis (id) on delete cascade,
  data date not null,
  tarefa text not null,
  valor text not null check (valor in ('feito', 'nao')),
  em timestamptz not null default now(),
  primary key (pessoa, data, tarefa)
);
alter table public.tarefas_marcadas enable row level security;
drop policy if exists tm_ler on public.tarefas_marcadas;
create policy tm_ler on public.tarefas_marcadas for select using (pessoa = auth.uid() or public.eh_diretoria());
drop policy if exists tm_escrever on public.tarefas_marcadas;
create policy tm_escrever on public.tarefas_marcadas for all using (pessoa = auth.uid()) with check (pessoa = auth.uid() and public.liberado());

-- ---------------------------------------------------------------- feed
create table if not exists public.feed_posts (
  id bigint generated always as identity primary key,
  autor uuid not null references public.perfis (id) on delete cascade,
  texto text not null check (length(texto) between 1 and 3000),
  fixado boolean not null default false,
  criado_em timestamptz not null default now()
);
create table if not exists public.feed_comentarios (
  id bigint generated always as identity primary key,
  post bigint not null references public.feed_posts (id) on delete cascade,
  autor uuid not null references public.perfis (id) on delete cascade,
  texto text not null check (length(texto) between 1 and 3000),
  criado_em timestamptz not null default now()
);
create table if not exists public.feed_curtidas (
  post bigint not null references public.feed_posts (id) on delete cascade,
  pessoa uuid not null references public.perfis (id) on delete cascade,
  primary key (post, pessoa)
);
alter table public.feed_posts enable row level security;
alter table public.feed_comentarios enable row level security;
alter table public.feed_curtidas enable row level security;
drop policy if exists fp_ler on public.feed_posts;           create policy fp_ler on public.feed_posts for select using (public.liberado());
drop policy if exists fp_criar on public.feed_posts;         create policy fp_criar on public.feed_posts for insert with check (autor = auth.uid() and public.liberado() and (not fixado or public.eh_diretoria()));
drop policy if exists fp_fixar on public.feed_posts;         create policy fp_fixar on public.feed_posts for update using (public.eh_diretoria());
drop policy if exists fp_apagar on public.feed_posts;        create policy fp_apagar on public.feed_posts for delete using (autor = auth.uid() or public.eh_diretoria());
drop policy if exists fc_ler on public.feed_comentarios;     create policy fc_ler on public.feed_comentarios for select using (public.liberado());
drop policy if exists fc_criar on public.feed_comentarios;   create policy fc_criar on public.feed_comentarios for insert with check (autor = auth.uid() and public.liberado());
drop policy if exists fc_apagar on public.feed_comentarios;  create policy fc_apagar on public.feed_comentarios for delete using (autor = auth.uid() or public.eh_diretoria());
drop policy if exists fk_ler on public.feed_curtidas;        create policy fk_ler on public.feed_curtidas for select using (public.liberado());
drop policy if exists fk_mexer on public.feed_curtidas;      create policy fk_mexer on public.feed_curtidas for all using (pessoa = auth.uid()) with check (pessoa = auth.uid() and public.liberado());

-- ---------------------------------------------------------------- pedidos de alteração
create table if not exists public.pedidos (
  id bigint generated always as identity primary key,
  autor uuid not null references public.perfis (id) on delete cascade,
  tela text not null default '',
  titulo text not null default '',
  texto text not null check (length(texto) between 1 and 4000),
  status text not null default 'aprovacao' check (status in ('aprovacao', 'aberto', 'fazendo', 'feito', 'recusado')),
  resposta text not null default '',
  aprovado_por uuid references public.perfis (id),
  criado_em timestamptz not null default now()
);
alter table public.pedidos enable row level security;
drop policy if exists pd_ler on public.pedidos;      create policy pd_ler on public.pedidos for select using (autor = auth.uid() or public.eh_diretoria());
-- pedido da diretoria já entra aprovado ("aberto"); os outros entram "aprovacao"
drop policy if exists pd_criar on public.pedidos;    create policy pd_criar on public.pedidos for insert with check (autor = auth.uid() and public.liberado() and (status = 'aprovacao' or (status = 'aberto' and public.eh_diretoria())));
drop policy if exists pd_decidir on public.pedidos;  create policy pd_decidir on public.pedidos for update using (public.eh_diretoria());

-- ---------------------------------------------------------------- lançamentos de produtividade feitos no sistema
create table if not exists public.lancamentos (
  obra text not null,
  data date not null,
  item text not null,
  dados jsonb not null,             -- { feito, motivo, por }
  pessoa uuid references public.perfis (id),
  em timestamptz not null default now(),
  primary key (obra, data, item)
);
alter table public.lancamentos enable row level security;
drop policy if exists lc_ler on public.lancamentos;      create policy lc_ler on public.lancamentos for select using (public.liberado());
drop policy if exists lc_escrever on public.lancamentos; create policy lc_escrever on public.lancamentos for all using (public.liberado()) with check (public.liberado());

-- ---------------------------------------------------------------- arquivos
-- fotos: foto de perfil de cada um (pasta = id da pessoa); dados: o que o coletor (computador do escritório)
-- lê do Drive e manda a cada 10 min. Pastas de "dados": todos/ (todo mundo liberado), valores/ (só quem vê valores).
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('dados', 'dados', false) on conflict (id) do nothing;

drop policy if exists fotos_ler on storage.objects;
create policy fotos_ler on storage.objects for select using (bucket_id = 'fotos' and public.liberado());
drop policy if exists fotos_minha on storage.objects;
create policy fotos_minha on storage.objects for all using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists dados_todos on storage.objects;
create policy dados_todos on storage.objects for select using (bucket_id = 'dados' and (storage.foldername(name))[1] = 'todos' and public.liberado());
drop policy if exists dados_valores on storage.objects;
create policy dados_valores on storage.objects for select using (bucket_id = 'dados' and (storage.foldername(name))[1] = 'valores' and public.ve_valores());
-- (o coletor grava com a chave de serviço, que passa por cima destas regras; ela fica só no computador do escritório)

-- ---------------------------------------------------------------- primeiro acesso
-- Depois que o Felipe criar a conta no sistema, rodar (troca o e-mail se for outro):
--   update public.perfis set funcao = 'socio', nome = 'Felipe' where email = 'felipe@construcaosolida.com';
