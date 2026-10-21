// Treinamentos: guias curtos, passo a passo, do que a equipe faz todo dia na Sólida (primeira versão de 16/10, para
// a diretoria revisar). Cada pessoa vê primeiro os da sua função e marca "já li" (fica só neste navegador).
// Os textos vêm do que já está definido nos processos e nos formulários da empresa (guia de movimentação, folha de
// ferramentas obrigatórias, relatório diário no WhatsApp, Mais Controle). Para sugerir outro, "Pedir alteração".

import { html } from '../formato.js';
import { funcaoAtual, idPessoa } from '../sessao.js';
import { TOPICOS, SUBTOPICOS, registrar, vistos as slidesVistos } from '../treinamentos-slides.js';
import { paginaVisivel } from '../funcoes.js';

const OBRA = ['gestor_obra', 'estagiario', 'encarregado'];
const FERRAMENTAS = ['ferramentas', 'executor_ferramentas', 'estagiario_compras', 'posobra'];
const GESTAO_OP = ['coord_operacoes', 'tecnico', 'planejamento', 'orc_terceirizado'];

export const TREINAMENTOS = [
  {
    id: 'sistema', topico: 'funcoes', titulo: 'Como usar o sistema no dia a dia', min: 5, para: 'todos', funcoes: 'todos',
    resumo: 'Login, Minha semana, marcar tarefas, Feed e Perfil.',
    passos: [
      'Entre com o seu usuário e a senha. No primeiro acesso o sistema pede para você criar a sua senha.',
      'Minhas funções mostra as tarefas da sua função, cada uma num cartão, no dia e horário do quadro.',
      'Quando fizer a tarefa, clique em ✓ Feito. Se não fez, clique em ✕ Não. Clicar de novo desfaz. Tarefa sem marcação conta como não entregue.',
      'Quando o sistema acha a prova sozinho (arquivo no Drive ou produtividade no grupo), o cartão já vem como "✓ automático".',
      'Dá para arrastar um cartão para outro horário ou dia da semana, puxar a borda de baixo para mudar a duração e clicar para ver os detalhes. É só um ajuste seu.',
      'No Perfil você vê a sua pontuação. No Feed ficam os avisos e publicações da empresa.',
      'Viu algo errado ou faltando? Use o botão "Pedir alteração", em qualquer tela.',
    ],
  },
  {
    id: 'relatorio', topico: 'operacao', titulo: 'Relatório diário de produtividade no WhatsApp', min: 5, para: 'Gestor de obra, estagiário, encarregado', funcoes: OBRA,
    resumo: 'O que postar no grupo da obra, de manhã e no fim do dia.',
    passos: [
      'De manhã, o gestor posta no grupo da obra a programação do dia: "Atividades do dia", com cada serviço, a quantidade entre parênteses e quem faz.',
      'No fim do dia, o encarregado ou o estagiário posta o "RELATÓRIO DIÁRIO": etapa, quantidade feita, equipe e nome.',
      'Use o mesmo nome do serviço que está na programação. É por ele que o sistema compara o que foi feito com a meta.',
      'Nunca invente quantidade. Se não sabe quanto foi feito, escreva que não foi medido.',
      'Se ficou abaixo da meta, diga o motivo (falta de mão de obra, falta de material, chuva, serviço dependia de outra equipe…).',
      'O sistema lê o grupo no dia seguinte: relatório que não foi postado aparece como alerta para o gestor.',
    ],
  },
  {
    id: 'movimentacao', topico: 'transporte', titulo: 'Guia de movimentação de ferramentas', min: 4, para: 'Ferramentas, transporte, gestor, estagiário, encarregado', funcoes: [...FERRAMENTAS, ...OBRA, 'ajudante'],
    resumo: 'Como preencher a folha toda vez que algo sai ou chega no galpão ou na obra.',
    passos: [
      'Toda movimentação de material ou ferramenta (sair do galpão, chegar no galpão, passar de uma obra para outra) tem que ter registro. Sem registro, o estoque se perde.',
      'Escreva a data e o responsável no alto da folha.',
      'Em ORIGEM e DESTINO escreva GALPÃO, o nome da obra, MANUTENÇÃO ou DESCARTE.',
      'Cada linha é uma movimentação: item, quantidade, origem, destino e observação. Pode listar vários itens numa linha se a origem e o destino forem os mesmos.',
      'Use a mesma folha o dia todo e preencha na hora em que movimentar, não depois.',
      'Assine a linha e mande a foto da folha pelo WhatsApp no mesmo dia.',
      'No sistema, em Transporte e logística › Reposição de ferramentas, a guia já sai preenchida com a rota do dia, pronta para imprimir.',
    ],
  },
  {
    id: 'folha-ferramentas', topico: 'transporte', titulo: 'Folha de ferramentas obrigatórias da obra', min: 6, para: 'Gestor, estagiário, encarregado, ferramentas', funcoes: [...OBRA, ...FERRAMENTAS],
    resumo: 'Como contar e preencher o checklist de 15 em 15 dias, sem erro.',
    passos: [
      'De 15 em 15 dias, na quarta-feira, cada obra conta as ferramentas obrigatórias e o Anderson manda a foto da folha no grupo de ferramentas. A compra demora a chegar, por isso não é toda semana.',
      'Preencha obra, data e responsável. Na coluna ATUAL escreva o número que tem de verdade, contando com o olho no local. Se não tem, escreva 0: campo em branco quer dizer "não contei".',
      'Ferramenta quebrada ou em conserto não conta como "atual".',
      'Escada: escreva a quantidade e os degraus, por exemplo 2-7D (duas escadas de 7 degraus).',
      'Escreva a lápis ou caneta e sem rasurar por cima: número escrito sobre outro número não dá para ler e o sistema não aceita chute.',
      'Tire a foto reta, com a folha inteira no enquadramento e boa luz. Foto torta ou cortada perde linhas.',
      'Consumíveis (parafuso, fita, disco…) a própria obra compra e repõe. Bucha, parafuso e prego precisam de 1 caixa de cada e de pelo menos 50 de cada.',
      'Depois que a folha chega, o sistema calcula o que falta em cada obra, o que dá para mover entre obras e o que comprar.',
    ],
  },
  {
    id: 'terceirizadas', topico: 'operacao', titulo: 'Terceirizadas: contrato e medição no Mais Controle', min: 5, para: 'Operação, planejamento, gestor de obra', funcoes: [...GESTAO_OP, 'gestor_obra'],
    resumo: 'Toda empresa que trabalha na obra precisa estar lançada.',
    passos: [
      'Toda empresa vinculada a uma obra, cinza ou laranja, precisa ter um contrato vinculado àquela obra no Mais Controle.',
      'Antes de uma empresa começar na obra, confira se o contrato existe: Mais Controle › Obras › Medição de Contratos.',
      'Contrato lançado também precisa de medição: sem medição, a empresa trabalha e o custo não aparece.',
      'O nome da empresa tem que ser o mesmo na programação, no WhatsApp e no Mais Controle. Nome diferente atrapalha a conferência.',
      'No sistema, Operação › "Terceirizadas nas obras × contratos" mostra quem está sem contrato ou sem medição. O alerta vai para a Simone.',
    ],
  },
];

