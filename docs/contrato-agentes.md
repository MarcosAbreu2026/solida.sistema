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

A cada 15 dias (quarta-feira; ciclos a partir da semana de 12/10/2026, decisão do Felipe porque a compra demora a chegar) o Anderson manda no grupo "GESTAO ferramentas" a imagem da planilha
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
- `enviadoEm`: dia em que a imagem foi postada no grupo. Até a quarta-feira da primeira semana do ciclo de 14 dias = no prazo; depois disso = com atraso. Próximas datas: 28/10, 11/11, 25/11...
- `verificadoEm`: quando os grupos foram lidos pela última vez. Sem ele (ou lido antes da quarta), o cartão
  mostra "ainda não verificado" em vez de "não enviada" — o sistema nunca afirma que faltou sem ter lido.
- Um registro por envio; o histórico das últimas 4 semanas sai dos próprios registros.
## Agente de Operação: terceirizadas nas obras × contratos no Mais Controle (pedido de 16/10)

Toda empresa vinculada a uma obra (cinza ou laranja) precisa ter contrato vinculado no Mais Controle e medição.
O alerta vai para a Simone (processos 1.1 e 1.4). Não se compara época; só se a empresa tem contrato na obra e se
já teve medição. Rotina (só leitura, no Chrome já logado em https://acessar.maiscontroleerp.com.br):

1. Obras › Medição de Contratos › Contratos: clicar em CARREGAR até acabar a lista (228 contratos em 16/10) e
   anotar por contrato: fornecedor, título, obra (ex.: "Mo531 (Laranja) - ADM"), status e % de medições aprovadas.
   Não gravar valores em R$.
2. Para cada empresa citada nas programações das obras (e nos relatórios do WhatsApp), procurar entre os contratos
   daquela obra um fornecedor com o mesmo nome (ou parecido) e gravar em `dados/json/terceirizados.json`:
   `{ "obra": "Mo531", "empresa": "Humber", "contrato": true|false, "medicao": true|false|null, "contratoNome": "…", "obs": "…" }`
   (`contrato: false` = nenhum fornecedor com esse nome nos contratos da obra; usar `obs` para pedir conferência do nome).
3. `verificadoEm` = quando leu o Mais Controle; `avisos` = observações gerais (ex.: obra com pouquíssimos contratos).
Empresa que aparece na programação e não está no arquivo entra na tela sozinha como "ainda não conferida".

## Agente de Operação: análise das medições de obra (pedido de 03/11/2026)

A Operação ganhou **Análise das medições** (`#/operacao/medicoes`, botão ao lado de "Análise das metas da semana"). O sistema cruza,
obra por obra e semana por semana (segunda a sexta): **produtividade enviada** (relatórios diários do grupo), **efetivo enviado**,
**programação semanal** e **metas**, e compara a **medição lançada no Mais Controle, item a item**, com o que foi produzido. Quem
calcula é o sistema; o agente só precisa **ler a medição no Mais Controle** e gravar o arquivo abaixo. Rodada: **toda segunda de manhã**,
sobre a semana que acabou (a mesma semana que o POP 1.3 fecha na segunda).

### O que o agente faz (só leitura, no Chrome já logado em https://acessar.maiscontroleerp.com.br)

1. Se aparecer tela de login, parar e pedir ao usuário para entrar (nunca digitar senha).
2. Para cada obra em andamento (cinza **e** laranja): Obras › Medição de Contratos (e a medição semanal da obra), abrir as medições
   **da semana** (segunda a domingo anteriores) e anotar, por serviço medido: o nome **como está no Mais Controle**, a unidade, a
   quantidade **medida na semana** (não o acumulado), o contrato/fornecedor, se é cinza ou laranja e o status (registrada, aprovada…).
   Se o Mais Controle só mostrar percentual, mandar `pct` e deixar `medido` vazio.
3. **Não gravar valores em R$** nem dados pessoais.
4. Gravar `dados/json/medicoes-mc.json` (o coletor manda para a nuvem a cada 10 min). Obra sem nenhuma medição na semana entra com
   `itens: []` (é isso que mostra "medição não lançada"). Obra que o agente não conseguiu ler: não incluir, e dizer ao usuário.

```json
{
  "semana": { "inicio": "2026-10-26" },
  "verificadoEm": "2026-11-02T09:10",
  "obras": [
    { "obra": "Mo533",
      "obs": "texto curto, opcional (ex.: 2 contratos ainda sem medição)",
      "itens": [
        { "item": "Pintura das paredes, 2ª demão", "unidade": "m²", "medido": 97, "contrato": "Pinturas X", "tipo": "cinza", "status": "aprovada" },
        { "item": "Bancadas, tentos e bancos", "unidade": "un", "medido": 23, "contrato": "Marmoraria", "tipo": "laranja" },
        { "item": "Rejunte de cerâmica", "unidade": "m²", "pct": 40 }
      ] }
  ]
}
```

- `semana.inicio`: a **segunda-feira** da semana analisada (AAAA-MM-DD). Arquivo de outra semana não é usado para a semana pedida.
- `item`: o nome do serviço no Mais Controle. O sistema casa com o item da programação/produtividade por **semelhança** (acentos, vírgulas
  e "de/da" não contam) e avisa "nome parecido" quando não é idêntico. Serviço medido em mais de um contrato: pode vir em linhas separadas, o sistema soma.
- `tipo`: `cinza` (equipe Sólida, POP 1.1 e 1.3) ou `laranja` (terceirizado, POP 1.4). Sem `tipo`, vale `cinza`.
- Laranja não tem produtividade diária: o sistema compara o medido com a **quantidade programada** da semana.

### Como o sistema avalia (tolerância 10%, em `app/js/analise-medicoes.js`)

| Situação | Quando | Nível |
|---|---|---|
| Bate | medido dentro de 10% do produzido | ok |
| Medido a mais | medido > produzido + 10%, ou medido sem produtividade enviada | **crítico** (aparece nos alertas da Operação) |
| Medido a menos | medido < produzido − 10% | atenção |
| Não medido | produzido e sem medição no Mais Controle | atenção |
| Só em % / unidade diferente | sem quantidade comparável | atenção |

Também entram: dia com produtividade e sem efetivo, equipe na obra sem produtividade, semana sem nenhum relatório, medição ainda não lida.
O agente **não** precisa repetir essas contas; se quiser, pode acrescentar na área `operacao` do dados.json um alerta `critico` por
medição "a mais" no formato dos demais ("1.3 · LARISSA — Mo533: Rejunte medido 28 m² a mais que o produzido").

## Contas das automações (Configurações › Automações)

A tela Automações da diretoria mostra, para cada fonte, QUAL CONTA está conectada. Ninguém digita isso: quem sabe é o computador do escritório.
- O `enviar-nuvem.mjs` (via `scripts/contas-automacoes.mjs`) preenche sozinho: **banco** (conta do coletor + projeto), **whatsapp** (número do WhatsApp Web do leitor, gravado pelo `leitor-whatsapp.mjs` em `dados/whatsapp/conta.json`) e **drive** (e-mail da conta do Google Drive para computador, se achar).
- O agente que lê **Mais Controle, Sólides/Tangerino, Bitrix, Gmail e Google Agenda** registra a conta que está logada na tela (o nome/e-mail que o próprio site mostra, nunca senha) em `dados/json/automacoes.json`, ao terminar a leitura:
  `{ "itens": { "maiscontrole": { "conta": "nome ou e-mail logado", "lidoEm": "AAAA-MM-DDTHH:MM:SS" } } }`
  Ids: `maiscontrole`, `solides`, `bitrix`, `gmail`, `calendar`. Mantenha o que já está no arquivo (só atualize o seu item). Se a fonte pedir login, escreva em `conta` "desconectada (pede login)".
- O `enviar-nuvem` manda o arquivo junto com os demais.
