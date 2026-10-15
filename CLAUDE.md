# Sistema Sólida — começando pelo Pós-Obra

Este repositório vai virar o sistema interno da **Sólida** (construtora, Rio de Janeiro).
Hoje o controle do setor de pós-obra está numa planilha Excel (`dados/planilhas/SL_Pos Obra_Controle Integrado_R01.xlsx`).
O objetivo é transformar essa planilha num sistema, em fases:

1. **Fase 1 — Dashboard de consulta (agora).** Só leitura. Mostra o que a planilha mostra hoje (aba Dashboard), mais as visões por obra, por equipe/PJ e o financeiro.
2. **Fase 2 — Preenchimento pelo próprio sistema.** O pós-obra deixa de preencher a planilha e passa a lançar no sistema (OS, agenda semanal, lançamentos financeiros).
3. **Fase 3 — Outros setores.** Repetir o modelo para operação, transporte/logística, suprimentos/compras, planejamento, comercial, financeiro e RH, com uma visão geral para a diretoria.

## Leia antes de começar
- `docs/contexto-empresa.md` — quem usa, requisitos já definidos (visual, acesso, custos).
- `docs/modulo-pos-obra.md` — **regras de negócio** da planilha (como as diárias são contadas, como a situação da obra é calculada, o que o dashboard soma). Qualquer número que o sistema mostrar tem que bater com a planilha.
- `docs/modelo-de-dados.md` — entidades, campos e listas de valores.
- `docs/roadmap.md` — fases e o que entra em cada uma.
- `docs/decisoes-em-aberto.md` — **pergunte ao Felipe antes de decidir** qualquer item dessa lista.

## Dados
- `dados/planilhas/` — a planilha integrada (fonte da verdade hoje) e as duas planilhas de origem que alimentaram a R01 (Controle Operacional R06 e Controle de Cobrança R40).
- `dados/json/` — exportação da planilha integrada, uma tabela por arquivo. Gerada por `python scripts/exportar_planilha.py "<xlsx>" dados/json`. Use como dado de exemplo/seed; reexporte quando a planilha mudar.

## Regras de trabalho
- Interface e textos **em português do Brasil**. Datas dd/mm/aaaa, dinheiro R$ 1.234,56.
- Não usar API paga do Claude/OpenAI dentro do produto (requisito do Felipe).
- Valide os cálculos contra a planilha: para um mesmo período, diárias, custo, receita e margem têm que dar o mesmo valor que a aba Dashboard.
- Nomes de pessoas na agenda são texto livre; a contagem depende dos apelidos cadastrados na Equipe (ver regras).
- Valores financeiros e de diária são sensíveis: só sócios veem faturamento/lucro.
