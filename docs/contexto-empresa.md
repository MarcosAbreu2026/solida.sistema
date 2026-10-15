# Contexto da empresa e requisitos já definidos

## A empresa
- **Sólida**: construtora de reformas/obras residenciais e comerciais no Rio de Janeiro.
- Códigos de obra: `MoXXX` (obra) e `POXXX` / `Po_nome` (pós-obra da obra XXX ou cliente).
- Setor de pós-obra: gestor **Ênio**. Também aparecem como responsáveis Pedro e Isabel. Equipe própria (pedreiros, pintores, ajudantes, bombeiro, carpinteiro) + **PJ pagos por diária** (Samuel e Arthur, eletricistas) + terceirizados contratados por serviço (JS Elétrica, Inovar, Sartmetal, Didi etc.).
- Atendimento recorrente: PO288 e PO318 têm **manutenção fixa quinzenal** (cobrança mensal fixa).

## Setores (para as fases seguintes)
Operação, pós-obra, transporte/logística, suprimentos/compras, planejamento, comercial, financeiro, RH e uma visão de diretoria.
Os processos de cada setor estão no **POP Sólida (R14, out/2026)**.

## Fontes de dados que existem hoje
- Planilhas no Google Drive (pasta SOLIDA GERAL): PÓS OBRA (esta planilha), ORÇAMENTOS, OPERACOES (cronograma e programação semanal por obra).
- ERP **Mais Controle** (medições, financeiro, centro de custo), **Bitrix** (comercial), **Sólides** (RH), grupos de WhatsApp das obras (efetivo diário), e-mail.

## Já existe um "Painel da Empresa"
Há um app de painel (executável Windows) que lê um `dados.json` no Google Drive e mostra uma coluna por setor. Requisitos que o Felipe já definiu para ele e que valem para este sistema:
- Toda a empresa usa; **sócios veem mais** (faturamento, lucro, margem), funcionários veem menos.
- Sem custo de API de IA.
- Atualização automática (o painel atual relê os dados a cada 5 min; pedido de atualização a cada 30 min).
- Visual de **alto padrão**, sem "cara de app de IA", mas com **fontes legíveis** (nada de fontes finas).
- Títulos não quebram em duas linhas; elementos clicáveis com destaque e cor diferente.
- Na visão geral: indicadores do mês e do ano (faturamento, lucro, margem, orçamentos em andamento, taxa de conversão, obras e pós-obras em curso), Comercial e Financeiro separados em Obra e Pós-obra, e crescimento em relação ao ano anterior.

Decidir com o Felipe se este sistema **substitui** o Painel da Empresa ou **convive** com ele (ver `decisoes-em-aberto.md`).
