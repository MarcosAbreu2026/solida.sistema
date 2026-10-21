// Sistema Sólida — mostra o mesmo que o Painel da Empresa (dados.json do Drive, preenchido pelos agentes),
// mais: perfis por função, "Meu dia" (quadro de funções), Operação › Metas e produtividade,
// e no Pós-obra os detalhes da planilha integrada (dados/json).

import { carregarDados, carregarPainel, carregarProdutividade, carregarDrive, carregarFerramentasChk, carregarTerceirizados } from './dados.js';
import * as terceiros from './telas/terceirizados.js';
import * as ferrChk from './telas/ferramentas-checklist.js';
import * as reposicao from './telas/reposicao.js';
import * as ordenar from './ordenar.js';
import * as atas from './telas/atas.js';
import { montarBase } from './regras.js';
import { periodo, hojeISO, ehData, somarDias, inicioDaSemana } from './datas.js';
import { html, esc, descreverPeriodo } from './formato.js';
import { definirPerfil } from './componentes.js';
import { normalizar, criarTelas, pt } from './painel-empresa.js';
import { sessao, funcaoAtual, veValores, entrar, sair, logado, idPessoa, podeVerArea, obrasDaPessoa,
  podeVerComo, simulando, verComo, funcaoReal } from './sessao.js';
import { FUNCOES, funcaoPorId, veBlocoGeral, INDICADORES_SO_GESTAO, paginaVisivel, aplicarAbas, abasPadrao } from './funcoes.js';
import * as marketing from './telas/marketing.js';
import * as login from './telas/login.js';
import { marcarCheck, gravarLancamento, apagarLancamento, gravarManual, vincularDia, sincronizarTarefas, lerPessoasTarefas } from './armazenamento.js';
import * as perfil from './telas/perfil.js';
import * as nuvem from './nuvem.js';
import * as acessos from './telas/acessos.js';
import * as feed from './telas/feed.js';
import * as evidencias from './evidencias.js';
import * as treinamentos from './telas/treinamentos.js';
import { desenharBoneco } from './escritorio/desenho.js';
import { pessoaPorId } from './escritorio/pessoas.js';
import * as painel from './telas/painel.js';
import * as obras from './telas/obras.js';
import * as servicos from './telas/servicos.js';
import * as agenda from './telas/agenda.js';
import * as equipe from './telas/equipe.js';
import * as posGeral from './telas/posobra-geral.js';
import * as agendaPos from './agenda-pos.js';
import * as svPos from './servicos-pos.js';
import * as financeiro from './telas/financeiro.js';
import * as meudia from './telas/meudia.js';
import { abrirCalendario } from './calendario.js';
import * as gravador from './gravador.js';
import * as quadro from './telas/quadro.js';
import * as produtividade from './telas/produtividade.js';
import * as operacao from './telas/operacao.js';
import * as comercial from './telas/comercial.js';
import * as projetos from './telas/projetos.js';
import * as estoque from './telas/estoque.js';
import * as pedidos from './telas/pedidos.js';
import * as escritorio from './telas/escritorio.js';

const ATUALIZAR_A_CADA_MS = 5 * 60 * 1000;

// Abas do pós-obra: o resumo dos agentes (como no painel) + as abas da planilha integrada
// abas do Pós-obra (21/10): Pós-obras (cartões) · Pendências (as mesmas de Atas e pendências) · Agenda (cartões de funcionários) · Equipe e PJ · Financeiro.
// Painel, Obras e Serviços (planilha) continuam existindo, mas escondidos (links no rodapé de Pós-obras).
const SUB = [
  { id: '', nome: 'Pós-obras' },
  { id: 'servicos', nome: 'Serviços', nova: true },
  { id: 'pendencias', nome: 'Pendências', nova: true },
  { id: 'agenda', nome: 'Agenda', nova: true },
  { id: 'equipe', nome: 'Equipe e PJ', mod: equipe },
  { id: 'financeiro', nome: 'Financeiro', mod: financeiro, restrita: true },
  { id: 'painel', nome: 'Painel da planilha', mod: painel, escondida: true },
  { id: 'obras', nome: 'Obras', mod: obras, escondida: true },
  { id: 'servicos-tabela', nome: 'Serviços (tabela da planilha)', mod: servicos, escondida: true },
];

const estado = {
  cfg: null,          // dados.json do painel (agentes)
  sync: {},           // { origem, atualizado, erro }
  base: null,         // planilha integrada do pós-obra
  erroBase: null,
  verPor: ler('verPor') || 'Semana',
  ref: hojeISO(),
  dia: hojeISO(),                                  // Meu dia
  pendAberta: false,                               // caixa de pendências aberta?
  semanaRef: null,                                 // Meu dia › Programação da semana (null = semana do dia)
  quadro: { funcao: null, ref: hojeISO() },        // Quadro de funções
  pessoas: { filtro: 'todos', busca: '', obra: 'todas' },
  posAgenda: { semana: inicioDaSemana(hojeISO()), sel: '', chave: '' },   // Pós-obra › Agenda
  drive: { orcamentos: null, projetos: null },    // orçamentos e projetos lidos no Drive (exportar-drive.ps1)
  pedido: { aberto: false, lista: [], msg: '' },
  loginNuvem: { modo: 'entrar' },                 // tela de entrada na nuvem  // "Pedir alteração" (dados/pedidos.json no servidor)
};

// ---------------------------------------------------------------- pedir alteração

// tela atual como chave do pedido (ex.: "estoque", "operacao/metas") e o nome que aparece para a pessoa
function telaDoPedido() {
  const r = rotaAtual();
  const aba = document.querySelector('#conteudo .subnav a.on');
  return { tela: [r.tela, r.sub].filter(Boolean).join('/'), titulo: `${$('#titulo').textContent}${aba && r.sub ? ` › ${aba.textContent.trim()}` : ''}` };
}

function desenharPedido() {
  let el = $('#pedido');
  if (!el) { el = document.createElement('div'); el.id = 'pedido'; document.body.appendChild(el); }
  // todo mundo pede; a diretoria (perfil real, mesmo usando "Ver como") aprova os pedidos dos outros
  if (!logado()) { el.innerHTML = ''; return; }
  const diretoria = ehDiretoria();
  const p = estado.pedido;
  const meu = (x) => x.pessoa === nomeDoPedido();
  const n = diretoria ? p.lista.filter(pedidos.pendenteAprovacao).length : p.lista.filter((x) => meu(x) && pedidos.emAberto(x)).length;
  el.innerHTML = String(p.aberto ? pedidos.painel({ ...telaDoPedido(), pedidos: p.lista, msg: p.msg, diretoria }) : pedidos.botao(n, diretoria));
}
const ehDiretoria = () => funcaoReal().id === 'socio';
const nomeDoPedido = () => { const s = sessao(); return s.nome || s.usuario || ''; };

async function atualizarPedidos() {
  const antes = JSON.stringify(estado.pedido.lista);
  estado.pedido.lista = await pedidos.listar();
  // perfil da diretoria mostra os pedidos da equipe: redesenha quando a lista muda
  if (rotaAtual().tela === 'perfil' && antes !== JSON.stringify(estado.pedido.lista)) desenhar();
  const ativo = document.activeElement;
  if (!(ativo && ativo.closest && ativo.closest('#pedido'))) desenharPedido();
}
definirPerfil(veValores());

