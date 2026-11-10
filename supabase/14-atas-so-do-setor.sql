-- Atas só do setor (pedido do Felipe, 10/11/2026): só quem é do setor da ata (marcado em Acessos › setores), da obra, quem criou e a diretoria vê a ata.
-- Reunião de um setor pode gerar pendência para gente de outro setor: essa pessoa vê a PENDÊNCIA dela (pend_ler), não a ata.
-- Também: "Orçamentos" vira dois setores, ORC terceirizado laranja e ORC obras novas. Já aplicado no Supabase em 10/11/2026.
create or replace function public.meus_departamentos() returns text[] language sql stable security definer set search_path = public as $$
  select coalesce((select setores from public.perfis where id = auth.uid()), '{}'::text[])
$$;
alter policy atas_ler on public.atas using (
  liberado() and (
    ve_tudo_de_atas()
    or criado_por = auth.uid()
    or (obra is not null and obra = any (minhas_obras()))
    or (not funcao_de_obra() and setor is not null and setor = any (meus_departamentos()))
  )
);
delete from public.setores where nome = 'Orçamentos';
update public.setores set ordem = ordem + 1 where ordem >= 10;
insert into public.setores (nome, ordem) values ('ORC terceirizado laranja', 10), ('ORC obras novas', 11) on conflict (nome) do nothing;
update public.perfis set setores = array_replace(setores, 'Orçamentos', 'ORC terceirizado laranja') where nome = 'Leandro';
update public.perfis set setores = array_replace(setores, 'Orçamentos', 'ORC obras novas') where nome = 'Isabel';
update public.perfis set setores = array_append(setores, 'ORC terceirizado laranja') where nome = 'Julia' and not ('ORC terceirizado laranja' = any (setores));
update public.atas set setor = 'ORC obras novas' where setor = 'Orçamentos';
update public.pendencias set setor = 'ORC obras novas' where setor = 'Orçamentos';
