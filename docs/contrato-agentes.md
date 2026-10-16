# O que os agentes precisam mandar no dados.json (além do que já mandam)

O sistema lê o mesmo `dados.json` do Drive que o Painel da Empresa. Para as telas novas, os agentes
precisam acrescentar os campos abaixo. Campos que não vierem não quebram nada: a tela mostra
"Sem registro".

## Agente de Operação: realizado × meta diária (`produtividade`)

Dentro da área `operacao`, um registro por obra e por dia, com o que a equipe relatou no grupo de
WhatsApp da obra (só leitura do grupo). O agente compara com a programação/meta diária que o agente
de Planejamento já publica em `planejamento.porObra[].programacao.dias`.

```json
"produtividade": [
  {
    "obra": "Mo533",
    "data": "2026-10-09",
    "fonte": "WhatsApp · grupo Mo533 · 18:20",
    "itens": [
      { "item": "Pintura do teto, 1ª demão", "feito": 22, "unidade": "m²",
        "motivo": "Falta de material", "obs": "acabou a massa às 15h" },
      { "item": "Rejunte de cerâmica", "feito": 7.8, "unidade": "m²" },
      { "item": "Pintura do teto, 2ª demão", "feito": false, "motivo": "Outro", "obs": "1ª demão ainda secando" }
    ]
  }
]
```

- `item`: **o mesmo texto do item da programação**, antes dos dois-pontos (é por ele que o sistema
  casa meta e realizado). Item relatado que não está na programação não entra.
- `feito`: número na mesma unidade da meta. Item sem quantidade na meta ("a confirmar", tarefas
  de texto): `true` (feito) ou `false` (não feito).
- `motivo`: só quando ficou abaixo da meta, e só se o grupo disser o porquê. Usar uma destas:
  Falta de mão de obra · Falta de material · Procrastinação · Chuva / clima ·
  Serviço dependia de outra equipe · Mudança de prioridade · Outro. Sem motivo no grupo: deixar vazio
  (o sistema mostra o item como "Abaixo" sem justificativa, e isso vira cobrança).
- Nunca inventar quantidade (regra 2 dos agentes): se o grupo não disse quanto foi feito, não mande o item.
- Alerta sugerido na área `operacao`: `critico` para obra com item abaixo da meta sem justificativa;
  `atencao` para obra sem relato de produtividade no grupo até 18h.

## Agente de Planejamento: cinza ou laranja em cada item

Quando a obra só tem programação/cronograma semanal, o sistema divide os itens **cinza** (equipe
Sólida) com quantidade de segunda a sexta e mostra os **laranja** (terceiros/fornecedores) como
"na semana". Hoje ele adivinha pelo parêntese: "(Sólida)" = cinza; "(Humber)", "(terceirizado)",
"(fornecedor)" = laranja; compra/contratação/entrega = laranja; sem parêntese = cinza. Isso erra em
casos como "Bancadas, tentos e bancos: 23 un (mármores no caminho crítico)", que é marmoraria.

Peça ao agente para mandar o tipo junto, mantendo o texto como está:

```json
"estaSemana": [
  {"texto": "Pintura das paredes, 2ª demão: 62 m²", "tipo": "cinza"},
  {"texto": "Bancadas, tentos e bancos: 23 un", "tipo": "laranja", "quem": "Marmoraria"}
]
```

(Enquanto vier só texto, o sistema continua adivinhando.)

## Agente de Operação: medições e diário de obra por obra (pedido de 14/10)

A Operação ganhou as abas Medições e Diário de obra, uma linha por obra. Hoje o sistema separa por
obra o texto dos alertas. O ideal é o agente mandar estruturado, dentro da área `operacao`:

```json
"porObra": [
  { "obra": "Mo533",
    "medicao": { "ok": true,  "info": "Contratos registrados até sexta (1.1)" },
    "diario":  { "ok": false, "info": "Sem diário desde 30/09 (1.8)" } }
]
```

## Agente de Transporte e logística: regras novas (pedido de 14/10)

- **Checklists de ferramentas até quarta:** conferir no grupo de WhatsApp de ferramentas
  ("Sólida FERRAMENTAS") as fotos que o Anderson manda toda quarta. Verificar na quarta, fim do dia.
- **Obras faltando ferramentas:** sai desse checklist, depois de atualizada a Planilha Mestre.
- **Reposições entregues até terça:** conferir no grupo "Strada Solida".
- **Veículos OK para operação** e **Locações no prazo:** saem do painel por enquanto (locação entra
  depois). O alerta da Planilha Mestre continua.

## Agente de Planejamento: meta diária por dia

A tela de metas só funciona para obras com a programação **separada por dia** em
`programacao.dias` e itens no formato `"Atividade: quantidade unidade"` (ex.:
`"Pintura das paredes, 1ª demão: 19 m²"`). Hoje só a Mo533 vem assim; Mo531, Mo581 e Mo358 vêm sem
divisão por dia, então aparecem com o alerta "sem meta diária separada por dia".

## Agente de Transporte e logística: planilha de ferramentas obrigatórias por obra (pedido de 16/10)

Toda quarta o Anderson manda no grupo "Sólida FERRAMENTAS" (ou "Gestão Ferramentas") a imagem da planilha
de ferramentas obrigatórias preenchida, uma por obra, mais as do estoque e dos carros (Anderson,
Nascimento e Enio). A tela Transporte e logística mostra um cartão por local dizendo se a da semana
chegou até quarta. Quem lê o grupo (só leitura) grava `dados/json/ferramentas-checklist.json`:

```json
{ "verificadoEm": "2026-10-16T09:00",
  "registros": [
    { "local": "Mo533", "enviadoEm": "2026-10-14", "hora": "17:40", "por": "Anderson" },
    { "local": "Estoque", "enviadoEm": "2026-10-14" },
    { "local": "Carro do Enio", "enviadoEm": "2026-10-14" }
  ] }
```

- `local`: código da obra (Mo533...) ou `Estoque`, `Carro do Anderson`, `Carro do Nascimento`, `Carro do Enio`.
- `enviadoEm`: dia em que a imagem foi postada no grupo. Até quarta = no prazo; quinta em diante = com atraso.
- `verificadoEm`: quando os grupos foram lidos pela última vez. Sem ele (ou lido antes da quarta), o cartão
  mostra "ainda não verificado" em vez de "não enviada" — o sistema nunca afirma que faltou sem ter lido.
- Um registro por envio; o histórico das últimas 4 semanas sai dos próprios registros.