# Acessos, funções e o que cada um vê

Pedido do Felipe (14/10/2026): acesso exclusivo para cada pessoa (inclusive encarregados), cada
pessoa com uma função; a função define o que ela vê e o quadro de tarefas dela.

## Decisões
- Hospedagem: **Supabase + Vercel (planos gratuitos)**.
- Login: **usuário e senha** (Felipe vai passar o nome e o usuário de cada pessoa).
- Leitura do WhatsApp (realizado × meta): **feita pelos agentes**, como hoje — sem API de IA paga
  dentro do sistema. Formato em `docs/contrato-agentes.md`.

## Funções (primeira versão — `app/js/funcoes.js`)
| Função | Vê valores em R$ / Financeiro | Por obra | Quadro de funções | Agentes |
|---|---|---|---|---|
| Sócio / Diretoria | sim | — | sim | sim |
| Coordenação de operações (POP: Simone) | não | — | sim | não |
| Gestor de planejamento (Mariana) | não | — | não | não |
| Gestor de projetos e orçamentos (Isabel) | não | — | não | não |
| Gestor de compras (Marcos H) | não | — | não | não |
| Gestor de ferramentas e logística | não | — | não | não |
| Gestor do pós-obra (Ênio) | não | — | não | não |
| Gestor do financeiro (Letícia · Isabelle) | sim | — | não | não |
| Gestor do RH (Leandro) | não | — | não | não |
| Gestor de obra (inclui documentação e medição de obra, POP 1.3 e 1.8) | não | sim | não | não |
| Estagiário de obra | não | sim | não | não |
| Encarregado | não | sim | não | não |

- Quem não vê valores **não sabe que o Financeiro existe**: some do menu, dos botões da Visão geral,
  do bloco Financeiro e das abas do pós-obra; o endereço direto volta para a Visão geral.
- Funções "por obra" (encarregado, estagiário, gestor de obra) — pedido de 14/10:
  - veem só Visão geral, Meu dia, Operação, Planejamento e RH;
  - Visão geral só com os números (sem a frase de resumo, sem alertas, sem notas com nomes de obras);
  - Operação: só Metas e produtividade das suas obras; Planejamento: só o quadro das suas obras;
  - RH: todos os funcionários de todas as obras (para saber onde está cada um).
- Visão geral por função (`geral` em `app/js/funcoes.js`, pelo título do bloco):
  sócio e financeiro veem tudo; coordenação, planejamento e pós-obra: Comercial, Obras, Indicadores;
  projetos: + Comparativo com 2025; documentação, compras, ferramentas, RH e funções de obra: Obras e
  Indicadores. A frase de resumo só aparece para quem vê o Comercial. Funções de obra também não veem
  indicadores de gestão (setores em dia, conversão, orçamentos).
- "Ver como" (faixa no topo; em modo teste aparece para todos — `MODO_TESTE` em `app/js/sessao.js`;
  com o login de verdade, só para sócio): clica numa função e o sistema inteiro aparece como ela
  vê, com a lista do que aparece e se vê valores em R$; para funções de obra, escolhe a obra.
- **Minha semana** (antes "Meu dia"), 2 abas, ambas em quadro da semana:
  **Semana** — itens (CINZA e LARANJA, inclusive os sem dia definido) × seg–sex, com "Programado na
  semana" à esquerda; cada célula mostra "X de Y · N% abaixo da meta" ou "meta batida"; quem está
  na obra digita o número na célula e aperta Enter (clica de novo para corrigir; "por quê?" quando
  fica abaixo). **Funções** — tarefas da função × seg–sáb com ✓ / ✕ na célula.
  A aba Semana (de preencher) é só das funções de obra.
- **Setores são só consulta.** Operação › Metas e produtividade: uma linha por obra (situação, de
  onde veio a programação, dias com produtividade enviada, % de metas batidas, "o que fazer") e o
  detalhe da semana de cada obra em modo leitura. Ninguém preenche ali.
- Sem programação diária: o sistema divide a semana por dia e avisa "Distribuição por dia feita por IA".
- Obras sem meta diária: itens cinza com quantidade divididos de seg a sex (meta calculada);
  laranja e o que não dá para dividir aparecem em "Na semana" (`app/js/programacao.js`).
