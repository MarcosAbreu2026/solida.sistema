# Rotinas agendadas dos agentes — rodam no COMPUTADOR DO ESCRITÓRIO

Decisão do Felipe (03/11/2026): o computador do escritório (ligado 24h) é o principal. Nele ficam a pasta do sistema, o `iniciar.bat`
(servidor, coletor do Drive, leitor de WhatsApp) e as rotinas dos agentes. Notebooks só pedem mudanças no código (ver `docs/guia-computadores.md`).
As rotinas antigas que estavam no notebook foram pausadas.

## O que o escritório precisa ter

1. A pasta do sistema atualizada: `git pull` (na pasta do sistema, PowerShell).
2. `iniciar.bat` aberto (reiniciar depois do `git pull`). Confira no `dados\coletor-log.txt` se aparece "Nuvem: N de N arquivos enviados".
3. O Chrome do escritório logado em: WhatsApp Web, Mais Controle (https://acessar.maiscontroleerp.com.br), Google Drive e Gmail.
   Se uma rotina encontrar tela de login, ela **para e avisa** (nunca digita senha).
4. O Claude (aplicativo desktop ou Claude Code) instalado, com a pasta do sistema aberta, e a extensão Claude in Chrome ligada.
5. Para criar as rotinas, peça ao Claude **no computador do escritório**:
   > Leia docs/rotinas-agendadas.md e crie as 4 rotinas agendadas descritas lá, com a pasta do sistema deste computador.

## Regras que valem para todas as rotinas

- **Somente leitura nas fontes externas.** WhatsApp: não enviar, não reagir, não responder, não apagar, não baixar. Mais Controle, Drive,
  Gmail, Bitrix, Sólides, Tangerino: só ler.
- Nunca inventar número. Dado ilegível ou fonte bloqueada: dizer no resumo "não foi possível ler X" e seguir com as outras fontes.
- Não gravar valores em R$ de contratos, telefone, CPF nem dados pessoais.
- Não apagar registros antigos dos JSON; acrescentar ou atualizar.
- Não usar API paga de IA. Responder sempre em português do Brasil.
- Cada execução começa sem memória: ler antes `CLAUDE.md`, `docs/contrato-agentes.md`, `docs/contexto-empresa.md` e `docs/modulo-pos-obra.md`.
- A pasta do sistema é a deste computador (no guia: `C:\sistema-solida`). Trocar `<PASTA>` abaixo por ela.

---

## 1. Produtividade das obras (WhatsApp) — dia anterior
**Quando:** segunda a sábado, 07:30.  **Nome:** `produtividade-whatsapp-dia-anterior`

```
Verifique a produtividade do DIA ANTERIOR de cada obra da Sólida nos grupos de WhatsApp e atualize dados/json/produtividade.json do sistema.
Pasta do sistema: <PASTA>. Leia ANTES e siga à risca docs/rotina-produtividade-whatsapp.md (regras, onde ler, formato do registro).
Dia a verificar: o dia anterior. Se hoje é segunda, verifique o sábado (se houver relatório) e confira se a sexta está registrada; se não, faça a sexta.
1. Abra o WhatsApp Web no Chrome já logado (Claude in Chrome). Se aparecer QR code ou login, PARE e avise.
2. Obras ativas: dados/painel-cache.json, área planejamento, lista porObra. Abra o grupo de cada uma (ex.: "Mo581 . Sólida", "Mo533 . Sólida").
3. Em cada grupo, role para cima até carregar o dia e extraia as mensagens com javascript:
   [...document.querySelectorAll('#main [data-pre-plain-text]')].map(el => el.getAttribute('data-pre-plain-text') + ' ' + (el.querySelector('span.selectable-text')?.innerText || el.innerText))
4. Ache a PROGRAMAÇÃO DO DIA (manhã) e o RELATÓRIO DIÁRIO (fim do dia). Compare item a item: meta × feito. Procure o motivo do que ficou abaixo.
5. Grave um registro por obra e dia em dados/json/produtividade.json (substitui o da mesma obra e data; só os últimos 14 dias; atualiza "atualizadoEm", fuso -03:00). Valide o JSON.
6. Rode, na pasta do sistema: node scripts/enviar-nuvem.mjs produtividade   (manda só a produtividade, mesclada com a da nuvem). Confirme "1 de 1 arquivos enviados".
Programação semanal e metas costumam vir em PDF: não baixe; anote em "avisos" que existe e o nome do arquivo.
Ao terminar, feche a aba que abriu e responda em poucas linhas, por obra.
```

## 2. Ferramentas obrigatórias (WhatsApp) — leitura
**Quando:** segunda a sábado, 09:00, 12:00, 15:00 e 17:00.  **Nome:** `ferramentas-whatsapp-leitura`

```
Leia no WhatsApp Web (Chrome já logado) o que o Anderson enviou de folhas de ferramentas e atualize dados/json/ferramentas-checklist.json.
Pasta do sistema: <PASTA>. Grupos: "GESTAO ferramentas", "Sólida FERRAMENTAS" e a conversa "Anderson Bandeira". Registre cada folha por local
(obras ativas, Estoque, Carro do Anderson, do Nascimento, do Enio), atualize verificadoEm (yyyy-MM-ddTHH:mm) e a nota da semana em "semanas"
(ini = segunda-feira; prazo quarta; sem envio até o dia da leitura = "não enviada"). Formato em docs/contrato-agentes.md.
Depois rode: node scripts/enviar-nuvem.mjs ferramentas-checklist   e confirme o envio. Somente leitura; fechar a aba ao terminar.
```

## 3. Leitura diária de todos os agentes
**Quando:** segunda a sábado, 08:30.  **Nome:** `leitura-diaria-todos-os-agentes`

```
Rode a leitura de TODOS os agentes do Sistema Sólida e deixe os dados do sistema e da nuvem atualizados. Pasta do sistema: <PASTA>.
Leia antes: CLAUDE.md, docs/contrato-agentes.md, docs/contexto-empresa.md, docs/modulo-pos-obra.md. Se a skill "agentes-solida" existir, use-a
(9 agentes: operação, pós-obra, transporte/logística, suprimentos/compras, planejamento, comercial, financeiro, RH e diretor, conforme o POP R14).
Ordem (se algo falhar, continue com o resto):
1. WhatsApp: (a) ferramentas, como na rotina 2; (b) produtividade, como na rotina 1 (se ainda não rodou hoje); (c) Strada Solida (rotas),
   ATESTADO/FALTAS/HORA EXTRA (RH), COMPRAS SÓLIDA e GESTÃO DAS COMPRAS, Pós Obra - Gestão, SETOR ORÇAMENTOS: registre só o que o contrato dos agentes manda;
   onde não houver formato, resuma em dados/json/whatsapp-resumo-AAAA-MM-DD.json (grupo, resumo factual curto, ações/pendências, quem, prazo).
2. Programação semanal e metas: os PDFs ficam no Drive, em OPERACOES\OBRAS\<obra>\GERENCIAMENTO\PROGRAMAÇÃO SEMANAL (o mais novo de cada obra). Leia o que o
   sistema ainda não estrutura e atualize a área "planejamento" (porObra[].programacao.dias, itens no formato "Atividade: quantidade unidade (quem)").
3. Mais Controle (leitura): terceirizadas × contratos e medições (alertas da Simone), compras em andamento, medições.
4. Drive e demais agentes (financeiro, comercial, planejamento, RH, diretor): o coletor (scripts/coletor.ps1) já lê o Drive a cada 10 min; só confira que dados/json está atualizado
   e leia à mão o que o contrato atribuir a um agente e o coletor não cobre.
5. Pedidos de alteração: ler dados/pedidos.json e listar os novos; NÃO mudar código sozinho.
6. Rode: node scripts/enviar-nuvem.mjs   e confirme "N de N arquivos enviados". (Só se este computador for o do coletor; senão envie só o que gerou: nomes dos arquivos.)
7. Resumo final em até 15 linhas: o que foi lido em cada fonte, o que mudou, alertas, o que não deu para ler e por quê, pedidos pendentes, envio à nuvem.
```

## 4. Análise das medições (Mais Controle) — semanal
**Quando:** segunda-feira, 08:00.  **Nome:** `medicoes-mais-controle-semanal`

```
Leia no Mais Controle (Chrome já logado) as medições da SEMANA ANTERIOR (segunda a domingo) de cada obra em andamento, cinza e laranja, e grave
dados/json/medicoes-mc.json. Pasta do sistema: <PASTA>. Siga à risca a seção "Agente de Operação: análise das medições de obra" de docs/contrato-agentes.md
(formato do arquivo, semana.inicio = segunda-feira, item como está no Mais Controle, quantidade medida na semana, tipo cinza/laranja).
Só leitura. Não gravar valores em R$. Se aparecer tela de login, pare e avise. Obra sem medição na semana entra com itens: [].
Depois rode: node scripts/enviar-nuvem.mjs medicoes-mc   e confirme o envio. O sistema compara sozinho, item a item, com a produtividade (Operação › Análise das medições).
```

---

## Observações
- O leitor de WhatsApp do `iniciar.bat` (de 15 em 15 min, seg–sex, 7h–18h) continua lendo efetivo e ferramentas dos grupos configurados em `dados/whatsapp-grupos.json`.
  Os grupos das obras precisam estar nessa lista com `"tipo": "efetivo"`.
- Programação semanal e metas são **PDFs** postados nos grupos e salvos no Drive; o coletor já lê o PDF mais novo de cada obra, mas ainda só extrai uma nota.
  Transformar a tabela em metas por dia está na fila.
- Memórias do Claude (ferramentas, Tangerino, Mais Controle…) são por computador. No escritório, o que vale para todos fica no `CLAUDE.md` e em `docs/`.
