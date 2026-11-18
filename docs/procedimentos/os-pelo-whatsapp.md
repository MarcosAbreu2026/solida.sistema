# OS pelo WhatsApp (grupo do Pós-obra)

Autorizado pelo Felipe em 18/11/2026: o leitor de WhatsApp do computador do escritório lê o grupo **"Pós Obra - Gestão"**, abre OS no Quadro de OS e, quando falta informação, **pergunta no próprio grupo** e cria a OS quando a pessoa responde. Sem IA e sem API paga (regras de texto em `scripts/os-wpp.mjs`).
É, junto com as cobranças de produtividade/efetivo (`cobrancas-whatsapp.md`), uma das únicas situações em que o sistema escreve no WhatsApp.

## O que vira pedido de OS
Só a mensagem que **começa** com `OS`, `Nova OS`, `Abrir OS`, `Chamado` ou `Solicitação` (ou que tem "nova OS"/"abrir OS" no texto). Conversa comum não cria nada. Exemplos:
- `Nova OS PO420 - infiltração no banheiro. Problema: mancha de umidade no teto`
- `OS PO - Carol: trocar fechadura da porta de entrada. Endereço: Rua das Acácias 193`

Campos reconhecidos (com ou sem rótulo): **PO** (`PO420` ou `PO - Nome`), **cliente:**, **endereço:**, **assunto:**, **problema:**. Sem rótulo, o assunto é a primeira frase depois do PO.

## O que o sistema faz
- **PO que já existe no cadastro** (pelo código ou pelo nome do cliente): cria a OS na coluna *Solicitação* do Quadro de OS, com o problema e a origem ("Aberta pelo WhatsApp por Fulano").
- **PO novo**: precisa de **cliente e endereço** (regra do cadastro). Com os dois, cria o PO (pós-obra em andamento) e a OS.
- **Falta algo** (PO, assunto, cliente ou endereço): manda **uma** mensagem no grupo, começando com "🤖 Sistema Sólida:", listando o que falta. Quando a mesma pessoa responde (com ou sem rótulo, numa mensagem só), cria a OS e avisa no grupo. Resposta de outra pessoa não vale. Pergunta sem resposta em 72 h é esquecida.
- Nunca duplica: cada mensagem é tratada uma única vez e a OS guarda a origem `wpp:<id da mensagem>`.
- O que o sistema mesmo escreveu (começa com "🤖 Sistema Sólida:") nunca é lido como pedido.
- Na primeira rodada, o histórico do grupo é só marcado como visto (não cria nem pergunta nada sobre mensagens antigas).

## Como ligar (computador do escritório)
1. `git pull` e reiniciar o `iniciar.bat`. O leitor acrescenta sozinho `"os_wpp": { "modo": "simulacao" }` na conversa do grupo em `dados/whatsapp-grupos.json` (ou cria a conversa "Pós Obra - Gestão").
2. **Simulação** (padrão): não cria nem envia nada; escreve em `dados/whatsapp/os-wpp-log.json` o que FARIA. Deixe alguns dias, confira o log e as regras acima com mensagens reais do grupo.
3. Para valer: trocar `"modo": "simulacao"` por `"modo": "ativo"` na conversa. Passa a criar as OS e a enviar as perguntas.
4. Para desligar: voltar para `simulacao` (ou `ativo: false` na conversa).

## Limites
- O WhatsApp Web do leitor precisa estar logado (o mesmo da leitura); se cair, para e avisa.
- O leitor abre o grupo a cada ~15 min em horário comercial: a pergunta e a criação acontecem na rodada seguinte à mensagem, não na hora.
- Para criar a OS o leitor usa a conta do coletor (funções `os_wpp_criar` e `po_wpp_criar` no Supabase, só dele).
- Teste das regras de texto: `node scripts/os-wpp.teste.mjs`.
