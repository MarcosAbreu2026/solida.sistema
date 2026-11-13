-- Caixinha BeeVale (POP ADM 11.11) — etapas 1 e 2: base, cartões, importação do relatório e log.
-- Quem vê: administrativo (ADM), sócio (CEO) e financeiro. Quem grava: só o administrativo (a diretoria e o financeiro consultam e aprovam).
-- Gastos (tabela cx_gastos) só recebem GASTOS; recargas e transferências do relatório são contadas e descartadas na importação.
-- A recarga, a conferência com o Mais Controle e as pendências entram nas próximas etapas (tabelas cx_recargas, cx_lancamentos_mc etc.).
-- Rodar no Supabase > SQL Editor do projeto usado pelo sistema (o endereço está em app/js/nuvem.js).

create or replace function public.ve_caixinha() returns boolean language sql stable security definer set search_path = public as
  $$ select coalesce(public.minha_funcao() in ('socio', 'administrativo', 'financeiro'), false) $$;
create or replace function public.edita_caixinha() returns boolean language sql stable security definer set search_path = public as
  $$ select coalesce(public.minha_funcao() = 'administrativo', false) $$;
revoke execute on function public.ve_caixinha(), public.edita_caixinha() from public, anon;
grant execute on function public.ve_caixinha(), public.edita_caixinha() to authenticated;

-- data e usuário da última alteração, gravados sozinhos (regra do POP: "registrar sempre a data da última alteração")
create or replace function public.cx_toca() returns trigger language plpgsql security definer set search_path = public as $$
begin new.atualizado_em := now(); new.atualizado_por := auth.uid(); return new; end $$;

create table if not exists public.cx_cartoes (
  id bigint generated always as identity primary key,
  identificacao text not null unique check (length(btrim(identificacao)) > 0),
  nome_beevale text not null default '',                       -- nome do responsável como aparece no site do BeeVale (texto livre)
  usuario uuid references public.perfis (id) on delete set null, -- usuário do sistema a quem as pendências vão
  vinculo_confirmado boolean not null default false,           -- só o ADM confirma; nunca por semelhança de nome
  saldo numeric(14,2),
  saldo_em date,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create table if not exists public.cx_importacoes (
  id bigint generated always as identity primary key,
  cartao bigint not null references public.cx_cartoes (id) on delete cascade,
  periodo_ini date not null,
  periodo_fim date not null,
  arquivo text not null default '',
  hash_arquivo text not null,
  qtd_gastos int not null default 0,
  qtd_recargas int not null default 0,
  qtd_transferencias int not null default 0,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (cartao, periodo_ini, periodo_fim),                   -- mesma importação (cartão + período) não entra duas vezes
  unique (hash_arquivo)
);
create table if not exists public.cx_gastos (
  id bigint generated always as identity primary key,
  cartao bigint not null references public.cx_cartoes (id) on delete cascade,
  importacao bigint references public.cx_importacoes (id) on delete cascade,
  data date not null,
  valor numeric(14,2) not null check (valor >= 0),
  estabelecimento text not null default '',
  linha_hash text not null unique,                             -- evita gasto em dobro quando os períodos se sobrepõem
  linha_origem int,                                            -- linha do arquivo
  status text not null default 'pendente',                     -- pendente · conferido · divergente (etapas seguintes)
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create index if not exists cx_gastos_cartao_data on public.cx_gastos (cartao, data desc);
create table if not exists public.cx_config (
  chave text primary key,                                      -- ex.: mapeamento (colunas do Excel do BeeVale)
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
create table if not exists public.cx_log (
  id bigint generated always as identity primary key,
  usuario uuid default auth.uid(),
  usuario_nome text not null default '',
  acao text not null,
  detalhe jsonb,
  em timestamptz not null default now()
);

drop trigger if exists cx_cartoes_toca on public.cx_cartoes;
create trigger cx_cartoes_toca before insert or update on public.cx_cartoes for each row execute function public.cx_toca();
drop trigger if exists cx_gastos_toca on public.cx_gastos;
create trigger cx_gastos_toca before insert or update on public.cx_gastos for each row execute function public.cx_toca();
drop trigger if exists cx_config_toca on public.cx_config;
create trigger cx_config_toca before insert or update on public.cx_config for each row execute function public.cx_toca();

alter table public.cx_cartoes enable row level security;
alter table public.cx_importacoes enable row level security;
alter table public.cx_gastos enable row level security;
alter table public.cx_config enable row level security;
alter table public.cx_log enable row level security;

do $$
declare t text;
begin
  foreach t in array array['cx_cartoes', 'cx_importacoes', 'cx_gastos', 'cx_config'] loop
    execute format('drop policy if exists %I on public.%I', t || '_ler', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.ve_caixinha())', t || '_ler', t);
    execute format('drop policy if exists %I on public.%I', t || '_criar', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.edita_caixinha())', t || '_criar', t);
    execute format('drop policy if exists %I on public.%I', t || '_alterar', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.edita_caixinha()) with check (public.edita_caixinha())', t || '_alterar', t);
    execute format('drop policy if exists %I on public.%I', t || '_apagar', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.edita_caixinha())', t || '_apagar', t);
  end loop;
end $$;

-- log: qualquer um que vê a Caixinha registra a própria ação; ninguém altera nem apaga
drop policy if exists cx_log_ler on public.cx_log;
create policy cx_log_ler on public.cx_log for select to authenticated using (public.ve_caixinha());
drop policy if exists cx_log_criar on public.cx_log;
create policy cx_log_criar on public.cx_log for insert to authenticated with check (public.ve_caixinha() and usuario = auth.uid());
