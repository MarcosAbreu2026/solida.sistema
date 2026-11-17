---
name: sincronizar-reunioes-google-agenda
description: Leva as reuniões criadas no sistema para o Google Agenda do sistema (uma única conta Google, logada no Chrome do escritório), que convida as pessoas.
---

NAVEGADOR (regra fixa do computador do escritório): use SÓ o Chrome deste computador (list_connected_browsers › onThisComputer: true; select_browser com o deviceId dele). Ele precisa estar logado na conta do Google do sistema (a mesma do Google Agenda). Se aparecer tela de login, PARE e avise; nunca digite senha.
Pasta do sistema: a do computador do escritório (C:\sistema-solida). Rode a cada 10 minutos em horário comercial (ou sob demanda).

Passos:
1. Na pasta do sistema: `node scripts/reunioes-google.mjs pendentes` (gera dados/json/reunioes-pendentes.json). Se der 0, termine.
2. Para cada reunião do arquivo, no Google Agenda (calendar.google.com) da conta do sistema:
   - acao "criar": novo evento com título = `titulo` (já vem no padrão R_<obra ou departamento>_<título>), data/início/fim, local e os `convidados` (e-mails). Salve mandando os convites. Anote o id do evento (da URL de edição ou do link "Copiar link do evento").
   - acao "atualizar": abra o evento `eventoGoogle` (ou procure pelo título e data) e ajuste título, horário, local e convidados; salve com envio de atualização aos convidados.
   - acao "apagar": exclua o evento e avise os convidados.
   - `semEmail`: pessoas da Sólida sem e-mail cadastrado: não dá para convidar; registre no erro/resumo.
3. Depois de cada uma: `node scripts/reunioes-google.mjs marcar <id> ok <idEvento>` (ou `marcar <id> erro "o que aconteceu"`). Para "apagar" use `ok`.
4. Resposta final (até 5 linhas): quantas criadas, atualizadas, apagadas e o que deu erro.

Regras: só mexa em eventos das reuniões do arquivo; nunca apague nem edite outros eventos da agenda; nunca responda convites nem envie e-mails por fora do convite do Google Agenda. O que for mudado direto no Google Agenda NÃO volta para o sistema: a edição é sempre pelo sistema.
