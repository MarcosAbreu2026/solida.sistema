# Sistema Sólida

Versão web do **Painel da Empresa**: mostra tudo o que o painel antigo (Solida.exe) mostra, puxando das
mesmas fontes, e acrescenta no setor Pós-obra os detalhes da planilha integrada. Só leitura: lançar dados
dentro do sistema fica para a Fase 2.

## Como abrir
Dê dois cliques em **`iniciar.bat`**. Abre uma janela preta (deixe aberta) e o navegador em
`http://localhost:8080/app/`. Não precisa instalar nada.

## De onde vêm os dados
- **Visão geral e os 8 setores** (Operação, Pós-obra, Transporte, Suprimentos, Planejamento, Comercial,
  Financeiro, RH, Funcionários por obra e Agentes): o mesmo `dados.json` do Google Drive que o Painel da
  Empresa lê. Quem preenche esse arquivo são os agentes, a partir das planilhas do Drive (orçamentos,
  cobrança do pós-obra, cronogramas, ferramentas), do Mais Controle, do WhatsApp e do Sólides.
  O link fica em `config.json` (se não houver, usa o link configurado no Painel da Empresa).
  O sistema relê a cada 5 minutos; sem internet, mostra a última cópia baixada (`dados/painel-cache.json`).
- **Pós-obra › abas da planilha** (Painel da planilha, Obras, Serviços, Agenda, Equipe e PJ, Financeiro):
  `dados/json/`, exportado da planilha `SL_Pos Obra_Controle Integrado_R01.xlsx` com

      python scripts/exportar_planilha.py "dados/planilhas/SL_Pos Obra_Controle Integrado_R01.xlsx" dados/json

  (precisa de Python + `pip install openpyxl`).
- **Comercial › Orçamentos e Arquiteturas / Planejamento › Projetos e As-built**: lidos direto do Google
  Drive para computador (pasta `G:`) por `scripts/exportar-drive.ps1`, que grava `dados/json/orcamentos.json`
  e `dados/json/projetos.json`. O servidor roda o script sozinho em segundo plano (no máximo a cada 10 min).
  - Orçamentos: `ORÇAMENTOS\SL_ORÇAMENTOS<ano>_Rnn.xlsx` (2023 em diante). A situação é a **cor da linha**,
    conforme a legenda no topo da planilha.
  - Projetos: `OPERACOES\OBRAS\<obra>\PROJETO\<disciplina>` (arquivos-modelo da pasta `Moxxx` não contam),
    a `<obra>_LISTAGEM PROJETOS_Rnn.xlsx` quando existe (coluna RECEBIDO) e o cronograma
    `GERENCIAMENTO\CRONOGRAMA\<obra>_CRONOGRAMA_Rnn.xlsx` (para saber se o projeto chegou antes do serviço).
  - As-built: os `.dwg` de `PROJETO\ASBUILT` de cada obra; a semana conta como revisada se algum foi salvo nela.
  - Estoque (todo mundo vê): `PÓS OBRA\FERRAMENTAS\LISTAS\SL_FERRAMENTAS_SOLIDA_Rnn.xlsx`, aba CONTROLE →
    `dados/json/estoque.json` (galpão, carros Anderson/Nascimento/Enio e cada obra; coluna O = obrigatória de obra).
    Consumíveis completos só para sócios e pós-obra (`VE_CONSUMIVEIS` em `estoque.js`); os outros veem só os
    consumíveis obrigatórios de obra, para consulta ("a obra repõe": não saem do galpão). "Pedir itens do estoque"
    (retirada, solicitação de compra, requisição para o cliente) é só a estrutura, marcada como em manutenção.
- **Operação**: sem abas — o Resumo (cronograma, programação e medições de todas as obras) e, embaixo, Por obra:
  um cartão por obra; clicando, a tela mostra só a obra (com "← Todas as obras") e as abas Cronograma, Programação
  semanal (ou Pendências finais), Medições, Escopo e Aditivos, lidos das pastas da obra por `scripts/exportar-drive.ps1`
  (vai para `projetos.json`). Cronograma, escopo e aditivos aparecem como a própria planilha, numa caixa só leitura
  (`scripts/grade-xlsx.ps1` lê valores formatados, cores, mesclas e larguras; colunas/linhas ocultas ficam de fora);
  as colunas de valor (material, mão de obra, locação, S.total) só aparecem para sócios.
  - Aditivos: abas AD01, AD02… da planilha de escopo; aprovado/aguardando/cancelado vem do texto escrito na aba
    (ou da aba RESUMO ADS, quando existe).
  - Cronograma: `GERENCIAMENTO\CRONOGRAMA\<obra>_CRONOGRAMA_Rnn.xlsx`.
  - Programação semanal / pendências: o PDF mais novo de `GERENCIAMENTO\PROGRAMAÇÃO SEMANAL` (lido por
    `scripts/ler-pdf.ps1`, que tira o texto e a tabela do PDF; cinza/laranja pela cor da faixa).
  - Escopo: `GERENCIAMENTO\DOC\ESCOPO\<obra>_ESCOPO_Rnn.xlsx` (aba ESCOPO SEM VALOR, ESCOPO ou orçamento base) e as
    abas de aditivo AD01, AD02… Só descrição, unidade e quantidade — nenhum valor.
  - PDF e planilha que não mudaram não são relidos (`VERSAO_LEITURA` no script força reler tudo).
  - Metas diárias e produtividade continuam em `#/operacao/metas` (link no Resumo).
