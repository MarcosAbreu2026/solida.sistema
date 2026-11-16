// Treinamentos com slides (21/10): cards de tópicos, cada um com subtópicos; clicar num subtópico abre uma apresentação
// com prints reais do sistema, caixas e setas vermelhas e a legenda de cada número. Os prints ficam em img/treinamentos/
// e são gerados por scripts/gerar-prints-treinamento.mjs (refazer sempre que a tela mudar). Para criar outro treinamento:
// acrescente um subtópico em TOPICOS, com os slides (imagem, título, texto, legenda dos números) e rode o gerador.
import { idPessoa } from './sessao.js';

const img = (n) => `img/treinamentos/${n}.jpg`;

// Os tópicos são os nomes do menu da esquerda; os subtópicos são os treinamentos de cada um.
// tipo 'setor' = área do menu (aparece para quem tem a área); tipo 'pagina' = página geral (aparece para quem vê a página)
export const TOPICOS = [
  { id: 'agenda', nome: 'Agenda', tipo: 'pagina', pagina: 'meudia', icone: '📅' },
  { id: 'tarefas', nome: 'Tarefas', tipo: 'pagina', pagina: 'atas', icone: '✅' },
  { id: 'atas', nome: 'Atas', tipo: 'pagina', pagina: 'atas', icone: '📝' },
  { id: 'materiais', nome: 'Materiais / Vendas', tipo: 'setor', icone: '🧱' },
  { id: 'diretoria', nome: 'Diretoria', tipo: 'diretoria', icone: '🏢' },
  { id: 'operacao', nome: 'Painéis dos departamentos', tipo: 'setor', icone: '🏗️' },
  { id: 'posobra', nome: 'Pós-obra', tipo: 'setor', icone: '🛠️' },
  { id: 'transporte', nome: 'Transporte e logística', tipo: 'setor', icone: '🚚' },
  { id: 'suprimentos', nome: 'Suprimentos e compras', tipo: 'setor', icone: '📦' },
  { id: 'planejamento', nome: 'Planejamento', tipo: 'setor', icone: '📅' },
  { id: 'projetos', nome: 'Projetos', tipo: 'setor', icone: '📐' },
  { id: 'comercial', nome: 'Comercial', tipo: 'setor', icone: '💼' },
  { id: 'orcamentos', nome: 'Orçamentos', tipo: 'setor', icone: '🧾' },
  { id: 'financeiro', nome: 'Financeiro', tipo: 'setor', icone: '💰' },
  { id: 'rh', nome: 'RH', tipo: 'setor', icone: '👥' },
  { id: 'estoque', nome: 'Estoque', tipo: 'pagina', pagina: 'estoque', icone: '🧰' },
  { id: 'marketing', nome: 'Marketing', tipo: 'pagina', pagina: 'marketing', icone: '📣' },
];

