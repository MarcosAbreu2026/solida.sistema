// Treinamentos com slides (21/10): cards de tópicos, cada um com subtópicos; clicar num subtópico abre uma apresentação
// com prints reais do sistema, caixas e setas vermelhas e a legenda de cada número. Os prints ficam em img/treinamentos/
// e são gerados por scripts/gerar-prints-treinamento.mjs (refazer sempre que a tela mudar). Para criar outro treinamento:
// acrescente um subtópico em TOPICOS, com os slides (imagem, título, texto, legenda dos números) e rode o gerador.
import { idPessoa } from './sessao.js';

const img = (n) => `img/treinamentos/${n}.jpg`;

// Os tópicos são os nomes do menu da esquerda; os subtópicos são os treinamentos de cada um.
// tipo 'setor' = área do menu (aparece para quem tem a área); tipo 'pagina' = página geral (aparece para quem vê a página)
export const TOPICOS = [
  { id: 'atas', nome: 'Atas e pendências', tipo: 'pagina', pagina: 'atas', icone: '📝' },
  { id: 'funcoes', nome: 'Minhas funções', tipo: 'pagina', pagina: 'meudia', icone: '✅' },
  { id: 'operacao', nome: 'Operação', tipo: 'setor', icone: '🏗️' },
  { id: 'posobra', nome: 'Pós-obra', tipo: 'setor', icone: '🛠️' },
  { id: 'transporte', nome: 'Transporte e logística', tipo: 'setor', icone: '🚚' },
  { id: 'suprimentos', nome: 'Suprimentos e compras', tipo: 'setor', icone: '📦' },
  { id: 'planejamento', nome: 'Planejamento', tipo: 'setor', icone: '📅' },
  { id: 'projetos', nome: 'Projetos', tipo: 'setor', icone: '📐' },
  { id: 'comercial', nome: 'Comercial e orçamentos', tipo: 'setor', icone: '💼' },
  { id: 'financeiro', nome: 'Financeiro', tipo: 'setor', icone: '💰' },
  { id: 'rh', nome: 'RH', tipo: 'setor', icone: '👥' },
  { id: 'estoque', nome: 'Estoque', tipo: 'pagina', pagina: 'estoque', icone: '🧰' },
  { id: 'marketing', nome: 'Marketing', tipo: 'pagina', pagina: 'marketing', icone: '📣' },
];

