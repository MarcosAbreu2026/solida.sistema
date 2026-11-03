---
name: agentes-solida
description: Rodar a leitura dos 9 agentes do Sistema Sólida (operação, pós-obra, transporte/logística, suprimentos/compras, planejamento, comercial, financeiro, RH e diretor) e atualizar dados/json e a nuvem. Use nas rotinas agendadas e quando pedirem "rodar os agentes".
---

# Agentes do Sistema Sólida

Leia antes de agir: `CLAUDE.md`, `docs/contrato-agentes.md`, `docs/contexto-empresa.md`, `docs/modulo-pos-obra.md` e `docs/rotinas-agendadas.md`.
Os processos de cada setor estão no POP Sólida (R14, out/2026); o que cada agente deve mandar está em `docs/contrato-agentes.md`.

## Os 9 agentes
operação · pós-obra · transporte e logística · suprimentos e compras · planejamento · comercial · financeiro · RH · diretor.

## Regras
- Somente leitura nas fontes externas (WhatsApp, Mais Controle, Drive, Gmail, Bitrix, Sólides, Tangerino): não enviar, reagir, responder, apagar nem baixar.
- Tela de login ou QR code: parar e avisar. Nunca digitar senha.
- Nunca inventar número. Dado ilegível ou fonte bloqueada: dizer "não foi possível ler X" e seguir.
- Não gravar valores em R$ de contratos, telefone, CPF nem dados pessoais.
- Não apagar registros antigos dos JSON: acrescentar ou atualizar. Validar o JSON depois de gravar.
- Não usar API paga de IA. Responder em português do Brasil.
- Pedidos de alteração (`dados/pedidos.json`): só listar os novos; não mudar código sozinho.

## Como rodar
1. Para cada agente, ler no contrato o que ele deve gravar e de onde vem (WhatsApp, Mais Controle, Drive).
2. O coletor (`scripts/coletor.ps1`) já lê o Drive a cada 10 min: conferir que `dados/json` está atualizado e ler à mão só o que o contrato atribui ao agente e o coletor não cobre.
3. Enviar à nuvem: `node scripts/enviar-nuvem.mjs [nome]` e confirmar "N de N arquivos enviados".
4. Resumo final curto: o que foi lido em cada fonte, o que mudou, alertas, o que não deu para ler e por quê.