// treinamentos com slides (imagem + legenda). Cada um aparece no bloco do menu a que pertence (campo topico).
export const SUBTOPICOS = [
      {
        id: 'agenda-usar', topico: 'agenda', funcoes: 'todos', titulo: 'Como usar a Agenda (semana e dia)', para: 'Todos',
        resumo: 'A Agenda mostra as suas tarefas nos dias e horários, em dois modos: Semana e Dia. Concluir, excluir, arrastar e as funções da semana.',
        slides: [
          { imagem: img('agenda-01-menu'), titulo: 'Onde fica e o que mostra', texto: 'No menu da esquerda, em Meu trabalho, clique em Agenda. Ela mostra as SUAS tarefas (as que têm você como responsável ou gestor) em cima de um calendário. Na lateral esquerda ficam os cartões das suas Funções, e o resto da tela é o calendário.',
            dica: 'Só aparecem tarefas que têm prazo. Tarefa sem prazo fica só na tela Tarefas.' },
          { imagem: img('agenda-02-modos'), titulo: 'Dois modos: Semana e Dia', texto: 'No alto da tela, ao lado do título, fica o seletor "Modo de visualização": Semana ou Dia. Semana mostra de segunda a sexta (sábado só aparece se tiver tarefa) com os dias lado a lado. Dia mostra só um dia, com cartões grandes e fáceis de ler: título, obra, departamento, responsável e prioridade.',
            legenda: ['Semana: a semana inteira, para planejar.', 'Dia: um dia só, com cartões maiores, para ler com calma.'],
            dica: 'No modo Dia use "← Dia anterior", "Hoje" e "Próximo dia →", ou clique direto no dia da semana (o número mostra quantas tarefas há naquele dia). No modo Semana use "Semana anterior" e "Próxima semana".' },
          { imagem: img('agenda-03-diatodo'), titulo: 'Faixa "dia todo" e tarefas com horário', texto: 'Tarefa SEM horário fica numa faixa chamada "dia todo", logo abaixo do nome do dia (igual ao Google Agenda). Tarefa COM horário vira um cartão na grade, começando na hora marcada e com a altura da duração (a grade vai das 8h às 17h30, de meia em meia hora).',
            dica: 'Para dar horário a uma tarefa, arraste o cartão da faixa "dia todo" para a hora desejada. Para tirar o horário, arraste de volta para a faixa.' },
          { imagem: img('agenda-04-arrastar'), titulo: 'Arrastar e esticar', texto: 'Segure um cartão e arraste para outro horário ou outro dia: o prazo e o horário mudam na hora. Puxe a borda de baixo do cartão para mudar a duração (de 30 em 30 minutos). Clicar no cartão (sem arrastar) abre a tarefa.',
            dica: 'Mudou de dia uma tarefa que já passou do prazo? Fica registrado como reprogramação: a data antiga é guardada.' },
          { imagem: img('agenda-05-concluir'), titulo: 'Concluir e excluir direto no cartão', texto: 'Passe o mouse sobre o cartão (no celular os botões ficam sempre à vista): aparecem o botão ✓, que conclui a tarefa, e o ×, que exclui. Tarefa concluída fica verde e riscada, e o botão vira ↺ para reabrir.',
            legenda: ['✓ Concluir a tarefa (↺ reabre, se já estiver concluída).', '× Excluir. Se a tarefa veio de uma ata, ela só sai da lista e o item continua na ata.'],
            dica: 'Concluir não pede mais para escolher a função da tarefa.' },
          { imagem: img('agenda-06-cores'), titulo: 'As cores dos cartões', texto: 'Vermelho: tarefa vencida. Azul: vence hoje. Cinza: vence nos próximos dias. Verde: concluída. A vencida não some: continua no dia em que venceu até você resolver (concluir ou escolher outra data).' },
          { imagem: img('agenda-07-funcoes'), titulo: 'Cartões de Funções e as 5 bolinhas', texto: 'Na lateral esquerda cada Função do seu cargo é um cartão com 5 bolinhas, uma para cada dia útil (S, T, Q, Q, S). A bolinha fica verde quando a tarefa daquela função é concluída naquele dia; amarela, quando só parte foi concluída; vermelha, quando o dia passou sem concluir; contorno azul é hoje; cinza é um dia que ainda vai chegar.',
            dica: 'Para ligar uma tarefa a uma função, escolha a função dentro da tarefa (campo "Função (Agenda)"). É opcional.' },
          { imagem: img('tarefa-nova-07-escopo'), titulo: 'Se a tarefa é recorrente', texto: 'Tarefa recorrente se repete toda semana ou todo mês e aparece em cada repetição, no mesmo dia. Ao arrastar ou mexer em uma delas, o sistema pergunta: "Só esta tarefa" ou "Esta e as próximas". O mesmo vale para excluir.' },
        ],
      },
      {
        id: 'tarefas-usar', topico: 'tarefas', funcoes: 'todos', titulo: 'Como usar as Tarefas (Tabela e Lista)', para: 'Todos',
        resumo: 'Os dois modos (Tabela e Lista), os filtros, a prioridade, concluir e imprimir.',
        slides: [
          { imagem: img('tarefas-01-quadro'), titulo: 'O que são as Tarefas', texto: 'Tarefas reúne as tarefas que saem das atas e as que são criadas direto aqui. Quem é de obra vê as das suas obras; os demais veem as suas, as de quem responde a você e as que observam. A diretoria e o administrativo veem tudo.' },
          { imagem: img('tarefas-06-modos'), titulo: 'Dois modos de visualização', texto: 'No alto da tela, ao lado do título, fica o seletor "Modo de visualização": Tabela ou Lista. A Tabela é um quadro com uma coluna por prazo: Vencido, Hoje, Esta semana, Próxima semana, Sem prazo, Em duas semanas ou mais e Concluído. A Lista mostra o dia escolhido, em cartões grandes, com as tarefas atrasadas e as sem prazo juntas, agrupadas por obra ou departamento.',
            dica: 'Na Tabela arraste o cartão para outra coluna para mudar o prazo (soltou em Concluído, a tarefa é concluída). Na Lista use as setas e o botão Hoje para trocar o dia.' },
          { imagem: img('tarefas-07-cartao'), titulo: 'O cartão da tarefa', texto: 'Cada cartão mostra o título, a data (com os dias de atraso, se vencida) e a prioridade, o responsável e a obra ou o departamento. Clique no título para mudar o nome ali mesmo (só o texto depois da vírgula; o assunto não muda): Enter salva e Esc cancela. Clique em qualquer outro canto do cartão, fora dos botões, para abrir a janela da tarefa.' },
          { imagem: img('tarefas-02-filtros'), titulo: 'Filtros: Responsável, Setor, Obra e Procurar', texto: 'No filtro Responsável há Todos, Só as minhas, Terceirizados, Clientes e Arquitetura. Embaixo fica o grupo "Equipe da Sólida", com a opção "Equipe da Sólida (todos)" e o nome de cada pessoa, para ver as tarefas de alguém específico. A diretoria e o administrativo escolhem qualquer pessoa; os demais, quem podem acompanhar. Os outros filtros são Setor, Obra e Procurar (busca por texto) e há "Ordenar por" (prioridade, data, assunto ou responsável).',
            dica: 'Na Lista a caixa se chama "Ver tarefas de" e funciona do mesmo jeito.' },
          { imagem: img('tarefas-08-prioridade'), titulo: 'Prioridade (urgência)', texto: 'Cada tarefa pode ter prioridade Alta, Média ou Baixa, escolhida na janela da tarefa (campo Urgência). Ela aparece como uma etiqueta colorida no cartão: vermelha, amarela e verde. Tarefa sem prioridade não mostra nada.' },
          { imagem: img('tarefas-09-concluir'), titulo: 'Concluir e excluir', texto: 'Para concluir, use o botão "concluir" do cartão (ou arraste para a coluna Concluído, na Tabela). Concluir não exige escolher a função. Excluir uma tarefa que veio de uma ata só a tira da lista: o item continua na ata. Tarefa avulsa é apagada de verdade.' },
          { imagem: img('tarefas-10-imprimir'), titulo: 'Imprimir', texto: 'O botão "🖨 Imprimir" fica ao lado do seletor de modo. A folha sai com um cabeçalho igual ao das atas: logo, o título "TAREFAS" com a data e, no canto de cima à direita, a obra ou o departamento filtrado, com uma linha dizendo de quem são as tarefas. O cabeçalho se repete em todas as páginas e o rodapé mostra "Página 1 de 3", "Página 2 de 3"… Tarefas concluídas não são impressas. A Lista sai colorida como na tela.',
            dica: 'Na janela de impressão do navegador, marque "Gráficos de segundo plano" para as cores saírem, e desmarque "Cabeçalhos e rodapés" se o endereço do site aparecer.' },
        ],
      },
      {
        id: 'tarefa-nova', topico: 'tarefas', funcoes: 'todos', titulo: 'Criar e editar uma tarefa', para: 'Todos',
        resumo: 'A janela de nova tarefa, a janela da tarefa com anotações e os observadores.',
        slides: [
          { imagem: img('tarefa-nova-01-criar'), titulo: 'Criar uma tarefa', texto: 'Na Lista, o botão "Nova tarefa" abre a janela de criação; na Tabela, o + de cada coluna cria uma tarefa já com o prazo da coluna. Os campos com borda vermelha são obrigatórios: assunto e título (o que fazer), responsável, departamento e prazo. A obra é opcional.' },
          { imagem: img('tarefa-nova-02-responsavel'), titulo: 'Responsável: Sólida ou externo', texto: 'Escolha o tipo: Sólida (e aí a pessoa), Terceirizado (nome da empresa ou pessoa), Cliente ou Arquitetura. Se a pessoa for da Sólida, o gestor dela é definido sozinho pelas obras e pelos departamentos.' },
          { imagem: img('tarefa-nova-03-opcionais'), titulo: 'Campos opcionais', texto: 'Abaixo da linha ficam os campos opcionais: Função (Agenda), Urgência (prioridade) e Observadores. Observadores são pessoas que acompanham a tarefa sem ser responsáveis: clique nos nomes da lista para acrescentar e no × para tirar. O gestor aparece travado, com um cadeado.',
            dica: 'O horário e a duração da tarefa se escolhem na janela dela depois de criada, ou arrastando o cartão na Agenda.' },
          { imagem: img('tarefa-nova-04-importar'), titulo: 'Importar uma lista de pendências (PDF)', texto: 'Na aba Tarefas, ao lado de "Imprimir", fica o botão "⬆ Importar lista". Escolha o PDF de uma lista de pendências: cada linha vira uma tarefa. O sistema lê dois modelos. (1) A lista com várias pessoas e obras: tabela Nº · Obra · Descrição · Responsável · Urgência · Desde · Previsto; cada linha traz a obra, o responsável, a prioridade e o prazo (o "Previsto"). (2) A "Ata de pendências — Nome", de uma pessoa só: tabela Obra · Pendência · Urgência · Pendente desde · Observação; a pessoa do título é a responsável de todas, o prazo é a data da ata (ou o dia que a observação disser: "prazo era 11/11", "Marcada para 12/11"), "às 9h" vira o horário e "Com a Julia" põe a Julia como observadora. A observação vai para as anotações da tarefa. Depois de ler, aparece a tabela de conferência: corrija o que precisar, desmarque o que não quiser e clique em "Criar tarefas".',
            dica: 'O assunto sai do que tem que ser feito (compatibilizar vira COMPATIBILIZAÇÃO, relatório vira RELATÓRIO, metas vira METAS) e a obra fica só na caixinha de obra. Obra que o sistema não achou aparece em branco, com "no PDF: Mo602" embaixo: escolha na caixinha ou use "+ Nova obra em orçamento…". Ata de reunião continua sendo importada na aba Atas, não aqui.' },
          { imagem: img('tarefa-nova-05-recorrente'), titulo: 'Tarefa recorrente: criar', texto: 'Ao lado do prazo há a caixinha "Tarefa recorrente" e, junto dela, a escolha "Toda semana" ou "Todo mês". Marcada, a tarefa se repete: toda semana, no mesmo dia da semana, ou todo mês, no mesmo dia do mês (nos meses curtos cai no último dia). O sistema cria as primeiras 12 repetições e vai criando as próximas sozinho.',
            dica: 'Cada repetição é uma tarefa de verdade: dá para concluir só a de hoje, e as outras continuam abertas.' },
          { imagem: img('tarefa-nova-06-transformar'), titulo: 'Tarefa recorrente: transformar uma tarefa que já existe', texto: 'Abra a tarefa, marque "Tarefa recorrente" ao lado do prazo, escolha semanal ou mensal e clique em "Salvar alterações": a tarefa vira a primeira da série e o sistema cria as próximas. Depois que a tarefa é recorrente, a caixinha aparece marcada e travada.' },
          { imagem: img('tarefa-nova-07-escopo'), titulo: 'Tarefa recorrente: mudar ou excluir', texto: 'Ao arrastar o cartão na Agenda, ao salvar a janela da tarefa ou ao excluir, o sistema pergunta: "Só esta tarefa" muda ou apaga apenas aquela repetição; "Esta e as próximas" vale para ela e para todas as seguintes (se você mudar o dia, as próximas andam junto). As anteriores nunca mudam. Quem pode excluir é quem criou a tarefa, o responsável e a diretoria.',
            dica: 'Concluir e reprogramar a data pelo calendário valem só para a tarefa que você mexeu, sem pergunta.' },
          { imagem: img('tarefa-nova-08-janela'), titulo: 'A janela da tarefa e as anotações', texto: 'Clicar no cartão abre a janela da tarefa, com dois quadros brancos: à esquerda os dados da tarefa (título, responsável, prazo, horário, duração, função, urgência e observadores) e à direita as anotações, que funcionam como um chat da tarefa. Cada anotação mostra quem escreveu e quando. As reprogramações de prazo também aparecem ali, como avisos.',
            dica: 'Depois de mudar um campo, clique em "Salvar alterações". Clicar fora da janela, na parte transparente, fecha sem salvar.' },
        ],
      },
      {
        id: 'ata-criar', topico: 'atas', funcoes: 'todos', titulo: 'Como criar uma ata no sistema', para: 'Todos',
        resumo: 'Do menu até a ata pronta: dados, itens, importação de ata pronta, PDF no Drive e acompanhamento das pendências.',
        slides: [
          { imagem: img('ata-01-menu'), titulo: 'Onde ficam as atas', texto: 'Toda reunião vira uma ata no sistema, e quem faz a ata é qualquer pessoa da equipe. No menu da esquerda, em Meu trabalho, clique em Atas. Cada pessoa vê as atas do seu departamento (e das suas obras) e as que ela mesma criou; as tarefas que saem das atas vão para quem é o responsável e ficam em Tarefas, mesmo que o responsável seja de outro departamento.',
            legenda: ['Atas: a lista das atas e o botão para criar uma nova.'] },
          { imagem: img('ata-02-nova-ata'), titulo: 'Comece pelo botão "+ Nova ata"', texto: 'Na tela Atas, no alto, à esquerda, fica o botão + Nova ata. Para criar uma ata, clique nele.',
            legenda: ['+ Nova ata: aqui você cria a ata.', 'Tarefas: aqui ficam as tarefas de todo mundo, em um quadro por prazo (vencido, hoje, esta semana…).'] },
          { imagem: img('ata-03-dados'), titulo: 'Preencha os dados da reunião', texto: 'Estes campos são obrigatórios: sem eles a ata não salva.',
            legenda: ['Data da reunião.', 'Obra da reunião. Se não for de uma obra, escolha "Nenhuma".', 'Departamento: escolha sempre um.', 'Nome da ata: sai sozinho no padrão da Sólida (obra, data, tipo e revisão) e é o nome do PDF que vai para o Drive.', 'Local: online, no escritório, na obra…', 'Participantes: escreva Nome (empresa), separados por vírgula. Exemplo: Maria (Sólida), João (Cliente), Ana (Arquitetura).'],
            dica: 'O tipo da reunião (reunião, arquitetura, cliente…) fica ao lado da data e entra no nome da ata.' },
          { imagem: img('ata-04-itens'), titulo: 'Cada linha é uma pendência ou um informativo', texto: 'Abaixo dos dados ficam as linhas da ata. Escolha o tipo de cada uma e preencha: assunto e descritivo são sempre duas caixinhas.',
            legenda: ['Tipo da linha: Pendência (vermelho) quando alguém precisa fazer algo.', 'Assunto: uma ou duas palavras, sempre em caixa alta (MARCENARIA).', 'O que fazer (ou o que foi dito).', 'Quem é o responsável: Sólida (escolha a pessoa), Terceirizado (nome da empresa ou pessoa), Cliente ou Arquitetura.', 'Prazo: obrigatório em toda pendência. Clique no campo para escolher a data.', 'Informativo (verde): só registra o que foi dito ou decidido. Tem quem informou, mas não tem prazo.'],
            dica: 'Precisa de mais linhas? Use "+ outro item". O × tira a linha. Pendência vai para a lista de pendências das pessoas; informativo só fica na ata.' },
          { imagem: img('ata-05-faltando'), titulo: 'Círculo vermelho = ainda falta preencher', texto: 'O sistema mostra, com um círculo vermelho, tudo que precisa ser preenchido para a ata poder ser salva. Quando você completa, o círculo some.',
            legenda: ['Obra.', 'Departamento.', 'Local.', 'O que fazer: em toda linha que você começou, preencha assunto, descritivo, responsável e prazo (nas pendências).'],
            dica: 'Linha em branco é ignorada. Só as linhas que você começou a preencher precisam estar completas.' },
          { imagem: img('ata-06-salvar'), titulo: 'A ata sai no padrão da Sólida', texto: 'Ao clicar em Salvar ata, ela aparece como a ata da Sólida: cabeçalho com logo, tabela com item, tipo, responsável e data limite.',
            legenda: ['Nome da ata, no padrão: obra, data, tipo e revisão.', 'A tabela da ata: pendência em vermelho, informativo em verde. O PDF vai sozinho para o Drive, em até 10 minutos: ata de obra na pasta GERENCIAMENTO › ATAS da obra; ata de pós-obra em PÓS OBRA › PO_OBRAS › ano › pasta do pós-obra; ata de departamento (sem obra) na pasta do departamento. As pastas que faltam são criadas.', 'Criar revisão: abre a ata para você mexer em qualquer coisa (dados, itens, participantes). A ata ganha R01, R02… e o PDF novo vai para o Drive; o antigo continua lá.', 'Pauta da próxima reunião: monta o que ficou aberto desta ata, pronto para copiar.'] },
          { imagem: img('ata-12-imprimir'), titulo: 'Imprimir a ata', texto: 'Com a ata aberta, o botão "🖨 Imprimir ata" fica no alto, ao lado de "← Todas as atas". A folha sai só com a ata, no padrão da Sólida (cabeçalho com logo, tabela de itens, tipo, responsável e data limite), em A4, sem os botões da tela. Na janela de impressão do navegador, escolha a impressora ou "Salvar como PDF".',
            dica: 'Se aparecer o endereço do site no rodapé, desmarque "Cabeçalhos e rodapés" na janela de impressão. As cores da ata (pendência em vermelho, informativo em verde) saem se você marcar "Gráficos de segundo plano".' },
          { imagem: img('ata-11-nova'), titulo: 'Importar fica fechado até você precisar', texto: 'Ao abrir uma nova ata, o formulário já vem pronto para preencher. A caixa de importar uma ata pronta (PDF) ou colar a transcrição fica fechada: clique nela só quando for usar.',
            legenda: ['Importar uma ata pronta ou colar a transcrição: clique para abrir.', 'O formulário da ata: comece pelos dados da reunião.'] },
          { imagem: img('ata-08-importar'), titulo: 'Importar um PDF ou colar o texto', texto: 'Já tem a ata pronta em PDF, ou o texto num e-mail ou aplicativo? Não precisa digitar de novo. Abra a caixa de importar e escolha uma das duas formas.',
            legenda: ['Escolher arquivo: envie o PDF (ou arquivo de texto) da ata. Atas no padrão da Sólida são lidas por inteiro, linha a linha.', 'Ou cole o texto da ata aqui.', 'Ler o texto colado: o sistema monta as linhas da ata, com responsável e prazo quando conseguir achar.'],
            dica: 'PDF que é foto ou digitalização não tem texto para ler: nesse caso cole o texto. Depois de importar, confira e complete o que faltar.' },
          { imagem: img('ata-09-depois'), titulo: 'Depois da ata: reprogramar uma data', texto: 'Na ata salva, clique na data de uma pendência para escolher outro dia. A data antiga fica guardada e a pendência aparece como "reprogramada".',
            legenda: ['Clique na data da pendência.', 'O calendário mostra os feriados em vermelho. Escolha o novo dia.'],
            dica: 'Para dar a pendência como feita, clique no ✓ ao lado da data.' },
          { imagem: img('ata-10-pendencias'), titulo: 'Acompanhe tudo em Tarefas', texto: 'A tela Tarefas reúne as pendências de todas as atas (veja o treinamento "Como usar as Tarefas"). Você filtra por responsável, setor ou obra e vê o que está vencido, o que vence hoje e o que vem pela frente, na Tabela ou na Lista.',
            dica: 'Excluir uma pendência da lista não apaga o item da ata: a ata só muda por uma revisão.' },
        ],
      },
      {
        id: 'pauta-usar', topico: 'atas', funcoes: 'todos', titulo: 'Como montar a pauta da próxima reunião', para: 'Todos',
        resumo: 'A aba Pautas reúne o que ficou em aberto, por obra ou departamento, e copia em texto para o e-mail ou o WhatsApp.',
        slides: [
          { imagem: img('pauta-01-onde'), titulo: 'Onde fica a pauta', texto: 'Na tela Atas há duas abas: Atas e Pautas. A pauta junta, em um lugar só, tudo o que ainda está em aberto das atas e das tarefas daquela obra ou daquele departamento, para você levar para a próxima reunião sem ter que abrir ata por ata.' },
          { imagem: img('pauta-02-para-quem'), titulo: 'Escolha para quem é a pauta', texto: 'A pauta só aparece depois que você escolhe um filtro, senão a lista ficaria enorme. Em "Pauta para" escolha Arquitetura, Arquitetura e cliente, Cliente ou Terceirizados da obra; use também Departamento, Obra e Procurar. Em "Ordenar por" escolha o prazo mais próximo ou a ordem alfabética.',
            dica: 'Cada obra ou departamento vira um cartão, com a quantidade de itens em aberto e a data da última ata.' },
          { imagem: img('pauta-03-ler'), titulo: 'Ler a pauta', texto: 'Cada item mostra o assunto, o título, quem é o responsável e o prazo. Os itens atrasados aparecem em vermelho. Clicar em um item abre a tarefa, onde você vê as anotações e pode reprogramar o prazo ou concluir.' },
          { imagem: img('pauta-04-copiar'), titulo: 'Copiar a pauta', texto: 'O botão "Copiar pauta", em cada cartão, copia a pauta em texto, pronta para colar no e-mail ou no WhatsApp e mandar para os participantes antes da reunião.',
            dica: 'Depois da reunião, crie a ata nova: o que foi resolvido você conclui nas tarefas, e o que ficou entra na ata seguinte.' },
        ],
      },
      {
        id: 'estoque-abas', topico: 'estoque', funcoes: 'todos', titulo: 'O Estoque e as suas abas', para: 'Quem acessa o Estoque',
        resumo: 'O estoque do galpão e, embaixo do título, as abas de contagem, guia de movimentação, pedidos, checklists e reposição.',
        slides: [
          { imagem: img('estoque-01-abas'), titulo: 'Só o estoque, e as abas embaixo do título', texto: 'A tela Estoque mostra só o estoque do galpão: o resumo e a lista de itens, com a quantidade e o mínimo. O que se faz com o estoque fica nas abas logo abaixo do título: Contagem do estoque (digitar o que foi contado, no lugar da folha escrita à mão), Guia de movimentação (registrar saídas, entradas e consertos, com foto), Pedir itens do estoque, Checklists de ferramentas e Reposição (o que falta e o que comprar).',
            legenda: ['Estoque: o resumo e a lista de itens do galpão.', 'Contagem do estoque: escolha o local, digite só o que contou e salve.', 'Guia de movimentação: registre qualquer movimentação de ferramentas e materiais.', 'Pedir itens do estoque (em preparação).'],
            dica: 'Na Reposição dá para filtrar por categoria (ferramentas, maquinários, limpeza…): a lista de compras e as rotas consideram só as categorias marcadas.' },
          { imagem: img('estoque-02-guia'), titulo: 'Imprimir a guia de movimentação', texto: 'Na aba Guia de movimentação, cada guia tem o botão "🖨 Imprimir esta guia". Ele imprime só aquela guia, em papel, com data, responsável, origem, destino, item e quantidade, e linhas em branco para completar à mão. Na janela de impressão do navegador, escolha a impressora ou "Salvar como PDF".' },
        ],
      },
      {
        id: 'paineis-usar', topico: 'operacao', funcoes: 'todos', titulo: 'Como ler o painel de um departamento', para: 'Todos',
        resumo: 'Todo departamento segue o mesmo desenho: uma pergunta, indicadores com meta e "quem precisa agir".',
        slides: [
          { imagem: img('painel-01-departamento'), titulo: 'Uma pergunta por painel', texto: 'Cada departamento do menu tem um painel com o mesmo desenho. No alto, a faixa escura diz a pergunta que aquele painel responde. Abaixo vêm os indicadores, cada um com o valor, a meta, a fonte e a data da leitura. A tela completa de antes continua na aba "Detalhes".',
            legenda: ['A pergunta que o painel responde.', 'Detalhes: a tela completa que já existia.'],
            dica: 'A faixa rosa no alto avisa de onde e de quando são os números. Traço (—) quer dizer que a fonte ainda não é lida pelo sistema: o sistema nunca inventa número.' },
          { imagem: img('painel-02-agir'), titulo: 'Quem precisa agir, e o botão Criar tarefa', texto: 'Cada alerta aparece com o nível (crítico ou atenção), o que está acontecendo, o responsável e o prazo. Clique em "Criar tarefa" e o alerta vira uma tarefa já preenchida, com o texto, a obra e o setor: é só escolher o responsável e o prazo.',
            legenda: ['Nível do alerta: crítico (vermelho) ou atenção (amarelo).', 'Criar tarefa: o alerta vira tarefa com responsável e data-limite.'] },
        ],
      },
      {
        id: 'posobra-os', topico: 'posobra', funcoes: 'todos', titulo: 'Quadro de OS do Pós-obra', para: 'Quem acessa o Pós-obra',
        resumo: 'O quadro de OS por etapa, com todas as colunas à vista.',
        slides: [
          { imagem: img('posobra-01-quadro'), titulo: 'O quadro', texto: 'No Pós-obra e na página Início do pós-obra fica o Quadro de OS. Cada cartão é uma OS e cada coluna é uma etapa, da esquerda para a direita: Solicitação, Análise, Orçamento, Falta agendar, Agendado, Em execução e Concluído. Todas as colunas aparecem ao mesmo tempo.',
            dica: 'A coluna é a situação real da OS: uma OS "em execução" não pode estar com orçamento pendente. Se algo estiver errado, confira o cadastro da OS.' },
          { imagem: img('posobra-02-os'), titulo: 'Abrir e mover uma OS', texto: 'Arraste o cartão para a coluna certa ou clique nele para abrir: problema, solução, fotos, responsável e datas. As fotos da OS ficam guardadas no próprio sistema.' },
          { imagem: img('posobra-03-controle'), titulo: 'Controle de obras: a visão geral dos pós-obras', texto: 'Em Pós-Obra › Detalhes › "Controle de obras" fica a lista do Controle Operacional (planilha), feita com os dados do sistema e em ordem de número do PO. Cada PO é uma faixa e embaixo dela vêm as suas OS, uma linha por OS, com o status (a fase) em coluna própria e o problema e a solução da OS. A OS não tem responsável nem prazo: quem faz o quê são as PENDÊNCIAS dela, que surgem a partir da fase em que a OS está. Use "+ pendência" na OS (a pendência nasce na fase atual, que aparece nela) e defina o responsável e o prazo direto na linha da pendência. Embaixo de cada PO, o campo "Nova OS". Tudo o que é pós-obra é PO (nada de MO).',
            dica: 'Uma OS pode ter várias pendências em cada fase: orçamento, falta agendar, execução… Clique no texto de uma pendência para abrir a tarefa (anotações, prioridade, observadores). Os cartões do alto contam os pós-obras por situação e filtram a lista.' },
        ],
      },
      {
        id: 'rh-resumo', topico: 'rh', funcoes: 'todos', titulo: 'RH: resumo dos funcionários', para: 'Quem acessa o RH',
        resumo: 'A tabela de funcionários por obra com o programado e o realizado.',
        slides: [
          { imagem: img('rh-01-tabela'), titulo: 'A tabela do RH', texto: 'No painel do RH a seção "Programado × realizado" é uma tabela com cada funcionário: em que obra ele foi programado em cada dia (planilha de distribuição) e onde realmente apareceu no efetivo. Logo abaixo ficam faltas e atrasos, controle de férias e os outros indicadores do RH.',
            dica: 'Dado que o sistema ainda não consegue ler aparece com traço (—): o sistema nunca inventa número.' },
        ],
      },
      {
        id: 'materiais-vendas', topico: 'materiais', funcoes: 'todos', titulo: 'Materiais / Vendas', para: 'Quem acessa Materiais / Vendas',
        resumo: 'O painel de materiais: saídas do galpão, material vendido e consumíveis abaixo do mínimo.',
        slides: [
          { imagem: img('materiais-01-painel'), titulo: 'Materiais / Vendas', texto: 'O painel "Materiais / Vendas" mostra as saídas do galpão (no mês e por obra), o material vendido e quantos consumíveis estão abaixo do mínimo, com link para o Estoque. Número que o sistema ainda não soma aparece com traço (—): o sistema nunca inventa valor. A venda de materiais saiu do Transporte e logística e ficou aqui.' },
        ],
      },
      {
        id: 'ver-como', topico: 'diretoria', funcoes: ['socio'], titulo: 'Ver como: usar o sistema no lugar de um cargo', para: 'Diretoria',
        resumo: 'A faixa Ver como mostra o sistema do jeito que um cargo enxerga e usa.',
        slides: [
          { imagem: img('vercomo-01'), titulo: 'O que é', texto: 'No alto da tela, só para a diretoria, fica a faixa "Ver como", com os cargos. Clique em um cargo, por exemplo Gestor de obra, e o sistema passa a mostrar e a se comportar como aquele cargo: menu, telas, tarefas visíveis e as funções que aparecem ao concluir ou criar uma tarefa.',
            dica: 'Use para conferir o que cada pessoa vê e para testar uma tela antes de pedir que alguém use.' },
          { imagem: img('vercomo-02-voltar'), titulo: 'Como voltar', texto: 'Clique em "Diretoria" na mesma faixa para voltar ao seu próprio acesso. Continua valendo que só você, da diretoria, aprova pedidos de alteração e vê valores e faturamento.' },
        ],
      },
      {
        id: 'config-cadastros', topico: 'diretoria', funcoes: ['socio'], titulo: 'Configurações e Cadastros', para: 'Diretoria',
        resumo: 'Quem vê cada tela (Configurações) e as listas de obras, setores e pessoas (Cadastros).',
        slides: [
          { imagem: img('config-01-cadastros'), titulo: 'Cadastros: a fonte das listas', texto: 'Em Cadastros ficam as obras (e pós-obras), os setores (departamentos) e as pessoas com seus logins. Tudo o que você cria ou exclui ali aparece na hora, em todas as telas: atas, tarefas, filtros, agenda, acessos e painéis. As listas de obras, setores e pessoas nunca ficam escritas no código.',
            dica: 'Criou uma obra nova e ela não apareceu em algum seletor? Avise: isso é um erro do sistema, não falta de cadastro.' },
          { imagem: img('config-02-quem-ve'), titulo: 'Configurações: quem vê o quê', texto: 'Em Configurações (último item do menu da esquerda) a diretoria escolhe quais cargos veem cada tela, cada departamento, cada bloco da página Início e opções como "ver as atas de todos os departamentos". O menu da esquerda de Configurações tem os mesmos grupos do menu do sistema (Meu trabalho, Departamentos, Resultados, Equipe).',
            dica: 'Cada tela tem o botão de voltar ao padrão. A mudança vale para todos assim que for salva.' },
        ],
      },
];
const registrados = [];
export function registrar(lista) { registrados.length = 0; registrados.push(...lista); }
export const todosSub = () => [...SUBTOPICOS, ...registrados];
// ---------------------------------------------------------------- visto
const CHAVE = 'solida.treinamentos';
export function vistos() { try { return new Set((JSON.parse(localStorage.getItem(CHAVE)) || {})[idPessoa()] || []); } catch { return new Set(); } }
function marcarVisto(id) { try { const t = JSON.parse(localStorage.getItem(CHAVE)) || {}; const e = new Set(t[idPessoa()] || []); e.add(id); t[idPessoa()] = [...e]; localStorage.setItem(CHAVE, JSON.stringify(t)); } catch { /* sem armazenamento */ } }
export const acharSub = (id) => { const s = todosSub().find((x) => x.id === id); return s ? { sub: s } : null; };

