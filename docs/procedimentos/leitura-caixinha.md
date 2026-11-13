# Leitura Bee Vale × Mais Controle (aba Caixinha › Conferência)

Pedido do Marcos em 13/11/2026. Só leitura, no Chrome DESTE computador (regra em `.claude/CLAUDE.md`), já logado nos dois sites. Se aparecer tela de login: PARE, não digite senha, avise no resumo.

## O que ler
1. **Bee Vale** (`https://beevale.com.br/wallet/2107/current_cards/balances`, menu Financeiro › Cartões - Saldo Atual): nome e saldo de cada cartão (a lista tem 4 páginas, 10 por linha; a paginação é por clique, não por endereço). Na página inicial (`/wallet/2107`): "Saldo corporativo".
2. **Mais Controle** (`https://acessar.maiscontroleerp.com.br/#/accounts`, Financeiro › Contas Bancárias): clicar no olho (canto direito, acima da tabela) só para mostrar os valores. Ler "Valor Atual" das contas **Bee Vale** e **Caixinha (dinheiro)**.

## Onde gravar
`dados/json/caixinha.json` (formato: `maisControle{lidoEm,fonte,contas[{nome,saldo}]}` e `beevale{lidoEm,fonte,saldoCorporativo,cartoes[{nome,saldo}]}`; saldos em número, negativo com sinal). Depois: `node scripts/enviar-nuvem.mjs caixinha` e conferir "1 de 1 arquivos enviados". A tela é a aba **Conferência** da Caixinha (Administrativo), só consulta: ADM, sócio e financeiro.

Nunca inventar valor: se não leu, não grava. A "diferença a conferir" é só Bee Vale menos Mais Controle; não é erro confirmado.
