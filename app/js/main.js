// Sistema Sólida — mostra o mesmo que o Painel da Empresa (dados.json do Drive, preenchido pelos agentes),
// mais: perfis por função, "Meu dia" (quadro de funções), Operação › Metas e produtividade,
// e no Pós-obra os detalhes da planilha integrada (dados/json).

import { carregarDados, carregarPainel, carregarProdutividade, carregarDrive, carregarFerramentasChk } from './dados.js';
import * as ferrChk from './telas/ferramentas-checklist.js';
import { montarBase } from './regras.js';
import { periodo, hojeISO, ehData } from './datas.js';
import { html, esc, descreverPeriodo } from './formato.js';
import { definirPerfil } from './componentes.js';
import { normalizar, criarTelas, pt } from './painel-empresa.js';
import { sessao, funcaoAtual, veValores, entrar, sair, logado, idPessoa, podeVerArea, obrasDaPessoa,
  podeVerComo, simulando, verComo, funcaoReal } from './sessao.js';
import { FUNCOES, funcaoPorId, veBlocoGeral, INDICADORES_SO_GESTAO } from './funcoes.js';
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
import * as financeiro from './telas/financeiro.js';
import * as meudia from './telas/meudia.js';
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
const SUB = [
  { id: '', nome: 'Resumo' },
  { id: 'painel', nome: 'Painel da planilha', mod: painel },
  { id: 'obras', nome: 'Obras', mod: obras },
  { id: 'servicos', nome: 'Serviços', mod: servicos },
  { id: 'agenda', nome: 'Agenda', mod: agenda },
  { id: 'equipe', nome: 'Equipe e PJ', mod: equipe },
  { id: 'financeiro', nome: 'Financeiro', mod: financeiro, restrita: true },
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
  const subs = SUB.filter((s) => veValores() || !s.restrita);
  const ehObra = rota.sub === 'obra';
  const sub = subs.find((s) => s.id === rota.sub) || subs[1];
  const ativa = ehObra ? 'obras' : sub.id;
  const abas = subnav(subs.map((s) => ({ ...s, href: `#/posobra${s.id ? `/${s.id}` : ''}` })), rota.sub ? ativa : '');
  if (!rota.sub) return { abas, conteudo: '' };

  if (!estado.base) {
    return { abas, conteudo: `<div class="erro" style="margin-top:26px">${esc(estado.erroBase || 'Carregando a planilha do pós-obra…')}</div>` };
  }
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

// ---------------------------------------------------------------- desenho

// de onde vêm os dados do pós-obra: os arquivos mais novos da pasta PÓS OBRA do Drive
function fonteDoPosObra() {
  const f = estado.base && estado.base.fonte;
  if (!f) return 'Dados do pós-obra lidos da planilha integrada (cópia de 13/10).';
  const nome = (x) => String(x || '').replace(/.xlsx$/i, '');
  return `Lido do Drive: ${[f.operacional, f.cobranca, f.agenda].filter(Boolean).map(nome).join(' · ')}${f.lidoEm ? ` (leitura de ${new Date(f.lidoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})` : ''}. Quando a equipe salva uma revisão nova, o sistema passa a ler a nova.`;
}

function desenharNav(sel) {
  const CFG = estado.cfg;
  const f = funcaoAtual();
  // Feed com a bolinha de publicações novas
  const itemFeed = () => { const n = sel === 'feed' ? 0 : feed.novas(s.nome); return `<a class="nav-item${sel === 'feed' ? ' sel' : ''}" href="#/feed"><span>Feed</span>${n ? `<span class="nav-n">${n}</span>` : ''}</a>`; };
  const item =(id, nome, status) => `<a class="nav-item${id === sel ? ' sel' : ''}" href="#/${esc(id)}"${id === sel ? ' aria-current="page"' : ''}><span>${esc(nome)}</span>${status ? pt(status) : ''}</a>`;
  const s = sessao();
  // perfil (primeira coisa do menu): bonequinho + nome; clicando abre a pontuação e as sugestões
  $('#nav').innerHTML = `<div class="marca"><img src="img/logo.png" alt="Sólida"><span>Painel da empresa</span></div>`
    + `<a class="nav-perfil${sel === 'perfil' ? ' sel' : ''}" href="#/perfil" title="Meu perfil">${perfil.avatar(s.nome, 38)}<span><b>${esc(s.nome)}</b><small>${esc(f.nome)}</small></span></a>`
    + item('geral', 'Visão geral') + itemFeed() + (f.semMinhaSemana ? '' : item('meudia', 'Minha semana')) + (f.veQuadro ? item('quadro', 'Quadro de funções') : '')
    + '<div class="nav-sep"></div>'
    + (CFG ? CFG.areas.filter(podeVerArea).map((a) => item(a.id, a.nome, a.status)).join('') : '')
    + item('estoque', 'Estoque')   // todo mundo vê
    + '<div class="nav-sep"></div>'   // equipe: escritório virtual, treinamentos (e o que vier depois)
    + item('escritorio', 'Escritório virtual')
    + item('treinamentos', 'Treinamentos')
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
  if (tela === 'quadro' && !f.veQuadro) tela = 'meudia';
  if (tela === 'meudia' && f.semMinhaSemana) tela = 'geral';

  let area = CFG && CFG.areas.find((a) => a.id === tela);
  if (area && !podeVerArea(area)) { area = null; tela = 'geral'; }   // setor fora do perfil: nem existe
  const ehObraPlan = tela === 'planejamento' && rota.sub === 'obra';
  const fixas = ['agentes', 'meudia', 'quadro', 'estoque', 'escritorio', 'perfil', 'feed', 'treinamentos', 'acessos'];
  const sel = tela === 'funcionarios' ? 'rh' : (area || fixas.includes(tela)) ? tela : 'geral';
  desenharNav(sel);
  desenharPerfil();
  desenharVerComo();
  if (tela !== 'escritorio') escritorio.parar();   // saiu do escritório virtual: para a animação e a presença

  const d = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#data').textContent = d.charAt(0).toUpperCase() + d.slice(1);
  const titulo = ehObraPlan ? rota.arg
    : area ? area.nome
    : ({ agentes: 'Agentes', funcionarios: 'Funcionários por obra', meudia: 'Minha semana', quadro: 'Quadro de funções', estoque: 'Estoque', escritorio: 'Escritório virtual', perfil: 'Perfil', feed: 'Feed', treinamentos: 'Treinamentos', acessos: 'Acessos' }[tela] || 'Visão geral');
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
    nuvem.listarPerfis().then((ps) => { if (rotaAtual().tela === 'acessos') $('#conteudo').innerHTML = `<div>${acessos.render({ perfis: ps, obras: obrasDisponiveis(), msg: estado.acessosMsg || '', aviso: estado.acessosAviso })}</div>`; estado.acessosMsg = ''; estado.acessosAviso = null; });
    return;
  }
  if (tela === 'treinamentos') { $('#conteudo').innerHTML = `<div>${treinamentos.render()}</div>`; return; }
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
  if (tela === 'meudia') {
    $('#conteudo').innerHTML = `<div>${meudia.render({ dia: estado.dia, CFG, pendAberta: estado.pendAberta, aba: rota.sub, params: rota.params, semanaRef: estado.semanaRef })}</div>`;
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
        const depois = `${produtividade.alertasMetas(CFG, visiveis)}${tabela}<div style="margin-top:34px">${ob.cards}</div>`;
        // obra aberta: só ela (com o link para voltar)
        if (ob.aberta) out = `<div>${ob.painel}</div>`;
        else out = deObra ? `<div>${depois}</div>` : T.telaArea(area, '', { semEstado: true, semAlertas: true, depoisIndicadores: depois });
      }
    }
    else if (area && area.id === 'transporte') {
      // Transporte: indicadores → planilha de ferramentas obrigatórias por obra (enviada toda quarta no grupo)
      out = T.telaArea(area, '', { depoisIndicadores: ferrChk.cartoes(CFG, estado.ferrChk, deObra ? obrasDaPessoa() : null) });
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
      const { abas, conteudo } = telaPosObraPlanilha(rota);
      out = rota.sub ? `<div>${abas}${conteudo}</div>` : T.telaArea(area, `<div style="margin-bottom:34px">${abas}</div>`);
    } else if (area) out = T.telaArea(area);
    else out = T.telaGeral();
  } catch (e) {
    console.error(e);
    out = `<div class="erro">Erro ao montar esta tela: ${esc(e.message)}</div>`;
  }
  $('#conteudo').innerHTML = out;
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
  const [painelR, baseR, prodR, driveR, , , , , ferrR] = await Promise.allSettled([carregarPainel(), carregarDados(), carregarProdutividade(), carregarDrive(), sincronizarTarefas(atual), perfil.carregarFotos(), feed.carregar(), evidencias.carregar(), carregarFerramentasChk()]);
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
    estado.base = montarBase(baseR.value, hojeISO());
    estado.erroBase = null;
  } else {
    estado.erroBase = `Não foi possível ler a planilha do pós-obra: ${baseR.reason.message}`;
  }
  if (!estado.cfg && !['meudia', 'quadro'].includes(rotaAtual().tela)) {
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
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-acesso]'); if (!f) return;
    e.preventDefault();
    const fd = new FormData(f);
    const funcao = fd.get('funcao') || null; const obras = fd.getAll('obras');
    if (!funcao) { alert('Escolha a função da pessoa.'); return; }
    if (funcaoPorId(funcao).porObra && !obras.length) { alert('Escolha pelo menos uma obra para esta função.'); return; }
    try { await nuvem.salvarPerfil(f.dataset.acesso, { funcao, obras, ativo: !!fd.get('ativo') }); estado.acessosMsg = 'Salvo.'; desenhar(); }
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
meudia.instalarQuadro(() => desenhar());