const $ = (s) => document.querySelector(s);
function ler(k) { try { return localStorage.getItem(`solida.${k}`); } catch { return null; } }
function gravar(k, v) { try { localStorage.setItem(`solida.${k}`, v); } catch { /* sem armazenamento */ } }
const hora = (d) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function rotaAtual() {
  const h = location.hash.replace(/^#\/?/, '') || 'geral';
  const [caminho, query = ''] = h.split('?');
  const partes = caminho.split('/');
  return {
    tela: partes[0] || 'geral',
    sub: partes[1] || '',
    arg: partes.length > 2 ? decodeURIComponent(partes.slice(2).join('/')) : '',
    params: new URLSearchParams(query),
  };
}

const subnav = (itens, ativa) => String(html`<div class="subnav" role="tablist">${itens.map((s) => html`<a href="${s.href}" class="${s.id === ativa ? 'on' : ''}" role="tab">${s.nome}</a>`)}</div>`);

// ---------------------------------------------------------------- pós-obra

function telaPosObraPlanilha(rota) {
  const subs = SUB.filter((s) => (veValores() || !s.restrita) && !s.escondida);
  const todas = SUB.filter((s) => veValores() || !s.restrita);
  const ehObra = rota.sub === 'obra';
  const sub = todas.find((s) => s.id === rota.sub) || subs[0];
  const ativa = ehObra ? '' : sub.id;
  const abas = subnav(subs.map((s) => ({ ...s, href: `#/posobra${s.id ? `/${s.id}` : ''}` })), ehObra ? '' : (rota.sub ? ativa : ''));
  const semBase = () => ({ abas, conteudo: `<div class="erro" style="margin-top:26px">${esc(estado.erroBase || 'Carregando a planilha do pós-obra…')}</div>` });

  // Pós-obras (cartões das obras em andamento)
  if (!rota.sub) {
    if (!estado.base) return { abas, conteudo: '', resumo: semBase().conteudo };
    carregarAgendaSemana();
    return { abas, conteudo: '', resumo: String(posGeral.renderResumo(estado.base, inicioDaSemana(hojeISO()), agendaPos.linhas)) };
  }
  // Serviços: quadro por fase (análise, orçamento, execução, concluído…), arrastando os cartões
  if (rota.sub === 'servicos') {
    if (!estado.base) return semBase();
    const podeEditar = ['socio', 'posobra', 'coord_operacoes'].includes(funcaoAtual().id);
    return { abas, conteudo: `<div class="pagina" style="margin-top:26px">${svPos.erro ? `<p class="erro">${esc(svPos.erro)}</p>` : ''}${String(posGeral.renderServicos({ base: estado.base, params: rota.params, podeEditar }))}</div>` };
  }
  // Pendências: a mesma lista de Atas e pendências, só do setor Pós-obra
  if (rota.sub === 'pendencias') {
    garantirAtasCarregadas();
    return { abas, conteudo: `<div class="pagina" style="margin-top:26px">${String(atas.renderPendencias({ params: rota.params, obras: obrasDeAtas(), setorFixo: 'Pós-obra', base: '#/posobra/pendencias' }))}</div>` };
  }
  // Agenda da semana: cartões de funcionários arrastados para a obra e o dia
  if (rota.sub === 'agenda') {
    if (!estado.base) return semBase();
    carregarAgendaSemana();
    const podeEditar = ['socio', 'posobra', 'coord_operacoes'].includes(funcaoAtual().id);
    return { abas, conteudo: `<div class="pagina" style="margin-top:26px">${String(posGeral.renderAgenda({ base: estado.base, semanaIni: estado.posAgenda.semana, linhasAgenda: agendaPos.linhas, podeEditar, selecionado: estado.posAgenda.sel, erro: agendaPos.erro }))}</div>` };
  }

  // página de uma obra: simples e didática (a completa fica em ?completo=1)
  if (ehObra && !rota.params.get('completo')) {
    if (!estado.base) return semBase();
    carregarAgendaSemana(); garantirAtasCarregadas();
    return { abas, conteudo: `<div class="pagina" style="margin-top:26px">${String(posGeral.renderObra({ base: estado.base, nome: rota.arg, semanaIni: estado.posAgenda.semana, linhasAgenda: agendaPos.linhas, pendencias: atas.todasPendencias(), linkCompleto: `#/posobra/obra/${encodeURIComponent(rota.arg)}?completo=1` }))}</div>` };
  }
  if (!estado.base) return semBase();
  const p = periodo(estado.verPor, estado.ref);
  const ctx = { base: estado.base, p, params: rota.params };
  const corpo = ehObra ? obras.renderDetalhe({ ...ctx, nome: rota.arg }) : sub.mod.render(ctx);
  const barra = html`<div class="periodo">
    <label>Ver por<select id="ver-por">${['Semana', 'Mês'].map((v) => html`<option ${v === estado.verPor ? html.seguro('selected') : ''}>${v}</option>`)}</select></label>
    <label>Data de referência<input type="date" id="data-ref" value="${estado.ref}"></label>
    <button type="button" class="botao" id="hoje">Hoje</button>
    <div class="atual"><span>Período</span><b>${descreverPeriodo(p)}</b></div>
  </div>`;
  return {
    abas,
    conteudo: String(html`<div class="pagina" style="margin-top:26px">
      <p class="pequeno" style="margin:0">${fonteDoPosObra()}</p>
      ${barra}${corpo}</div>`),
  };
}

// a base do pós-obra = planilha + o que o sistema mudou nos serviços (fases) e os serviços novos
function reconstruirBase() {
  if (!estado.dadosBase) return;
  estado.base = montarBase({ ...estado.dadosBase, servicos: svPos.mesclar(estado.dadosBase.servicos || []) }, hojeISO());
}

// carrega a agenda da semana escolhida (uma vez por semana) e redesenha
function carregarAgendaSemana() {
  const de = estado.posAgenda.semana; const chave = `${de}`;
  if (estado.posAgenda.chave === chave) return;
  estado.posAgenda.chave = chave;
  agendaPos.carregar(de, somarDias(de, 6)).then(() => { const r = rotaAtual(); if (r.tela === 'posobra' && (!r.sub || r.sub === 'agenda')) desenhar(); });
}
function garantirAtasCarregadas() {
  if (estado.atasVisitada === '#posobra') return;
  estado.atasVisitada = '#posobra';
  atas.carregar().then(() => { const r = rotaAtual(); const a = document.activeElement; if (r.tela === 'posobra' && r.sub === 'pendencias' && !(a && a.closest && a.closest('#pend-form'))) desenhar(); });
}
// ---------------------------------------------------------------- desenho

// de onde vêm os dados do pós-obra: os arquivos mais novos da pasta PÓS OBRA do Drive
function fonteDoPosObra() {
  const f = estado.base && estado.base.fonte;
  if (!f) return 'Dados do pós-obra lidos da planilha integrada (cópia de 13/10).';
  const nome = (x) => String(x || '').replace(/.xlsx$/i, '');
  return `Lido do Drive: ${[f.operacional, f.cobranca, f.agenda].filter(Boolean).map(nome).join(' · ')}${f.lidoEm ? ` (leitura de ${new Date(f.lidoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})` : ''}. Quando a equipe salva uma revisão nova, o sistema passa a ler a nova.`;
}

// obras que dá para vincular a uma pessoa: só as obras (Mo…), sem as encerradas no cadastro da planilha de ferramentas
// obras nas atas: quem é de obra só as suas; os demais, todas as obras ativas
function obrasDeAtas() { return funcaoAtual().porObra ? obrasDaPessoa() : obrasDeAcesso(); }

function obrasDeAcesso() {
  const enc = new Set((((estado.drive || {}).estoque || {}).cadastroObras || []).filter((c) => /encerr|finaliz|conclu/i.test(c.status || '')).map((c) => c.obra));
  return obrasDisponiveis().filter((o) => /^Mo\d/i.test(o) && !enc.has(o));
}

function desenharNav(sel) {
  const CFG = estado.cfg;
  const f = funcaoAtual();
  // Feed com a bolinha de publicações novas
  const itemFeed = () => { const n = sel === 'feed' ? 0 : feed.novas(s.nome); return `<a class="nav-item${sel === 'feed' ? ' sel' : ''}" href="#/feed"><span>Feed</span>${n ? `<span class="nav-n">${n}</span>` : ''}</a>`; };
  const itemAtas = () => { const n = atas.minhasAbertas(); return `<a class="nav-item${sel === 'atas' ? ' sel' : ''}" href="#/atas"><span>Atas e pendências</span>${n ? `<span class="nav-n">${n}</span>` : ''}</a>`; };
  const item =(id, nome, status) => `<a class="nav-item${id === sel ? ' sel' : ''}" href="#/${esc(id)}"${id === sel ? ' aria-current="page"' : ''}><span>${esc(nome)}</span>${status ? pt(status) : ''}</a>`;
  const s = sessao();
  // perfil (primeira coisa do menu): bonequinho + nome; clicando abre a pontuação e as sugestões
  $('#nav').innerHTML = `<div class="marca"><img src="img/logo.png" alt="Sólida"><span>Painel da empresa</span></div>`
    + `<a class="nav-perfil${sel === 'perfil' ? ' sel' : ''}" href="#/perfil" title="Meu perfil">${perfil.avatar(s.nome, 38)}<span><b>${esc(s.nome)}</b><small>${esc(f.nome)}</small></span></a>`
    + item('geral', 'Visão geral') + (paginaVisivel(f, 'feed') ? itemFeed() : '') + (paginaVisivel(f, 'atas') ? itemAtas() : '') + (!f.semMinhaSemana && paginaVisivel(f, 'meudia') && f.editaProdutividade ? item('meudia', 'Minha semana') : '') + (!f.semMinhaSemana && paginaVisivel(f, 'meudia') ? item('funcoes', 'Minhas funções') : '') + (f.veQuadro ? item('quadro', 'Quadro de funções') : '')
    + '<div class="nav-sep"></div>'
    + (CFG ? CFG.areas.filter(podeVerArea).map((a) => item(a.id, a.nome, a.status)).join('') : '')
    + (paginaVisivel(f, 'estoque') ? item('estoque', 'Estoque') : '')
    + (paginaVisivel(f, 'marketing') ? item('marketing', 'Marketing') : '')
    + '<div class="nav-sep"></div>'   // equipe: escritório virtual, treinamentos (e o que vier depois)
    + (paginaVisivel(f, 'escritorio') ? item('escritorio', 'Escritório virtual') : '')
    + (paginaVisivel(f, 'treinamentos') ? item('treinamentos', 'Treinamentos') : '')
    + (f.veAgentes ? `<div class="nav-sep"></div>${item('agentes', 'Agentes')}${nuvem.NA_NUVEM && funcaoReal().id === 'socio' ? item('acessos', 'Acessos') : ''}` : '')
    + `<div class="navfoot">${estado.sync.origem === 'link' ? 'Atualiza sozinho a cada 5 minutos.' : 'Mostrando os últimos dados baixados.'}</div>`;
  desenharAvatares($('#nav'));
}

// bonequinho do escritório como foto do perfil (nenhuma foto é guardada)
function desenharAvatares(raiz = document) {
  raiz.querySelectorAll('canvas[data-avatar]').forEach((c) => {
    const p = pessoaPorId(c.dataset.avatar); if (!p) return;
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    g.save(); g.imageSmoothingEnabled = false; const k = c.width / 36; g.scale(k, k);
    desenharBoneco(g, p, 1, 18, { dir: 'baixo' }); g.restore();
  });
}

function desenharPerfil() {
  const s = sessao();
  $('#bPerfil').innerHTML = simulando()
    ? `<span class="pt atencao"></span><span><b>${esc(s.nome)}</b> · vendo como ${esc(funcaoAtual().nome)}</span>`
    : `<span class="pt ok"></span><span><b>${esc(s.nome)}</b> · ${esc(funcaoAtual().nome)}</span>`;
}

// Opções das telas do painel conforme a função (setores, obras, blocos da Visão geral)
function opcoesTelas() {
  const f = funcaoAtual();
  return {
    areaVisivel: podeVerArea,
    obras: f.porObra ? obrasDaPessoa() : null,
    resumida: f.porObra,
    veBloco: (titulo) => veBlocoGeral(f, titulo),
    // a frase de resumo da Visão geral fala de orçamentos e do comparativo do ano: só para quem vê o Comercial
    semFrase: !veBlocoGeral(f, 'Comercial'),
    itemOculto: f.porObra ? (label) => INDICADORES_SO_GESTAO.some((r) => r.test(label)) : null,
    // indicadores tirados do painel a pedido do Felipe (14/10): veículos e locações (transporte) entram depois
    kpiOculto: (area, label) => area === 'transporte' && /ve[íi]culos ok|loca[çc][õo]es devolvidas|locações no prazo/i.test(label),
  };
}

// ---------------------------------------------------------------- "Ver como" (só sócio)
// Faixa no topo de todas as telas: escolhe uma função e o sistema inteiro passa a aparecer como ela vê.

function resumoDoPerfil() {
  const CFG = estado.cfg;
  const f = funcaoAtual();
  const itens = [];
  const blocos = CFG ? (CFG.geral.blocos || []).filter((b) => veBlocoGeral(f, b.titulo) && (!b.restrito || f.veValores)).map((b) => b.titulo) : [];
  itens.push(`Visão geral${f.porObra ? ' (só números)' : ''}: ${blocos.join(', ') || '—'}`);
  const abasDia = meudia.ABAS.filter((a) => !a.obra || f.editaProdutividade).map((a) => a.nome);
  if (!f.semMinhaSemana) itens.push(`Minha semana: ${abasDia.join(', ')}`);
  if (f.veQuadro) itens.push('Quadro de funções');
  if (CFG) {
    for (const a of CFG.areas.filter(podeVerArea)) {
      if (f.porObra && a.id === 'operacao') itens.push('Operação (só programação, metas e medições das suas obras)');
      else if (f.porObra && a.id === 'planejamento') itens.push('Planejamento (só as suas obras)');
      else if (a.id === 'rh') itens.push('RH (todos os funcionários)');
      else itens.push(a.nome);
    }
  }
  if (f.veAgentes) itens.push('Agentes');
  return { itens, valores: f.veValores };
}

// nomes curtos para os botões do "Ver como" (o nome completo fica no title)
const NOME_CURTO = {
  socio: 'Diretoria', coord_operacoes: 'Coordenação', tecnico: 'Técnico', planejamento: 'Planejamento',
  orc_terceirizado: 'Orç. terceirizado', projetos: 'Projeto + orç.', compras: 'Compras', ferramentas: 'Ferramentas',
  executor_ferramentas: 'Executor ferram.', estagiario_compras: 'Estag. compras', posobra: 'Pós-obra', financeiro: 'Financeiro', administrativo: 'Administrativo',
  rh: 'RH', marketing: 'Marketing', gestor_obra: 'Gestor de obra', estagiario: 'Estagiário', encarregado: 'Encarregado', ajudante: 'Ajudante',
};

function desenharVerComo() {
  const el = $('#ver-como');
  if (!podeVerComo()) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const f = funcaoAtual();
  const obras = obrasDisponiveis();
  const minhas = obrasDaPessoa();
  // faixa compacta: só os botões das funções (pedido do Felipe, 15/10); o que cada perfil vê fica no title
  const r = resumoDoPerfil();
  el.innerHTML = String(html`<div class="vc-linha">
      <span class="vc-rot">Ver como</span>
      <div class="vc-funcoes">${FUNCOES.map((x) => html`<button type="button" data-vercomo="${x.id}" class="${x.id === f.id ? 'on' : ''}" title="${x.nome}${x.id === f.id ? ` · Aparece: ${r.itens.join(' · ')} · Valores em R$: ${r.valores ? 'sim' : 'não'}` : ''}">${NOME_CURTO[x.id] || x.nome}</button>`)}</div>
      ${f.porObra ? html`<label class="vc-obra">Obra<select id="vercomo-obra">${obras.map((o) => html`<option ${minhas[0] === o ? html.seguro('selected') : ''}>${o}</option>`)}</select></label>` : ''}
      ${simulando() ? html`<button type="button" class="vc-voltar" data-vercomo="${funcaoReal().id}">Voltar ao meu perfil</button>` : ''}
    </div>`);
}

function obraPadrao() {
  const obras = obrasDisponiveis();
  return obras.includes('Mo533') ? 'Mo533' : obras[0];
}

// ---------------------------------------------------------------- login

function mostrarLogin(erro = '') {
  document.body.classList.add('sem-login');
  const el = $('#login');
  el.hidden = false;
  let ultimo = {};
  try { ultimo = JSON.parse(localStorage.getItem('solida.ultimoLogin')) || {}; } catch { /* nada */ }
  if (nuvem.NA_NUVEM) {
    // na nuvem: e-mail e senha; conta sem função = aguardando a diretoria liberar
    const p = nuvem.perfilAtual();
    // logado com senha provisória: cria a senha; sem função ou bloqueado: volta para entrar com aviso
    const st = p && p.trocar_senha ? { modo: 'nova-senha' }
      : p && (!p.funcao || p.ativo === false) ? { modo: 'entrar', erro: 'Seu acesso está bloqueado ou sem função. Fale com a diretoria.' }
      : { ...estado.loginNuvem, erro: erro || estado.loginNuvem.erro };
    el.innerHTML = String(login.renderNuvem(st));
  } else el.innerHTML = String(login.render({ obras: obrasDisponiveis(), ultimo, erro }));
  document.title = 'Entrar · Sólida';
  const campo = el.querySelector(ultimo.usuario ? '[name="senha"]' : '[name="usuario"], [name="email"], [name="nome"]');
  if (campo) campo.focus();
}

// entrada na nuvem: entrar, criar conta, esqueci a senha, senha nova
async function loginNuvem(form) {
  const fd = new FormData(form); const modo = form.dataset.modo;
  const msg = form.querySelector('#msg-login'); const bt = form.querySelector('button[type=submit]');
  if (msg) msg.textContent = ''; if (bt) bt.disabled = true;
  try {
    if (modo === 'entrar') await nuvem.entrar(fd.get('usuario'), String(fd.get('senha') || ''));
    else if (modo === 'nova-senha') {
      if (fd.get('senha') !== fd.get('senha2')) throw new Error('As duas senhas não são iguais.');
      await nuvem.trocarSenha(String(fd.get('senha') || ''));
    }
    estado.loginNuvem = { modo: 'entrar' };
    estado.dia = hojeISO();
    if (logado()) { location.hash = funcaoAtual().semMinhaSemana ? '#/geral' : '#/meudia'; atualizar(); }
    desenhar();
  } catch (err) {
    if (msg) msg.textContent = err.message || String(err);
  } finally { if (bt) bt.disabled = false; }
}

function esconderLogin() {
  document.body.classList.remove('sem-login');
  $('#login').hidden = true;
  $('#login').innerHTML = '';
}

function desenhar() {
  if (!logado()) { mostrarLogin(); desenharPedido(); return; }
  esconderLogin();
  const CFG = estado.cfg;
  const rota = rotaAtual();
  let tela = rota.tela;
  const f = funcaoAtual();
  if (tela === 'agentes' && !f.veAgentes) tela = 'geral';
  if (tela === 'quadro' && !f.veQuadro) tela = 'funcoes';
  if ((tela === 'meudia' || tela === 'funcoes') && f.semMinhaSemana) tela = 'geral';
  if (tela === 'meudia' && !f.editaProdutividade) tela = 'funcoes';   // quem não lança produtividade só tem as funções
  if (tela === 'funcoes' && !paginaVisivel(f, 'meudia')) tela = 'geral';
  if (['meudia', 'feed', 'estoque', 'escritorio', 'treinamentos', 'atas', 'marketing'].includes(tela) && !paginaVisivel(f, tela)) tela = 'geral';   // aba que a diretoria tirou desta função

  let area = CFG && CFG.areas.find((a) => a.id === tela);
  if (area && !podeVerArea(area)) { area = null; tela = 'geral'; }   // setor fora do perfil: nem existe
  const ehObraPlan = tela === 'planejamento' && rota.sub === 'obra';
  const fixas = ['agentes', 'meudia', 'funcoes', 'quadro', 'estoque', 'escritorio', 'perfil', 'feed', 'treinamentos', 'acessos', 'atas', 'marketing'];
  const sel = tela === 'funcionarios' ? 'rh' : (area || fixas.includes(tela)) ? tela : 'geral';
  desenharNav(sel);
  desenharPerfil();
  desenharVerComo();
  if (tela !== 'escritorio') escritorio.parar();   // saiu do escritório virtual: para a animação e a presença

  const d = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#data').textContent = d.charAt(0).toUpperCase() + d.slice(1);
  const titulo = ehObraPlan ? rota.arg
    : area ? area.nome
    : ({ agentes: 'Agentes', funcionarios: 'Funcionários por obra', meudia: 'Minha semana', funcoes: 'Minhas funções', quadro: 'Quadro de funções', estoque: 'Estoque', escritorio: 'Escritório virtual', perfil: 'Perfil', feed: 'Feed', treinamentos: 'Treinamentos', acessos: 'Acessos', atas: 'Atas e pendências', marketing: 'Marketing' }[tela] || 'Visão geral');
  $('#titulo').textContent = titulo;
  document.title = `${titulo} · Sólida`;

  const sc = $('#sinc');
  const sy = estado.sync;
  if (sy.erro) { sc.textContent = 'Sem conexão, mostrando os últimos dados'; sc.className = 'sinc err'; sc.title = sy.erro; }
  else if (sy.origem === 'link') { sc.textContent = `Atualizado às ${hora(sy.atualizado)}`; sc.className = 'sinc'; sc.title = ''; }
  else if (sy.origem) { sc.textContent = 'Últimos dados baixados'; sc.className = 'sinc'; }

  // telas que não dependem do dados.json
  if (tela === 'feed') {
    feed.marcarVisto();
    $('#conteudo').innerHTML = `<div>${feed.render({ eu: { nome: sessao().nome }, diretoria: f.id === 'socio', msg: estado.feedMsg || '' })}</div>`;
    estado.feedMsg = '';
    return;
  }
  if (tela === 'acessos' && nuvem.NA_NUVEM && funcaoReal().id === 'socio') {
    $('#conteudo').innerHTML = '<div class="carregando">Carregando a equipe…</div>';
    nuvem.listarPerfis().then((ps) => { if (rotaAtual().tela === 'acessos') $('#conteudo').innerHTML = `<div>${acessos.render({ perfis: ps, obras: obrasDeAcesso(), meuId: nuvem.perfilAtual() && nuvem.perfilAtual().id, msg: estado.acessosMsg || '', aviso: estado.acessosAviso })}</div>`; estado.acessosMsg = ''; estado.acessosAviso = null; });
    return;
  }
  if (tela === 'atas') {
    if (gravador.gravando() && document.getElementById('ata-fala') && rota.params.get('aba') === 'nova') return;   // gravando a reunião: não redesenha, senão perde a tela
    $('#conteudo').innerHTML = `<div>${atas.render({ params: rota.params, obras: obrasDeAtas(), sugestoes: ((estado.terceiros && estado.terceiros.empresas) || []).map((e) => e.empresa), msg: estado.atasMsgHash === location.hash ? (estado.atasMsg || '') : '' })}</div>`;
    ordenar.aplicar();
    { const fm = document.getElementById('ata-form'); if (fm) atas.atualizarNomeDoForm(fm); }
    gravAtualizar();
    if (estado.atasVisitada !== location.hash) {   // ao entrar na tela (ou mudar de aba), busca os dados mais novos
      estado.atasVisitada = location.hash;
      atas.carregar().then(() => { const a = document.activeElement; if (rotaAtual().tela === 'atas' && !(a && a.closest && a.closest('#ata-form, #pend-form'))) desenhar(); });
    }
    return;
  }
  if (tela === 'marketing') { $('#conteudo').innerHTML = `<div>${marketing.render()}</div>`; return; }
  if (tela === 'treinamentos') { $('#conteudo').innerHTML = `<div>${treinamentos.render({ todos: rota.params.get('todos') === '1', aberto: estado.treinAberto })}</div>`; return; }
  if (tela === 'perfil') {
    const eu = { chave: idPessoa(), nome: sessao().nome, funcao: funcaoAtual().id, obras: obrasDaPessoa() };
    const pAlvo = rota.params.get('p'); const reg = lerPessoasTarefas();
    const podeVerTodos = f.id === 'socio';
    const alvo = podeVerTodos && pAlvo && reg[pAlvo] ? { chave: pAlvo, ...reg[pAlvo] } : null;
    // diretoria: além do ranking, as sugestões da equipe sobre o sistema (pedidos de alteração)
    const extra = podeVerTodos && !alvo ? `${nuvem.NA_NUVEM ? '<section class="secao"><h2>Logins da equipe</h2><p><a class="botao on" href="#/acessos">Criar login · redefinir senha · função e obras</a></p></section>' : ''}${pedidos.secaoEquipe(estado.pedido.lista)}` : '';
    $('#conteudo').innerHTML = `<div>${perfil.render({ eu, alvo, podeVerTodos, extra, CFG })}</div>`;
    desenharAvatares();
    return;
  }
  if (tela === 'meudia' || tela === 'funcoes') {
    $('#conteudo').innerHTML = `<div>${meudia.render({ dia: estado.dia, CFG, pendAberta: estado.pendAberta, soFuncoes: tela === 'funcoes', aba: tela === 'funcoes' ? 'funcoes' : rota.sub, params: rota.params, semanaRef: estado.semanaRef })}</div>`;
    return;
  }
  // escritório virtual: tela com animação própria (não redesenha sozinha a cada 5 min)
  if (tela === 'escritorio') {
    $('#conteudo').innerHTML = `<div id="esc-raiz">${escritorio.render()}</div>`;
    escritorio.iniciar($('#esc-raiz'));
    return;
  }
  if (tela === 'estoque') {
    $('#conteudo').innerHTML = `<div>${estoque.render(estado.drive.estoque, { podeCompleto: estoque.VE_ESTOQUE_COMPLETO.includes(f.id), veConsumiveis: estoque.VE_CONSUMIVEIS.includes(f.id), verTudo: rota.params.get('ver') === 'tudo' })}</div>`;
    return;
  }
  if (tela === 'quadro') {
    $('#conteudo').innerHTML = `<div>${quadro.render({ funcaoId: estado.quadro.funcao || (f.id === 'socio' ? 'coord_operacoes' : f.id), ref: estado.quadro.ref })}</div>`;
    return;
  }

  if (!CFG) return;
  const deObra = f.porObra;
  const T = criarTelas(CFG, veValores(), opcoesTelas());
  let out;
  try {
    if (ehObraPlan) out = T.telaObra(rota.arg);
    else if (area && area.id === 'operacao') {
      // Operação: acompanhamento de todas as obras (quem é de obra vê só as suas e não vê o Resumo do setor)
      const visiveis = deObra ? obrasDaPessoa() : null;
      // Só o Resumo (cronograma, programação e medições de todas as obras) e, embaixo, Por obra (15/10).
      // Metas diárias continuam em #/operacao/metas (link no Resumo).
      const base = '#/operacao';
      if (rota.sub === 'metas') {
        out = `<div><a class="link" href="${base}">← Operação</a><div style="margin-top:18px">${produtividade.render({ CFG, params: rota.params, dia: estado.dia, semanaRef: estado.semanaRef })}</div></div>`;
      } else {
        const ob = operacao.porObra(CFG, visiveis, estado.drive.projetos, rota.params, base, { veValores: !!f.veValores });
        // ordem (pedido do Felipe, 15/10): indicadores → alertas das metas → cronograma/programação/medições → Por obra
        const tabela = operacao.abaProgramacao(CFG, visiveis, (o) => `${base}?obra=${encodeURIComponent(o)}&aba=cronograma`);
        const depois = `${produtividade.alertasMetas(CFG, visiveis)}${terceiros.render(CFG, estado.terceiros, visiveis)}${tabela}<div style="margin-top:34px">${ob.cards}</div>`;
        // obra aberta: só ela (com o link para voltar)
        if (ob.aberta) out = `<div>${ob.painel}</div>`;
        else out = `<div class="atalho-metas"><a class="botao on" href="#/operacao/metas">Análise das metas da semana</a> <span class="pequeno">o que está dentro da meta, o que não está e o que fazer, obra por obra</span></div>${deObra ? `<div>${depois}</div>` : T.telaArea(area, '', { semEstado: true, semAlertas: true, depoisIndicadores: depois })}`;
      }
    }
    else if (area && area.id === 'transporte') {
      // Transporte: indicadores → planilha de ferramentas obrigatórias por obra (enviada toda quarta no grupo)
      // abas: Resumo · Reposição de ferramentas (a reposição mostra carros e obras: só quem vê o estoque completo)
      const veRepos = estoque.VE_ESTOQUE_COMPLETO.includes(f.id);
      const abas = veRepos ? subnav(reposicao.ABAS_TRANSPORTE.map((a) => ({ ...a, href: `#/transporte${a.id ? `/${a.id}` : ''}` })), rota.sub === 'reposicao' ? 'reposicao' : '') : '';
      if (veRepos && rota.sub === 'reposicao') out = `<div>${abas}<div style="margin-top:26px">${reposicao.render(estado.drive.estoque)}</div></div>`;
      else out = T.telaArea(area, abas ? `<div style="margin-bottom:34px">${abas}</div>` : '', { depoisIndicadores: ferrChk.cartoes(CFG, estado.ferrChk, deObra ? obrasDaPessoa() : null, estado.drive.estoque) });
    }
    else if (area && area.id === 'planejamento') {
      // Planejamento: Resumo · Programação semanal · Produtividade · Diário de obra
      const visiveis = deObra ? obrasDaPessoa() : null;
      const lista = operacao.ABAS_PLANEJAMENTO;
      const sub = lista.find((a) => a.id === rota.sub) ? rota.sub : '';
      const abas = subnav(lista.map((a) => ({ ...a, href: `#/planejamento${a.id ? `/${a.id}` : ''}` })), sub);
      // alerta em destaque, em qualquer aba: quem não mandou a produtividade no último dia útil
      const topo = `${produtividade.alertaProdutividadeOntem(CFG, visiveis)}${abas}`;
      const corpo = {
        programacao: () => operacao.abaProgramacao(CFG, visiveis),
        produtividade: () => operacao.abaProdutividade(CFG, visiveis, estado.semanaRef),
        diario: () => operacao.abaDiario(CFG, visiveis),
      }[sub];
      out = corpo ? `<div>${topo}<div style="margin-top:26px">${corpo()}</div></div>` : T.telaArea(area, `<div style="margin-bottom:34px">${topo}</div>`);
    }
    else if (area && (area.id === 'comercial' || area.id === 'projetos')) {
      // Comercial: Resumo · Orçamentos · Arquiteturas — Projetos: Resumo · Por obra · As-built
      const ehCom = area.id === 'comercial';
      const lista = ehCom ? comercial.ABAS_COMERCIAL : projetos.ABAS_PROJETOS;
      const visiveis = deObra ? obrasDaPessoa() : null;
      const sub = lista.find((a) => a.id === rota.sub) ? rota.sub : '';
      const abas = subnav(lista.map((a) => ({ ...a, href: `#/${area.id}${a.id ? `/${a.id}` : ''}` })), sub);
      const corpo = {
        orcamentos: () => comercial.abaOrcamentos(estado.drive.orcamentos, rota.params.get('ano')),
        arquiteturas: () => comercial.abaArquiteturas(estado.drive.orcamentos),
        obras: () => projetos.abaProjetos(CFG, estado.drive.projetos, visiveis),
        asbuilt: () => projetos.abaAsbuilt(CFG, estado.drive.projetos, visiveis, estado.semanaRef),
      }[sub];
      const topo = ehCom ? abas : `${abas}${projetos.resumoProjetos(CFG, estado.drive.projetos, visiveis)}`;
      out = corpo ? `<div>${abas}<div style="margin-top:26px">${corpo()}</div></div>` : T.telaArea(area, `<div style="margin-bottom:34px">${topo}</div>`);
    }
    else if (tela === 'funcionarios') out = T.telaPessoas(estado.pessoas);
    else if (tela === 'agentes') out = T.telaAgentes();
    else if (area && area.id === 'posobra') {
      const { abas, conteudo, resumo } = telaPosObraPlanilha(rota);
      out = rota.sub ? `<div>${abas}${conteudo}</div>` : T.telaArea(area, `<div style="margin-bottom:34px">${abas}${resumo || ''}</div>`);
    } else if (area) out = T.telaArea(area);
    else out = T.telaGeral();
  } catch (e) {
    console.error(e);
    out = `<div class="erro">Erro ao montar esta tela: ${esc(e.message)}</div>`;
  }
  $('#conteudo').innerHTML = out;
  ordenar.aplicar();   // tabelas ordenáveis: reaplica a ordem escolhida
  desenharPedido();
  // Projetos: clicar numa obra do ranking abre as disciplinas dela
  const obraAberta = tela === 'projetos' && rota.sub === 'obras' && rota.params.get('obra');
  if (obraAberta) {
    const det = document.getElementById(`proj-${obraAberta}`);
    if (det) { det.open = true; det.scrollIntoView({ block: 'start' }); }
  }
  // Operação: trocar de aba dentro da mesma obra mantém a rolagem (ver hashchange)
  const chaveObra = tela === 'operacao' ? (rota.params.get('obra') || '') : '';
  estado.obraOpVista = chaveObra;
}

// obras que podem ser vinculadas a uma pessoa (as do planejamento + as da lista do RH)
function obrasDisponiveis() {
  const CFG = estado.cfg;
  if (!CFG) return [];
  const plan = (CFG.areas.find((a) => a.id === 'planejamento') || {}).porObra || [];
  return [...new Set([...plan.map((o) => o.obra), ...(CFG.obras || []).filter((o) => /^(Mo|Po)/i.test(o))])];
}

// ---------------------------------------------------------------- dados

// Planejamento e Projetos são setores separados (pedido do Felipe, 15/10). O agente ainda manda um setor
// só ("Planejamento e projetos"): os processos 3.x e os indicadores/alertas de projeto vão para Projetos;
// cronograma, programação e metas ficam no Planejamento.
const EH_PROJETO = /projet|revis[ãa]o|aditivo|compatibiliz|as.?built|planta|listagem/i;
function separarProjetos(cfg) {
  const i = cfg.areas.findIndex((a) => a.id === 'planejamento');
  if (i < 0 || cfg.areas.some((a) => a.id === 'projetos')) return;
  const plan = cfg.areas[i];
  const deProjeto = (x) => EH_PROJETO.test(`${x.label || ''} ${x.texto || ''} ${x.nome || ''}`) && !/cronograma|programa[çc][ãa]o|metas?/i.test(x.label || x.texto || '');
  const proc = (p) => String(p.cod || '').startsWith('3.');
  const projetosArea = {
    ...plan, id: 'projetos', nome: 'Projetos',
    resumo: '', instrucoes: [], porObra: undefined, semanas: undefined,   // cronograma por obra é do Planejamento
    kpis: (plan.kpis || []).filter(deProjeto),
    alertas: (plan.alertas || []).filter(deProjeto),
    processos: (plan.processos || []).filter(proc),
    fontes: [{ nome: 'Drive', via: 'OPERACOES > obra > PROJETO (disciplinas e ASBUILT) e listagem de projetos' }],
  };
  projetosArea.status = projetosArea.alertas.some((a) => a.nivel === 'critico') ? 'critico' : projetosArea.alertas.length ? 'atencao' : 'ok';
  cfg.areas.splice(i, 1, {
    ...plan, nome: 'Planejamento',
    kpis: (plan.kpis || []).filter((k) => !deProjeto(k)),
    alertas: (plan.alertas || []).filter((a) => !deProjeto(a)),
    processos: (plan.processos || []).filter((p) => !proc(p)),
  }, projetosArea);
}

async function atualizar() {
  // marcações de tarefas de todos (pontuação do Perfil); quem está logado manda o que só tinha neste navegador
  const atual = logado() ? { pessoa: idPessoa(), nome: sessao().nome, funcao: funcaoAtual().id, teste: simulando(), obras: obrasDaPessoa() } : null;
  if (nuvem.NA_NUVEM && logado()) { try { aplicarAbas(await nuvem.carregarAbas()); } catch { /* sem a tabela: fica o padrão de cada função */ } }
  const [painelR, baseR, prodR, driveR, , , , , ferrR, terR] = await Promise.allSettled([carregarPainel(), carregarDados(), carregarProdutividade(), carregarDrive(), sincronizarTarefas(atual), perfil.carregarFotos(), feed.carregar(), evidencias.carregar(), carregarFerramentasChk(), carregarTerceirizados(), atas.carregar()]);
  if (terR.status === 'fulfilled') estado.terceiros = terR.value;
  if (ferrR.status === 'fulfilled') estado.ferrChk = ferrR.value;
  if (prodR.status === 'fulfilled') estado.whats = prodR.value;
  if (driveR.status === 'fulfilled') estado.drive = driveR.value;
  if (painelR.status === 'fulfilled') {
    const env = painelR.value;
    const cfg = normalizar(env.dados);
    if (cfg) { separarProjetos(cfg); estado.cfg = cfg; }
    estado.sync = { origem: env.origem, atualizado: env.atualizado, erro: env.erro || (cfg ? null : 'O dados.json não tem "geral" e "areas".') };
  } else {
    estado.sync = { ...estado.sync, erro: painelR.reason.message };
  }
  // produtividade do WhatsApp vai junto com o painel: as telas leem tudo do mesmo lugar (CFG)
  if (estado.cfg) estado.cfg.whats = (estado.whats && estado.whats.registros) || [];
  // Projetos: o status também sai da verificação das pastas (projeto faltando, as-built parado)
  const areaProj = estado.cfg && estado.cfg.areas.find((a) => a.id === 'projetos');
  const stProj = areaProj && projetos.statusProjetos(estado.cfg, estado.drive.projetos);
  const ORDEM_ST = ['ok', 'pendente', 'atencao', 'critico'];
  if (stProj && ORDEM_ST.indexOf(stProj) > ORDEM_ST.indexOf(areaProj.status)) areaProj.status = stProj;
  if (baseR.status === 'fulfilled') {
    estado.dadosBase = baseR.value;
    await svPos.carregar();
    reconstruirBase();
    estado.erroBase = null;
  } else {
    estado.erroBase = `Não foi possível ler a planilha do pós-obra: ${baseR.reason.message}`;
  }
  if (!estado.cfg && !['meudia', 'funcoes', 'quadro'].includes(rotaAtual().tela)) {
    $('#conteudo').innerHTML = `<div class="erro">Não foi possível carregar os dados do painel. ${esc(estado.sync.erro || '')}<br>
      Abra o sistema pelo <b>iniciar.bat</b> (não abra o arquivo index.html direto).</div>`;
  }
  // na tela de login, só completa a lista de obras (sem apagar o que a pessoa já digitou)
  if (!logado()) {
    const sel = $('#login .obras-sel');
    if (sel && !sel.querySelector('input') && estado.cfg) {
      sel.innerHTML = '<legend>Obras vinculadas</legend>' + obrasDisponiveis()
        .map((o) => `<label class="check"><input type="checkbox" name="obras" value="${esc(o)}"> ${esc(o)}</label>`).join('');
    }
    if (!$('#login').innerHTML) mostrarLogin();
    return;
  }
  const ativo = document.activeElement;
  const ocupado = ativo && ativo.matches('input, select, textarea');
  if (!ocupado && !(escritorio.ativo() && rotaAtual().tela === 'escritorio')) desenhar();
  atualizarPedidos();   // status dos pedidos de alteração (o Claude marca como feito)
}

// ---------------------------------------------------------------- eventos

function trocarQuery(muda) {
  const r = rotaAtual();
  Object.entries(muda).forEach(([k, v]) => (v === null ? r.params.delete(k) : r.params.set(k, v)));
  const caminho = [r.tela, r.sub, r.arg && encodeURIComponent(r.arg)].filter(Boolean).join('/');
  location.hash = `#/${caminho}${r.params.toString() ? `?${r.params}` : ''}`;
}

function configurar() {
  window.addEventListener('hashchange', () => {
    const obraAntes = estado.obraOpVista; const rolagem = $('#conteudo').scrollTop;
    desenhar(); desenharPedido();
    // mesma obra da Operação (só mudou a aba): continua onde estava
    if (estado.obraOpVista && estado.obraOpVista === obraAntes) { $('#conteudo').scrollTop = rolagem; return; }
    $('#conteudo').scrollTop = 0; window.scrollTo(0, 0);
  });

  // login (modo teste: qualquer usuário e senha; a senha não é guardada)
  $('#login').addEventListener('change', (e) => {
    if (e.target.name === 'funcao') $('#login .obras-sel').hidden = !funcaoPorId(e.target.value).porObra;
  });
  $('#login').addEventListener('submit', (e) => {
    e.preventDefault();
    if (nuvem.NA_NUVEM) { loginNuvem(e.target); return; }
    const fd = new FormData(e.target);
    const usuario = String(fd.get('usuario') || '').trim();
    const msg = $('#msg-login');
    if (!usuario || !fd.get('senha')) { msg.textContent = 'Preencha o usuário e a senha.'; return; }
    const funcao = fd.get('funcao');
    const obras = fd.getAll('obras');
    if (funcaoPorId(funcao).porObra && !obras.length) { msg.textContent = 'Escolha pelo menos uma obra para esta função.'; return; }
    const s = entrar({ usuario, nome: fd.get('nome'), funcao, obras });
    try { localStorage.setItem('solida.ultimoLogin', JSON.stringify({ usuario: s.usuario, nome: s.nome, funcao, obras })); } catch { /* nada */ }
    definirPerfil(veValores());
    estado.quadro.funcao = null;
    estado.dia = hojeISO();
    location.hash = funcaoPorId(funcao).semMinhaSemana ? '#/geral' : '#/meudia';
    desenhar();
  });
  $('#login').addEventListener('click', async (e) => {
    const m = e.target.closest('[data-login-modo]');
    if (m) { if (m.dataset.loginModo === 'sair') { await nuvem.sair(); } estado.loginNuvem = { modo: m.dataset.loginModo === 'sair' ? 'entrar' : m.dataset.loginModo }; mostrarLogin(); return; }
    if (e.target.closest('[data-login-recarregar]')) { await nuvem.carregarPerfil(); desenhar(); atualizar(); }
  });
  $('#bSair').addEventListener('click', async () => {
    if (nuvem.NA_NUVEM) await nuvem.sair();
    sair();
    location.hash = '#/geral';
    mostrarLogin();
  });
  // lembra se a caixa de pendências está aberta (o Meu dia é redesenhado a cada check)
  document.addEventListener('toggle', (e) => {
    if (e.target.id === 'pendencias') estado.pendAberta = e.target.open;
  }, true);

  document.addEventListener('change', (e) => {
    const id = e.target.id;
    if (id === 'ver-por') { estado.verPor = e.target.value; gravar('verPor', estado.verPor); desenhar(); }
    if (id === 'data-ref' && ehData(e.target.value)) { estado.ref = e.target.value; desenhar(); }
    if (id === 'dia-ref' && ehData(e.target.value)) { estado.dia = e.target.value; desenhar(); }
    if (id === 'quadro-funcao') { estado.quadro.funcao = e.target.value; desenhar(); }
    if (id === 'dia-prod' && ehData(e.target.value)) trocarQuery({ dia: e.target.value });
    if (id === 'vercomo-obra') { verComo(funcaoAtual().id, [e.target.value]); desenhar(); }
    if (id === 'fobra') { estado.pessoas.obra = e.target.value; atualizarPessoas(); }
    const form = e.target.closest('.form-produtividade');
    if (form && e.target.type === 'checkbox') { e.target.dataset.tocado = '1'; produtividade.atualizarJustificativas(form, estado.cfg); }
  });

  document.addEventListener('click', (e) => {
    const vc = e.target.closest('[data-vercomo]');
    if (vc) {
      const nova = vc.dataset.vercomo;
      const ehDeObra = FUNCOES.find((x) => x.id === nova)?.porObra;
      verComo(nova, ehDeObra ? [obrasDaPessoa()[0] || obraPadrao()].filter(Boolean) : []);
      definirPerfil(veValores());
      estado.quadro.funcao = null;
      estado.atasVisitada = null;   // as atas e pendências dependem de quem está vendo: recarrega
      desenhar();
      return;
    }
    if (e.target.closest('#hoje')) { estado.ref = hojeISO(); desenhar(); return; }
    // quadro da semana: item sem quantidade (✓ / ✕) e clique num número lançado para corrigir
    // Operação: clicar na obra abre o detalhe da semana dela
    const ab = e.target.closest('[data-abrir]');
    if (ab) {
      const det = document.getElementById(ab.dataset.abrir);
      if (det) { det.open = true; det.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      return;
    }
    const vi = e.target.closest('[data-vincular]');
    if (vi) {
      const v = JSON.parse(vi.dataset.vincular);
      vincularDia(v.o, v.i, v.t, v.d);
      desenhar();
      return;
    }
    const lc = e.target.closest('[data-lancar]');
    if (lc) {
      const [obra, data, ...resto] = lc.dataset.lancar.split('|');
      gravarManual(obra, data, resto.join('|'), { feito: lc.dataset.valor === '1', por: sessao().nome, ...(lc.dataset.valor === '1' ? { motivo: '' } : {}) });
      produtividade.editarCelula(null);
      desenhar();
      return;
    }
    const ed = e.target.closest('[data-editar]');
    if (ed) {
      produtividade.editarCelula(ed.dataset.editar);
      desenhar();
      const campo = document.querySelector(`.qs-input[data-cel="${CSS.escape(ed.dataset.editar)}"]`);
      if (campo) { campo.focus(); campo.select(); }
      return;
    }
    const imp = e.target.closest('[data-imprimir]');
    if (imp) {
      // data-imprimir="guia1" imprime só aquela guia; vazio = a impressão normal da tela
      document.body.dataset.imprime = imp.dataset.imprimir || '';
      window.addEventListener('afterprint', () => { delete document.body.dataset.imprime; }, { once: true });
      window.print();
      return;
    }
    const tn = e.target.closest('[data-trein]');
    if (tn) { treinamentos.alternarFeito(tn.dataset.trein); estado.treinAberto = tn.dataset.trein; desenhar(); return; }
    const cp = e.target.closest('[data-copiar]');
    if (cp) {
      const el = document.querySelector(`[data-texto-rota="${cp.dataset.copiar}"]`);
      const txt = el ? el.innerText : '';
      const pronto = () => { const antes = cp.textContent; cp.textContent = '✓ Copiado'; setTimeout(() => { cp.textContent = antes; }, 1800); };
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(pronto).catch(() => {
        const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); pronto(); } catch { /* sem permissão */ } ta.remove();
      });
      return;
    }
    const ck = e.target.closest('[data-check]');
    if (ck) {
      const [tarefa, dia, valor] = ck.dataset.check.split('|');
      const ativo = ck.getAttribute('aria-pressed') === 'true';
      marcarCheck(idPessoa(), dia, tarefa, ativo ? null : valor, { nome: sessao().nome, funcao: funcaoAtual().id, teste: simulando() });
      desenhar();
      return;
    }
    const dd = e.target.closest('[data-dia]');
    if (dd) { estado.dia = dd.dataset.dia; desenhar(); return; }
    const an = e.target.closest('[data-ano]');
    if (an) { trocarQuery({ ano: an.dataset.ano }); return; }
    const sw = e.target.closest('[data-semana-md]');
    if (sw) { estado.semanaRef = sw.dataset.semanaMd; desenhar(); return; }
    const dp = e.target.closest('[data-dia-prod]');
    if (dp) { trocarQuery({ dia: dp.dataset.diaProd }); return; }
    const sm = e.target.closest('[data-semana]');
    if (sm) { estado.quadro.ref = sm.dataset.semana; desenhar(); return; }
    const ap = e.target.closest('.apagar-lanc');
    if (ap) {
      const form = ap.closest('.form-produtividade');
      apagarLancamento(form.dataset.obra, form.dataset.dia);
      desenhar();
      return;
    }
    const f = e.target.closest('[data-filtro]');
    if (f) { estado.pessoas.filtro = f.dataset.filtro; desenhar(); return; }
    const b = e.target.closest('[data-ref]');
    if (b) { estado.ref = b.dataset.ref; desenhar(); return; }
    const h = e.target.closest('[data-href]');
    if (h) { location.hash = h.dataset.href; return; }
    const l = e.target.closest('[data-link]');
    if (l) location.hash = l.dataset.link;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches && e.target.matches('tr.lnk')) location.hash = e.target.dataset.href;
    // quadro da semana: digitou o número e apertou Enter: salva e mostra se bateu a meta
    if (e.target.matches && e.target.matches('.qs-input')) {
      if (e.key === 'Escape') { produtividade.editarCelula(null); desenhar(); return; }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = e.target.value.trim().replace(',', '.');
      if (v === '' || Number.isNaN(Number(v)) || Number(v) < 0) { e.target.classList.add('qs-erro'); return; }
      const [obra, data, ...resto] = e.target.dataset.cel.split('|');
      // se a correção bateu a meta, o motivo de "abaixo" deixa de valer
      const bateu = Number(v) >= Number(e.target.dataset.meta);
      gravarManual(obra, data, resto.join('|'), { feito: Number(v), por: sessao().nome, ...(bateu ? { motivo: '' } : {}) });
      produtividade.editarCelula(null);
      desenhar();
    }
  });
  // abaixo da meta: escolher o motivo direto na célula
  document.addEventListener('change', (e) => {
    if (!e.target.matches || !e.target.matches('.qs-motivo') || !e.target.value) return;
    const [obra, data, ...resto] = e.target.dataset.motivo.split('|');
    const feito = e.target.dataset.bool ? e.target.dataset.feito === '1' : Number(e.target.dataset.feito);
    gravarManual(obra, data, resto.join('|'), { feito, motivo: e.target.value, por: sessao().nome });
    desenhar();
  });

  // lançamento de produtividade (teste)
  document.addEventListener('submit', (e) => {
    if (e.target.classList.contains('form-produtividade')) {
      e.preventDefault();
      const form = e.target;
      form.querySelectorAll('input[type="checkbox"]').forEach((c) => { c.dataset.tocado = '1'; });
      produtividade.atualizarJustificativas(form, estado.cfg);
      const r = produtividade.lerFormulario(form, estado.cfg);
      const msg = form.querySelector('.msg-lanc');
      if (r.erro) { msg.className = 'msg msg-lanc err'; msg.textContent = r.erro; return; }
      gravarLancamento(r.lancamento);
      desenhar();
      const novo = document.querySelector(`.form-produtividade[data-obra="${CSS.escape(r.lancamento.obra)}"] .msg-lanc`);
      if (novo) { novo.className = 'msg msg-lanc ok'; novo.textContent = 'Lançamento de teste salvo.'; }
      return;
    }
    if (e.target.closest('[data-filtros]')) e.preventDefault();
  });

  // busca da lista de funcionários (igual ao painel)
  function atualizarPessoas() {
    const el = $('#lista');
    if (el && estado.cfg) el.innerHTML = criarTelas(estado.cfg, veValores(), opcoesTelas()).listaPessoas(estado.pessoas);
  }
  document.addEventListener('input', (e) => {
    if (e.target.id === 'busca') { estado.pessoas.busca = e.target.value; atualizarPessoas(); }
    const form = e.target.closest('.form-produtividade');
    if (form && e.target.type === 'number') produtividade.atualizarJustificativas(form, estado.cfg);
  });

  // filtros das listas do pós-obra: cada mudança vira a query da rota
  const aplicarFiltros = (form) => {
    const { tela, sub, arg } = rotaAtual();
    const q = new URLSearchParams();
    new FormData(form).forEach((v, k) => { if (v) q.set(k, v); });
    const caminho = [tela, sub, arg && encodeURIComponent(arg)].filter(Boolean).join('/');
    const foco = document.activeElement?.name;
    const pos = document.activeElement?.selectionStart;
    history.replaceState(null, '', `#/${caminho}${q.toString() ? `?${q}` : ''}`);
    desenhar();
    if (foco) {
      const el = document.querySelector(`[data-filtros] [name="${foco}"]`);
      el?.focus();
      if (pos != null && el?.setSelectionRange) el.setSelectionRange(pos, pos);
    }
  };
  // Pedir alteração: abrir/fechar o painel e enviar
  document.addEventListener('click', async (e) => {
    const d = e.target.closest('[data-pedido-decidir]');
    if (d) {
      const [id, status] = d.dataset.pedidoDecidir.split('|');
      try {
        await pedidos.decidir(id, status, nomeDoPedido());
        estado.pedido.msg = status === 'aberto' ? 'Pedido aprovado ✓' : 'Pedido recusado';
      } catch (err) { estado.pedido.msg = `Não foi possível: ${err.message}`; }
      estado.pedido.lista = await pedidos.listar();
      desenharPedido();
      return;
    }
    const b = e.target.closest('[data-pedido]');
    if (!b) return;
    estado.pedido.aberto = b.dataset.pedido === 'abrir';
    estado.pedido.msg = '';
    desenharPedido();
    if (estado.pedido.aberto) { const t = document.querySelector('#pd-form textarea'); if (t) t.focus(); atualizarPedidos(); }
  });
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'pd-form') return;
    e.preventDefault();
    const campo = e.target.querySelector('textarea');
    const texto = campo.value.trim();
    if (!texto) return;
    try {
      await pedidos.enviar({ ...telaDoPedido(), texto, pessoa: nomeDoPedido(), funcao: funcaoReal().nome, diretoria: ehDiretoria() });
      estado.pedido.msg = ehDiretoria() ? 'Pedido enviado ✓' : 'Enviado para a aprovação da diretoria ✓';
      campo.value = '';
    } catch (err) {
      estado.pedido.msg = `Não foi possível enviar: ${err.message}`;
    }
    estado.pedido.lista = await pedidos.listar();
    desenharPedido();
  });

  // Estoque: categoria (abas) + procurar item, sem redesenhar a tela (só esconde o que não bate)
  const filtrarEstoque = () => {
    const q = (($('#busca-estoque') || {}).value || '').trim().toLowerCase();
    const cat = (document.querySelector('.est-cats a.on') || { dataset: {} }).dataset.estCat || '';
    document.querySelectorAll('.est-grupo').forEach((g) => {
      let algum = false;
      const naCat = !cat || cat === 'OBRIG' || g.dataset.cat === cat;
      g.querySelectorAll('[data-texto]').forEach((tr) => {
        const ok = naCat && (cat !== 'OBRIG' || tr.dataset.obrig === '1') && (!q || tr.dataset.texto.includes(q));
        tr.hidden = !ok; algum = algum || ok;
      });
      g.hidden = !algum;
    });
  };
  document.addEventListener('input', (e) => { if (e.target.id === 'busca-estoque') filtrarEstoque(); });
  // Acessos (diretoria, na nuvem): liberar a pessoa, mudar função/obras, bloquear
  // criar login (senha provisória gerada aqui e mostrada uma vez) e redefinir senha
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('#ac-novo'); if (!f) return;
    e.preventDefault();
    const fd = new FormData(f);
    const usuario = String(fd.get('usuario') || '').trim().toLowerCase(); const nome = String(fd.get('nome') || '').trim();
    const funcao = fd.get('funcao'); const obras = fd.getAll('obras');
    if (!nome || !usuario || !funcao) { alert('Preencha nome, usuário e função.'); return; }
    if (funcaoPorId(funcao).porObra && !obras.length) { alert('Escolha pelo menos uma obra para esta função.'); return; }
    const senha = nuvem.senhaProvisoria();
    try { await nuvem.criarLogin({ usuario, nome, funcao, obras, senha }); estado.acessosAviso = { titulo: `Login criado para ${nome}`, usuario, senha }; desenhar(); }
    catch (err) { alert(`Não foi possível criar (${err.message || err}).`); }
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-redefinir-senha]'); if (!b) return;
    const [id, nome] = b.dataset.redefinirSenha.split('|');
    if (!confirm(`Gerar uma senha provisória nova para ${nome}? A senha atual deixa de funcionar.`)) return;
    const senha = nuvem.senhaProvisoria();
    try {
      await nuvem.redefinirSenha(id, senha);
      const usuario = b.closest('.ac-linha').querySelector('.ac-quem .pequeno b').textContent;
      estado.acessosAviso = { titulo: `Senha nova de ${nome}`, usuario, senha }; desenhar();
    } catch (err) { alert(`Não foi possível (${err.message || err}).`); }
  });
  // caixinhas de obras: "todas" / "nenhuma"
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-obras-todas]'); if (!t) return;
    t.closest('.ac-chips').querySelectorAll('input[name="obras"]').forEach((c) => { c.checked = t.dataset.obrasTodas === '1'; });
  });
  // excluir login (apaga também o que a pessoa marcou no sistema)
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-excluir-login]'); if (!b) return;
    const [id, nome] = b.dataset.excluirLogin.split('|');
    if (!confirm(`Excluir o login de ${nome}?\n\nIsso apaga o acesso e tudo o que a pessoa marcou no sistema (tarefas, publicações). Não dá para desfazer.\nPara só impedir a entrada, use "ativo" desmarcado.`)) return;
    try { await nuvem.excluirLogin(id); estado.acessosMsg = `Login de ${nome} excluído.`; desenhar(); }
    catch (err) { alert(`Não foi possível excluir (${err.message || err}).`); }
  });
  // abas por função: voltar uma linha ao padrão e salvar a tabela
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-abas-padrao]'); if (!b) return;
    const tr = b.closest('tr'); const padrao = (tr.dataset.padrao || '').split(',');
    tr.querySelectorAll('input[type="checkbox"]').forEach((c) => { c.checked = padrao.includes(c.value); });
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('#ac-abas'); if (!f) return;
    e.preventDefault();
    const gravar = {}; const apagar = [];
    for (const fn of FUNCOES.filter((x) => x.id !== 'socio')) {
      const marcadas = [...f.querySelectorAll(`input[name="aba:${fn.id}"]:checked`)].map((c) => c.value);
      const padrao = abasPadrao(fn);
      const igual = marcadas.length === padrao.length && marcadas.every((a) => padrao.includes(a));
      if (igual) apagar.push(fn.id); else gravar[fn.id] = marcadas;
    }
    try { await nuvem.salvarAbas(gravar, apagar); aplicarAbas(await nuvem.carregarAbas()); estado.acessosMsg = 'Abas salvas. Valem na próxima vez que a pessoa abrir ou atualizar o sistema.'; desenhar(); }
    catch (err) { alert(`Não foi possível salvar as abas (${err.message || err}).`); }
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-acesso]'); if (!f) return;
    e.preventDefault();
    const fd = new FormData(f);
    const funcao = fd.get('funcao') || null; const obras = fd.getAll('obras');
    if (!funcao) { alert('Escolha a função da pessoa.'); return; }
    if (funcaoPorId(funcao).porObra && !obras.length) { alert('Escolha pelo menos uma obra para esta função.'); return; }
    try { await nuvem.salvarPerfil(f.dataset.acesso, { funcao, obras }); estado.acessosMsg = 'Salvo.'; desenhar(); }
    catch (err) { alert(`Não foi possível salvar (${err.message || err}).`); }
  });
  // Feed: publicar, comentar, curtir, fixar e apagar
  const quemPublica = () => ({ autor: sessao().nome, funcao: funcaoReal().nome });
  document.addEventListener('submit', async (e) => {
    const fForm = e.target.closest('#fd-form'); const fCom = e.target.closest('[data-feed-comentar]');
    if (!fForm && !fCom) return;
    e.preventDefault();
    const texto = (e.target.texto.value || '').trim(); if (!texto) return;
    try {
      if (fForm) {
        await feed.enviar({ acao: 'publicar', texto, ...quemPublica() });
        if (fForm.fixar && fForm.fixar.checked) { const p = feed.publicacoes().find((x) => x.autor === sessao().nome && x.texto === texto); if (p) await feed.enviar({ acao: 'fixar', post: p.id, valor: true, ...quemPublica() }); }
      } else await feed.enviar({ acao: 'comentar', post: fCom.dataset.feedComentar, texto, ...quemPublica() });
      feed.marcarVisto(); desenhar();
    } catch (err) { estado.feedMsg = `Não foi possível publicar (${err.message || err}).`; desenhar(); }
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-feed]'); if (!b) return;
    const [acao, post, extra] = b.dataset.feed.split('|');
    if (acao === 'apagar' && !confirm(extra ? 'Apagar este comentário?' : 'Apagar esta publicação para todo mundo?')) return;
    try {
      await feed.enviar({ acao, post, valor: extra === '1', texto: acao === 'apagar' ? extra : '', ...quemPublica() });
      desenhar();
    } catch (err) { alert(`Não foi possível (${err.message || err}).`); }
  });  // foto do perfil: a própria pessoa escolhe a imagem (reduzida para 256 px antes de ir para o servidor)
  document.addEventListener('change', async (e) => {
    if (!['pf-foto-input', 'pf-foto-input2'].includes(e.target.id) || !e.target.files || !e.target.files[0]) return;
    const msg = $('#pf-foto-msg'); if (msg) msg.textContent = ' enviando…';
    try { await perfil.enviarFoto(sessao().nome, e.target.files[0]); desenhar(); }
    catch (err) { if (msg) msg.textContent = ` não foi possível salvar a foto (${err.message || err})`; }
  });
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-pf-remover-foto]')) return;
    if (!confirm('Remover a sua foto do perfil?')) return;
    await perfil.removerFoto(sessao().nome); desenhar();
  });  // botões de partes que ainda não funcionam (ex.: pedir itens do estoque)
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-em-breve]');
    if (!b) return;
    const aviso = b.parentElement.querySelector('.aviso-breve') || Object.assign(document.createElement('span'), { className: 'aviso-breve' });
    aviso.textContent = `“${b.textContent.trim()}” está em manutenção — fica para o futuro.`;
    b.parentElement.appendChild(aviso);
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-est-cat]');
    if (!a) return;
    e.preventDefault();
    document.querySelectorAll('.est-cats a').forEach((x) => x.classList.toggle('on', x === a));
    filtrarEstoque();
  });

  let espera;
  document.addEventListener('input', (e) => {
    const form = e.target.closest('[data-filtros]');
    if (!form) return;
    clearTimeout(espera);
    espera = setTimeout(() => aplicarFiltros(form), e.target.type === 'search' ? 250 : 0);
  });

  // dica (tooltip) dos gráficos
  const dica = $('#dica');
  document.addEventListener('pointermove', (e) => {
    const alvo = e.target.closest?.('[data-dica]');
    if (!alvo) { dica.hidden = true; return; }
    dica.textContent = alvo.dataset.dica;
    dica.hidden = false;
    const x = Math.min(e.clientX + 14, window.innerWidth - dica.offsetWidth - 8);
    dica.style.transform = `translate(${x}px, ${e.clientY + 16}px)`;
  });
}