- **Planejamento e Projetos** são setores separados no sistema. O agente ainda manda um setor só
  ("Planejamento e projetos"); `separarProjetos()` em `main.js` passa os processos 3.x e os indicadores/alertas
  de projeto, revisão e aditivo para Projetos.
- **Escritório virtual** (todo mundo vê): `app/js/telas/escritorio.js` + `app/js/escritorio/` (planta em grade em
  `mapa.js`, pessoas e bonequinhos em `pessoas.js`, desenho em `desenho.js`). Presença pelo servidor local
  (`/api/escritorio`, só na memória). Com o sistema hospedado (Etapa 2), troca o `SERVIDOR` de `escritorio.js`.
- **Pedir alteração** (botão em todas as telas): `dados/pedidos.json` via `/api/pedidos`. Pedido da diretoria já
  entra aprovado; os dos outros esperam a diretoria aprovar. O Claude faz só os aprovados.
- **Quadro de tarefas de cada função** (Minha semana › Funções e Quadro de funções): `app/js/funcoes.js`, transcrito
  do Quadro_Tarefas_Semanal_Solida.pdf (SL_TAREFAS_FUNC_R37 + POP R14).

## Perfil e pontuação das tarefas
- No alto do menu: a foto e o nome; clicando, abre o **Perfil** (`app/js/telas/perfil.js`). A própria pessoa coloca
  a foto no Perfil (📷 / "Colocar minha foto"): o navegador corta e reduz para 256 px em JPEG e o servidor guarda em
  `dados/fotos/<nome>.jpg` (`/api/fotos`). Sem foto, aparece o bonequinho do escritório virtual ou as iniciais.
- Cada ✓ feito / ✕ não feito de Minha semana › Funções vai para o servidor (`/api/tarefas` → `dados/tarefas-feitas.jsonl`,
  uma linha por marcação; a última vale).
- Pontuação: só as tarefas recorrentes da grade, em dias já passados (sem feriado), a partir do primeiro dia em que a
  pessoa marcou algo. Taxa de entrega = feitas ÷ previstas (sem marcação conta como não entregue); 10 pontos por tarefa feita.
- Perfil: esta semana, últimas 4 semanas, pontos, posição, evolução de 8 semanas, tarefas recorrentes da pior para a
  melhor e sugestões automáticas (regras por tipo de tarefa — sem API paga, nada sai do sistema).
- Diretoria: ranking da equipe (últimas 4 semanas) e o perfil de cada pessoa. Marcações feitas no "Ver como" ficam de fora.

## Tarefa feita automaticamente (sem marcar)
- `scripts/evidencias.ps1` (roda junto com a leitura do Drive) registra cada arquivo novo/alterado nas pastas de controle das
  obras (PROGRAMAÇÃO SEMANAL, CRONOGRAMA, PENDENCIAS, DOC\ESCOPO, ATA, RELATÓRIO SEMANAL, DIARIO DE OBRA) com dia, hora e a
  conta que salvou (gravada no próprio arquivo) → `dados/json/evidencias.json` (histórico de 120 dias).
- `app/js/evidencias.js`: tarefa sem marcação, mas com prova (arquivo da obra da pessoa; produtividade enviada no grupo),
  aparece em Minha semana como "✓ feito automático" e conta na pontuação. Marcação manual sempre vale mais.
  O crédito é de quem tem a tarefa na função e acompanha a obra (a conta do Office muitas vezes é compartilhada).

## Feed, Treinamentos e menu
- Menu: Visão geral · Feed · Minha semana | setores da empresa · Estoque | Escritório virtual · Treinamentos | Agentes.
- **Feed** (`app/js/telas/feed.js`): todo mundo publica, comenta e curte; a diretoria fixa no topo e apaga qualquer
  publicação, cada um apaga o que escreveu. Servidor: `/api/feed` → `dados/feed.jsonl` (uma linha por ação).
  A bolinha vermelha no menu conta as publicações novas desde a última visita.
- **Treinamentos**: aba criada; o conteúdo ainda vai ser definido.
- Perfil da diretoria: ranking da equipe + sugestões da equipe sobre o sistema (os pedidos de alteração, com aprovar/recusar).

## Perfis, Meu dia e metas
- **Entrar como** (topo): escolhe nome, função e obras — simula o login até o Supabase entrar.
  Funções e tarefas em `app/js/funcoes.js`; detalhes em `docs/acessos-e-funcoes.md`.
- **Setores que cada função vê**: lista `areas` de cada função em `funcoes.js` (sem lista = diretoria, vê tudo).
  Setor fora da lista some do menu e da Visão geral, e o endereço direto volta para a Visão geral.
- **Meu dia**: tarefas da função no dia (do POP R14), check feito/não feito e pendências anteriores.
- **Quadro de funções**: semana × tarefas por função (sócio e coordenação).
- **Operação › Metas e produtividade**: Visualização (meta diária × realizado do agente) e
  Edição (teste) — só itens da programação/meta; abaixo da meta exige justificativa.
- Por enquanto checks e lançamentos de teste ficam só no navegador.

## Conferir os cálculos do pós-obra
`http://localhost:8080/app/verificar.html` recalcula a semana de 13/10/2026 e compara com a planilha.

## Estrutura
- `app/js/painel-empresa.js` — telas do Painel da Empresa (mesma lógica do Solida.exe).
- `app/js/regras.js` — regras de negócio da planilha do pós-obra.
- `app/js/dados.js` — de onde vêm os dados.
- `app/js/telas/` — abas da planilha do pós-obra.
- `servidor.ps1` / `iniciar.bat` — servidor local; busca o dados.json no Drive.
