# Rotina diária: produtividade do dia anterior (WhatsApp → sistema)

Roda todo dia útil de manhã (tarefa agendada no Claude). Confere o **dia anterior inteiro** de cada
obra ativa e grava em `dados/json/produtividade.json`. O sistema lê esse arquivo sozinho (aba Meu dia
› Hoje / Semana e Operação › Metas e produtividade). Na segunda-feira, o "dia anterior" é a sexta
(e o sábado, se houver relatório).

## Regras
- **Só leitura** no WhatsApp: não enviar, não reagir, não apagar, não baixar arquivos.
- **Nunca inventar número.** Se o relatório não diz a quantidade de um item, `feito` fica `false`
  (não consta) e a observação explica. Interpretação duvidosa: escrever "conferir" na `obs`.
- Não gravar telefone, CPF, valores em R$ nem dados pessoais.

## Onde ler (WhatsApp Web, no Chrome já logado)
Grupos das obras ativas (ver `dados/painel-cache.json` › planejamento.porObra):
`Mo581 . Sólida`, `Mo533 . Sólida`, `Mo531 . Av. Lucio Costa, 2960, ap 201`, `Mo358 . Sólida`,
`Mo465 . Sólida` (e novos grupos "MoXXX . Sólida" quando a obra começar).

Em cada grupo, rolar para cima até carregar o dia anterior inteiro. Extrair as mensagens com
`document.querySelectorAll('#main [data-pre-plain-text]')` (o atributo traz "[hora, data] autor").

## O que procurar no dia
1. **Programação do dia** — de manhã, normalmente do gestor (Leandro): "Atividades do dia" com os
   serviços, quantidade entre parênteses e a pessoa. Vira a lista `itens` (programado).
   Também valem a programação diária/meta diária postada pela Mariana (texto). PDF não se baixa:
   só registrar em `avisos` que existe uma programação nova (nome do arquivo).
2. **Relatório diário** — no fim do dia, do encarregado/estagiário: "RELATÓRIO DIÁRIO" com
   Etapa / Quantidade / Equipe / Nome. Vira o `feito` de cada item.
3. **Motivo** de ficar abaixo, se o grupo disser (ex.: "Carlos foi para a Mo415" → Falta de mão de obra).
   Motivos: Falta de mão de obra · Falta de material · Procrastinação · Chuva / clima ·
   Serviço dependia de outra equipe · Mudança de prioridade · Outro.

## Como montar o registro
```json
{
  "obra": "Mo581", "data": "2026-10-13",
  "programacao": { "por": "Leandro", "hora": "08:25", "titulo": "Atividades do dia" },   // ou null
  "relatorio":   { "por": "Taísa Escalzo", "hora": "17:26" },                          // ou null
  "semRelatorio": false,                    // true quando não veio relatório diário no grupo
  "itens": [                                // programação do dia × relatório
    { "item": "Arrematar vãos internos", "meta": 6, "unidade": "un", "tipo": "cinza",
      "feito": 2, "motivo": "", "obs": "Relatório: arremate de vão de porta, 2 portas (Naldo)" }
  ],
  "extras": ["serviços do relatório que não estavam na programação"],
  "avisos": ["programação nova postada em PDF", "programação do dia não postada", …]
}
```
- `tipo`: `cinza` (equipe Sólida) ou `laranja` (terceiro/fornecedor: Todeschini, Itanhangá, Inovar…).
- Item sem quantidade na programação: `meta: null` e `feito: true/false`.
- Sem programação do dia: `itens: []` e o relatório inteiro em `extras`.
- Atualizar `atualizadoEm` e **substituir** registros da mesma obra e data (não duplicar).
  Manter os registros dos últimos 14 dias; apagar os mais antigos.

## No fim
Responder em poucas linhas: por obra, se veio programação e relatório, itens abaixo da meta e os
motivos, e o que não deu para ler. Fechar a aba do WhatsApp que foi aberta.