configurar();
if (nuvem.NA_NUVEM) {
  // link de 'esqueci a senha' volta com a sessão de recuperação: pede a senha nova
  await nuvem.carregarPerfil();
}
desenhar();
atualizar();
setInterval(atualizar, ATUALIZAR_A_CADA_MS);

// Quadro da semana › Funções: arrastar, redimensionar e abrir os cartões
// parar a gravação: o áudio vai para o computador do escritório transcrever (Whisper) e o texto volta em "Gravações"
function pararEEnviar(botao) {
  const msg = () => document.querySelector('.at-grav-msg');
  gravador.parar().then(async (r) => {
    const b = botao || document.querySelector('[data-gravar]'); if (b) { b.textContent = '● Gravar a reunião'; b.classList.add('on'); }
    if (r && nuvem.NA_NUVEM) {
      if (msg()) msg().textContent = 'Enviando o áudio para o computador do escritório…';
      try { await nuvem.enviarGravacao(r.blob, r.duracaoS); if (msg()) msg().textContent = 'Áudio enviado. O computador do escritório está transcrevendo (leva uns minutos): o texto aparece aqui embaixo, em Gravações.'; await gravAtualizar(); }
      catch (err) { if (msg()) msg().textContent = `Não consegui enviar o áudio (${err.message || err}). A transcrição ao vivo continua na caixa.`; }
    } else if (msg()) msg().textContent = 'Gravação parada.';
  });
}
let gravs = [];
const fmtGrav = (g) => { const dh = new Date(g.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); const min = g.duracao_s ? `${Math.max(1, Math.round(g.duracao_s / 60))} min` : '';
  const st = g.status === 'pronta' ? `<b>pronta</b> (${String(g.texto || '').split(/\s+/).length} palavras${g.modelo ? `, Whisper ${esc(g.modelo)}` : ''}) <button type="button" class="ac-mini at-ok" data-grav-usar="${g.id}">Usar esta transcrição</button>`
    : g.status === 'erro' ? `<span class="pendente">erro: ${esc(g.erro || '')}</span>` : g.status === 'transcrevendo' ? 'transcrevendo no computador do escritório…' : 'aguardando o computador do escritório';
  return `<li>${dh}${min ? ` · ${min}` : ''} — ${st} <button type="button" class="ac-mini" data-grav-apagar="${g.id}">apagar</button></li>`; };
