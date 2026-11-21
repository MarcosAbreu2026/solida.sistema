# Enviar os dados do Drive para a nuvem (computador do escritório)

Use no computador do escritório (o que tem Node, o Google Drive aberto e o `config.local.json`).
Serve para os terceirizados cinza e laranja aparecerem no sistema (Orçamento Terceirizado Laranja › "Terceirizados por obra") e para o Dia a dia usar a classificação cinza × laranja nova.

## Passo a passo (manual)
1. Abra a pasta do sistema e baixe as novidades: `git pull origin main`.
2. Leia o Drive (cria/atualiza `dados\json\projetos.json`, que agora traz `obras[].terceirizados`):
   `powershell -ExecutionPolicy Bypass -File scripts\exportar-drive.ps1`
3. Envie para a nuvem só o arquivo de projetos:
   `node scripts\enviar-nuvem.mjs projetos`
   (sem argumento envia todos os arquivos de `dados\json`).
4. Abra o sistema, entre em Orçamento Terceirizado Laranja, e confira que a seção "Terceirizados por obra" lista as obras com "fechados / total".

## Prompt para colar no Claude Code do escritório
> Estou no computador do escritório, na pasta do Sistema Sólida. Faça `git pull origin main`, rode `scripts\exportar-drive.ps1` para ler o Google Drive e depois `node scripts\enviar-nuvem.mjs projetos` para enviar à nuvem. Ao final, confira em `dados\json\projetos.json` que as obras têm o campo `terceirizados` (Mo602 deve ter 29 itens cinza e 23 laranja, Mo358 28 e 63) e diga se o envio deu certo. Não altere código.

## Observações
- Valores (orçado, fechado, diferença, forma de pagamento) saem da cópia "todos" e só chegam a sócios.
- Po595 (pós-obra) não tem planilha de terceirizados no Drive: os itens dela são lançados direto no sistema ("+ Novo item").
- O que o time preenche na tela (loja cotando, data limite, contrato, situação) fica no banco (`terc_itens`) e vale por cima da planilha.
