# Módulo Pós-Obra — regras de negócio (como a planilha funciona)

A planilha `SL_Pos Obra_Controle Integrado_R01.xlsx` tem estas abas:
Dashboard · Agenda · Obras · Serviços · Equipe · PJ · Financeiro · (Cálculos e Cálculos Agenda, ocultas) · Listas · Instruções.

## 1. Período
O Dashboard tem dois controles: **Ver por** (`Semana` | `Mês`) e **Data de referência** (padrão: hoje).
- Semana: segunda a domingo da semana que contém a data. (`início = data − WEEKDAY(data,3)`, `fim = início + 6`)
- Mês: dia 1 até o último dia do mês da data.
Todos os números "no período" usam esse intervalo, inclusive nas pontas.

## 2. Agenda (programação semanal / PAS)
- Grade: linhas = obras (mesmo nome da aba Obras), colunas = dias (17/08/2026 a 27/06/2027). Cada célula é **texto livre**, ex.: `Marcos e Cleviano: pintura`, `Barba e bil`, `Cleviano (falta)`.
- **Contagem de diárias por pessoa** (aba Cálculos Agenda):
  - Para cada profissional da Equipe, procura-se o nome e os apelidos (colunas "Também escrito como") dentro do texto da célula. Busca **sem diferenciar maiúsculas/minúsculas**, mas **acentos contam** ("Enio" ≠ "Ênio", por isso o apelido).
  - A busca é por **trecho de texto** (SEARCH). Cuidado: "Bil" casa com "mobilizar". No sistema, prefira casar palavra inteira e avisar ambiguidades.
  - Se a pessoa aparece em **N obras no mesmo dia**, cada obra recebe **1/N** diária (a diária é dividida).
  - `Nome (falta)` ou `Nome (atestado)` → não conta diária.
  - Profissionais "genéricos" (nome com parênteses, ex.: `Ajudante (s/ nome)`, ou vínculo Terceirizado) contam **1 por menção** (não dividem).
- **Custo de mão de obra** = diárias × valor da diária do profissional (aba Equipe).
- Terceirizados contratados por serviço não ficam na Equipe: o custo deles vai no Financeiro.

## 3. PJ (Samuel e Arthur, eletricistas)
- São PJ, mas **pagos por diária** → ficam na Equipe com `Vínculo = PJ` e entram na contagem de diárias da Agenda como a equipe própria. **Não** lançar o custo deles também no Financeiro (contaria duas vezes).
- A aba PJ mostra: diárias e custo no período e no total, e uma tabela "dias escalados por obra no período" (dias em que o nome aparece na linha da obra; aqui o dia não é dividido).
- Valor da diária do Arthur ainda não foi informado.

## 4. Obras
Campos: obra, cliente, endereço, tipo (Pós-obra, Manutenção fixa, Chamado, Aditivo, Interno), responsável.
**Situação da obra é calculada** a partir das OS dela (aba Serviços), nesta prioridade — a primeira que existir vence:
`Execução > Atrasado > Planejamento > Agendamento > Orçamento > Análise > Fixo > Pausado > Concluído > Cancelado`.
- Sem nenhuma OS → `Sem OS`. Tem OS mas nenhuma com situação → `Sem situação`.
- Ou seja: só fica Concluído quando não houver nenhuma OS em situação "mais aberta".

## 5. Serviços (OS / pendências)
Uma linha por OS: código (OS-001…), obra, situação, data início, prazo (data ou "contínuo"), concluído em, profissionais/responsável, relato, obs.
- **Dias em atraso** = hoje − prazo (≥0), só se prazo é data e a OS não está Concluída/Cancelada.
- **Status do prazo**: `Encerrado` (concluída/cancelada) · `Sem prazo` · `Vencido` (prazo < hoje) · `Vence em 7 dias` · `No prazo`.
- "Concluído em" é a data que faz a OS contar como concluída **no período**.

## 6. Financeiro
Lançamentos: data, obra, tipo, descrição, fornecedor/cliente, valor, pago/recebido (Sim/Não).
Tipos: Material · Serviço terceirizado · Transporte · Equipamento/Aluguel · Outros · **Receita (cobrança)**.
- Cobranças parcialmente pagas viram **duas linhas**: o que já entrou (Sim) e o saldo (Não).
- Lançamento **sem data não entra em nenhum período** (o Dashboard mostra um aviso). Muitas receitas vindas da planilha de cobrança estão sem data porque a origem não registra quando o dinheiro entrou.

## 7. Dashboard (o que cada número é)
| Card | Cálculo |
|---|---|
| Obras com atividade no período | obras com pelo menos 1 diária/menção na Agenda no período |
| Serviços abertos | OS não concluídas/canceladas |
| Serviços concluídos no período | OS Concluído com "Concluído em" no período |
| Prazos vencidos | OS com status Vencido |
| Diárias no período | soma das diárias (regra da seção 2) |
| Custo do período | custo de MO da Agenda + lançamentos não-receita do Financeiro com data no período |
| Receita do período | lançamentos "Receita (cobrança)" com data no período (recebidos ou não) |
| Margem do período | receita − custo (mostra "-" se receita = 0) |
Gráficos: obras em aberto por situação; diárias por semana (8 semanas até a data escolhida).

## 8. De onde vieram os dados da R01
- **Controle Operacional Pós-Obra R06** (planilha do Ênio, 09/10/2026): situação, relato, obs, responsável, prazos, materiais e a coluna "agenda" (virou a Agenda de 12 a 19/10).
- **PO_CONTROLE_COBRANÇA R40**: aba ANDAMENTO inteira e aba FINALIZADO a partir de 17/08/2026 → Financeiro.
- Divergências encontradas entre as duas (ficou valendo o Controle Operacional): drenagem do Junior (FINALIZADO na cobrança × Planejamento na operação); Po88 ("finalizado, cobrar final" × Execução); laudo ArpoBrasil (recebido × obs "aguardando pagamento").