function desenharGravs() { const el = document.getElementById('grav-lista'); if (el) el.innerHTML = gravs.length ? `<h4>Gravações</h4><ul class="at-gravs">${gravs.map(fmtGrav).join('')}</ul>` : ''; }
async function gravAtualizar() { if (!nuvem.NA_NUVEM || !document.getElementById('grav-lista')) return; try { gravs = await nuvem.listarGravacoes(); } catch { return; } desenharGravs(); }
setInterval(() => { if (document.getElementById('grav-lista') && gravs.some((g) => g.status === 'pendente' || g.status === 'transcrevendo')) gravAtualizar(); }, 20000);
document.addEventListener('click', async (e) => {
  const us = e.target.closest && e.target.closest('[data-grav-usar]');
  if (us) { const g = gravs.find((x) => String(x.id) === us.dataset.gravUsar); const c = document.getElementById('ata-fala'); if (g && c) { c.value = g.texto || ''; gravador.definirTexto(g.texto || ''); const m = document.querySelector('.at-grav-msg'); if (m) m.textContent = 'Transcrição do Whisper colocada na caixa: confira e aperte "Montar a ata com a transcrição".'; c.scrollIntoView({ block: 'center' }); } return; }
  const ap = e.target.closest && e.target.closest('[data-grav-apagar]');
  if (ap) { const g = gravs.find((x) => String(x.id) === ap.dataset.gravApagar); if (g && confirm('Apagar esta gravação (áudio e transcrição)?')) { try { await nuvem.apagarGravacao(g); await gravAtualizar(); } catch (err) { alert(`Não foi possível apagar (${err.message || err}).`); } } }
});
// Pós-obra › Serviços em quadro por fase: arrastar o cartão para a coluna (ou "Mover para…"), "+" para criar, "apagar" nos criados aqui
async function svFazer(fn) { try { await fn(); reconstruirBase(); desenhar(); } catch (err) { alert(`Não foi possível mexer no serviço (${err.message || err}).`); } }
const svPorOs = (os) => ((estado.base && estado.base.servicos) || []).find((s) => s.os === os);
document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('[data-sv-os]'); if (c) { e.dataTransfer.setData('text/plain', `sv:${c.dataset.svOs}`); e.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', (e) => { const col = e.target.closest && e.target.closest('[data-sv-fase]'); if (col) { e.preventDefault(); col.classList.add('sv-sobre'); } });
document.addEventListener('dragleave', (e) => { const col = e.target.closest && e.target.closest('[data-sv-fase]'); if (col) col.classList.remove('sv-sobre'); });
document.addEventListener('drop', (e) => {
  const col = e.target.closest && e.target.closest('[data-sv-fase]'); if (!col) return;
  e.preventDefault(); col.classList.remove('sv-sobre');
  const v = String(e.dataTransfer.getData('text/plain') || ''); if (!v.startsWith('sv:')) return;
  const s = svPorOs(v.slice(3)); if (s && s.situacao !== col.dataset.svFase) svFazer(() => svPos.mudarFase(s, col.dataset.svFase));
});
document.addEventListener('change', (e) => {
  const sel = e.target.closest && e.target.closest('[data-sv-mover]'); if (!sel || !sel.value) return;
  const s = svPorOs(sel.dataset.svMover); if (s) svFazer(() => svPos.mudarFase(s, sel.value));
});
document.addEventListener('click', (e) => {
  const novo = e.target.closest && e.target.closest('[data-sv-novo]');
  if (novo) {
    const antigo = document.getElementById('at-modal'); if (antigo) antigo.remove();
    const m = document.createElement('div'); m.id = 'at-modal'; m.className = 'at-modal';
    m.innerHTML = `<div class="at-modal-caixa">${String(posGeral.formServico(estado.base, novo.dataset.svNovo))}</div>`; document.body.appendChild(m);
    return;
  }
  const ap = e.target.closest && e.target.closest('[data-sv-apagar]');
  if (ap) { if (confirm('Apagar este serviço? (só os criados aqui podem ser apagados)')) svFazer(() => svPos.apagar(ap.dataset.svApagar)); }
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest && e.target.closest('#sv-form'); if (!f) return;
  e.preventDefault(); const fd = new FormData(f);
  svFazer(async () => { await svPos.criar({ obra: String(fd.get('obra') || ''), relato: String(fd.get('relato') || '').trim(), profissionais: String(fd.get('profissionais') || '').trim(), prazo: String(fd.get('prazo') || ''), situacao: f.dataset.fase }); const m = document.getElementById('at-modal'); if (m) m.remove(); });
});
// Pós-obra › Agenda: cartões de funcionários arrastados para a obra e o dia (ou toque no nome e depois no quadrado)
const apFaixa = () => [estado.posAgenda.semana, somarDias(estado.posAgenda.semana, 6)];
async function apFazer(fn) { try { await fn(...apFaixa()); desenhar(); } catch (err) { alert(`Não foi possível mexer na agenda (${err.message || err}).`); } }
document.addEventListener('click', (e) => {
  const sem = e.target.closest && e.target.closest('[data-ap-sem]');
  if (sem) { const v = sem.dataset.apSem; estado.posAgenda.semana = inicioDaSemana(v === 'hoje' ? hojeISO() : v); estado.posAgenda.chave = ''; desenhar(); return; }
  if (e.target.closest && e.target.closest('[data-ap-importar]')) { apFazer((de, ate) => agendaPos.importar(posGeral.daPlanilha(estado.base, estado.posAgenda.semana), de, ate)); return; }
  const del = e.target.closest && e.target.closest('[data-ap-del]');
  if (del) { apFazer((de, ate) => agendaPos.remover(del.dataset.apDel, de, ate)); return; }
  const card = e.target.closest && e.target.closest('[data-ap-pessoa]');
  if (card) { estado.posAgenda.sel = estado.posAgenda.sel === card.dataset.apPessoa ? '' : card.dataset.apPessoa; desenhar(); return; }
  const cel = e.target.closest && e.target.closest('.ap-cel');
  if (cel && estado.posAgenda.sel && !e.target.closest('[data-ap-chip]')) apFazer((de, ate) => agendaPos.atribuir({ data: cel.dataset.apData, obra: cel.dataset.apObra, pessoa: estado.posAgenda.sel }, de, ate));
});
document.addEventListener('dragstart', (e) => {
  const c = e.target.closest && e.target.closest('[data-ap-pessoa]'); const ch = e.target.closest && e.target.closest('[data-ap-chip]');
  if (!c && !ch) return;
  e.dataTransfer.setData('text/plain', c ? `p:${c.dataset.apPessoa}` : `m:${ch.dataset.apChip}`); e.dataTransfer.effectAllowed = 'copyMove';
});
document.addEventListener('dragover', (e) => { const cel = e.target.closest && e.target.closest('.ap-cel'); if (cel) { e.preventDefault(); cel.classList.add('ap-sobre'); } });
document.addEventListener('dragleave', (e) => { const cel = e.target.closest && e.target.closest('.ap-cel'); if (cel) cel.classList.remove('ap-sobre'); });
document.addEventListener('drop', (e) => {
  const cel = e.target.closest && e.target.closest('.ap-cel'); if (!cel) return;
  e.preventDefault(); cel.classList.remove('ap-sobre');
  const [tipo, ...resto] = String(e.dataTransfer.getData('text/plain') || '').split(':'); const valor = resto.join(':'); if (!valor) return;
  const alvo = { data: cel.dataset.apData, obra: cel.dataset.apObra };
  if (tipo === 'p') apFazer((de, ate) => agendaPos.atribuir({ ...alvo, pessoa: valor }, de, ate));
  else if (tipo === 'm') apFazer((de, ate) => agendaPos.mover(valor, alvo, de, ate));
});

meudia.instalarQuadro(() => desenhar());
ordenar.instalar();

// Reposição › rota: dia e horário de saída (a rota em texto se refaz)
document.addEventListener('change', (e) => {
  const r = e.target.closest && e.target.closest('[data-rota]');
  if (!r) return;
  reposicao.ajustarRota(r.dataset.rota, r.value);
  desenhar();
});

// Atas e pendências: filtros, nova ata, concluir/reabrir/excluir pendência
document.addEventListener('change', (e) => {
  const f = e.target.closest && e.target.closest('[data-atas-filtro]');
  if (f) trocarQuery({ [f.dataset.atasFiltro]: f.value || null, ...(f.dataset.atasFiltro === 'pessoa' ? { terc: null } : {}) });   // trocar o responsável limpa o terceirizado escolhido
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches && e.target.matches('input[data-atas-filtro]')) { e.preventDefault(); trocarQuery({ [e.target.dataset.atasFiltro]: e.target.value || null }); }
});
// reprogramar o prazo de uma pendência: clicar na data abre o mini calendário com feriados (guarda o prazo original; vira "reprogramada")
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-cal-prazo]'); if (!b) return;
  const id = b.dataset.calPrazo; const p = atas.pendenciaPorId(id);
  abrirCalendario({ ancora: b, valor: p ? p.prazo : '', aoEscolher: async (novo) => {
    try { await atas.reprogramar(id, novo); desenhar(); } catch (err) { alert(`Não foi possível mudar o prazo (${err.message || err}).`); }
  } });
});
// nova pendência avulsa (sem ata), aberta pelo + de cada caixinha do quadro por prazo
document.addEventListener('click', (e) => {
  const nova = e.target.closest && e.target.closest('[data-av-nova]');
  if (nova) {
    const antigo = document.getElementById('at-modal'); if (antigo) antigo.remove();
    const m = document.createElement('div'); m.id = 'at-modal'; m.className = 'at-modal';
    m.innerHTML = `<div class="at-modal-caixa">${String(atas.formAvulsa(obrasDeAtas(), nova.dataset.avNova, nova.dataset.avSetor || ''))}</div>`;
    document.body.appendChild(m); const campo = m.querySelector('[name="p_assunto"]'); if (campo) campo.focus();
    return;
  }
  if ((e.target.closest && e.target.closest('[data-av-fechar]')) || (e.target.id === 'at-modal')) { const m = document.getElementById('at-modal'); if (m) m.remove(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const m = document.getElementById('at-modal'); if (m) m.remove(); } });
// pauta da próxima reunião: o que ficou aberto da ata (e das anteriores do mesmo lugar), pronto para copiar
document.addEventListener('click', async (e) => {
  const pb = e.target.closest && e.target.closest('[data-pauta]');
  if (pb) {
    const a = atas.ataPorId(pb.dataset.pauta); if (!a) return;
    const texto = atas.pautaTexto(a);
    const antigo = document.getElementById('at-modal'); if (antigo) antigo.remove();
    const m = document.createElement('div'); m.id = 'at-modal'; m.className = 'at-modal';
    m.innerHTML = `<div class="at-modal-caixa"><h3 style="margin:0 0 4px">Pauta da próxima reunião</h3><p class="pequeno" style="margin:0 0 10px">Montada com as pendências que ainda estão abertas. Copie e cole onde for usar.</p><pre class="at-pauta" id="at-pauta-texto"></pre><div class="at-av-botoes"><button type="button" class="botao" data-av-fechar>Fechar</button><button type="button" class="botao on" data-pauta-copiar>Copiar a pauta</button></div></div>`;
    document.body.appendChild(m); m.querySelector('#at-pauta-texto').textContent = texto;
    return;
  }
  if (e.target.closest && e.target.closest('[data-pauta-copiar]')) {
    const t = (document.getElementById('at-pauta-texto') || {}).textContent || '';
    try { await navigator.clipboard.writeText(t); e.target.textContent = 'Copiada ✓'; } catch { const r = document.createRange(); r.selectNodeContents(document.getElementById('at-pauta-texto')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); e.target.textContent = 'Selecionada: Ctrl+C'; }
  }
});
document.addEventListener('click', async (e) => {
  const add = e.target.closest('[data-pf-add]');
  if (add) { document.getElementById('pend-linhas').insertAdjacentHTML('beforeend', atas.linhaForm()); return; }
  const del = e.target.closest('[data-pf-del]');
  if (del) { const l = del.closest('.pf-linha'); const box = l.parentElement; if (box.id === 'pend-linhas' && box.children.length === 1) { l.querySelectorAll('input,select').forEach((c) => { c.value = ''; }); } else if (box.id === 'pend-linhas') l.remove(); return; }
  const st = e.target.closest('[data-pend]');
  if (st) { const [id, status] = st.dataset.pend.split('|'); try { await atas.mudarStatus(id, status); desenhar(); } catch (err) { alert(`Não foi possível (${err.message || err}). Só quem é o responsável, quem criou ou a diretoria pode mudar.`); } return; }
  const pd = e.target.closest('[data-pend-del]');
  if (pd) {
    const dePendencia = atas.pendenciaPorId(pd.dataset.pendDel);
    const daAta = dePendencia && dePendencia.ata_id;
    if (!confirm(daAta ? 'Tirar esta pendência da sua lista de pendências? O item continua na ata, que não muda.' : 'Excluir esta pendência?')) return;
    try { await atas.apagarPendencia(pd.dataset.pendDel); desenhar(); } catch (err) { alert(`Não foi possível ${daAta ? 'tirar da lista' : 'excluir'} (${err.message || err}).`); }
    return;
  }
  const volta = e.target.closest('[data-pend-lista]');
  if (volta) { try { await atas.mudarNaLista(volta.dataset.pendLista, true); desenhar(); } catch (err) { alert(`Não foi possível (${err.message || err}).`); } return; }
  const ad = e.target.closest('[data-ata-del]');
  if (ad) { if (!confirm('Excluir esta ata e todas as pendências dela? Não dá para desfazer.')) return; try { await atas.apagarAta(ad.dataset.ataDel); estado.atasMsg = 'Ata excluída.'; estado.atasMsgHash = '#/atas?aba=atas'; location.hash = estado.atasMsgHash; desenhar(); } catch (err) { alert(`Não foi possível excluir (${err.message || err}).`); } }
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('#ata-form'); const g = e.target.closest('#pend-form');
  if (!f && !g) return;
  e.preventDefault();
  try {
    if (f) {
      const fd = new FormData(f);
      const obraA = String(fd.get('obra') || '') === '-' ? '' : String(fd.get('obra') || ''); const setorA = String(fd.get('setor') || '');
      if (!setorA) { alert('Escolha o departamento da ata.'); f.setor.focus(); return; }
      const itens = [...f.querySelectorAll('.pf-linha')].map((l) => lerLinhaPendencia(l)).filter((p) => p.descricao);
      if (itens.some((p) => p.semAssunto || p.semDescritivo)) { alert('Cada item precisa do assunto e do descritivo (as duas caixinhas).'); return; }
      itens.forEach((p, i) => { p.item = i + 1; });
      const informativos = itens.filter((p) => p.kind === 'informativo');
      if (informativos.some((p) => (p.externoTipo === '' && !p.responsavel) || (p.externoTipo === 'terceirizado' && !p.externoCategoria && !p.externoNome))) { alert('Todo informativo precisa de quem informou: escolha a pessoa da Sólida, o terceirizado ou o cliente.'); return; }
      const pendencias = itens.filter((p) => p.kind !== 'informativo');
      if (pendencias.some((p) => !p.prazo)) {
        const l = [...f.querySelectorAll('.pf-linha')].find((x) => { const q = lerLinhaPendencia(x); return q.kind !== 'informativo' && q.descricao && !q.prazo; });
        const campo = l && l.querySelector('[name="p_prazo"]'); if (campo) { campo.focus(); campo.style.outline = '2px solid #c0392b'; }
        alert('Toda pendência precisa de uma data limite. Preencha o prazo das linhas marcadas para salvar a ata.'); return;
      }
      if (pendencias.some((p) => p.externoTipo === '' && !p.responsavel)) { alert('Toda pendência precisa de um responsável: escolha a pessoa da Sólida.'); return; }
      if (pendencias.some((p) => p.externoTipo === 'terceirizado' && !p.externoCategoria && !p.externoNome)) { alert('Pendência de terceirizado: escreva o nome da empresa ou pessoa.'); return; }
      const nome = atas.atualizarNomeDoForm(f); if (!nome) { alert('Escolha a data: o nome da ata sai dela.'); return; }
      if (f.dataset.revisar) {
        const idRev = f.dataset.revisar;
        await atas.revisar(idRev, { data: fd.get('data'), tipoReuniao: fd.get('tipo_reuniao'), obra: obraA, setor: setorA, local: String(fd.get('local') || '').trim(), participantes: String(fd.get('participantes') || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean), resumo: String(fd.get('resumo') || ''), pendencias, informativos });
        estado.atasMsg = `Revisão salva: ${nome}. O PDF novo vai para o Drive em instantes.`;
        estado.atasMsgHash = `#/atas?aba=atas&ata=${idRev}`; location.hash = estado.atasMsgHash; desenhar();
        return;
      }
      const nova = await atas.criarAta({ titulo: nome, tipoReuniao: fd.get('tipo_reuniao'), revisao: fd.get('revisao'), local: String(fd.get('local') || '').trim(), data: fd.get('data'), tipo: obraA ? 'obra' : 'departamento', obra: obraA, setor: setorA, participantes: String(fd.get('participantes') || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean), resumo: String(fd.get('resumo') || ''), pendencias, informativos });
      estado.atasMsg = `Ata salva${pendencias.length ? ` com ${pendencias.length} ${pendencias.length === 1 ? 'pendência' : 'pendências'}` : ''}${informativos.length ? `${pendencias.length ? ' e' : ' com'} ${informativos.length} ${informativos.length === 1 ? 'informativo' : 'informativos'}` : ''}.`;
      estado.atasMsgHash = `#/atas?aba=atas&ata=${nova.id}`; location.hash = estado.atasMsgHash;
    } else {
      const p = lerLinhaPendencia(g.querySelector('.pf-linha'));
      if (p.semAssunto || p.semDescritivo) { alert('A pendência precisa do assunto e do descritivo (as duas caixinhas).'); return; }
      if (p.descricao && !p.prazo) { alert('Toda pendência precisa de uma data limite.'); return; }
      if (!p.descricao || (p.externoTipo === '' && !p.responsavel) || (p.externoTipo === 'terceirizado' && !p.externoCategoria && !p.externoNome)) { alert('Escreva a pendência e escolha o responsável.'); return; }
      if (g.dataset.avulsa) {
        const setorV = String(new FormData(g).get('av_setor') || ''); if (!setorV) { alert('Escolha o departamento da pendência.'); return; }
        await atas.criarPendencia({ ata_id: null, ...p, obra: String(new FormData(g).get('av_obra') || ''), setor: setorV });
        const mod = document.getElementById('at-modal'); if (mod) mod.remove();
      } else await atas.criarPendencia({ ata_id: Number(g.dataset.ata), ...p, obra: g.dataset.obra, setor: g.dataset.setor });
    }
    desenhar();
  } catch (err) { alert(`Não foi possível salvar (${err.message || err}).`); }
});

// Atas: importar um PDF ou texto e montar o rascunho com as pendências
async function importarAta(dados) {
  const msg = document.querySelector('.at-imp-msg'); if (msg) msg.textContent = 'Lendo a ata…';
  try { await atas.importar(dados, obrasDeAtas()); desenhar(); }
  catch (err) { if (msg) msg.textContent = ''; alert(err.message || String(err)); }
}
document.addEventListener('change', (e) => {
  if (e.target && e.target.id === 'ata-arquivo' && e.target.files && e.target.files[0]) importarAta({ arquivo: e.target.files[0] });
});
document.addEventListener('click', (e) => {
  if (e.target.closest && e.target.closest('[data-ata-ler]')) { importarAta({ texto: (document.getElementById('ata-colada') || {}).value || '' }); return; }
  // gravar a reunião: transcreve ao vivo para a caixa "Transcrição"; "Montar a ata" separa informativos e pendências
  const gb = e.target.closest && e.target.closest('[data-gravar]');
  if (gb) {
    const msg = document.querySelector('.at-grav-msg'); const caixa = document.getElementById('ata-fala');
    if (gravador.gravando()) { pararEEnviar(gb); return; }
    if (caixa && caixa.value.trim()) gravador.definirTexto(caixa.value);   // continua do que já está escrito
    const estados = { gravando: '● Gravando… fale normalmente', negado: 'O navegador não deixou usar o microfone: libere o microfone no cadeado da barra de endereço e tente de novo.', parado: 'Gravação parada.' };
    try {
      gravador.iniciar({
        aoTexto: (t) => { const c = document.getElementById('ata-fala'); if (c) { c.value = t; c.scrollTop = c.scrollHeight; } },
        aoEstado: (s) => { const mm = document.querySelector('.at-grav-msg'); const b = document.querySelector('[data-gravar]'); if (mm) mm.textContent = estados[s] || (s.startsWith('erro') ? `Problema no reconhecimento de voz (${s.slice(5)}).` : s); if (b) { const g = s === 'gravando' || s === 'religando'; b.textContent = g ? '■ Parar a gravação' : '● Gravar a reunião'; b.classList.toggle('on', !g); } },
      });
      gb.textContent = '■ Parar a gravação'; gb.classList.remove('on');
    } catch (err) { if (msg) msg.textContent = err.message || String(err); }
    return;
  }
  if (e.target.closest && e.target.closest('[data-ata-ler-fala]')) { if (gravador.gravando()) pararEEnviar(null); importarAta({ texto: (document.getElementById('ata-fala') || {}).value || '', fala: true }); return; }
  if (e.target.closest && e.target.closest('[data-ata-descartar]')) { if (confirm('Descartar a ata lida e começar do zero?')) { atas.descartarRascunho(); desenhar(); } }
});

// uma linha de pendência do formulário (responsável da Sólida ou "Outro": cliente, arquitetura, terceirizado…)
function lerLinhaPendencia(l) {
  const tipo = l.querySelector('[name="p_tipo"]').value;
  return {
    kind: (l.querySelector('[name="p_kind"]') || {}).value || 'pendencia',
    pid: l.dataset.pid || '',
    descricao: [l.querySelector('[name="p_assunto"]').value.trim().replace(/,/g, ' /').toLocaleUpperCase('pt-BR'), l.querySelector('[name="p_desc"]').value.trim()].filter(Boolean).join(', '),
    semAssunto: !!l.querySelector('[name="p_desc"]').value.trim() && !l.querySelector('[name="p_assunto"]').value.trim(),
    semDescritivo: !!l.querySelector('[name="p_assunto"]').value.trim() && !l.querySelector('[name="p_desc"]').value.trim(),
    responsavel: tipo === 'solida' ? l.querySelector('[name="p_resp"]').value : '',
    externoTipo: tipo === 'solida' ? '' : tipo,
    externoCategoria: '',
    externoNome: tipo === 'solida' ? '' : l.querySelector('[name="p_nome"]').value.trim(),
    prazo: l.querySelector('[name="p_prazo"]').value,
  };
}
// trocar Sólida / Terceirizado / Cliente mostra os campos certos da mesma linha
document.addEventListener('change', (e) => {
  const kind = e.target.closest && e.target.closest('[data-pf-kind]');
  if (kind) { const l = kind.closest('.pf-linha'); l.dataset.kind = kind.value; l.querySelector('[name="p_desc"]').placeholder = kind.value === 'informativo' ? 'Informação (ex.: Fachada liberada)' : 'O que fazer (ex.: Retirar da área gourmet)'; return; }
  const sel = e.target.closest && e.target.closest('[data-pf-tipo]');
  if (!sel) return;
  const l = sel.closest('.pf-linha'); const tipo = sel.value; l.dataset.tipo = tipo;
  l.querySelector('.pf-sol').hidden = tipo !== 'solida';
  const nome = l.querySelector('.pf-ext'); nome.hidden = tipo === 'solida';
  nome.placeholder = tipo === 'cliente' ? 'Nome do cliente' : tipo === 'arquitetura' ? 'Nome da arquitetura ou arquiteto' : 'Nome da empresa ou pessoa';
});

// círculo vermelho em tudo que ainda falta para conseguir salvar (formulário da ata e "acrescentar pendência")
function marcarFaltas(f) {
  if (!f) return;
  const marca = (el, falta) => { if (el) el.classList.toggle('falta', !!falta); };
  const vazio = (el) => !el || !String(el.value || '').trim();
  if (f.id === 'ata-form') for (const n of ['data', 'obra', 'setor', 'local', 'participantes']) marca(f.elements[n], vazio(f.elements[n]));
  const unica = f.id === 'pend-form';
  if (f.dataset.avulsa) marca(f.elements.av_setor, vazio(f.elements.av_setor));
  for (const l of f.querySelectorAll('.pf-linha')) {
    const q = (s) => l.querySelector(s); const v = (s) => (q(s) ? String(q(s).value || '').trim() : '');
    const tipo = v('[name="p_tipo"]'); const info = v('[name="p_kind"]') === 'informativo';
    const ativa = unica || ['[name="p_assunto"]', '[name="p_desc"]', '[name="p_prazo"]', '[name="p_resp"]', '[name="p_nome"]'].some((s) => v(s));
    marca(q('[name="p_assunto"]'), ativa && !v('[name="p_assunto"]'));
    marca(q('[name="p_desc"]'), ativa && !v('[name="p_desc"]'));
    marca(q('[name="p_prazo"]'), ativa && !info && !v('[name="p_prazo"]'));
    marca(q('[name="p_resp"]'), ativa && tipo === 'solida' && !v('[name="p_resp"]'));
    const semTerc = ativa && tipo === 'terceirizado' && !v('[name="p_nome"]');
    marca(q('[name="p_nome"]'), semTerc);
    if (tipo !== 'terceirizado') marca(q('[name="p_nome"]'), false);
  }
}
const marcarTudo = () => { marcarFaltas(document.getElementById('ata-form')); marcarFaltas(document.getElementById('pend-form')); };
['input', 'change', 'click'].forEach((ev) => document.addEventListener(ev, (e) => { if (e.target.closest && e.target.closest('#ata-form, #pend-form')) setTimeout(marcarTudo, 0); }));
new MutationObserver(() => marcarTudo()).observe(document.body, { childList: true, subtree: true });

// nome padrão da ata: atualiza ao mexer na obra/departamento, data, tipo ou revisão
document.addEventListener('change', (e) => {
  const f = e.target.closest && e.target.closest('#ata-form');
  if (f && ['obra', 'setor', 'data', 'tipo_reuniao', 'revisao'].includes(e.target.name)) atas.atualizarNomeDoForm(f);
});
document.addEventListener('input', (e) => {
  if (e.target && e.target.name === 'revisao' && e.target.closest && e.target.closest('#ata-form')) { e.target.dataset.manual = '1'; atas.atualizarNomeDoForm(e.target.form); }
});
