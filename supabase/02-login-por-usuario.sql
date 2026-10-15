-- Login por usuário e senha (15/10/2026): sem trava de e-mail; os sócios criam o login de cada pessoa.
-- O usuário "mariana" vira o e-mail interno mariana@usuarios.construcaosolida.com (nenhum e-mail é enviado).
-- Já aplicado no projeto (migração "login_por_usuario"); fica aqui como registro.
drop trigger if exists ao_criar_conta on auth.users;
drop function if exists public.nova_conta();
alter table public.perfis add column if not exists usuario text unique;
alter table public.perfis add column if not exists trocar_senha boolean not null default true;
-- criar_perfil(): preenche usuario, nome, funcao e obras com o que o sócio informou (raw_user_meta_data)
-- email_do_usuario(usuario), criar_login(usuario, nome, funcao, obras, senha) e redefinir_senha(id, senha): só diretoria
-- senha_trocada(): a própria pessoa avisa que criou a senha no primeiro acesso
-- (código completo das funções: ver a migração "login_por_usuario" no painel do Supabase › Database › Migrations)