// ideias de próximos treinamentos (não escritos ainda)
const SUGESTOES = [
  'Diário de obra no Mais Controle: o que registrar todo dia e como não deixar em rascunho.',
  'Medição de contratos (processos 1.1 e 1.4): passo a passo, prazos e erros comuns.',
  'EPI: quem recebe o quê, como registrar a entrega e a troca.',
  'Segurança na obra: uso correto de escada, andaime e ferramentas elétricas.',
  'Programação semanal: como montar a meta diária por serviço, com quantidade e unidade.',
  'QCL: como fazer e como aprovar.',
  'Um treinamento por processo do POP, começando pelos de cada função.',
  'Orçamento terceirizado: pedir, comparar, negociar e formalizar o fornecedor.',
];

const CHAVE = 'solida.treinamentos';
function lerFeitos() { try { return (JSON.parse(localStorage.getItem(CHAVE)) || {})[idPessoa()] || []; } catch { return []; } }
export function alternarFeito(id) {
  try {
    const todos = JSON.parse(localStorage.getItem(CHAVE)) || {}; const eu = new Set(todos[idPessoa()] || []);
    if (eu.has(id)) eu.delete(id); else eu.add(id);
    todos[idPessoa()] = [...eu]; localStorage.setItem(CHAVE, JSON.stringify(todos));
  } catch { /* sem armazenamento: não guarda */ }
}