// ---------------------------------------------------------------- apresentação (slides)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let aberto = null;
export function fechar() { if (aberto) { aberto.caixa.remove(); document.removeEventListener('keydown', aberto.tecla); document.body.style.overflow = ''; aberto = null; } }
export function abrir(subId, inicio = 0, aoFechar = () => {}) {
  const achado = acharSub(subId); if (!achado) return;
  fechar();
  const { sub } = achado; let i = Math.max(0, Math.min(inicio, sub.slides.length - 1));
  const caixa = document.createElement('div'); caixa.className = 'tv'; caixa.setAttribute('role', 'dialog'); caixa.setAttribute('aria-label', sub.titulo);
  // Todos os passos são montados de uma vez (as imagens já carregam todas ao abrir) e a troca é só um deslize suave de um trilho:
  // nada é redesenhado nem recarregado a cada passo. A caixa tem tamanho fixo, igual em todos os passos.
  const total = sub.slides.length;
  const slide = (s) => `<div class="tv-slide">
      ${s.imagem ? `<div class="tv-palco"><a href="${esc(s.imagem)}" target="_blank" rel="noopener" title="Clique para ver a imagem em tamanho grande"><img src="${esc(s.imagem)}" alt="${esc(s.titulo)}" loading="eager" decoding="async"></a></div>` : ''}
      <section class="tv-texto ${s.imagem ? '' : 'tv-so-texto'}"><h3>${esc(s.titulo)}</h3><p>${esc(s.texto)}</p>
        ${s.legenda && s.legenda.length ? `<ol class="tv-legenda">${s.legenda.map((l, k) => `<li><span>${k + 1}</span>${esc(l)}</li>`).join('')}</ol>` : ''}
        ${s.dica ? `<p class="tv-dica"><b>Dica:</b> ${esc(s.dica)}</p>` : ''}</section></div>`;
  caixa.innerHTML = `<div class="tv-corpo">
      <header class="tv-topo"><div><b>${esc(sub.titulo)}</b><span data-tv-passo></span></div><button type="button" class="tv-fechar" data-tv="fechar" aria-label="Fechar">×</button></header>
      <div class="tv-janela"><div class="tv-trilho">${sub.slides.map(slide).join('')}</div>
        <button type="button" class="tv-seta tv-seta-esq" data-tv="ant" aria-label="Passo anterior" title="Anterior (←)">‹</button>
        <button type="button" class="tv-seta tv-seta-dir" data-tv="prox" aria-label="Próximo passo" title="Próximo (→)">›</button></div>
      <footer class="tv-rodape"><div class="tv-bolas">${sub.slides.map((_, k) => `<button type="button" data-tv-ir="${k}" aria-label="Passo ${k + 1}"></button>`).join('')}</div>
        <button type="button" class="botao on tv-fim" data-tv="fim" hidden>✓ Concluir treinamento</button></footer></div>`;
  const trilho = caixa.querySelector('.tv-trilho'); const slidesEl = [...caixa.querySelectorAll('.tv-slide')]; const bolas = [...caixa.querySelectorAll('[data-tv-ir]')];
  const desenhar = () => {
    trilho.style.transform = `translateX(-${i * 100}%)`;
    slidesEl.forEach((el, k) => { el.setAttribute('aria-hidden', k === i ? 'false' : 'true'); if (k === i) { const t = el.querySelector('.tv-texto'); if (t) t.scrollTop = 0; } });
    bolas.forEach((b, k) => b.classList.toggle('on', k === i));
    caixa.querySelector('[data-tv-passo]').textContent = `Passo ${i + 1} de ${total}`;
    const ant = caixa.querySelector('.tv-seta-esq'); const prox = caixa.querySelector('.tv-seta-dir');
    ant.disabled = i === 0; prox.disabled = i === total - 1;
    caixa.querySelector('.tv-fim').hidden = i !== total - 1;
  };
  const ir = (n) => { i = Math.max(0, Math.min(n, total - 1)); desenhar(); };
  // arrastar o dedo para os lados (celular)
  let x0 = null; caixa.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  caixa.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) ir(i + (dx < 0 ? 1 : -1)); }, { passive: true });
  caixa.addEventListener('click', (e) => {
    if (e.target === caixa) { fechar(); aoFechar(); return; }
    const b = e.target.closest('[data-tv],[data-tv-ir]'); if (!b) return;
    if (b.dataset.tvIr !== undefined) { ir(Number(b.dataset.tvIr)); return; }
    if (b.dataset.tv === 'fechar') { fechar(); aoFechar(); } else if (b.dataset.tv === 'ant') ir(i - 1); else if (b.dataset.tv === 'prox') ir(i + 1);
    else if (b.dataset.tv === 'fim') { marcarVisto(sub.id); fechar(); aoFechar(); }
  });
  const tecla = (e) => { if (e.key === 'Escape') { fechar(); aoFechar(); } else if (e.key === 'ArrowRight') ir(i + 1); else if (e.key === 'ArrowLeft') ir(i - 1); };
  document.addEventListener('keydown', tecla); document.body.style.overflow = 'hidden';
  aberto = { caixa, tecla }; document.body.appendChild(caixa);
  trilho.style.transition = 'none'; desenhar(); void trilho.offsetWidth; trilho.style.transition = '';   // o primeiro passo aparece direto, sem deslizar
}
