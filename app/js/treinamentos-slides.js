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
  { id: 'feed', nome: 'Feed', tipo: 'pagina', pagina: 'feed', icone: '💬' },
  { id: 'treinamentos', nome: 'Treinamentos', tipo: 'pagina', pagina: 'treinamentos', icone: '🎓' },
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
        id: 'funcoes-usar', topico: 'agenda', funcoes: 'todos', titulo: 'Como usar as suas funções da semana (Agenda)', para: 'Todos',
        resumo: 'As funções da sua semana, na Agenda: como ver, marcar o que foi feito e o que não foi, e mudar o horário de cada uma.',
        slides: [
          { imagem: img('func-01-menu'), titulo: 'Onde fica', texto: 'A Agenda é a página onde você controla o seu trabalho do dia a dia: as funções da sua semana (antes chamada "Minhas funções") e as suas tarefas com prazo. No menu da esquerda, em Meu trabalho, clique em Agenda.',
            legenda: ['Agenda: as funções da sua função, de segunda a sexta, e as suas tarefas.', 'Treinamentos: aqui você revê este passo a passo quando quiser.'] },
          { imagem: img('func-02-quadro'), titulo: 'A sua semana', texto: 'Cada coluna é um dia (de segunda a sexta), as horas ficam na lateral (de meia em meia hora) e cada cartão é uma tarefa da sua função. O cartão tem a altura do tempo que a tarefa ocupa: uma tarefa de 8h às 9h ocupa as linhas das 8h e das 8h30. A barra mostra quantas você já marcou como feitas na semana.',
            legenda: ['O seu nome e a sua função.', 'Barra de progresso: tarefas feitas até hoje.', 'O dia: o de hoje fica destacado em amarelo e mostra quantas tarefas você já fez.', 'Um cartão = uma tarefa, do começo ao fim do horário dela. Tarefas no mesmo horário ficam lado a lado.'],
            dica: 'Tarefas de dias que ainda não chegaram aparecem em cinza: só dá para marcar de hoje para trás.' },
          { imagem: img('func-10-menu'), titulo: 'O menu recolhe para dar espaço', texto: 'Quando você abre uma página, o menu da esquerda recolhe e sobra só uma tirinha com uma setinha. Assim os dias da semana cabem na tela, com as horas na lateral.',
            legenda: ['Clique na setinha para abrir o menu de novo.'] },
          { imagem: img('func-03-marcar'), titulo: 'Marque cada tarefa: feito ou não feito', texto: 'Em cada cartão há dois botões. O sistema não marca nada por você: só vale o que você marcar.',
            legenda: ['O nome completo da tarefa.', 'Fez a tarefa? Clique em ✓ Feito.', 'Não deu para fazer? Clique em ✕ Não.'],
            dica: 'Errou? Clique de novo no botão já marcado para desfazer.' },
          { imagem: img('func-04-cores'), titulo: 'As cores dos cartões', texto: 'Depois de marcar, o cartão muda de cor para você bater o olho e ver o que falta.',
            legenda: ['Verde: você marcou como feita.', 'Vermelho: você marcou como não feita.', 'Amarelo: ainda falta você marcar (tarefa sem marcação conta como não entregue).'],
            dica: 'Sempre marque no mesmo dia: é mais fácil de lembrar e o seu progresso fica certo.' },
          { imagem: img('func-11-mover'), titulo: 'Mude o horário ou o dia de uma tarefa', texto: 'Quer fazer uma tarefa em outra hora, ou em outro dia da semana? Segure o cartão, arraste e solte no dia e na meia hora que quiser (se soltar às 9h30, a tarefa vai até as 10h). O novo horário e o novo dia ficam valendo nas próximas semanas, só para você: ninguém mais é afetado e eles não voltam sozinhos.',
            legenda: ['O cartão que você moveu fica marcado e mostra o novo horário.', '↺ movida: clique para voltar ao horário original do quadro.'],
            dica: 'Cada linha da grade é meia hora (11h, 11h30, 12h…): solte o cartão na linha onde a tarefa deve começar. Tarefa que você mudou de dia só pode ser marcada a partir do dia em que ela passou a ficar.' },
          { imagem: img('func-12-duracao'), titulo: 'Quanto tempo a tarefa ocupa no dia', texto: 'Puxe a borda de baixo do cartão para ele ocupar mais ou menos linhas, ou clique no cartão para abrir uma caixinha com os botões − 30 min e + 30 min. Aí você também pode marcar feito ou não feito. O cartão fica mais alto quando a tarefa ocupa mais tempo.',
            legenda: ['O nome completo da tarefa.', '− 30 min: a tarefa passa a ocupar menos tempo.', '+ 30 min: a tarefa passa a ocupar mais tempo.', 'Situação: ✓ Feito ou ✕ Não feito, igual no cartão.'],
            dica: 'A duração que você escolher vale para essa tarefa em todas as semanas e é só sua. Para voltar ao original, use "↺ Voltar ao quadro" na caixinha.' },
          { imagem: img('func-07-semanas'), titulo: 'Semanas anteriores e próximas', texto: 'Esqueceu de marcar alguma coisa? Volte à semana anterior e marque lá. Você também vê a semana que vem.',
            legenda: ['Semana anterior: volta e permite marcar o que ficou pendente.', 'A semana que você está vendo.', 'Próxima semana: só para consultar.'],
            dica: 'Tarefas de semanas passadas que ficaram sem marcação você marca direto na semana anterior.' },
          { imagem: img('func-08-fora'), titulo: 'Tarefas fora do quadro', texto: 'Algumas tarefas não têm dia certo (mensais, quinzenais, ocasionais). Elas ficam numa lista no fim da página, junto com as observações da sua função.',
            legenda: ['Fora do quadro: tarefas mensais e ocasionais e as observações da sua função.'] },
          { imagem: img('func-09-treinamento'), titulo: 'Pronto: é só isso', texto: 'Todo dia, abra a Agenda e marque ✓ Feito ou ✕ Não feito em cada tarefa. A marcação vale ponto e mostra para a diretoria como a semana está andando.',
            legenda: ['Para rever este passo a passo, clique em "Como funciona esta página", no fim da página.'],
            dica: 'Dúvida? Fale com o seu gestor ou use o botão "Pedir alteração" para sugerir uma melhoria.' },
        ],
      },
      {
        id: 'ata-criar', topico: 'atas', funcoes: 'todos', titulo: 'Como criar uma ata no sistema', para: 'Todos',
        resumo: 'Do menu até a ata pronta: dados, itens, importação de ata pronta, PDF e pauta da próxima reunião.',
        slides: [
          { imagem: img('ata-01-menu'), titulo: 'Onde ficam as atas', texto: 'Toda reunião vira uma ata no sistema, e quem faz a ata é qualquer pessoa da equipe. No menu da esquerda, em Meu trabalho, clique em Atas. As tarefas que saem das atas ficam em Tarefas.',
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
            legenda: ['Nome da ata, no padrão: obra, data, tipo e revisão.', 'A tabela da ata: pendência em vermelho, informativo em verde. O PDF vai sozinho para a pasta da obra no Drive (Gerenciamento › ATA), em até 10 minutos. Ata sem obra fica só no sistema.', 'Criar revisão: abre a ata para você mexer em qualquer coisa (dados, itens, participantes). A ata ganha R01, R02… e o PDF novo vai para o Drive; o antigo continua lá.', 'Pauta da próxima reunião: monta o que ficou aberto desta ata, pronto para copiar.'] },
          { imagem: img('ata-11-nova'), titulo: 'Importar fica fechado até você precisar', texto: 'Ao abrir uma nova ata, o formulário já vem pronto para preencher. A caixa de importar uma ata pronta (PDF) ou colar a transcrição fica fechada: clique nela só quando for usar.',
            legenda: ['Importar uma ata pronta ou colar a transcrição: clique para abrir.', 'O formulário da ata: comece pelos dados da reunião.'] },
          { imagem: img('ata-08-importar'), titulo: 'Importar um PDF ou colar o texto', texto: 'Já tem a ata pronta em PDF, ou o texto num e-mail ou aplicativo? Não precisa digitar de novo. Abra a caixa de importar e escolha uma das duas formas.',
            legenda: ['Escolher arquivo: envie o PDF (ou arquivo de texto) da ata. Atas no padrão da Sólida são lidas por inteiro, linha a linha.', 'Ou cole o texto da ata aqui.', 'Ler o texto colado: o sistema monta as linhas da ata, com responsável e prazo quando conseguir achar.'],
            dica: 'PDF que é foto ou digitalização não tem texto para ler: nesse caso cole o texto. Depois de importar, confira e complete o que faltar.' },
          { imagem: img('ata-09-depois'), titulo: 'Depois da ata: reprogramar uma data', texto: 'Na ata salva, clique na data de uma pendência para escolher outro dia. A data antiga fica guardada e a pendência aparece como "reprogramada".',
            legenda: ['Clique na data da pendência.', 'O calendário mostra os feriados em vermelho. Escolha o novo dia.'],
            dica: 'Para dar a pendência como feita, clique no ✓ ao lado da data.' },
          { imagem: img('ata-10-pendencias'), titulo: 'Acompanhe tudo em Tarefas', texto: 'A tela Tarefas reúne as pendências de todas as atas (veja o treinamento "Como usar as Tarefas"). Você filtra por pessoa, setor ou obra e vê o que está vencido, o que vence hoje e o que vem pela frente.',
            legenda: ['O + de cada coluna cria uma pendência que não veio de uma ata (já vem com o prazo da coluna).', 'Concluir: dá a pendência como feita.', 'Clique na data para reprogramar.'],
            dica: 'Excluir uma pendência da lista não apaga o item da ata: a ata só muda por uma revisão.' },
        ],
      },
      {
        id: 'agenda-tarefas', topico: 'agenda', funcoes: 'todos', titulo: 'Suas tarefas na Agenda', para: 'Todos',
        resumo: 'As tarefas com prazo aparecem no dia certo da sua Agenda, como no Google Agenda: veja, abra, arraste e reprograme.',
        slides: [
          { imagem: img('agenda-01-menu'), titulo: 'Agenda e Tarefas, lado a lado', texto: 'No menu, em Meu trabalho, ficam a Agenda (o seu dia e as suas tarefas), as Tarefas (o quadro de todas as tarefas da equipe) e as Atas. A Agenda mostra as suas funções da semana e, em cima de cada dia, as tarefas que vencem naquele dia.',
            legenda: ['Agenda: as suas funções da semana e as suas tarefas, dia a dia.', 'Tarefas: o quadro com todas as tarefas, por prazo (veja o treinamento "Como usar as Tarefas").', 'Atas: as atas das reuniões.'],
            dica: 'O número vermelho ao lado de Tarefas mostra quantas tarefas abertas são suas.' },
          { imagem: img('agenda-02-semana'), titulo: 'Cartõezinhos de tarefa em cada dia', texto: 'Cada cartãozinho colorido, logo abaixo do nome do dia, é uma tarefa com prazo naquele dia, com a obra e o assunto. Entram só as tarefas em que você é o responsável ou o gestor. Quando há mais de três no mesmo dia, aparece "+N" para ver o resto.',
            legenda: ['Resumo da semana: quantas tarefas em aberto e quantas vencidas.', 'Um cartãozinho = uma tarefa com prazo neste dia. Clique nele para abrir os detalhes.'] },
          { imagem: img('agenda-03-cores'), titulo: 'As cores e a tarefa vencida', texto: 'A cor diz a situação. A tarefa vencida não some nem muda de dia: fica no dia em que venceu, em vermelho, até você resolver. Para resolver, clique no ↻ ao lado dela e escolha o novo dia (ou conclua a tarefa).',
            legenda: ['Vermelho: vencida.', 'Azul: vence hoje.', 'Cinza-azulado: vence nos próximos dias.', 'A vencida fica no dia em que venceu.', '↻ Reprogramar: abre o calendário (feriados em vermelho) para escolher o novo prazo.'],
            dica: 'A data antiga fica guardada: a tarefa passa a aparecer como "reprogramada" e dá para ver quantas vezes isso aconteceu.' },
          { imagem: img('agenda-04-arrastar'), titulo: 'Arraste o cartão para outro dia', texto: 'Precisa mudar o prazo? Segure o cartãozinho e solte em outro dia da semana: o prazo muda na hora, igual a mover um compromisso no Google Agenda.',
            legenda: ['Arraste o cartão para o dia novo.', 'O dia que recebe o cartão fica destacado enquanto você arrasta.'] },
          { imagem: img('tarefas-04-detalhes'), titulo: 'Clique no cartão para ver os detalhes', texto: 'Clicar em um cartãozinho abre a tarefa: dá para mudar o título, o responsável, o gestor e o prazo, concluir, excluir e anotar no chat. O treinamento "Como usar as Tarefas" mostra tudo isso passo a passo.',
            legenda: ['Título (assunto e o que fazer).', 'Responsável.', 'Gestor: automático ou escolhido por você.', 'Prazo.', 'Concluir a tarefa.', 'Excluir (se veio de uma ata, só tira da lista e o item continua na ata).'] },
        ],
      },
      {
        id: 'tarefas-usar', topico: 'tarefas', funcoes: 'todos', titulo: 'Como usar as Tarefas', para: 'Todos',
        resumo: 'O quadro por prazo, os filtros, arrastar o cartão para mudar o prazo e a janela da tarefa com chat.',
        slides: [
          { imagem: img('tarefas-01-quadro'), titulo: 'O quadro por prazo', texto: 'Tarefas reúne as tarefas de todas as atas e as que foram criadas direto aqui. Cada coluna é um prazo: Vencido, Vencimento hoje, esta semana, próxima semana, sem prazo, em duas semanas ou mais e Concluído. Cada tarefa é um cartão.',
            legenda: ['Vencido: passou do prazo e ainda não foi concluída.', 'Vencimento hoje.', 'O + de cada coluna cria uma tarefa nova com o prazo da coluna.'],
            dica: 'Quem é de obra vê só as tarefas das suas obras; o resto da equipe vê as do seu departamento e as suas.' },
          { imagem: img('tarefas-02-filtros'), titulo: 'Filtre o que quer ver', texto: 'No alto há quatro filtros. Responsável: todas as tarefas, só as minhas, equipe da Sólida, terceirizados, clientes ou arquitetura. Setor: o departamento da empresa. Obra. E o campo Procurar, que busca por texto.',
            legenda: ['Responsável: Todos, Só as minhas, Equipe da Sólida, Terceirizados, Clientes, Arquitetura.', 'Setor: os departamentos da empresa.', 'Obra.', 'Procurar: digite parte do título, do nome ou da obra.'] },
          { imagem: img('tarefas-03-arrastar'), titulo: 'Arraste o cartão para mudar o prazo', texto: 'Para mudar o prazo, arraste o cartão para outra coluna. Soltou em "Vencimento hoje", o prazo vira hoje. Soltou em "Concluído", a tarefa é dada como feita. Soltou em "Sem prazo", a data some. Se você arrasta de volta para "Vencido" uma tarefa que foi reprogramada, ela volta para o dia que estava antes.',
            legenda: ['Arraste o cartão de uma coluna para outra.', 'A coluna de destino fica destacada.', 'Concluído: dá a tarefa como feita.'],
            dica: 'Em "Vencido" só volta a tarefa que tinha uma data anterior já vencida; as outras entram ali sozinhas quando o prazo passa.' },
          { imagem: img('tarefas-04-detalhes'), titulo: 'Clique no cartão: a tarefa por dentro', texto: 'Clicando no cartão abre a janela da tarefa. Dá para mudar o título (assunto e o que fazer), o responsável, o gestor e o prazo, concluir (ou reabrir) e excluir. Só pode mudar quem é o responsável, o gestor ou quem criou a tarefa; os outros veem e anotam.',
            legenda: ['Título: o assunto e o que fazer.', 'Responsável: uma pessoa da Sólida ou "Outro" (terceirizado, cliente, arquitetura).', 'Gestor: "Automático" segue as obras e os setores; escolher uma pessoa fixa o gestor.', 'Prazo.', 'Concluir.', 'Excluir. Tarefa que veio de uma ata só é tirada da lista: o item continua na ata.'],
            dica: 'Depois de mudar qualquer campo, clique em "Salvar alterações".' },
          { imagem: img('tarefas-05-chat'), titulo: 'Anote no chat da tarefa', texto: 'No fim da janela fica o chat da tarefa. Use para registrar o que foi combinado, cobrado ou resolvido. Cada anotação mostra quem escreveu e quando. Todos que enxergam a tarefa leem as anotações.',
            legenda: ['As anotações, da mais antiga para a mais nova. Você apaga só as suas (×).', 'Escreva a anotação e clique em Enviar (ou Ctrl+Enter).'],
            dica: 'Escreveu um link? Ele vira clicável sozinho.' },
        ],
      },
      {
        id: 'feed-usar', topico: 'feed', funcoes: 'todos', titulo: 'Como usar o Feed', para: 'Todos',
        resumo: 'Os recados e as novidades da equipe: publicar, comentar e curtir.',
        slides: [
          { imagem: img('feed-01'), titulo: 'O Feed da equipe', texto: 'O Feed é o mural da Sólida: recados, avisos e novidades. Qualquer pessoa publica, comenta e curte. A bolinha vermelha ao lado de Feed mostra que há publicação nova que você ainda não viu.',
            legenda: ['Feed: abra para ler as novidades e publicar.'],
            dica: 'Para assuntos de trabalho que precisam de responsável e prazo, crie uma tarefa em vez de usar o Feed.' },
        ],
      },
      {
        id: 'trein-usar', topico: 'treinamentos', funcoes: 'todos', titulo: 'Como usar os Treinamentos', para: 'Todos',
        resumo: 'Onde achar o passo a passo de cada tela e marcar o que você já viu.',
        slides: [
          { imagem: img('trein-01'), titulo: 'Passo a passo de cada tela', texto: 'Em Treinamentos, os blocos seguem o menu: cada tela do sistema tem o seu passo a passo, com prints reais e setas vermelhas. Clique em "abrir" para ver; no último passo, "Concluir treinamento" marca como visto. Dá para rever quando quiser.',
            legenda: ['Treinamentos: a lista de passo a passo, por tela.', 'Cada bloco: o nome da tela, quantos passos e se você já viu.'],
            dica: 'Use as setas do teclado (← →) para passar os passos e Esc para fechar.' },
        ],
      },
      {
        id: 'estoque-abas', topico: 'estoque', funcoes: 'todos', titulo: 'O Estoque e as suas abas', para: 'Quem acessa o Estoque',
        resumo: 'O estoque do galpão e, embaixo do título, as abas de contagem, guia de movimentação, pedidos, checklists e reposição.',
        slides: [
          { imagem: img('estoque-01-abas'), titulo: 'Só o estoque, e as abas embaixo do título', texto: 'A tela Estoque mostra só o estoque do galpão: o resumo e a lista de itens, com a quantidade e o mínimo. O que se faz com o estoque fica nas abas logo abaixo do título: Contagem do estoque (digitar o que foi contado, no lugar da folha escrita à mão), Guia de movimentação (registrar saídas, entradas e consertos, com foto), Pedir itens do estoque, Checklists de ferramentas e Reposição (o que falta e o que comprar).',
            legenda: ['Estoque: o resumo e a lista de itens do galpão.', 'Contagem do estoque: escolha o local, digite só o que contou e salve.', 'Guia de movimentação: registre qualquer movimentação de ferramentas e materiais.', 'Pedir itens do estoque (em preparação).'],
            dica: 'Na Reposição dá para filtrar por categoria (ferramentas, maquinários, limpeza…): a lista de compras e as rotas consideram só as categorias marcadas.' },
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
  const desenhar = () => {
    const s = sub.slides[i]; const ultimo = i === sub.slides.length - 1;
    caixa.innerHTML = `<div class="tv-corpo">
      <header class="tv-topo"><div><b>${esc(sub.titulo)}</b><span>Passo ${i + 1} de ${sub.slides.length}</span></div><button type="button" class="tv-fechar" data-tv="fechar" aria-label="Fechar">×</button></header>
      ${s.imagem ? `<div class="tv-palco"><a href="${esc(s.imagem)}" target="_blank" rel="noopener" title="Clique para ver a imagem em tamanho grande"><img src="${esc(s.imagem)}" alt="${esc(s.titulo)}"></a></div>` : ""}
      <section class="tv-texto ${s.imagem ? "" : "tv-so-texto"}"><h3>${esc(s.titulo)}</h3><p>${esc(s.texto)}</p>
        ${s.legenda && s.legenda.length ? `<ol class="tv-legenda">${s.legenda.map((l, k) => `<li><span>${k + 1}</span>${esc(l)}</li>`).join('')}</ol>` : ''}
        ${s.dica ? `<p class="tv-dica"><b>Dica:</b> ${esc(s.dica)}</p>` : ''}</section>
      <footer class="tv-rodape"><button type="button" class="botao" data-tv="ant" ${i === 0 ? 'disabled' : ''}>← Anterior</button>
        <div class="tv-bolas">${sub.slides.map((_, k) => `<button type="button" class="${k === i ? 'on' : ''}" data-tv-ir="${k}" aria-label="Passo ${k + 1}"></button>`).join('')}</div>
        <button type="button" class="botao on" data-tv="${ultimo ? 'fim' : 'prox'}">${ultimo ? '✓ Concluir treinamento' : 'Próximo →'}</button></footer></div>`;
    const corpo = caixa.querySelector('.tv-texto'); if (corpo) corpo.scrollTop = 0;
  };
  const ir = (n) => { i = Math.max(0, Math.min(n, sub.slides.length - 1)); desenhar(); };
  caixa.addEventListener('click', (e) => {
    if (e.target === caixa) { fechar(); aoFechar(); return; }
    const b = e.target.closest('[data-tv],[data-tv-ir]'); if (!b) return;
    if (b.dataset.tvIr !== undefined) { ir(Number(b.dataset.tvIr)); return; }
    if (b.dataset.tv === 'fechar') { fechar(); aoFechar(); } else if (b.dataset.tv === 'ant') ir(i - 1); else if (b.dataset.tv === 'prox') ir(i + 1);
    else if (b.dataset.tv === 'fim') { marcarVisto(sub.id); fechar(); aoFechar(); }
  });
  const tecla = (e) => { if (e.key === 'Escape') { fechar(); aoFechar(); } else if (e.key === 'ArrowRight') ir(i + 1); else if (e.key === 'ArrowLeft') ir(i - 1); };
  document.addEventListener('keydown', tecla); document.body.style.overflow = 'hidden';
  aberto = { caixa, tecla }; desenhar(); document.body.appendChild(caixa);
}