// treinamentos com slides (imagem + legenda). Cada um aparece no bloco do menu a que pertence (campo topico).
export const SUBTOPICOS = [
      {
        id: 'funcoes-usar', topico: 'funcoes', funcoes: 'todos', titulo: 'Como usar a página Minhas funções', para: 'Todos',
        resumo: 'Suas tarefas da semana: como ver, marcar o que foi feito e o que não foi, e mudar o horário de cada uma.',
        slides: [
          { imagem: img('func-01-menu'), titulo: 'Onde fica', texto: 'Minhas funções é a página onde você controla o seu trabalho do dia a dia. No menu da esquerda, clique em Minhas funções.',
            legenda: ['Minhas funções: as tarefas da sua função, de segunda a sábado.', 'Treinamentos: aqui você revê este passo a passo quando quiser.'] },
          { imagem: img('func-02-quadro'), titulo: 'A sua semana', texto: 'Cada coluna é um dia (de segunda a sábado), as horas ficam na lateral e cada cartão é uma tarefa da sua função. A barra mostra quantas você já marcou como feitas na semana.',
            legenda: ['O seu nome e a sua função.', 'Barra de progresso: tarefas feitas até hoje.', 'O dia: o de hoje fica destacado em amarelo e mostra quantas tarefas você já fez.', 'Um cartão = uma tarefa. Tarefas do mesmo horário ficam uma embaixo da outra, com o texto inteiro.'],
            dica: 'Tarefas de dias que ainda não chegaram aparecem em cinza: só dá para marcar de hoje para trás.' },
          { imagem: img('func-10-menu'), titulo: 'O menu recolhe para dar espaço', texto: 'Quando você abre uma página, o menu da esquerda recolhe e sobra só uma tirinha com uma setinha. Assim os 6 dias da semana cabem na tela, com as horas na lateral.',
            legenda: ['Clique na setinha para abrir o menu de novo.'] },
          { imagem: img('func-03-marcar'), titulo: 'Marque cada tarefa: feito ou não feito', texto: 'Em cada cartão há dois botões. O sistema não marca nada por você: só vale o que você marcar.',
            legenda: ['O nome completo da tarefa.', 'Fez a tarefa? Clique em ✓ Feito.', 'Não deu para fazer? Clique em ✕ Não.'],
            dica: 'Errou? Clique de novo no botão já marcado para desfazer.' },
          { imagem: img('func-04-cores'), titulo: 'As cores dos cartões', texto: 'Depois de marcar, o cartão muda de cor para você bater o olho e ver o que falta.',
            legenda: ['Verde: você marcou como feita.', 'Vermelho: você marcou como não feita.', 'Amarelo: ainda falta você marcar (tarefa sem marcação conta como não entregue).'],
            dica: 'Sempre marque no mesmo dia: é mais fácil de lembrar e o seu progresso fica certo.' },
          { imagem: img('func-11-mover'), titulo: 'Mude o horário de uma tarefa', texto: 'Quer fazer uma tarefa em outra hora do dia? Segure o cartão, arraste e solte na hora que quiser, no mesmo dia. O novo horário fica valendo para essa tarefa em todas as semanas, só para você: ninguém mais é afetado e ele não volta sozinho.',
            legenda: ['O cartão que você moveu fica marcado e mostra o novo horário.', '↺ movida: clique para voltar ao horário original do quadro.'],
            dica: 'Solte na metade de cima da hora para hora cheia (ex.: 11h) e na metade de baixo para "e meia" (11h30). Só dá para mover dentro do mesmo dia.' },
          { imagem: img('func-12-duracao'), titulo: 'Quanto tempo a tarefa ocupa no dia', texto: 'Clique em uma tarefa (no texto do cartão) para abrir uma caixinha. Nela você muda quanto tempo a tarefa ocupa no seu dia e também pode marcar feito ou não feito. O cartão fica mais alto quando a tarefa ocupa mais tempo.',
            legenda: ['O nome completo da tarefa.', '− 30 min: a tarefa passa a ocupar menos tempo.', '+ 30 min: a tarefa passa a ocupar mais tempo.', 'Situação: ✓ Feito ou ✕ Não feito, igual no cartão.'],
            dica: 'A duração que você escolher vale para essa tarefa em todas as semanas e é só sua. Para voltar ao original, use "↺ Voltar ao quadro" na caixinha.' },
          { imagem: img('func-07-semanas'), titulo: 'Semanas anteriores e próximas', texto: 'Esqueceu de marcar alguma coisa? Volte à semana anterior e marque lá. Você também vê a semana que vem.',
            legenda: ['Semana anterior: volta e permite marcar o que ficou pendente.', 'A semana que você está vendo.', 'Próxima semana: só para consultar.'],
            dica: 'Tarefas de semanas passadas que ficaram sem marcação você marca direto na semana anterior.' },
          { imagem: img('func-08-fora'), titulo: 'Tarefas fora do quadro', texto: 'Algumas tarefas não têm dia certo (mensais, quinzenais, ocasionais). Elas ficam numa lista no fim da página, junto com as observações da sua função.',
            legenda: ['Fora do quadro: tarefas mensais e ocasionais e as observações da sua função.'] },
          { imagem: img('func-09-treinamento'), titulo: 'Pronto: é só isso', texto: 'Todo dia, abra Minhas funções e marque ✓ Feito ou ✕ Não feito em cada tarefa. A marcação vale ponto e mostra para a diretoria como a semana está andando.',
            legenda: ['Para rever este passo a passo, clique em "Como funciona esta página", no fim da página.'],
            dica: 'Dúvida? Fale com o seu gestor ou use o botão "Pedir alteração" para sugerir uma melhoria.' },
        ],
      },
      {
        id: 'ata-criar', topico: 'atas', funcoes: 'todos', oculto: true, titulo: 'Como criar uma ata no sistema', para: 'Todos',
        resumo: 'Do menu até a ata pronta: dados, itens, gravação do áudio, PDF e pauta da próxima reunião.',
        slides: [
          { imagem: img('ata-01-menu'), titulo: 'Onde ficam as atas', texto: 'Toda reunião vira uma ata no sistema, e quem faz a ata é qualquer pessoa da equipe. No menu da esquerda, clique em Atas e pendências.',
            legenda: ['Atas e pendências: todo mundo vê este menu. O número vermelho ao lado mostra quantas pendências abertas são suas.'] },
          { imagem: img('ata-02-nova-ata'), titulo: 'Comece pela aba "Nova ata"', texto: 'No alto da tela há três abas. Para criar uma ata, clique em Nova ata.',
            legenda: ['Nova ata: aqui você cria a ata.', 'Pendências: aqui ficam as pendências de todo mundo, em um quadro por prazo (vencido, hoje, esta semana…).'] },
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
          { imagem: img('ata-07-gravar'), titulo: 'Opção 1: gravar a reunião em áudio', texto: 'Em vez de digitar, grave a reunião: o sistema transcreve e separa o que é pendência do que é informativo. Use o Chrome ou o Edge e libere o microfone quando o navegador pedir.',
            legenda: ['Gravar a reunião: aperte e deixe o microfone aberto durante a conversa. Para terminar, aperte de novo.', 'Transcrição: o texto aparece aqui, ao vivo. Na versão da internet, o áudio também vai para o computador do escritório, que transcreve com mais qualidade (leva uns minutos) e devolve o texto na lista Gravações, com o botão "Usar esta transcrição".', 'Montar a ata: o sistema separa pendências e informativos e preenche as linhas para você.'],
            dica: 'Sempre confira o resultado: nomes, assuntos, responsáveis e prazos podem precisar de ajuste. Tire o que não serve.' },
          { imagem: img('ata-08-importar'), titulo: 'Opção 2: importar um PDF ou colar o texto', texto: 'Já tem a ata pronta em PDF, ou o texto num e-mail ou aplicativo? Não precisa digitar de novo.',
            legenda: ['Escolher arquivo: envie o PDF (ou arquivo de texto) da ata. Atas no padrão da Sólida são lidas por inteiro, linha a linha.', 'Ou cole o texto da ata aqui.', 'Ler o texto colado: o sistema monta as linhas da ata, com responsável e prazo quando conseguir achar.'],
            dica: 'PDF que é foto ou digitalização não tem texto para ler: nesse caso cole o texto. Depois de importar, confira e complete o que faltar.' },
          { imagem: img('ata-09-depois'), titulo: 'Depois da ata: reprogramar uma data', texto: 'Na ata salva, clique na data de uma pendência para escolher outro dia. A data antiga fica guardada e a pendência aparece como "reprogramada".',
            legenda: ['Clique na data da pendência.', 'O calendário mostra os feriados em vermelho. Escolha o novo dia.'],
            dica: 'Para dar a pendência como feita, clique no ✓ ao lado da data.' },
          { imagem: img('ata-10-pendencias'), titulo: 'Acompanhe tudo na aba Pendências', texto: 'A aba Pendências reúne as pendências de todas as atas. Você filtra por pessoa, setor ou obra e vê o que está vencido, o que vence hoje e o que vem pela frente.',
            legenda: ['O + de cada coluna cria uma pendência que não veio de uma ata (já vem com o prazo da coluna).', 'Concluir: dá a pendência como feita.', 'Clique na data para reprogramar.'],
            dica: 'Excluir uma pendência da lista não apaga o item da ata: a ata só muda por uma revisão.' },
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