- O quadro de tarefas de cada função foi montado a partir das rotinas do POP R14. **Precisa ser
  revisado pelo Felipe**, principalmente as tarefas de estagiário, encarregado e gestor de obra,
  que não estão no POP.

## Como está agora (Etapa 1, só neste computador)
- Tela de login antes do sistema (usuário e senha). Em modo teste qualquer usuário e senha entram e a
  função/obras são escolhidas na caixa "Modo teste" da própria tela; a senha não é guardada. "Sair" no topo.
- Meu dia de encarregado, estagiário e gestor de obra mostra as metas diárias das obras vinculadas,
  com atalho para lançar a produtividade. Pendências de dias anteriores ficam numa caixa fechada.
- Checks do "Meu dia" e lançamentos de produtividade (modo teste) ficam só neste navegador.
- Nada disso é seguro: qualquer um que abre o sistema troca de perfil. Serve para validar as telas.

## Etapa 2 (precisa do Felipe)
1. Criar a conta no **Supabase** (supabase.com) e um projeto, com o e-mail da empresa; me passar a
   URL do projeto e a chave pública ("anon key").
2. Criar a conta na **Vercel** (vercel.com). Para publicar daqui sem o Felipe mexer em código,
   preciso instalar o Node.js (oficial, gratuito) neste computador — pedir autorização antes.
3. Mandar a lista: nome, usuário, função e obras de cada pessoa.

Com isso: login por usuário e senha (no Supabase o usuário vira `usuario@solida.local`), checks e
lançamentos gravados no banco e visíveis para todos, valores em R$ protegidos no servidor (hoje só
ficam escondidos na tela), e o sistema acessível do celular na obra.

## Guia de movimentação (03/11/2026)
- Aba **Estoque** ganhou a caixa "Guia de movimentação" (igual à página 1 da folha SL_MOVIMENTAÇÃO R01): o estagiário do galpão registra item, quantidade, origem, destino (livres: galpão, obra, manutenção, descarte…) e obs, ou envia a **foto da folha preenchida**.
- Quem registra: sócio, administrativo, ferramentas, executor de ferramentas e estagiário de compras/ferramentas (galpão). Estas três últimas funções, que só viam Minhas funções e Treinamentos, passam a ver também a aba Estoque.
- Dados: tabelas `movimentacoes_galpao` e `movimentacoes_fotos` (supabase/05-movimentacao-galpao.sql); a foto vai para o armazenamento `fotos`, na pasta de quem enviou.
- O estoque mostrado continua vindo da planilha do Drive: a guia só **registra** a movimentação; o gestor de ferramentas consolida na Planilha Mestre (POP 12.1).
## Contagem do estoque no site (03/11/2026)
- Aba **Estoque**, caixa "Contagem do estoque" (mesmas funções da guia de movimentação). Escolhe o local (galpão, carros ou obra), digita a quantidade atual dos itens contados e salva; a folha escrita à mão deixa de ser necessária.
- Dados: tabela `contagens_estoque` (supabase/06-contagem-estoque.sql), uma linha por data + local + item. A contagem aparece no estoque do site por cima da planilha enquanto for mais nova que a conferência do local na planilha; "comprar" e "consertar" continuam vindo da planilha.
- A planilha SL_FERRAMENTAS_SOLIDA_Rnn no Drive **não** é alterada pelo site (nova revisão R61 só com autorização do Felipe).
- **Gerar a próxima revisão da planilha (R61, R62…):** no computador do escritório, dar dois cliques em `gerar-revisao-estoque.bat` (ou `gerar-revisao-estoque.bat -Simular` para só ver o que mudaria). O script lê as contagens do Supabase, copia a revisão mais nova da planilha, preenche a cópia com o Excel (as fórmulas recalculam) e grava como a próxima revisão em PÓS OBRAFERRAMENTASLISTAS. Não mexe na revisão atual (depois, se quiser, mova a antiga para a pasta OLD). Só entra contagem mais nova que a conferência do local na planilha; item cujo nome na planilha não bate (planilha renumerada) é pulado e listado; célula com fórmula nunca é sobrescrita. Precisa de Excel instalado, do Drive aberto e do config.local.json.