const seApplica = (t, funcaoId) => funcaoId === 'socio' || t.funcoes === 'todos' || t.funcoes.includes(funcaoId);   // a diretoria vê todos (tem todos os menus)

// os guias de texto abrem na mesma apresentação dos treinamentos com slides (um passo por tela, sem imagem)
registrar(TREINAMENTOS.map((t) => ({ id: t.id, topico: t.topico, funcoes: t.funcoes, titulo: t.titulo, min: t.min, para: t.para === 'todos' ? 'Todos' : t.para, resumo: t.resumo,
  slides: t.passos.map((p, i) => ({ titulo: `Passo ${i + 1} de ${t.passos.length}`, texto: p })) })));

// o tópico aparece para quem tem aquele menu: setor nas áreas da função; página geral se a função vê a página
const topicoVisivel = (t, f) => (t.tipo === 'setor' ? !f.areas || f.areas.includes(t.id) : paginaVisivel(f, t.pagina));

export function render() {
  const f = funcaoAtual();
  const vistosSet = slidesVistos();
  const todasSub = [...SUBTOPICOS, ...TREINAMENTOS.map((t) => ({ ...t, para: t.para === 'todos' ? 'Todos' : t.para, slides: t.passos }))];
  // só os menus da função de quem está vendo, e só os treinamentos que valem para ela
  const doTopico = (t) => todasSub.filter((s) => s.topico === t.id && seApplica(s, f.id));
  const topicos = TOPICOS.filter((t) => topicoVisivel(t, f) && doTopico(t).length);
  const total = topicos.reduce((n, t) => n + doTopico(t).length, 0); const lidos = topicos.reduce((n, t) => n + doTopico(t).filter((s) => vistosSet.has(s.id)).length, 0);
  const linha = (s) => html`<tr><td class="tr-tit"><button type="button" class="tr-abrir" data-trein-slides="${s.id}">${s.titulo}</button></td>
    <td>${s.min} min</td><td>${s.slides.length} ${s.slides.length === 1 ? 'passo' : 'passos'}</td>
    <td>${vistosSet.has(s.id) ? html`<span class="tr-visto">✓ visto</span>` : html`<span class="muted">não visto</span>`}</td>
    <td class="n"><button type="button" class="ac-mini" data-trein-slides="${s.id}">${vistosSet.has(s.id) ? 'rever' : 'abrir'} ▶</button></td></tr>`;
  const bloco = (t) => html`<details class="pl-obra tr-topico" open>
    <summary><span class="pl-tit"><span class="tr-ico">${t.icone}</span>${t.nome}</span><span class="pl-cont">${doTopico(t).length} ${doTopico(t).length === 1 ? 'treinamento' : 'treinamentos'}</span></summary>
    <table class="pl-os tr-tab"><colgroup><col class="tr-c-tit"><col class="tr-c-min"><col class="tr-c-pas"><col class="tr-c-sit"><col class="tr-c-acao"></colgroup>
      <thead><tr><th>Treinamento</th><th>Duração</th><th>Passos</th><th>Situação</th><th></th></tr></thead><tbody>${doTopico(t).map(linha)}</tbody></table></details>`;
  return html`<div class="pagina treinamentos pl">
    <div class="pg-faixa"><div><b>${total}</b><span>${total === 1 ? 'treinamento para a sua função' : 'treinamentos para a sua função'}</span></div><div><b>${lidos}</b><span>já vistos</span></div></div>
    ${topicos.length ? html`<div class="pl-lista">${topicos.map(bloco)}</div>` : html`<p class="vazio">Ainda não há treinamento para a sua função.</p>`}
    ${f.id === 'socio' ? html`<details class="tr-ideias"><summary>Ideias para os próximos treinamentos (só a diretoria vê)</summary><ul class="tn-ideias">${SUGESTOES.map((s) => html`<li>${s}</li>`)}</ul></details>` : ''}
  </div>`;
}