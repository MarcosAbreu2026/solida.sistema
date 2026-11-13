// Sistema Sólida — mostra o mesmo que o Painel da Empresa (dados.json do Drive, preenchido pelos agentes),
// mais: perfis por função, "Meu dia" (quadro de funções), Operação › Metas e produtividade,
// e no Pós-obra os detalhes da planilha integrada (dados/json).

import { carregarDados, carregarPainel, carregarProdutividade, carregarDrive, carregarFerramentasChk, carregarTerceirizados, carregarEfetivo, carregarMedicoesMC, carregarRotas, carregarEquipeProg } from './dados.js';
import * as terceiros from './telas/terceirizados.js';
import * as ferrChk from './telas/ferramentas-checklist.js';
import * as efetivoTela from './telas/efetivo.js';
import { mudarSemana as mudarSemanaEP } from './equipe-prog.js';
import * as equipeRank from './telas/equipe-ranking.js';
import * as orcamentosTela from './telas/orcamentos.js';
import * as reposicao from './telas/reposicao.js';
import * as rotasTela from './telas/rotas.js';
import * as ordenar from './ordenar.js';
import * as atas from './telas/atas.js';
import { montarBase } from './regras.js';
import { periodo, hojeISO, ehData, somarDias, inicioDaSemana } from './datas.js';
import { html, esc, descreverPeriodo } from './formato.js';
import { definirPerfil } from './componentes.js';
import { normalizar, criarTelas, pt } from './painel-empresa.js';
import { sessao, funcaoAtual, veValores, podeMudarSituacaoObra, entrar, sair, logado, idPessoa, podeVerArea, obrasDaPessoa,
  podeVerComo, simulando, verComo, funcaoReal } from './sessao.js';
import { SETORES_ORGANOGRAMA, aplicarSetores, FUNCOES, funcaoPorId, veBlocoGeral, INDICADORES_SO_GESTAO, paginaVisivel, aplicarAbas, abasPadrao, soMinhasFuncoes, temEstoqueRestrito } from './funcoes.js';
import * as marketing from './telas/marketing.js';
import * as login from './telas/login.js';
import { marcarCheck, gravarLancamento, apagarLancamento, gravarManual, vincularDia, sincronizarTarefas, lerPessoasTarefas, sincronizarHorarios } from './armazenamento.js';
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
import * as osq from './os-quadro.js';
import * as configTela from './telas/configuracoes.js';
import * as obrasOrc from './telas/obras-orcamento.js';
import * as posControle from './telas/posobra-controle.js';
import { carregarConfig, definirConfig, restaurarConfig, snapshotConfig, listaConfig } from './config.js';
import * as tvSlides from './treinamentos-slides.js';
import * as obrasPos from './obras-pos.js';
import * as financeiro from './telas/financeiro.js';
import * as meudia from './telas/meudia.js';
import { abrirCalendario } from './calendario.js';
import * as quadro from './telas/quadro.js';
import * as produtividade from './telas/produtividade.js';
import * as operacao from './telas/operacao.js';
import * as comercial from './telas/comercial.js';
import * as projetos from './telas/projetos.js';
import * as estoque from './telas/estoque.js';
import * as movimentacao from './movimentacao.js';
import * as contagem from './contagem.js';
import * as analiseMed from './telas/analise-medicoes.js';
import * as pedidos from './telas/pedidos.js';
import * as escritorio from './telas/escritorio.js';
import { DEPARTAMENTOS, depPorId, podeVerDep } from './organograma.js';
import * as pd from './telas/painel-dep.js';
import { painelDe } from './deps/index.js';
import * as inicio from './deps/inicio.js';
import * as obraDep from './deps/obra.js';
import * as celularObra from './telas/celular-obra.js';
import * as agendaSemana from './telas/agenda-semana.js';

const ATUALIZAR_A_CADA_MS = 5 * 60 * 1000;

// Abas do pós-obra: o resumo dos agentes (como no painel) + as abas da planilha integrada
// abas do Pós-obra (21/10): Pós-obras (cartões) · Pendências (as mesmas de Atas e pendências) · Agenda (cartões de funcionários) · Equipe e PJ · Financeiro.
// Painel, Obras e Serviços (planilha) continuam existindo, mas escondidos (links no rodapé de Pós-obras).
const SUB = [
  { id: '', nome: 'Pós-obras', escondida: true },
  { id: 'controle', nome: 'Controle de obras', nova: true },
  { id: 'quadro-os', nome: 'Quadro de OS', escondida: true },
  { id: 'datas-os', nome: 'Datas das OS', nova: true },
  { id: 'servicos', nome: 'Serviços', escondida: true },
  { id: 'agenda', nome: 'Agenda', escondida: true },
  { id: 'equipe', nome: 'Equipe e PJ', mod: equipe },
  { id: 'financeiro', nome: 'Financeiro', mod: financeiro, restrita: true },
  { id: 'painel', nome: 'Painel da planilha', mod: painel, escondida: true },
  { id: 'obras', nome: 'Obras', mod: obras, escondida: true },
  { id: 'servicos-tabela', nome: 'Serviços (tabela da planilha)', mod: servicos, escondida: true },
];

// Sem piscar: qualquer tela que escreve em #conteudo só troca o HTML se ele mudou (ou se o usuário mexeu em algum campo e a tela precisa voltar ao
// estado salvo). A transição suave (fade, classe .troca) acontece só quando a TELA muda, não quando a mesma tela é redesenhada com dados novos.
{
  const alvo = document.getElementById('conteudo');
  const original = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  let ultimoHtml = null; let ultimaRota = null;
  Object.defineProperty(alvo, 'innerHTML', {
    configurable: true,
    get() { return original.get.call(this); },
    set(v) {
      const rotaChave = location.hash.split('?')[0];
      const sujo = [...this.querySelectorAll('input, select, textarea')].some((el) => (el.type === 'checkbox' || el.type === 'radio' ? el.checked !== el.defaultChecked : el.tagName === 'SELECT' ? (el.multiple ? false : el.selectedIndex !== Math.max(0, [...el.options].findIndex((o) => o.defaultSelected))) : el.value !== el.defaultValue));
      if (v !== ultimoHtml || sujo || this.innerText === '') {
        original.set.call(this, v); ultimoHtml = v;
        if (ultimaRota !== rotaChave) { this.classList.remove('troca'); void this.offsetWidth; this.classList.add('troca'); }
      }
      ultimaRota = rotaChave;
    },
  });
}

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
  if (['perfil', 'equipe'].includes(rotaAtual().tela) && antes !== JSON.stringify(estado.pedido.lista)) desenhar();
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
    return { abas, conteudo: '', resumo: String(posGeral.renderResumo(estado.base, rota.params, { podeEditar: podeEditarPos(), veValores: veValores() })) };
  }
  // Página de uma OS: dados, atualizações e as pendências dela
  if (rota.sub === 'os') {
    if (!estado.base) return semBase();
    garantirAtasCarregadas();
    return { abas, conteudo: `<div class="pagina" style="margin-top:26px">${String(posGeral.renderOS({ base: estado.base, os: rota.arg, atualizacoes: svPos.atualizacoesDa(rota.arg), pendencias: atas.todasPendencias(), podeEditar: podeEditarPos(), veValores: veValores() }))}</div>` };
  }
  // Controle de obras do pós-obra: a lista do Controle Operacional (planilha), montada com os pós-obras cadastrados e as OS do quadro
  if (rota.sub === 'controle') {
    garantirOsCarregadas(); garantirAtasCarregadas();
    return { abas, conteudo: `<div class="pagina" style="margin-top:26px">${String(posControle.render({ params: rota.params, obrasCad: estado.obrasCad || [], pendencias: atas.todasPendencias(), hoje: hojeISO(), podeEditar: podeEditarPos() }))}</div>` };
  }
  // Quadro de OS (solicitação > análise > orçamento > falta agendar > agendado > em execução > concluído) e o quadro de datas das mesmas OS
  if (rota.sub === 'quadro-os' || rota.sub === 'datas-os') {
    garantirOsCarregadas(); garantirAtasCarregadas();
    const dados = { params: rota.params, podeEditar: podeEditarPos(), clientesPos: posObrasAtivas() };
    return { abas, conteudo: `<div class="pagina" style="margin-top:26px">${rota.sub === 'quadro-os' ? String(osq.renderQuadro(dados)) : String(osq.renderDatas(dados))}</div>` };
  }
  // Serviços: quadro por fase (análise, orçamento, execução, concluído…), arrastando os cartões
  if (rota.sub === 'servicos') {
    if (!estado.base) return semBase();
    const podeEditar = ['socio', 'posobra', 'coord_operacoes'].includes(funcaoAtual().id);
    return { abas, conteudo: `<div class="pagina" style="margin-top:26px">${svPos.erro ? `<p class="erro">${esc(svPos.erro)}</p>` : ''}${String(posGeral.renderServicos({ base: estado.base, params: rota.params, podeEditar }))}</div>` };
  }
  // Agenda da semana: cartões de funcionários arrastados para a obra e o dia
  if (rota.sub === 'agenda') {
    if (!estado.base) return semBase();
    carregarAgendaSemana();
    const podeEditar = ['socio', 'posobra', 'coord_operacoes'].includes(funcaoAtual().id);
    return { abas, conteudo: `<div class="pagina" style="margin-top:26px">${String(posGeral.renderAgenda({ base: estado.base, semanaIni: estado.posAgenda.semana, linhasAgenda: agendaPos.linhas, podeEditar, selecionado: estado.posAgenda.sel, erro: agendaPos.erro, extras: apExtras(), equipeProg: estado.equipeProg }))}</div>` };
  }

  // página de uma obra: simples e didática (a completa fica em ?completo=1)
  if (ehObra && !rota.params.get('completo')) {
    if (!estado.base) return semBase();
    carregarAgendaSemana(); garantirAtasCarregadas();
    return { abas, conteudo: `<div class="pagina" style="margin-top:26px">${String(posGeral.renderObra({ base: estado.base, nome: rota.arg, semanaIni: estado.posAgenda.semana, linhasAgenda: agendaPos.linhas, pendencias: atas.todasPendencias(), podeEditar: podeEditarPos(), linkCompleto: `#/posobra/obra/${encodeURIComponent(rota.arg)}?completo=1` }))}</div>` };
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

const podeEditarPos = () => ['socio', 'posobra', 'coord_operacoes'].includes(funcaoAtual().id);

// a base do pós-obra = planilha + o que o sistema mudou nos serviços (fases) e os serviços novos
function reconstruirBase() {
  if (!estado.dadosBase) return;
  estado.base = montarBase({ ...estado.dadosBase, servicos: svPos.mesclar(estado.dadosBase.servicos || []), obras: obrasPos.mesclar(estado.dadosBase.obras || []) }, hojeISO());
}

// carrega a agenda da semana escolhida (uma vez por semana) e redesenha
function carregarAgendaSemana() {
  const de = estado.posAgenda.semana; const chave = `${de}`;
  if (estado.posAgenda.chave === chave) return;
  estado.posAgenda.chave = chave;
  agendaPos.carregar(de, somarDias(de, 6)).then(() => { const r = rotaAtual(); if (r.tela === 'posobra' && (!r.sub || r.sub === 'agenda')) desenhar(); });
}
// Pós-obra, página inicial: o Quadro de OS e a Agenda da semana entram no painel
function ctxPosObra() {
  garantirOsCarregadas(); garantirAtasCarregadas('#posobra-painel'); carregarAgendaSemana();
  const podeEditar = podeEditarPos();
  return {
    quadroOs: () => String(osq.renderQuadro({ params: new URLSearchParams(), podeEditar, clientesPos: posObrasAtivas(), semFiltros: true })),
    agendaPos: () => (estado.base ? String(posGeral.renderAgenda({ base: estado.base, semanaIni: estado.posAgenda.semana, linhasAgenda: agendaPos.linhas, podeEditar, selecionado: estado.posAgenda.sel, erro: agendaPos.erro, extras: apExtras(), equipeProg: estado.equipeProg })) : ''),
  };
}
function garantirOsCarregadas() {
  if (estado.osVisitada) return;
  estado.osVisitada = true;
  osq.carregar().then(() => { const r = rotaAtual(); if (emEdicao()) return; if (r.tela === 'posobra') desenhar(); });
}
function garantirAtasCarregadas(chave = '#posobra') {
  if (estado.atasVisitada === chave) return;
  estado.atasVisitada = chave;
  atas.carregar().then(() => { const r = rotaAtual(); if (emEdicao()) return; if ((r.tela === 'posobra' && r.sub === 'pendencias') || (chave !== '#posobra' && r.tela !== 'atas')) desenhar(); });
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
// A caixinha de obra sai do CADASTRO (Cadastros): toda obra não finalizada, Mo… = obra e Po… = pós-obra. Obra nova cadastrada aparece sozinha.
// Sem cadastro carregado (modo de teste), vale o que vem dos dados.
const numerico = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
// Tudo o que é criado ou excluído (obra, setor, login/pessoa) aparece em todas as telas: depois de cada criação/exclusão, de minuto em minuto e ao voltar para a aba,
// recarrega os cadastros e redesenha (sem atrapalhar quem está digitando). Regra do Felipe, 10/11/2026: listas nunca fixas no código.
// Versão nova do sistema: quem deixa o sistema aberto o dia todo continuava com o código antigo (e, por exemplo, não aparecia no escritório virtual).
// A cada 2 min vê se saiu versão nova (versao.json, gerado a cada publicação) e, quando NÃO há nada sendo preenchido, recarrega a página.
// Com formulário em edição (ata, tarefa, OS…) nunca recarrega: mostra um aviso "Atualizar agora" e a pessoa escolhe quando (pedido do Felipe, 13/11/2026: perdia a ata).
// emEdicao(): janela aberta, campo com o cursor ou qualquer campo de formulário já mexido (valor diferente do que veio na tela).
function emEdicao() {
  if (document.getElementById('at-modal')) return true;
  const a = document.activeElement;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest('#conteudo, #at-modal')) return true;
  return [...document.querySelectorAll('#conteudo form input, #conteudo form textarea, #conteudo form select')].some((el) => {
    if (el.type === 'hidden' || el.type === 'file' || el.type === 'submit' || el.type === 'button') return false;
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked !== el.defaultChecked;
    if (el.tagName === 'SELECT') { const pad = [...el.options].findIndex((o) => o.defaultSelected); return el.selectedIndex !== (pad < 0 ? 0 : pad); }
    return el.value !== el.defaultValue;
  });
}
function avisoVersaoNova() {
  if (document.getElementById('aviso-versao')) return;
  const d = document.createElement('div'); d.id = 'aviso-versao'; d.className = 'aviso-versao';
  d.innerHTML = '<span>Saiu uma versão nova do sistema. Termine o que está fazendo e atualize quando quiser.</span><button type="button" data-atualizar-versao>Atualizar agora</button><button type="button" class="aviso-x" data-fechar-aviso-versao title="Lembrar depois">×</button>';
  document.body.appendChild(d);
}
document.addEventListener('click', (e) => {
  if (e.target.closest && e.target.closest('[data-atualizar-versao]')) location.reload();
  if (e.target.closest && e.target.closest('[data-fechar-aviso-versao]')) { const d = document.getElementById('aviso-versao'); if (d) d.remove(); }
  const ver = e.target.closest && e.target.closest('[data-senha-ver]');
  if (ver) { e.preventDefault(); const campo = ver.parentElement.querySelector('input'); const mostrar = campo.type === 'password'; campo.type = mostrar ? 'text' : 'password'; ver.textContent = mostrar ? 'Ocultar' : 'Mostrar'; ver.setAttribute('aria-label', mostrar ? 'Ocultar a senha' : 'Mostrar a senha'); campo.focus(); }
});
{
  let versaoAbriu = null;
  const checar = async () => {
    try {
      const r = await fetch('versao.json', { cache: 'no-store' }); if (!r.ok) return;
      const v = (await r.json()).v; if (!v) return;
      if (versaoAbriu === null) { versaoAbriu = v; return; }
      if (v === versaoAbriu) return;
      if (emEdicao()) avisoVersaoNova(); else location.reload();
    } catch { /* sem conexão ou ambiente local: ignora */ }
  };
  setTimeout(checar, 3000); setInterval(checar, 2 * 60 * 1000);
}
// Acesso restrito (todo mundo menos diretoria e administrativo): o que a diretoria liberar em Configurações (Início, departamentos, Estoque, Marketing) também aparece e abre
const liberadoExtra = (f, id) => !!id && soMinhasFuncoes(f) && (listaConfig(`pagina.${id}`) || []).includes(f.id);
let sincronizandoCad = false;
async function sincronizarCadastros({ forcar = false } = {}) {
  if (!nuvem.NA_NUVEM || !logado() || sincronizandoCad) return;
  sincronizandoCad = true;
  try {
    const chavePessoas = () => JSON.stringify((atas.pessoasDaEquipe() || []).map((p) => `${p.id}|${p.nome}|${p.funcao}`));
    const antesPessoas = chavePessoas(); const antesCfg = snapshotConfig();
    const [oc, st] = await Promise.all([nuvem.listarObras().catch(() => null), nuvem.listarSetores().catch(() => null), atas.carregar().catch(() => null), carregarConfig().catch(() => null)]);
    let mudou = forcar || snapshotConfig() !== antesCfg;
    if (oc && JSON.stringify(oc) !== JSON.stringify(estado.obrasCad || [])) { estado.obrasCad = oc; mudou = true; }
    if (st && st.length && JSON.stringify(st) !== JSON.stringify(SETORES_ORGANOGRAMA)) { aplicarSetores(st); atas.atualizarSetoresAta(); mudou = true; }
    if (chavePessoas() !== antesPessoas) mudou = true;
    const a = document.activeElement;
    const digitando = !forcar && emEdicao();   // não redesenha por cima de ata, tarefa ou OS que a pessoa está preenchendo
    if (mudou && !digitando) desenhar();
  } finally { sincronizandoCad = false; }
}
setInterval(() => sincronizarCadastros(), 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizarCadastros(); });
window.addEventListener('focus', () => sincronizarCadastros());
// Agenda: a lista de funções da lateral tem a altura da área visível (quem rola é o #conteudo, não a janela): assim ela rola por dentro até o último card
function ajustarAlturaFuncoes() {
  const f = document.querySelector('.ag-funcoes'); const c = document.getElementById('conteudo'); if (!f || !c) return;
  f.style.maxHeight = `${Math.max(240, c.clientHeight - 24)}px`;
}
window.addEventListener('resize', ajustarAlturaFuncoes);
// obra "em orçamento" ainda não é obra de verdade: não entra nas listas da operação, só nas caixinhas de obra de atas e tarefas (de quem pode ver)
const SEM_LISTA = ['finalizada', 'orcamento', 'nao_fechado'];   // fora das listas da operação (orçamento e não fechado só aparecem para o setor ORC e a diretoria)
const cadastroAtivo = () => (estado.obrasCad || []).filter((c) => !SEM_LISTA.includes(c.situacao)).map((c) => c.codigo);
const cadastroEmOrcamento = () => (estado.obrasCad || []).filter((c) => c.situacao === 'orcamento').map((c) => c.codigo);
const nomesDasObras = () => Object.fromEntries((estado.obrasCad || []).map((c) => [String(c.codigo).toLowerCase(), c.nome || '']));
function obrasDeAtas() {
  if (funcaoAtual().porObra) return obrasDaPessoa();
  if ((estado.obrasCad || []).length) { atas.definirObrasOrcamento(cadastroEmOrcamento(), nomesDasObras()); return [...cadastroAtivo().sort(numerico), ...cadastroEmOrcamento().sort(numerico), ...atas.obrasForaDoCadastro(estado.obrasCad.map((c) => c.codigo)).sort(numerico)]; }
  return [...obrasDeAcesso(), ...obrasDisponiveis().filter((o) => /^po/i.test(o)), ...((estado.base && estado.base.obras) || []).filter((o) => !['Concluído', 'Cancelado', 'Sem OS', 'Sem situação'].includes(o.situacao)).map((o) => o.obra)];
}

// pós-obras ativos (os mesmos que aparecem nas atas): também dá para vincular pessoas a eles em Acessos
function posObrasAtivas() {
  if ((estado.obrasCad || []).length) return cadastroAtivo().filter((o) => /^po/i.test(o)).sort(numerico);
  return [...new Set(((estado.base && estado.base.obras) || []).filter((o) => !['Concluído', 'Cancelado', 'Sem OS', 'Sem situação'].includes(o.situacao)).map((o) => o.obra))].filter((o) => o && !/^Mo\d/i.test(o)).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
}
// obras que existem nos dados (planejamento, RH, pós-obra) mas ainda não estão no cadastro: aparecem em Cadastros para cadastrar com um clique
function obrasSemCadastro(oc) {
  const tem = new Set(oc.map((c) => String(c.codigo).toLowerCase()));
  const dosDados = [...obrasDisponiveis(), ...posObrasAtivas()].filter((o) => /^(mo|po)\d+[a-z]?$/i.test(String(o).trim()));
  return [...new Set(dosDados)].filter((o) => !tem.has(String(o).toLowerCase())).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })).map((codigo) => ({ codigo, nome: '', situacao: 'andamento', semCadastro: true }));
}
function obrasDeAcesso() {
  if ((estado.obrasCad || []).length) return cadastroAtivo().filter((o) => /^mo/i.test(o)).sort(numerico);
  const enc = new Set((((estado.drive || {}).estoque || {}).cadastroObras || []).filter((c) => /encerr|finaliz|conclu/i.test(c.status || '')).map((c) => c.obra));
  return obrasDisponiveis().filter((o) => /^Mo\d/i.test(o) && !enc.has(o));
}

// Menu lateral recolhível (21/10): ao abrir uma aba o menu recolhe e fica só uma tirinha com a setinha, para dar mais espaço à página.
// Clicar na setinha abre de novo. Só em tela larga (no celular o menu já é uma faixa no alto).
const recolhido = () => document.body.classList.contains('nav-recolhido');
const botaoRecolher = () => '';   // a setinha é um botão grande fixo no meio da lateral (criado em ajustarMenuRecolhivel)
function ajustarMenuRecolhivel() {
  const b = document.createElement('button'); b.type = 'button'; b.id = 'navToggle'; b.className = 'nav-handle';
  document.body.appendChild(b);
  const pintar = () => {
    const r = recolhido();
    b.dataset.estado = r ? 'fechado' : 'aberto'; b.title = r ? 'Abrir o menu' : 'Recolher o menu'; b.setAttribute('aria-label', b.title);
    b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  };
  b.addEventListener('click', () => { document.body.classList.toggle('nav-recolhido'); pintar(); });
  // o menu só recolhe quando a pessoa clica na setinha (clicar numa aba não recolhe mais)
  pintar();
}

function desenharNav(sel) {
  const CFG = estado.cfg;
  const f = funcaoAtual();
  // Feed com a bolinha de publicações novas
  const itemFeed = () => { const n = sel === 'feed' ? 0 : feed.novas(s.nome); return `<a class="nav-item${sel === 'feed' ? ' sel' : ''}" href="#/feed"><span>Feed</span>${n ? `<span class="nav-n">${n}</span>` : ''}</a>`; };
  const itemAtas = () => { const n = atas.minhasAbertas(); return `<a class="nav-item${sel === 'atas' ? ' sel' : ''}" href="#/atas"><span>Atas e pendências</span>${n ? `<span class="nav-n">${n}</span>` : ''}</a>`; };
  const item =(id, nome, status) => `<a class="nav-item${id === sel ? ' sel' : ''}" href="#/${esc(id)}"${id === sel ? ' aria-current="page"' : ''}><span>${esc(nome)}</span>${status ? pt(status) : ''}</a>`;
  const s = sessao();
  const itemObrasOrc = () => (atas.podeCriarObraOrcamento() && funcaoReal().id !== 'socio' ? item('obrasorc', 'Obras em orçamento') : '');
  // acesso restrito (por enquanto, quase todo mundo): só Minhas funções e Treinamentos
  if (soMinhasFuncoes(f)) {
    $('#nav').innerHTML = botaoRecolher() + `<div class="marca"><img src="img/logo.png" alt="Sólida"><span>Painel da empresa</span></div>`
      + `<div class="nav-perfil"><span class="nav-foto" data-nav-foto title="Clique para trocar a sua foto">${perfil.avatar(s.nome, 38)}</span><span><b>${esc(s.nome)}</b><small>${esc(f.nome)}</small></span></div>`
      // pedido do Felipe (04/11): Meu trabalho (Agenda, Tarefas, Atas) e Equipe (Treinamentos, Feed)
      + '<div class="nav-grupo">Meu trabalho</div>' + item('agenda', 'Agenda')
      + (f.porObra ? obrasDaPessoa().map((o) => `<a class="nav-item nav-celular${location.hash.startsWith(`#/celular/${o}`) ? ' sel' : ''}" href="#/celular/${encodeURIComponent(o)}"><span>Celular da obra ${esc(o)}</span></a>`).join('') : '')
      + (paginaVisivel(f, 'atas') ? itemTarefasRestrito(sel) + `<a class="nav-item${sel === 'atas' ? ' sel' : ''}" href="#/atas?aba=atas"><span>Atas</span></a>` : '') + itemObrasOrc()
      + '<div class="nav-grupo">Equipe</div>'
      + (temEstoqueRestrito(f) && paginaVisivel(f, 'estoque') ? item('estoque', 'Estoque') : '') + item('treinamentos', 'Treinamentos')
      + (paginaVisivel(f, 'escritorio') ? item('escritorio', 'Escritório virtual') : '')
      + (paginaVisivel(f, 'feed') ? itemFeed() : '')
      + (() => { const ex = [...(liberadoExtra(f, 'geral') ? [item('geral', 'Início')] : []), ...DEPARTAMENTOS.filter((d) => liberadoExtra(f, d.id)).map((d) => item(d.id, d.nome)), ...['estoque', 'marketing'].filter((id) => liberadoExtra(f, id)).map((id) => item(id, id === 'estoque' ? 'Estoque' : 'Marketing'))]; return ex.length ? '<div class="nav-grupo">Liberado para você</div>' + ex.join('') : ''; })()
      + `<div class="navfoot">${estado.sync.origem === 'link' ? 'Atualiza sozinho a cada 5 minutos.' : 'Mostrando os últimos dados baixados.'}</div>`;
    desenharAvatares($('#nav'));
    return;
  }
  // Menu espelhando o organograma (desenho do Marcos, 04/11/2026): Meu trabalho · Departamentos (obras dentro de Operações)
  // · Resultados · e o que o sistema já tinha e continua (Equipe: escritório virtual, treinamentos, feed…; Diretoria: agentes, cadastros).
  const grupo = (t) => `<div class="nav-grupo">${esc(t)}</div>`;
  const sub = (href, nome, on) => `<a class="nav-item nav-sub${on ? ' sel' : ''}" href="${href}"><span>${esc(nome)}</span></a>`;
  const r = rotaAtual();
  const statusDep = (d) => { const a = CFG && d.cfg && CFG.areas.find((x) => x.id === d.cfg); return a ? a.status : ''; };
  const obrasMenu = obrasDoMenu();
  const deps = DEPARTAMENTOS.filter((d) => podeVerDep(d, f)).map((d) => item(d.id, d.nome, statusDep(d))
    + (d.comObras ? obrasMenu.map((o) => sub(`#/obra/${encodeURIComponent(o)}`, o, r.tela === 'obra' && r.sub === o)).join('') : '')
    + (d.id === 'transporte' && paginaVisivel(f, 'estoque') ? item('estoque', 'Estoque') : '')).join('');
  const verAtas = paginaVisivel(f, 'atas');
  const nTar = atas.minhasAbertas();
  const itemTar = `<a class="nav-item${sel === 'tarefas' ? ' sel' : ''}" href="#/atas"><span>Tarefas</span>${nTar ? `<span class="nav-n">${nTar}</span>` : ''}</a>`;
  $('#nav').innerHTML = botaoRecolher() + `<div class="marca"><img src="img/logo.png" alt="Sólida"><span>Painel da empresa</span></div>`
    + `<a class="nav-perfil${sel === 'perfil' ? ' sel' : ''}" href="#/perfil" title="Meu perfil"><span class="nav-foto" data-nav-foto title="Clique para trocar a sua foto">${perfil.avatar(s.nome, 38)}</span><span><b>${esc(s.nome)}</b><small>${esc(f.nome)}</small></span></a>`
    + grupo('Meu trabalho')
    + item('geral', 'Início') + item('agenda', 'Agenda') + (verAtas ? itemTar + `<a class="nav-item${sel === 'atas' ? ' sel' : ''}" href="#/atas?aba=atas"><span>Atas</span></a>` : '') + itemObrasOrc()
    + grupo('Departamentos') + deps
    + (f.id === 'socio' ? grupo('Resultados') + item('equipe', 'Ranking') : '')   // ranking, funcionário do mês e recompensas: só a diretoria
    + grupo('Equipe')
    + (!f.semMinhaSemana && paginaVisivel(f, 'meudia') && f.editaProdutividade ? item('meudia', 'Minha semana') : '') + (f.veQuadro ? item('quadro', 'Quadro de funções') : '')
    + (paginaVisivel(f, 'feed') ? itemFeed() : '')
    + (paginaVisivel(f, 'escritorio') ? item('escritorio', 'Escritório virtual') : '')
    + (paginaVisivel(f, 'treinamentos') ? item('treinamentos', 'Treinamentos') : '')
    + (paginaVisivel(f, 'marketing') ? item('marketing', 'Marketing') : '')
    + (f.veAgentes ? `${grupo('Diretoria')}${item('agentes', 'Agentes')}${nuvem.NA_NUVEM && funcaoReal().id === 'socio' ? item('acessos', 'Cadastros') : ''}${funcaoReal().id === 'socio' ? item('configuracoes', 'Configurações') : ''}` : '')
    + `<div class="navfoot">${estado.sync.origem === 'link' ? 'Atualiza sozinho a cada 5 minutos.' : 'Mostrando os últimos dados baixados.'}</div>`;
  desenharAvatares($('#nav'));
}

function itemTarefasRestrito(sel) {
  const n = atas.minhasAbertas();
  return `<a class="nav-item${sel === 'tarefas' ? ' sel' : ''}" href="#/atas"><span>Tarefas</span>${n ? `<span class="nav-n">${n}</span>` : ''}</a>`;
}

// obras em curso no submenu de Operações (as do planejamento + as em andamento do cadastro); quem é de obra vê só as suas
function obrasDoMenu() {
  const CFG = estado.cfg; const f = funcaoAtual();
  const plan = CFG ? ((CFG.areas.find((a) => a.id === 'planejamento') || {}).porObra || []).map((o) => o.obra) : [];
  const cad = (estado.obrasCad || []).filter((c) => c.situacao === 'andamento' && /^Mo\d/i.test(c.codigo)).map((c) => c.codigo);
  const fin = new Set((estado.obrasCad || []).filter((c) => ['finalizada', 'nao_fechado'].includes(c.situacao)).map((c) => c.codigo));
  const todas = [...new Set([...plan, ...cad])].filter((o) => !fin.has(o)).sort(numerico);
  return f.porObra ? todas.filter((o) => obrasDaPessoa().includes(o)) : todas;
}

// página de uma obra (Operações › Mo531, desenho do Marcos): Resumo + abas; as abas antigas (cronograma, programação,
// medições, escopo e aditivos) vêm de telas/operacao.js, as novas de deps/obra.js
function telaObraNova(rota) {
  const cod = rota.sub; const abaId = rota.arg || '';
  const f = funcaoAtual();
  if (!cod) { location.hash = '#/operacao'; return ''; }
  if (f.porObra && !obrasDaPessoa().includes(cod)) return `<div class="erro">A obra ${esc(cod)} não está entre as suas obras.</div>`;
  const ctx = ctxPainel(depPorId('operacao'), estado.cfg.areas.find((a) => a.id === 'operacao'));
  const base = `#/obra/${encodeURIComponent(cod)}`;
  const tabs = obraDep.ABAS.map((a) => ({ ...a, href: `${base}${a.id ? `/${a.id}` : ''}` }));
  const legado = ['cronograma', 'programacao', 'medicoes', 'escopo'];
  let corpo;
  if (!abaId) corpo = obraDep.resumo(ctx, cod);
  else if (legado.includes(abaId)) corpo = operacao.abaDaObra(estado.cfg, estado.drive.projetos, cod, abaId, rota.params, `${base}/escopo`, { veValores: veValores() });
  else corpo = obraDep.aba(ctx, cod, abaId);
  return `<div class="pd">${obraDep.cabecalho(ctx, cod)}${pd.abas(tabs, abaId)}<div class="pd-corpo">${corpo}</div></div>`;
}

// tudo o que um painel de departamento pode precisar (contrato em app/js/deps/comum.js)
function ctxPainel(dep, area) {
  const f = funcaoAtual();
  if (estado.cfg) estado.cfg.obrasCad = estado.obrasCad || null;   // situação das obras (cadastro): as telas escondem finalizada e mostram pausada
  return { dep, CFG: estado.cfg, obrasCad: estado.obrasCad || null, podeMudarObra: podeMudarSituacaoObra(), area: area || null, f, veValores: veValores(), drive: estado.drive || {}, base: estado.base, efetivo: estado.efetivo || { dias: {} },
    rotas: estado.rotas || { semanas: [] }, equipeProg: estado.equipeProg || { pessoas: [] }, terceiros: estado.terceiros || { empresas: [] }, ferrChk: estado.ferrChk || { registros: [] }, mc: estado.mc || { obras: [] }, celular: celularObra.registros(),
    pendencias: atas.todasPendencias(), hoje: hojeISO(), visiveis: f.porObra ? obrasDaPessoa() : null, sync: estado.sync, obrasMenu: obrasDoMenu(),
    ...(dep && dep.id === 'posobra' ? ctxPosObra() : {}) };
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
  executor_ferramentas: 'Executor ferram.', estagiario_compras: 'Estag. compras', posobra: 'Pós-obra', estagiario_posobra: 'Estag. pós-obra', financeiro: 'Financeiro', administrativo: 'Administrativo',
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
    if (logado()) { location.hash = soMinhasFuncoes(funcaoAtual()) ? '#/funcoes' : (funcaoAtual().semMinhaSemana ? '#/geral' : '#/meudia'); atualizar(); }
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
  // onde está cada funcionário: só o efetivo de HOJE (zera todo dia); a lista de nomes vem do RH
  // obra cadastrada em Acessos entra na hora nas telas que usam a lista de obras dos dados (efetivo, ferramentas, orçamentos…)
  if (CFG) { CFG.obrasDados = CFG.obrasDados || [...(CFG.obras || [])]; CFG.obras = [...new Set([...CFG.obrasDados, ...(estado.obrasCad || []).filter((c) => !['finalizada', 'orcamento', 'nao_fechado'].includes(c.situacao)).map((c) => c.codigo)])]; }
  if (CFG) { CFG.funcionariosRH = CFG.funcionariosRH || CFG.funcionarios; CFG.funcionarios = efetivoTela.funcionariosDeHoje(CFG.funcionariosRH, estado.efetivo); }
  let rota = rotaAtual();
  let tela = rota.tela;
  const f = funcaoAtual();
  if (tela === 'funcoes') tela = 'agenda';   // "Minhas funções" virou a Agenda (desenho do Marcos)
  if (tela === 'agentes' && !f.veAgentes) tela = 'geral';
  if (tela === 'equipe' && f.id !== 'socio') tela = 'geral';
  if (tela === 'quadro' && !f.veQuadro) tela = 'agenda';
  if (tela === 'meudia' && f.semMinhaSemana) tela = 'geral';
  if (tela === 'meudia' && !f.editaProdutividade) tela = 'agenda';   // quem não lança produtividade só tem a agenda
  if (tela === 'agenda' && !paginaVisivel(f, 'meudia') && f.id !== 'socio') tela = 'geral';
  if (tela === 'obrasorc' && !atas.podeCriarObraOrcamento()) tela = 'geral';
  if (['meudia', 'feed', 'estoque', 'escritorio', 'treinamentos', 'atas', 'tarefas', 'marketing'].includes(tela) && !paginaVisivel(f, tela === 'tarefas' ? 'atas' : tela)) tela = 'geral';   // aba que a diretoria tirou desta função
  // acesso restrito (por enquanto, quase todo mundo): Agenda, Tarefas, Atas, Treinamentos e Feed (o resto é da diretoria e do Administrativo)
  if (soMinhasFuncoes(f)) tela = (['treinamentos', 'atas', 'tarefas', 'feed', 'escritorio', 'obrasorc'].includes(tela) || (tela === 'celular' && f.porObra) || (tela === 'estoque' && temEstoqueRestrito(f)) || liberadoExtra(f, (depPorId(tela) || {}).id || tela)) ? tela : 'agenda';

  // departamento do organograma (Painel no desenho do Marcos + Detalhes = a tela que já existia)
  let dep = depPorId(tela);
  if (dep && !podeVerDep(dep, f)) { dep = null; tela = 'geral'; }
  let area = CFG && CFG.areas.find((a) => a.id === (dep ? dep.cfg : tela));
  if (area && !dep && !podeVerArea(area)) { area = null; tela = 'geral'; }   // setor fora do perfil: nem existe
  const temLegado = !!(dep && area && dep.id !== 'materiais') || tela === 'geral';   // Materiais / Vendas: sem aba Detalhes por enquanto
  const ehPainel = (dep || tela === 'geral') && (!temLegado || ((!rota.sub || rota.sub === 'painel') && ![...rota.params.keys()].length));
  if ((dep || tela === 'geral') && !ehPainel && rota.sub === 'detalhe') rota = { ...rota, sub: '' };
  const ehObraPlan = tela === 'planejamento' && rota.sub === 'obra';
  const fixas = ['obrasorc', 'agentes', 'meudia', 'agenda', 'quadro', 'estoque', 'escritorio', 'perfil', 'feed', 'treinamentos', 'acessos', 'configuracoes', 'atas', 'tarefas', 'marketing', 'equipe', 'obra', 'celular'];
  const abaAtas = rota.params.get('aba');
  const sel = tela === 'funcionarios' ? 'rh' : tela === 'tarefas' || (tela === 'atas' && !['atas', 'nova', 'pautas'].includes(abaAtas)) ? 'tarefas' : (dep || area || fixas.includes(tela)) ? tela : 'geral';
  desenharNav(sel);
  desenharPerfil();
  desenharVerComo();
  if (tela !== 'escritorio') escritorio.parar();   // saiu do escritório virtual: para a animação e a presença

  const d = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#data').textContent = d.charAt(0).toUpperCase() + d.slice(1);
  const titulo = ehObraPlan ? rota.arg
    : dep ? (dep.titulo || dep.nome)
    : tela === 'obra' ? rota.sub
    : area ? area.nome
    : ({ obrasorc: 'Obras em orçamento', configuracoes: 'Configurações', agentes: 'Agentes', funcionarios: 'Funcionários por obra', meudia: 'Minha semana', agenda: 'Agenda', quadro: 'Quadro de funções', estoque: 'Estoque', escritorio: 'Escritório virtual', perfil: 'Perfil', feed: 'Feed', treinamentos: 'Treinamentos', acessos: 'Cadastros', atas: ['atas', 'nova', 'pautas'].includes(abaAtas) ? 'Atas' : 'Tarefas', tarefas: 'Tarefas', marketing: 'Marketing', equipe: 'Ranking', celular: 'Celular da obra' }[tela] || (f.id === 'socio' ? 'Início · visão do CEO' : 'Início'));
  $('#titulo').textContent = titulo;
  document.title = `${titulo} · Sólida`;

  // Tarefas: modo de visualização (Tabela | Lista) no topo, à esquerda de "Atualizado às…"
  { const mv = $('#modoVis'); const abaP = rota.params.get('aba'); const naTarefas = (tela === 'atas' || tela === 'tarefas') && (!abaP || abaP === 'pendencias');
    if (mv && tela === 'agenda') { const m = rota.params.get('modo') === 'dia' ? 'dia' : 'semana'; mv.hidden = false; mv.innerHTML = `<span class="mv-rot">Modo de visualização</span><span class="mv-seg"><button type="button" data-mva="semana" class="${m === 'semana' ? 'on' : ''}">Semana</button><button type="button" data-mva="dia" class="${m === 'dia' ? 'on' : ''}">Dia</button></span>`; }
    else if (mv) { mv.hidden = !naTarefas; if (naTarefas) { const m = rota.params.get('modo') === 'lista' ? 'lista' : 'tabela'; mv.innerHTML = `<span class="mv-rot">Modo de visualização</span><span class="mv-seg"><button type="button" data-mv="" class="${m === 'tabela' ? 'on' : ''}">Tabela</button><button type="button" data-mv="lista" class="${m === 'lista' ? 'on' : ''}">Lista</button></span><button type="button" class="mv-imp" data-lista-importar="" title="Importar uma lista de pendências em PDF: cada linha vira uma tarefa">⬆ Importar lista</button><button type="button" class="mv-imp" data-imprimir="" title="Imprimir as tarefas (ou salvar em PDF)">🖨 Imprimir</button>`; } } }
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
  if (tela === 'obrasorc') {
    $('#conteudo').innerHTML = `<div>${obrasOrc.render({ obrasCad: estado.obrasCad || [], msg: estado.obraOrcMsg || '' })}</div>`; estado.obraOrcMsg = '';
    return;
  }
  if (tela === 'configuracoes') {
    $('#conteudo').innerHTML = funcaoReal().id === 'socio' ? `<div>${configTela.render({ pagina: rota.sub || 'geral', msg: estado.cfgMsg || '' })}</div>` : '<div class="erro">Só a diretoria acessa as configurações.</div>';
    estado.cfgMsg = '';
    return;
  }
  if (tela === 'acessos' && nuvem.NA_NUVEM && funcaoReal().id === 'socio') {
    $('#conteudo').innerHTML = '<div class="carregando">Carregando a equipe…</div>';
    Promise.all([nuvem.listarPerfis(), nuvem.listarObras().catch(() => estado.obrasCad || [])]).then(([ps, oc]) => { estado.obrasCad = oc; if (rotaAtual().tela === 'acessos') $('#conteudo').innerHTML = `<div>${acessos.render({ perfis: ps, obras: obrasDeAcesso(), posObras: posObrasAtivas(), obrasCad: [...oc, ...obrasSemCadastro(oc)], listaAberta: !!estado.listaObrasAberta, meuId: nuvem.perfilAtual() && nuvem.perfilAtual().id, msg: estado.acessosMsg || '', aviso: estado.acessosAviso })}</div>`; estado.acessosMsg = ''; estado.acessosAviso = null; });
    return;
  }
  if (tela === 'atas' || tela === 'tarefas') {
    $('#conteudo').innerHTML = `<div>${atas.render({ params: rota.params, obras: obrasDeAtas(), sugestoes: ((estado.terceiros && estado.terceiros.empresas) || []).map((e) => e.empresa), msg: estado.atasMsgHash === location.hash ? (estado.atasMsg || '') : '' })}</div>`;
    ordenar.aplicar();
    { const fm = document.getElementById('ata-form'); if (fm) atas.atualizarNomeDoForm(fm); }
    if (estado.atasVisitada !== location.hash) {   // ao entrar na tela (ou mudar de aba), busca os dados mais novos
      estado.atasVisitada = location.hash;
      if (nuvem.NA_NUVEM) nuvem.listarObras().then((oc) => { if (JSON.stringify(oc) !== JSON.stringify(estado.obrasCad || [])) { estado.obrasCad = oc; const a = document.activeElement; if (['atas', 'tarefas'].includes(rotaAtual().tela) && !(a && a.closest && a.closest('#ata-form, #pend-form, #at-modal'))) desenhar(); } }).catch(() => {});
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
    const extra = '';   // bloco Cadastros removido do perfil da diretoria (acesso pela aba Cadastros no menu)
    $('#conteudo').innerHTML = `<div>${perfil.render({ eu, alvo, podeVerTodos, extra, CFG })}</div>`;
    desenharAvatares();
    return;
  }
  if (tela === 'meudia') {
    $('#conteudo').innerHTML = `<div>${meudia.render({ dia: estado.dia, CFG, pendAberta: estado.pendAberta, soFuncoes: false, aba: rota.sub, params: rota.params, semanaRef: estado.semanaRef })}</div>`;
    return;
  }
  // Agenda: as funções da semana + as tarefas (pendências com prazo) no mesmo calendário
  if (tela === 'agenda') {
    garantirAtasCarregadas('#agenda');
    $('#conteudo').innerHTML = `<div>${agendaSemana.render({ dia: estado.dia, CFG, pendAberta: estado.pendAberta, params: rota.params, semanaRef: estado.semanaRef, modo: rota.params.get('modo') === 'dia' ? 'dia' : 'semana', diaRef: ehData(rota.params.get('dia')) ? rota.params.get('dia') : hojeISO(), pendencias: atas.todasPendencias(), eu: nuvem.NA_NUVEM ? (nuvem.perfilAtual() || {}).id : idPessoa(), nomeDe: atas.nomePessoa })}</div>`;
    return;
  }
  // escritório virtual: tela com animação própria (não redesenha sozinha a cada 5 min)
  if (tela === 'escritorio') {
    $('#conteudo').innerHTML = `<div id="esc-raiz">${escritorio.render()}</div>`;
    escritorio.iniciar($('#esc-raiz'));
    return;
  }
  if (tela === 'estoque') {
    if (movimentacao.emEdicao() || contagem.emEdicao()) return;   // preenchendo a guia de movimentação: não redesenha, senão perde o que foi escrito
    movimentacao.garantir(desenhar);
    contagem.garantir(desenhar);
    const dEst = contagem.aplicar(estado.drive.estoque);   // contagens feitas no site por cima da planilha
    // abas embaixo do título (pedido do Felipe, 04/11): Estoque é só o estoque; contagem, guia, pedidos, checklists e reposição em abas
    const podeCont = contagem.PODE_CONTAR.includes(f.id) && dEst && dEst.itens;
    const podeMov = movimentacao.PODE_MOVIMENTAR.includes(f.id);
    const veComp = estoque.VE_ESTOQUE_COMPLETO.includes(f.id);
    const abasEst = [{ id: '', nome: 'Estoque' }, podeCont && { id: 'contagem', nome: 'Contagem do estoque' }, podeMov && { id: 'movimentacao', nome: 'Guia de movimentação' },
      { id: 'pedir', nome: 'Pedir itens do estoque' }, { id: 'checklists', nome: 'Checklists de ferramentas' }, veComp && { id: 'reposicao', nome: 'Reposição' }].filter(Boolean)
      .map((a) => ({ ...a, href: `#/estoque${a.id ? `/${a.id}` : ''}` }));
    const abaEst = abasEst.some((a) => a.id === rota.sub) ? rota.sub : '';
    const ctxEst = { ...ctxPainel(null, CFG && CFG.areas.find((a) => a.id === 'transporte')), drive: { ...(estado.drive || {}), estoque: dEst } };
    const corpoEst = {
      contagem: () => contagem.caixa({ dados: dEst, abrir: true }),
      movimentacao: () => movimentacao.caixa({ itens: ((dEst && dEst.itens) || []).map((i) => ({ cod: i.cod, item: i.item })), obras: (dEst && dEst.obras) || [] }),
      pedir: () => estoque.pedidosFuturos({ abrir: true }),
      checklists: () => `${painelDe('ferramentas', { ...ctxEst, parte: 'checklists' })}<div style="margin-top:26px">${ferrChk.cartoes(CFG, estado.ferrChk, f.porObra ? obrasDaPessoa() : null, dEst)}</div>`,
      reposicao: () => reposicao.render(dEst),
    }[abaEst];
    $('#conteudo').innerHTML = `<div class="pd">${pd.abas(abasEst, abaEst)}<div class="pd-corpo">${corpoEst ? corpoEst() : `${CFG ? painelDe('ferramentas', { ...ctxEst, parte: 'resumo' }) : ''}<div style="margin-top:22px">${estoque.render(dEst, { podeCompleto: veComp, veConsumiveis: estoque.VE_CONSUMIVEIS.includes(f.id), verTudo: rota.params.get('ver') === 'tudo' })}</div>`}</div></div>`;
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
    // ---- desenho do Marcos: Início, painéis dos departamentos, página da obra e celular da obra
    const abasDe = (base, ativa) => pd.abas([{ id: '', nome: 'Painel', href: base }, { id: 'detalhe', nome: tela === 'geral' ? 'Visão geral (anterior)' : 'Detalhes', href: `${base}/detalhe` }, ...(tela === 'transporte' ? [{ id: 'rotas', nome: 'Rotas da semana', href: `${base}/rotas` }] : [])], ativa);
    if (tela === 'geral' && ehPainel) {
      out = `<div class="pd">${pd.cabecalho({ rotulo: new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) })}${abasDe('#/geral', '')}${inicio.painel(ctxPainel(null, null))}</div>`;
    } else if (dep && ehPainel) {
      out = `<div class="pd">${pd.cabecalho({ resp: dep.resp })}${temLegado ? abasDe(`#/${dep.id}`, '') : ''}${painelDe(dep.id, ctxPainel(dep, area))}</div>`;
    } else if (tela === 'obra') {
      if (!estado.celCarregado) { estado.celCarregado = true; celularObra.carregar(() => desenhar()); }
      out = telaObraNova(rota);
    } else if (tela === 'celular') {
      if (!estado.celCarregado) { estado.celCarregado = true; celularObra.carregar(() => desenhar()); }
      if (f.porObra && !obrasDaPessoa().includes(rota.sub)) out = `<div class="erro">A obra ${esc(rota.sub)} não está entre as suas obras.</div>`;
      else out = String(celularObra.render(ctxPainel(depPorId('operacao'), CFG.areas.find((a) => a.id === 'operacao')), rota.sub, rota.params));
    } else if (ehObraPlan) out = T.telaObra(rota.arg);
    else if (area && area.id === 'operacao') {
      // Operação: acompanhamento de todas as obras (quem é de obra vê só as suas e não vê o Resumo do setor)
      const visiveis = deObra ? obrasDaPessoa() : null;
      // Só o Resumo (cronograma, programação e medições de todas as obras) e, embaixo, Por obra (15/10).
      // Metas diárias continuam em #/operacao/metas (link no Resumo).
      const base = '#/operacao';
      if (rota.sub === 'medicoes') {
        out = analiseMed.render({ CFG, mc: estado.mc, efetivo: estado.efetivo, params: rota.params, visiveis });
      } else if (rota.sub === 'metas') {
        out = `<div><a class="link" href="${base}">← Operação</a><div style="margin-top:18px">${produtividade.render({ CFG, params: rota.params, dia: estado.dia, semanaRef: estado.semanaRef })}</div></div>`;
      } else {
        const ob = operacao.porObra(CFG, visiveis, estado.drive.projetos, rota.params, base, { veValores: !!f.veValores });
        // ordem (pedido do Felipe, 15/10): indicadores → alertas das metas → cronograma/programação/medições → Por obra
        const tabela = operacao.abaProgramacao(CFG, visiveis, (o) => `${base}?obra=${encodeURIComponent(o)}&aba=cronograma`);
        const depois = `${produtividade.alertasMetas(CFG, visiveis)}${analiseMed.alertasResumo({ CFG, mc: estado.mc, efetivo: estado.efetivo, visiveis })}${terceiros.render(CFG, estado.terceiros, visiveis)}${tabela}<div style="margin-top:34px">${ob.cards}</div>`;
        // obra aberta: só ela (com o link para voltar)
        if (ob.aberta) out = `<div>${ob.painel}</div>`;
        else out = `<div class="atalho-metas"><a class="botao on" href="#/operacao/metas">Análise das metas da semana</a> <span class="pequeno">o que está dentro da meta, o que não está e o que fazer, obra por obra</span> <a class="botao on" href="#/operacao/medicoes">Análise das medições</a> <span class="pequeno">produtividade × efetivo × programação × Mais Controle</span></div>${deObra ? `<div>${depois}</div>` : T.telaArea(area, '', { semEstado: true, semAlertas: true, depoisIndicadores: depois })}`;
      }
    }
    else if (area && area.id === 'transporte') {
      // Transporte: indicadores → planilha de ferramentas obrigatórias por obra (enviada toda quarta no grupo)
      // abas: Resumo · Reposição de ferramentas (a reposição mostra carros e obras: só quem vê o estoque completo)
      const veRepos = estoque.VE_ESTOQUE_COMPLETO.includes(f.id);
      const abas = veRepos ? subnav(reposicao.ABAS_TRANSPORTE.map((a) => ({ ...a, href: `#/transporte${a.id ? `/${a.id}` : ''}` })), rota.sub === 'reposicao' ? 'reposicao' : '') : '';
      if (rota.sub === 'rotas') out = String(rotasTela.render(estado.rotas, rota.params));
      else if (veRepos && rota.sub === 'reposicao') out = `<div>${abas}<div style="margin-top:26px">${reposicao.render(estado.drive.estoque)}</div></div>`;
      else out = T.telaArea(area, abas ? `<div style="margin-bottom:34px">${abas}</div>` : '', { depoisIndicadores: ferrChk.cartoes(CFG, estado.ferrChk, deObra ? obrasDaPessoa() : null, estado.drive.estoque) });
    }
    else if (area && area.id === 'rh') {
      // RH: números e cartões do efetivo de HOJE (lido sozinho dos grupos das obras; zera todo dia) + histórico de quem esteve em cada obra por dia
      const visiveisRH = deObra ? obrasDaPessoa() : null;
      const abasRH = subnav([{ id: '', nome: 'Hoje', href: '#/rh' }, { id: 'efetivo', nome: 'Histórico do efetivo', href: '#/rh/efetivo' }], rota.sub === 'efetivo' ? 'efetivo' : '');
      if (rota.sub === 'efetivo') out = `<div>${abasRH}<div style="margin-top:26px">${efetivoTela.historico(CFG, estado.efetivo, rota.params, visiveisRH)}</div></div>`;
      else out = T.telaArea(efetivoTela.areaDeHoje(area, CFG, estado.efetivo, visiveisRH), `<div style="margin-bottom:34px">${abasRH}</div>`, { depoisIndicadores: efetivoTela.cartoes(CFG, estado.efetivo, visiveisRH) });
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
    else if (tela === 'equipe') out = equipeRank.render({ params: rota.params, extra: pedidos.secaoEquipe(estado.pedido.lista) });
    else if (area && area.id === 'orcamentos') out = orcamentosTela.render(CFG, estado.drive.projetos, veValores(), deObra ? obrasDaPessoa() : null);
    else if (tela === 'funcionarios') out = T.telaPessoas(estado.pessoas);
    else if (tela === 'agentes') out = T.telaAgentes();
    else if (area && area.id === 'posobra') {
      const { abas, conteudo, resumo } = telaPosObraPlanilha(rota.sub ? rota : { ...rota, sub: 'datas-os' });
      out = `<div>${abas}${conteudo}</div>`; void resumo;
    } else if (area) out = T.telaArea(area);
    else out = T.telaGeral();
    // tela antiga dentro do departamento: fica na aba "Detalhes"
    if ((dep || tela === 'geral') && !ehPainel) out = `<div class="pd">${dep ? pd.cabecalho({ resp: dep.resp }) : ''}${abasDe(`#/${dep ? dep.id : 'geral'}`, tela === 'transporte' && rota.sub === 'rotas' ? 'rotas' : 'detalhe')}<div class="pd-legado">${out}</div></div>`;
  } catch (e) {
    console.error(e);
    out = `<div class="erro">Erro ao montar esta tela: ${esc(e.message)}</div>`;
  }
  $('#conteudo').innerHTML = out;   // (o setter de #conteudo, logo abaixo de estado, evita redesenhar à toa e piscar)
  ordenar.aplicar();   // tabelas ordenáveis: reaplica a ordem escolhida
  ajustarAlturaFuncoes();
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
  // cadastro de obras (aba Cadastros): obras em andamento ou pausadas entram; as finalizadas saem
  const cad = estado.obrasCad || [];
  const fin = new Set(cad.filter((c) => c.situacao === 'finalizada').map((c) => c.codigo));
  const naoFechadas = new Set(cad.filter((c) => c.situacao === 'nao_fechado').map((c) => c.codigo));
  const plan = CFG ? ((CFG.areas.find((a) => a.id === 'planejamento') || {}).porObra || []) : [];
  const base = CFG ? [...plan.map((o) => o.obra), ...(CFG.obras || []).filter((o) => /^(Mo|Po)/i.test(o))] : [];
  if (!CFG && !cad.length) return [];
  return [...new Set([...base, ...cad.filter((c) => !['finalizada', 'orcamento', 'nao_fechado'].includes(c.situacao)).map((c) => c.codigo)])].filter((o) => !fin.has(o) && !naoFechadas.has(o));
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

// Comercial e Orçamentos são áreas separadas (21/10): "Comercial" fica com o resumo das propostas e as arquiteturas;
// "Orçamentos" mostra o orçamento (escopo e aditivos) das obras em andamento. Só entra no menu de quem tem essa aba liberada.
function separarOrcamentos(cfg) {
  const i = cfg.areas.findIndex((a) => a.id === 'comercial');
  if (i >= 0) cfg.areas[i] = { ...cfg.areas[i], nome: 'Comercial' };
  if (i < 0 || cfg.areas.some((a) => a.id === 'orcamentos')) return;
  cfg.areas.splice(i + 1, 0, { id: 'orcamentos', nome: 'ORC Obras Novas', status: 'ok', resumo: '', kpis: [], alertas: [], processos: [], instrucoes: '', frequencia: '',
    fontes: [{ nome: 'Drive', via: 'GERENCIAMENTO > DOC > ESCOPO de cada obra em andamento (escopo e aditivos)', ultima: '—' }] });
}

async function atualizar() {
  if (nuvem.NA_NUVEM && logado()) escritorio.presencaDeFundo();   // aparece no escritório virtual enquanto o sistema estiver aberto
  // marcações de tarefas de todos (pontuação do Perfil); quem está logado manda o que só tinha neste navegador
  const atual = logado() ? { pessoa: idPessoa(), nome: sessao().nome, funcao: funcaoAtual().id, teste: simulando(), obras: obrasDaPessoa() } : null;
  if (nuvem.NA_NUVEM && logado()) { try { aplicarAbas(await nuvem.carregarAbas()); } catch { /* sem a tabela: fica o padrão de cada função */ } }
  if (nuvem.NA_NUVEM && logado()) { try { estado.obrasCad = await nuvem.listarObras(); } catch { /* sem o cadastro: ficam só as obras dos dados */ }
    try { aplicarSetores(await nuvem.listarSetores()); atas.atualizarSetoresAta(); } catch { /* sem a tabela de setores: fica a lista padrão */ }
    try { await carregarConfig(); } catch { /* sem a tabela de configurações: vale o padrão do código */ } }
  const [painelR, baseR, prodR, driveR, , , , , ferrR, terR, , efR] = await Promise.allSettled([carregarPainel(), carregarDados(), carregarProdutividade(), carregarDrive(), sincronizarTarefas(atual), perfil.carregarFotos(), feed.carregar(), evidencias.carregar(), carregarFerramentasChk(), carregarTerceirizados(), atas.carregar(), carregarEfetivo(), sincronizarHorarios(logado() ? idPessoa() : null)]);
  if (efR.status === 'fulfilled') estado.efetivo = efR.value;
  if (terR.status === 'fulfilled') estado.terceiros = terR.value;
  if (ferrR.status === 'fulfilled') estado.ferrChk = ferrR.value;
  if (prodR.status === 'fulfilled') estado.whats = prodR.value;
  try { estado.equipeProg = await carregarEquipeProg(); } catch { /* sem a distribuição */ }
  try { estado.rotas = await carregarRotas(); } catch { estado.rotas = { semanas: [] }; }
  try { estado.mc = await carregarMedicoesMC(); } catch { /* ainda sem a leitura da medição no Mais Controle */ }
  if (driveR.status === 'fulfilled') estado.drive = driveR.value;
  if (painelR.status === 'fulfilled') {
    const env = painelR.value;
    const cfg = normalizar(env.dados);
    if (cfg) { separarProjetos(cfg); separarOrcamentos(cfg); estado.cfg = cfg; }
    estado.sync = { origem: env.origem, atualizado: env.atualizado, erro: env.erro || (cfg ? null : 'O dados.json não tem "geral" e "areas".') };
  } else {
    estado.sync = { ...estado.sync, erro: painelR.reason.message };
  }
  // produtividade do WhatsApp vai junto com o painel: as telas leem tudo do mesmo lugar (CFG)
  if (estado.cfg) estado.cfg.whats = (estado.whats && estado.whats.registros) || [];
  if (estado.cfg) estado.cfg.metasSemanais = (estado.whats && estado.whats.metasSemanais) || null;
  // Projetos: o status também sai da verificação das pastas (projeto faltando, as-built parado)
  const areaProj = estado.cfg && estado.cfg.areas.find((a) => a.id === 'projetos');
  const stProj = areaProj && projetos.statusProjetos(estado.cfg, estado.drive.projetos);
  const ORDEM_ST = ['ok', 'pendente', 'atencao', 'critico'];
  if (stProj && ORDEM_ST.indexOf(stProj) > ORDEM_ST.indexOf(areaProj.status)) areaProj.status = stProj;
  if (baseR.status === 'fulfilled') {
    estado.dadosBase = baseR.value;
    await Promise.all([svPos.carregar(), obrasPos.carregar()]);
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
    location.hash = soMinhasFuncoes(funcaoPorId(funcao)) ? '#/funcoes' : (funcaoPorId(funcao).semMinhaSemana ? '#/geral' : '#/meudia');
    desenhar();
  });
  $('#login').addEventListener('click', async (e) => {
    const m = e.target.closest('[data-login-modo]');
    if (m) { if (m.dataset.loginModo === 'sair') { await nuvem.sair(); } estado.loginNuvem = { modo: m.dataset.loginModo === 'sair' ? 'entrar' : m.dataset.loginModo }; mostrarLogin(); return; }
    if (e.target.closest('[data-login-recarregar]')) { await nuvem.carregarPerfil(); desenhar(); atualizar(); }
  });
  ajustarMenuRecolhivel();
  $('#bSair').addEventListener('click', async () => {
    escritorio.pararPresencaDeFundo();
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
    try { await nuvem.criarLogin({ usuario, nome, funcao, obras, senha }); estado.acessosAviso = { titulo: `Login criado para ${nome}`, usuario, senha }; await sincronizarCadastros({ forcar: true }); }
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
  // o corpo da página nunca rola (quem rola é o menu e o conteúdo): se o foco de um campo escondido empurrar o corpo, volta ao topo
  document.addEventListener('focusin', () => { requestAnimationFrame(() => { for (const el of [document.body, document.documentElement]) if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; } }); });
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
    try { await nuvem.excluirLogin(id); estado.acessosMsg = `Login de ${nome} excluído.`; await sincronizarCadastros({ forcar: true }); }
    catch (err) { alert(`Não foi possível excluir (${err.message || err}).`); }
  });
  // Setores (departamentos): criar e excluir; aparecem na hora em atas, pendências, tarefas e acessos
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('#set-novo'); if (!f) return;
    e.preventDefault(); const nome = String(new FormData(f).get('nome') || '').trim();
    if (!nome) return;
    if (SETORES_ORGANOGRAMA.some((s) => s.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'))) { alert('Este setor já existe.'); return; }
    try { await nuvem.criarSetor(nome); estado.acessosMsg = `Setor ${nome} criado.`; await sincronizarCadastros({ forcar: true }); }
    catch (err) { alert(`Não foi possível criar o setor (${err.message || err}).`); }
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-excluir-setor]'); if (!b) return;
    const nome = b.dataset.excluirSetor;
    if (!confirm(`Excluir o setor "${nome}"? Ele sai das listas; as atas e pendências que já usam esse nome continuam como estão.`)) return;
    try { await nuvem.excluirSetor(nome); estado.acessosMsg = `Setor ${nome} excluído.`; await sincronizarCadastros({ forcar: true }); }
    catch (err) { alert(`Não foi possível excluir o setor (${err.message || err}).`); }
  });
  // Cadastro de obras: incluir, mudar a situação (andamento · pausada · finalizada) e excluir
  const codigoObra = (txt) => { const s = String(txt || '').trim().replace(/\s+/g, ''); const m = s.match(/^(mo|po)(\d+.*)$/i); return m ? `${m[1][0].toUpperCase()}${m[1][1].toLowerCase()}${m[2]}` : s; };
  // Situação da obra no topo da página da obra (sócios e coordenação de operações)
  document.addEventListener('change', async (e) => {
    const sel = e.target.closest && e.target.closest('[data-situacao-obra]'); if (!sel) return;
    const codigo = sel.dataset.situacaoObra; const situacao = sel.value;
    if (!nuvem.NA_NUVEM) { alert('Mudar a situação da obra só funciona no sistema na nuvem (com login).'); desenhar(); return; }
    try {
      const cad = (estado.obrasCad || []).find((o) => o.codigo === codigo);
      await nuvem.salvarObra({ codigo, nome: (cad && cad.nome) || '', situacao });
      await sincronizarCadastros({ forcar: true });
    } catch (err) { alert(`Não foi possível mudar a situação da obra (${err.message || err}).`); desenhar(); }
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('#ob-novo, [data-obra-cad]'); if (!f) return;
    e.preventDefault();
    const fd = new FormData(f);
    const codigo = f.id === 'ob-novo' ? codigoObra(fd.get('codigo')) : f.dataset.obraCad;
    if (!codigo) { alert('Digite o código da obra (ex.: Mo565).'); return; }
    try { await nuvem.salvarObra({ codigo, nome: String(fd.get('nome') || '').trim(), situacao: fd.get('situacao') || 'andamento' }); estado.acessosMsg = `Obra ${codigo} salva.`; await sincronizarCadastros({ forcar: true }); }
    catch (err) { alert(`Não foi possível salvar a obra (${err.message || err}).`); }
  });
  // "+ Nova obra em orçamento…" na caixinha de obra: o setor ORC Obras Novas (e a diretoria) cria a obra na hora; ela só aparece para eles
  document.addEventListener('change', async (e) => {
    const sel = e.target.closest && e.target.closest('select'); if (!sel || !['__nova_orc__', '__novo_po__'].includes(sel.value)) return;
    const ehPos = sel.value === '__novo_po__'; let codigo; let nomeObra = '';
    if (ehPos) { nomeObra = (prompt('Nome do pós-obra (ex.: Sogra do Thiago):') || '').trim(); if (!nomeObra) { sel.value = ''; return; } codigo = `PO - ${nomeObra}`; }
    else { codigo = atas.normalizarCodigoObra(prompt('Código da obra em orçamento (ex.: Mo461):') || ''); if (!codigo) { sel.value = ''; return; } if (!/^mo\d/i.test(codigo)) { alert('O código da obra começa com Mo e o número (ex.: Mo461).'); sel.value = ''; return; } nomeObra = (prompt('Nome da obra (opcional, ex.: Sinagoga Leblon):') || '').trim(); }
    try {
      await nuvem.salvarObra({ codigo, nome: nomeObra, situacao: 'orcamento' });
      await sincronizarCadastros({ forcar: true });
      atas.definirObrasOrcamento(cadastroEmOrcamento(), nomesDasObras());
      const rotulo = ehPos ? 'Pós-obras' : 'Obras em orçamento';
      const g = [...sel.querySelectorAll('optgroup')].find((x) => x.label === rotulo) || Object.assign(document.createElement('optgroup'), { label: rotulo });
      if (!g.parentNode) sel.insertBefore(g, sel.querySelector('optgroup[label="Novo"]'));
      if (![...sel.options].some((o) => o.value === codigo)) { const op = document.createElement('option'); op.value = codigo; op.textContent = codigo; g.appendChild(op); }
      sel.value = codigo;
    } catch (err) { sel.value = ''; alert(`Não foi possível criar (${err.message || err}).`); }
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest && e.target.closest('#obo-novo, [data-obraorc]'); if (!f) return;
    e.preventDefault(); const fd = new FormData(f);
    try {
      let codigo; let nome = String(fd.get('nome') || '').trim();
      if (f.id === 'obo-novo') {
        if (fd.get('tipo') === 'pos') codigo = `PO - ${nome}`;
        else { codigo = atas.normalizarCodigoObra(fd.get('codigo')); if (!/^mo\d/i.test(codigo)) { alert('Informe o código da obra, começando com Mo (ex.: Mo461).'); return; } }
        estado.obraOrcMsg = `${codigo} cadastrada em orçamento.`;
      } else { codigo = f.dataset.obraorc; estado.obraOrcMsg = 'Salvo ✓'; }
      await nuvem.salvarObra({ codigo, nome, situacao: f.id === 'obo-novo' ? 'orcamento' : String(fd.get('situacao') || 'orcamento') });
      await sincronizarCadastros({ forcar: true });
    } catch (err) { alert(`Não foi possível salvar (${err.message || err}).`); }
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest && e.target.closest('[data-excluir-obraorc]'); if (!b) return;
    const codigo = b.dataset.excluirObraorc; if (!confirm(`Tirar ${codigo} da lista de obras em orçamento?`)) return;
    try { await nuvem.excluirObra(codigo); estado.obraOrcMsg = `${codigo} removida.`; await sincronizarCadastros({ forcar: true }); } catch (err) { alert(`Não foi possível excluir (${err.message || err}).`); }
  });
  // a lista de obras do Cadastro lembra se estava aberta (para não fechar ao salvar uma obra)
  document.addEventListener('toggle', (e) => { if (e.target.matches && e.target.matches('.ac-lista-obras')) estado.listaObrasAberta = e.target.open; }, true);
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-excluir-obra]'); if (!b) return;
    const codigo = b.dataset.excluirObra;
    if (!confirm(`Tirar a obra ${codigo} do cadastro? (Para só encerrar, mude a situação para "finalizada".)`)) return;
    try { await nuvem.excluirObra(codigo); estado.acessosMsg = `Obra ${codigo} removida do cadastro.`; await sincronizarCadastros({ forcar: true }); }
    catch (err) { alert(`Não foi possível remover (${err.message || err}).`); }
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
    try { await nuvem.salvarPerfil(f.dataset.acesso, { funcao, obras, setores: fd.getAll('setores') }); estado.acessosMsg = 'Salvo.'; await sincronizarCadastros({ forcar: true }); }
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
    if (!['pf-foto-input', 'pf-foto-input2', 'nav-foto-input'].includes(e.target.id) || !e.target.files || !e.target.files[0]) return;
    const msg = $('#pf-foto-msg'); if (msg) msg.textContent = ' enviando…';
    try { await perfil.enviarFoto(sessao().nome, e.target.files[0]); desenhar(); }
    catch (err) { if (msg) msg.textContent = ` não foi possível salvar a foto (${err.message || err})`; }
  });
  // clicar na foto do menu abre a escolha de imagem (todo mundo troca a própria foto)
  document.addEventListener('click', (e) => {
    const f = e.target.closest && e.target.closest('[data-nav-foto]'); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    let inp = document.getElementById('nav-foto-input');
    if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'nav-foto-input'; inp.hidden = true; document.body.appendChild(inp); }
    inp.value = ''; inp.click();
  }, true);
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

// ---------------------------------------------------------------- Pós-obra › Quadro de OS e Datas das OS
let osqArrastando = null;
const osqFazer = async (fn, { depois = null } = {}) => {
  try { await fn(); try { await atas.carregar(); } catch { /* sem as tarefas: segue */ } desenhar(); if (depois) depois(); } catch (err) { alert(`Não foi possível mexer na OS (${err.message || err}).`); }
};
function osqAbrir(html, classe = '') {
  let m = document.getElementById('at-modal');
  if (!m) { m = document.createElement('div'); m.id = 'at-modal'; m.className = 'at-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="at-modal-caixa ${classe}">${String(html)}</div>`;
}
const osqDetalhe = (id, msg = '') => osqAbrir(osq.detalhe(id, { podeEditar: podeEditarPos(), clientesPos: posObrasAtivas(), msg }), 'osq-caixa');
// Controle de obras do pós-obra: responsável e prazo da OS direto na linha (viram a tarefa da pessoa) e "+ Nova OS" dentro do PO
document.addEventListener('change', (e) => {
  const r = e.target.closest && e.target.closest('[data-pc-resp]');
  if (r) { osqFazer(() => osq.salvar(Number(r.dataset.pcResp) || r.dataset.pcResp, { responsavel: r.value || null })); return; }
  const p = e.target.closest && e.target.closest('[data-pc-prazo]');
  if (p) osqFazer(() => osq.salvar(Number(p.dataset.pcPrazo) || p.dataset.pcPrazo, { data_limite: p.value || null }));
});
const pcCriarOs = (botao) => {
  const campo = botao.parentElement.querySelector('[data-pc-nova-texto]'); const assunto = campo ? campo.value.trim() : '';
  if (!assunto) { if (campo) campo.focus(); return; }
  osqFazer(() => osq.criar({ cliente: botao.dataset.pcNova, assunto, status: 'solicitacao' }));
};
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-pc-nova]'); if (b) pcCriarOs(b); });
document.addEventListener('keydown', (e) => { if (e.key !== 'Enter' || !e.target.matches || !e.target.matches('[data-pc-nova-texto]')) return; e.preventDefault(); const b = e.target.parentElement.querySelector('[data-pc-nova]'); if (b) pcCriarOs(b); });
document.addEventListener('click', (e) => {
  const nova = e.target.closest && e.target.closest('[data-osq-nova]');
  if (nova) { osqAbrir(osq.formNova(nova.dataset.osqNova, posObrasAtivas())); const c = document.querySelector('#osq-form-nova [name="cliente"]'); if (c) c.focus(); return; }
  const c = e.target.closest && e.target.closest('[data-osq]');
  if (c) { if (c.dataset.arrastou) return; e.preventDefault(); osqDetalhe(c.dataset.osq); }
});
document.addEventListener('dragstart', (e) => {
  const c = e.target.closest && e.target.closest('.osq-card[data-osq]'); if (!c) return;
  osqArrastando = c.dataset.osq; c.dataset.arrastou = '1';
  try { e.dataTransfer.setData('text/plain', 'osq:' + osqArrastando); e.dataTransfer.effectAllowed = 'move'; } catch { /* sem dataTransfer */ }
});
document.addEventListener('dragend', (e) => { const c = e.target.closest && e.target.closest('.osq-card[data-osq]'); if (c) setTimeout(() => { delete c.dataset.arrastou; }, 50); document.querySelectorAll('.tf-sobre').forEach((x) => x.classList.remove('tf-sobre')); osqArrastando = null; });
document.addEventListener('dragover', (e) => { const col = e.target.closest && e.target.closest('[data-osq-col]'); if (!col || !osqArrastando) return; e.preventDefault(); col.classList.add('tf-sobre'); });
document.addEventListener('dragleave', (e) => { const col = e.target.closest && e.target.closest('[data-osq-col]'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('tf-sobre'); });
document.addEventListener('drop', (e) => {
  const col = e.target.closest && e.target.closest('[data-osq-col]'); if (!col || !osqArrastando) return;
  e.preventDefault(); col.classList.remove('tf-sobre'); const id = osqArrastando; osqArrastando = null;
  const o = osq.porIdOs(id); if (o && o.status !== col.dataset.osqCol) osqFazer(() => osq.mover(o.id, col.dataset.osqCol));
});
document.addEventListener('submit', (e) => {
  const nf = e.target.closest && e.target.closest('#osq-form-nova');
  if (nf) {
    e.preventDefault(); const fd = new FormData(nf);
    osqFazer(() => osq.criar({ cliente: fd.get('cliente'), assunto: fd.get('assunto'), status: nf.dataset.status }), { depois: () => { const m = document.getElementById('at-modal'); if (m) m.remove(); } });
    return;
  }
  const f = e.target.closest && e.target.closest('#osq-form');
  if (f) {
    e.preventDefault(); const fd = new FormData(f); const id = f.dataset.osqForm;
    const campos = { cliente: String(fd.get('cliente') || '').trim(), assunto: String(fd.get('assunto') || '').trim(), status: fd.get('status'), problema: fd.get('problema') || null, solucao: fd.get('solucao') || null };
    if (fd.has('responsavel')) { campos.responsavel = fd.get('responsavel') || null; campos.data_limite = fd.get('data_limite') || null; }
    osqFazer(() => osq.salvar(Number(id) || id, campos), { depois: () => osqDetalhe(id, 'Salvo ✓') });
  }
});
document.addEventListener('change', (e) => {
  const d = e.target.closest && e.target.closest('[data-osq-data]');
  if (d) { const [id, campo] = d.dataset.osqData.split('|'); osqFazer(() => osq.salvar(Number(id) || id, { [campo]: d.value || null })); return; }
  const fo = e.target.closest && e.target.closest('[data-osq-foto]');
  if (fo) { const id = fo.dataset.osqFoto; const arqs = [...fo.files]; osqFazer(async () => { for (const a of arqs) await osq.adicionarFoto(id, a); }, { depois: () => osqDetalhe(id) }); }
});
document.addEventListener('click', (e) => {
  const ft = e.target.closest && e.target.closest('[data-osq-foto-del]');
  if (ft) { const [id, i] = ft.dataset.osqFotoDel.split('|'); osqFazer(() => osq.tirarFoto(id, Number(i)), { depois: () => osqDetalhe(id) }); return; }
  const del = e.target.closest && e.target.closest('[data-osq-del]');
  if (del && confirm('Excluir esta OS? Não dá para desfazer.')) osqFazer(() => osq.apagar(del.dataset.osqDel), { depois: () => { const m = document.getElementById('at-modal'); if (m) m.remove(); } });
});

document.addEventListener('click', (e) => {   // RH › Programado × realizado: trocar a semana
  const b = e.target.closest('[data-ep-sem]'); if (!b) return;
  mudarSemanaEP(Number(b.dataset.epSem)); desenhar();
});

configurar();
movimentacao.ligar(() => desenhar());
contagem.ligar(() => desenhar());
celularObra.ligar(() => desenhar());   // celular da obra: executado do dia, efetivo e diário
if (nuvem.NA_NUVEM) {
  // link de 'esqueci a senha' volta com a sessão de recuperação: pede a senha nova
  await nuvem.carregarPerfil();
}
desenhar();
atualizar();
setInterval(atualizar, ATUALIZAR_A_CADA_MS);

// Quadro da semana › Funções: arrastar, redimensionar e abrir os cartões
// Pós-obra: completar os dados de uma obra, abrir/recolher a lista, e escolher quais obras aparecem na agenda da semana
const apExtrasTodos = () => { try { return JSON.parse(localStorage.getItem('solida.apExtras')) || {}; } catch { return {}; } };
const apExtras = () => apExtrasTodos()[estado.posAgenda.semana] || [];
const apExtrasGravar = (lista) => { const t = apExtrasTodos(); t[estado.posAgenda.semana] = lista; try { localStorage.setItem('solida.apExtras', JSON.stringify(t)); } catch { /* sem armazenamento */ } };
document.addEventListener('change', (e) => {
  const s = e.target.closest && e.target.closest('[data-ap-mais]'); if (!s || !s.value) return;
  apExtrasGravar([...new Set([...apExtras(), s.value])]); desenhar();
});
document.addEventListener('click', (e) => {
  const tirar = e.target.closest && e.target.closest('[data-ap-tirar-obra]'); if (tirar) { apExtrasGravar(apExtras().filter((o) => o !== tirar.dataset.apTirarObra)); desenhar(); return; }
  const todos = e.target.closest && e.target.closest('[data-po-todos]'); if (todos) { document.querySelectorAll('.pl-obra').forEach((d) => { d.open = todos.dataset.poTodos === 'abrir'; }); return; }
  const ed = e.target.closest && e.target.closest('[data-po-editar]');
  if (ed) {
    e.preventDefault(); const o = estado.base && estado.base.obraPorNome.get(ed.dataset.poEditar); if (!o) return;
    const antigo = document.getElementById('at-modal'); if (antigo) antigo.remove();
    const m = document.createElement('div'); m.id = 'at-modal'; m.className = 'at-modal'; m.innerHTML = `<div class="at-modal-caixa">${String(posGeral.formObra(o))}</div>`; document.body.appendChild(m);
  }
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest && e.target.closest('#ob-form'); if (!f) return;
  e.preventDefault(); const fd = new FormData(f);
  try {
    await obrasPos.salvar({ obra: f.dataset.obra, apelido: String(fd.get('apelido') || '').trim() || null, cliente: String(fd.get('cliente') || '').trim() || null, endereco: String(fd.get('endereco') || '').trim() || null, responsavel: String(fd.get('responsavel') || '').trim() || null });
    reconstruirBase(); const m = document.getElementById('at-modal'); if (m) m.remove(); desenhar();
  } catch (err) { alert(`Não foi possível salvar (${err.message || err}).`); }
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
// OS do pós-obra: prazo clicável (calendário com feriados), fase, nova pendência da OS e atualizações (anotações)
document.addEventListener('click', (e) => {
  const pz = e.target.closest && e.target.closest('[data-os-prazo]');
  if (pz) {
    const s = svPorOs(pz.dataset.osPrazo); if (!s) return;
    abrirCalendario({ ancora: pz, valor: /^\d{4}/.test(s.prazo || '') ? s.prazo : '', aoEscolher: (novo) => svFazer(() => svPos.reprogramarPrazo(s, novo)) });
    return;
  }
  const np = e.target.closest && e.target.closest('[data-os-pend]');
  if (np) {
    const antigo = document.getElementById('at-modal'); if (antigo) antigo.remove();
    const m = document.createElement('div'); m.id = 'at-modal'; m.className = 'at-modal';
    m.innerHTML = `<div class="at-modal-caixa">${String(atas.formAvulsa(obrasDeAtas(), '', 'Pós-obra', { obra: np.dataset.osObra, os: np.dataset.osPend }))}</div>`; document.body.appendChild(m);
    const campo = m.querySelector('[name="p_assunto"]'); if (campo) campo.focus();
  }
});
document.addEventListener('change', (e) => {
  const sel = e.target.closest && e.target.closest('[data-os-fase]'); if (!sel || !sel.value) return;
  const s = svPorOs(sel.dataset.osFase); if (s && s.situacao !== sel.value) svFazer(() => svPos.mudarFase(s, sel.value));
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest && e.target.closest('#os-nota'); if (!f) return;
  e.preventDefault(); const texto = String(new FormData(f).get('texto') || '').trim(); if (!texto) return;
  svFazer(() => svPos.nota(f.dataset.os, texto));
});
// Treinamentos com slides: abrir a apresentação do subtópico
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-trein-slides]'); if (b) tvSlides.abrir(b.dataset.treinSlides, 0, () => desenhar()); });

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
agendaSemana.instalarTarefasNaGrade(async (id, mud) => { try { let esc = 'uma'; if (atas.ehRecorrente(id)) { esc = await perguntarEscopo('Mudar tarefa recorrente'); if (!esc) { desenhar(); return; } } await atas.definirHorarioTarefa(id, mud, esc); } catch (err) { alert(`Não foi possível mudar o horário (${err.message || err}).`); } desenhar(); });
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
// "Criar tarefa" nos painéis (Quem precisa agir): o alerta vira pendência, já com o texto, a obra e o setor
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-criar-tarefa]'); if (!b) return;
  const antigo = document.getElementById('at-modal'); if (antigo) antigo.remove();
  const m = document.createElement('div'); m.id = 'at-modal'; m.className = 'at-modal';
  const texto = b.dataset.ctTexto || '';
  const assunto = (texto.match(/^([^:—–-]{3,40})[:—–-]/) || [])[1] || (b.dataset.ctObra || '');
  m.innerHTML = `<div class="at-modal-caixa">${String(atas.formAvulsa(obrasDeAtas(), b.dataset.ctPrazo || '', b.dataset.ctSetor || '', { obra: b.dataset.ctObra || '', desc: texto, assunto: assunto.trim() }))}</div>`;
  document.body.appendChild(m); const campo = m.querySelector('[name="p_resp"]'); if (campo) campo.focus();
});
// ---------------------------------------------------------------- detalhes da tarefa (cartão clicado, em Tarefas ou na Agenda) e arrastar para mudar o prazo
async function abrirTarefa(id, msg = '') {
  let m = document.getElementById('at-modal');
  if (!m) { m = document.createElement('div'); m.id = 'at-modal'; m.className = 'at-modal'; document.body.appendChild(m); }
  const antes = m.querySelector('.tf-notas'); const rolagem = antes ? antes.scrollTop : 0;
  m.innerHTML = `<div class="at-modal-caixa tf-caixa">${String(atas.detalheTarefa(id, { msg }))}</div>`;
  const notas = m.querySelector('.tf-notas'); if (notas) notas.scrollTop = rolagem || notas.scrollHeight;
}
async function abrirTarefaComNotas(id) {
  await abrirTarefa(id);
  try { await atas.carregarNotas(id); await abrirTarefa(id); const n = document.querySelector('.tf-notas'); if (n) n.scrollTop = n.scrollHeight; } catch (e) { /* sem a tabela de notas: abre sem o chat */ }
}
// Concluir exige a função da tarefa: abre a janelinha, grava a função e só então conclui
let aposFuncao = null;
function pedirFuncao(id, depois) {
  aposFuncao = depois;
  let m = document.getElementById('at-modal');
  if (!m) { m = document.createElement('div'); m.id = 'at-modal'; m.className = 'at-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="at-modal-caixa">${String(atas.formFuncaoConcluir(id))}</div>`;
  const s = m.querySelector('select'); if (s) s.focus();
}
document.addEventListener('submit', async (e) => {
  const f = e.target.closest && e.target.closest('#fn-conc'); if (!f) return;
  e.preventDefault(); const id = f.dataset.id; const funcao = String(new FormData(f).get('funcao') || '');
  if (!funcao) { alert('Escolha a função (ou "Fora da função").'); return; }
  try {
    await atas.definirFuncaoTarefa(id, funcao); await atas.mudarStatus(id, 'feita');
    const m = document.getElementById('at-modal'); if (m) m.remove();
    const f2 = aposFuncao; aposFuncao = null; if (f2) await f2(); else desenhar();
  } catch (err) { alert(`Não foi possível concluir (${err.message || err}).`); }
});
const redesenharTarefas = async (id, msg) => { await atas.carregar(); desenhar(); if (id && document.getElementById('at-modal')) await abrirTarefa(id, msg); };

document.addEventListener('click', (e) => {
  const card = e.target.closest && e.target.closest('[data-tarefa]'); if (!card) return;
  const dentro = e.target.closest('button, a, input, select, textarea, summary');
  if (dentro && dentro !== card) return;   // botões e links do próprio cartão (concluir, reprogramar, ata…) continuam funcionando
  if (card.dataset.arrastou) { delete card.dataset.arrastou; return; }
  e.preventDefault();
  abrirTarefaComNotas(card.dataset.tarefa);
});
document.addEventListener('change', (e) => {
  const sel = e.target.closest && e.target.closest('[data-tf-resp]'); if (!sel) return;
  const ext = sel.closest('#tf-form').querySelector('.tf-ext'); if (ext) ext.hidden = sel.value !== 'ext';
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest && e.target.closest('#tf-form'); if (!f) return;
  e.preventDefault(); const fd = new FormData(f); const id = f.dataset.tf;
  try {
    let escopo = 'uma'; if (atas.ehRecorrente(id)) { escopo = await perguntarEscopo('Salvar tarefa recorrente'); if (!escopo) return; }
    await atas.salvarTarefa(id, { escopo, recorrente: fd.has('t_recor'), frequencia: String(fd.get('t_freq') || 'semanal'), hora: fd.get('t_hora'), duracao: fd.get('t_dur'), observadores: fd.getAll('t_obs'), funcaoTarefa: fd.get('t_func'), urgencia: fd.get('t_urg'), assunto: fd.get('t_assunto'), desc: fd.get('t_desc'), resp: fd.get('t_resp'), tipo: fd.get('t_tipo'), nome: fd.get('t_nome'), gestor: fd.get('t_gestor'), prazo: fd.get('t_prazo') });
    await redesenharTarefas(id, 'Salvo ✓');
  } catch (err) { alert(`Não foi possível salvar (${err.message || err}).`); }
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest && e.target.closest('#tf-nota'); if (!f) return;
  e.preventDefault(); const t = String(new FormData(f).get('t_nota') || '').trim(); if (!t) return;
  try { await atas.anotar(f.dataset.tfNota, t); await abrirTarefa(f.dataset.tfNota); const n = document.querySelector('.tf-notas'); if (n) n.scrollTop = n.scrollHeight; }
  catch (err) { alert(`Não foi possível anotar (${err.message || err}).`); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.matches && e.target.matches('#tf-nota textarea')) { e.preventDefault(); e.target.form.requestSubmit(); }
});
document.addEventListener('click', async (e) => {
  const st = e.target.closest && e.target.closest('[data-tf-status]');
  if (st) { const [id, status] = st.dataset.tfStatus.split('|'); if (status === 'feita' && atas.precisaFuncao(id)) { pedirFuncao(id, () => redesenharTarefas(id, 'Concluída ✓')); return; } try { await atas.mudarStatus(id, status); await redesenharTarefas(id, status === 'feita' ? 'Concluída ✓' : 'Reaberta'); } catch (err) { alert(`Não foi possível mudar (${err.message || err}).`); } return; }
  const dup = e.target.closest && e.target.closest('[data-tf-dup]');
  if (dup) {
    dup.disabled = true;
    try { const novo = await atas.duplicarTarefa(dup.dataset.tfDup); await redesenharTarefas(novo, 'Cópia criada ✓ — ajuste o que precisar e salve'); }
    catch (err) { dup.disabled = false; alert(`Não foi possível duplicar (${err.message || err}).`); }
    return;
  }
  const del = e.target.closest && e.target.closest('[data-tf-del]');
  if (del) {
    const p = atas.pendenciaPorId(del.dataset.tfDel);
    let esc = 'uma';
    if (p && p.serie && !p.ata_id) { esc = await perguntarEscopo('Excluir tarefa recorrente'); if (!esc) return; }
    else if (!confirm(p && p.ata_id ? 'Tirar esta tarefa da lista? O item continua na ata.' : 'Excluir esta tarefa? Não dá para desfazer.')) return;
    try { await atas.apagarPendencia(del.dataset.tfDel, esc); const m = document.getElementById('at-modal'); if (m) m.remove(); await redesenharTarefas(); } catch (err) { alert(`Não foi possível excluir (${err.message || err}).`); }
    return;
  }
  const nd = e.target.closest && e.target.closest('[data-tf-nota-del]');
  if (nd) { const [nid, pid] = nd.dataset.tfNotaDel.split('|'); if (!confirm('Apagar esta anotação?')) return; try { await atas.apagarNota(nid, pid); await abrirTarefa(pid); } catch (err) { alert(`Não foi possível apagar (${err.message || err}).`); } }
});

// arrastar: o cartão vai para outra coluna do quadro de Tarefas ou para outro dia da Agenda e o prazo muda
let arrastandoId = null;
document.addEventListener('dragstart', (e) => {
  const c = e.target.closest && e.target.closest('[data-tarefa]'); if (!c) return;
  arrastandoId = c.dataset.tarefa; c.classList.add('tf-arrastando'); c.dataset.arrastou = '1';
  try { e.dataTransfer.setData('text/plain', arrastandoId); e.dataTransfer.effectAllowed = 'move'; } catch { /* navegador sem dataTransfer */ }
});
document.addEventListener('dragend', (e) => {
  const c = e.target.closest && e.target.closest('[data-tarefa]'); if (c) { c.classList.remove('tf-arrastando'); setTimeout(() => { delete c.dataset.arrastou; }, 50); }
  document.querySelectorAll('.tf-sobre').forEach((x) => x.classList.remove('tf-sobre')); arrastandoId = null;
});
const alvoDoArraste = (e) => e.target.closest && e.target.closest('.at-col[data-col], [data-ag-dia]');
document.addEventListener('dragover', (e) => { const a = alvoDoArraste(e); if (!a || !arrastandoId) return; e.preventDefault(); document.querySelectorAll('.tf-sobre').forEach((x) => { if (x !== a) x.classList.remove('tf-sobre'); }); a.classList.add('tf-sobre'); });
document.addEventListener('drop', async (e) => {
  const a = alvoDoArraste(e); if (!a || !arrastandoId) return;
  e.preventDefault(); const id = arrastandoId; arrastandoId = null; a.classList.remove('tf-sobre');
  try {
    if (a.dataset.agDia) await atas.reprogramar(id, a.dataset.agDia);
    else if (!(await atas.moverParaColuna(id, a.dataset.col))) { alert('Esta tarefa não tem um prazo anterior vencido para voltar. Arraste para outra coluna.'); return; }
    await redesenharTarefas();
  } catch (err) { alert(`Não foi possível mudar o prazo (${err.message || err}).`); }
});

document.addEventListener('click', (e) => { const a = e.target.closest && e.target.closest('[data-mva]'); if (a) { trocarQuery({ modo: a.dataset.mva === 'dia' ? 'dia' : null, dia: null }); return; } const d = e.target.closest && e.target.closest('[data-ag-dia]'); if (d) { trocarQuery({ dia: d.dataset.agDia }); return; } });
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-mv]'); if (b) trocarQuery({ modo: b.dataset.mv || null }); });
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-lt-filtro]'); if (!b) return; const [k, v] = b.dataset.ltFiltro.split('|'); trocarQuery({ [k]: v || null }); });
// Observadores da tarefa: clicar no nome da lista acrescenta; o × tira; a busca filtra a lista
document.addEventListener('click', (e) => {
  const add = e.target.closest && e.target.closest('[data-obs-add]');
  if (add) {
    const cx = add.closest('.obs'); const nome = cx.dataset.obs; const id = add.dataset.obsAdd;
    if (cx.querySelector(`[data-obs-chip="${id}"]`)) return;
    const chip = document.createElement('span'); chip.className = 'obs-chip'; chip.dataset.obsChip = id;
    chip.innerHTML = `${esc(add.dataset.obsNome)}<button type="button" data-obs-del="${esc(id)}" title="Tirar">×</button><input type="hidden" name="${esc(nome)}" value="${esc(id)}">`;
    cx.querySelector('.obs-chips').appendChild(chip); add.classList.add('on');
    return;
  }
  const del = e.target.closest && e.target.closest('[data-obs-del]');
  if (del) { const cx = del.closest('.obs'); const id = del.dataset.obsDel; const b = cx.querySelector(`[data-obs-add="${id}"]`); if (b) b.classList.remove('on'); del.closest('.obs-chip').remove(); }
});
document.addEventListener('input', (e) => {
  const q = e.target.closest && e.target.closest('[data-obs-busca]'); if (!q) return;
  const t = q.value.trim().toLocaleLowerCase('pt-BR');
  q.closest('.obs').querySelectorAll('.obs-item').forEach((b) => { b.hidden = !!t && !b.dataset.obsNome.toLocaleLowerCase('pt-BR').includes(t); });
});
// Configurações: marcar/desmarcar quem vê (salva na hora) e restaurar o padrão
document.addEventListener('click', async (e) => {
  const b = e.target.closest && e.target.closest('[data-cfg-fn]');
  if (b) {
    const [chave, fid] = b.dataset.cfgFn.split('|');
    const itens = [...b.closest('.cfg-chips').querySelectorAll('[data-cfg-fn]')].map((x) => ({ id: x.dataset.cfgFn.split('|')[1], on: x.classList.contains('on') }));
    const nova = itens.filter((x) => (x.id === fid ? !x.on : x.on)).map((x) => x.id);
    try { await definirConfig(chave, nova); estado.cfgMsg = 'Salvo ✓'; desenhar(); } catch (err) { alert(`Não foi possível salvar (${err.message || err}).`); }
    return;
  }
  const r = e.target.closest && e.target.closest('[data-cfg-reset]');
  if (r) { try { await restaurarConfig(r.dataset.cfgReset); estado.cfgMsg = 'Voltou ao padrão ✓'; desenhar(); } catch (err) { alert(`Não foi possível restaurar (${err.message || err}).`); } }
});
// Tarefa recorrente: pergunta (como no Google Agenda) se a mudança vale só para esta ou para esta e as próximas. Devolve 'uma', 'seguintes' ou null (cancelou).
function perguntarEscopo(titulo) {
  return new Promise((ok) => {
    const m = document.createElement('div'); m.className = 'esc-modal';
    m.innerHTML = `<div class="esc-caixa" role="dialog" aria-modal="true"><h3>${esc(titulo)}</h3><p>Esta tarefa se repete toda semana. O que você quer alterar?</p>
      <div class="esc-ops"><button type="button" data-esc="uma">Só esta tarefa</button><button type="button" data-esc="seguintes">Esta e as próximas</button></div>
      <div class="esc-rod"><button type="button" class="botao" data-esc="">Cancelar</button></div></div>`;
    const fim = (v) => { m.remove(); document.removeEventListener('keydown', tecla, true); ok(v || null); };
    const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fim(null); } };
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-esc]'); if (b) fim(b.dataset.esc); else if (e.target === m) fim(null); });
    document.addEventListener('keydown', tecla, true);
    document.body.appendChild(m);
  });
}
// Impressão: moldura com 0,5 cm de margem em todas as bordas, em cada folha (ver @page em estilo.css). Monta antes de imprimir e desmonta depois.
// Nome do arquivo ao salvar em PDF / imprimir: o navegador usa o título da página. Ata aberta = o nome definido quando a ata foi criada; tarefas = "Tarefas dd.mm.aaaa".
let tituloAntesDeImprimir = null;
function tituloParaImprimir() {
  const r = rotaAtual();
  if (r.tela === 'atas' && r.params.get('ata')) { const x = atas.ataPorId(r.params.get('ata')); if (x && x.titulo) return String(x.titulo); }
  const aba = r.params.get('aba');
  if ((r.tela === 'tarefas' || r.tela === 'atas') && (!aba || aba === 'pendencias')) { const d = ehData(r.params.get('dia')) ? r.params.get('dia') : hojeISO(); return `Tarefas ${d.split('-').reverse().join('.')}`; }
  return '';
}
// Ata impressa: letra pequena e, se ainda passar de uma folha, a folha encolhe para caber em 1 página (no mínimo 50%). A classe imp-ata vale só entre beforeprint e afterprint,
// assim a medida é feita com o mesmo tamanho de letra da impressão.
function ajustarAtaNaFolha() {
  const folha = document.querySelector('#conteudo .sd-folha'); if (!folha) return;
  document.body.classList.add('imp-ata');
  folha.style.zoom = ''; folha.style.width = '718px';   // largura útil da folha A4 (190 mm)
  const h = folha.getBoundingClientRect().height;
  folha.style.width = '';
  const z = Math.max(0.5, Math.min(1, 1035 / (h || 1)));
  if (z < 1) folha.style.zoom = String(z);
}
function desfazerAtaNaFolha() {
  document.body.classList.remove('imp-ata');
  const folha = document.querySelector('#conteudo .sd-folha'); if (folha) { folha.style.zoom = ''; folha.style.width = ''; }
}
window.addEventListener('beforeprint', () => {
  ajustarAtaNaFolha();
  const nomeArquivo = tituloParaImprimir(); if (nomeArquivo) { if (tituloAntesDeImprimir === null) tituloAntesDeImprimir = document.title; document.title = nomeArquivo; }
  const c = document.getElementById('conteudo'); if (!c || c.querySelector(':scope > .imp-moldura')) return;
  const t = document.createElement('table'); t.className = 'imp-moldura';
  t.innerHTML = '<thead><tr><td><div class="imp-esp"></div></td></tr></thead><tfoot><tr><td><div class="imp-esp"></div></td></tr></tfoot><tbody><tr><td></td></tr></tbody>';
  const td = t.querySelector('tbody td');
  // cabeçalho da impressão das tarefas: vai para o topo da moldura, que se repete em todas as folhas
  const cab = c.querySelector('.at-cab-imp');
  if (cab) { t._cab = { pai: cab.parentNode, prox: cab.nextSibling, el: cab }; const th = t.querySelector('thead td'); th.appendChild(cab); }
  while (c.firstChild) td.appendChild(c.firstChild);
  c.appendChild(t);
});
window.addEventListener('afterprint', () => {
  desfazerAtaNaFolha();
  if (tituloAntesDeImprimir !== null) { document.title = tituloAntesDeImprimir; tituloAntesDeImprimir = null; }
  const c = document.getElementById('conteudo'); const t = c && c.querySelector(':scope > .imp-moldura'); if (!t) return;
  const td = t.querySelector('tbody td');
  while (td.firstChild) c.insertBefore(td.firstChild, t);
  if (t._cab) { const { pai, prox, el } = t._cab; if (prox && prox.parentNode === pai) pai.insertBefore(el, prox); else if (pai && pai.isConnected) pai.appendChild(el); else c.insertBefore(el, c.firstChild); }
  t.remove();
});
// Tarefas › modo Lista: trocar o dia, passar a tarefa para o dia seguinte, abrir a tarefa, passar as pendências atrasadas
document.addEventListener('click', async (e) => {
  const d = e.target.closest && e.target.closest('[data-lt-dia]');
  if (d) { trocarQuery({ dia: d.dataset.ltDia === hojeISO() ? null : d.dataset.ltDia }); return; }
  const ab = e.target.closest && e.target.closest('[data-lt-abrir]');
  if (ab) { abrirTarefaComNotas(ab.dataset.ltAbrir); return; }
  const mv = e.target.closest && e.target.closest('[data-lt-mover]');
  if (mv) { const [id, dia] = mv.dataset.ltMover.split('|'); try { await atas.reprogramar(id, dia); desenhar(); } catch (err) { alert(`Não foi possível mudar o prazo (${err.message || err}).`); } return; }
  const ps = e.target.closest && e.target.closest('[data-lt-passar]');
  if (ps) {
    const [ids, dia] = ps.dataset.ltPassar.split('|'); const lista = ids.split(',');
    if (!confirm(`Passar ${lista.length} pendência(s) atrasada(s) para ${dia.slice(8, 10)}/${dia.slice(5, 7)}?`)) return;
    try { for (const id of lista) await atas.reprogramar(id, dia); desenhar(); } catch (err) { alert(`Não foi possível passar as pendências (${err.message || err}).`); }
  }
});
// Pautas: copiar a pauta de uma obra em texto
document.addEventListener('click', async (e) => {
  const b = e.target.closest && e.target.closest('[data-pauta-txt]'); if (!b) return;
  const g = atas.pautaPorNome(b.dataset.pautaTxt, rotaAtual().params); if (!g) return;
  const t = atas.textoDaPauta(g, rotaAtual().params.get('pauta') || '');
  try { await navigator.clipboard.writeText(t); b.textContent = 'Copiada ✓'; } catch { alert(t); }
  setTimeout(() => { b.textContent = 'Copiar pauta'; }, 2000);
});
// Reposição: filtro por categoria
document.addEventListener('click', (e) => {
  const c = e.target.closest && e.target.closest('[data-rp-cat]'); if (!c) return;
  e.preventDefault(); reposicao.alternarCategoria(c.dataset.rpCat); desenhar();
});
// nova pendência avulsa (sem ata), aberta pelo + de cada caixinha do quadro por prazo
document.addEventListener('click', (e) => {
  const nova = e.target.closest && e.target.closest('[data-av-nova]');
  if (nova) {
    const antigo = document.getElementById('at-modal'); if (antigo) antigo.remove();
    const m = document.createElement('div'); m.id = 'at-modal'; m.className = 'at-modal';
    m.innerHTML = `<div class="at-modal-caixa">${String(atas.formAvulsa(obrasDeAtas(), nova.dataset.avNova, nova.dataset.avSetor || '', { obra: nova.dataset.avObra || '', resp: nova.dataset.avResp || '' }))}</div>`;
    document.body.appendChild(m); const campo = m.querySelector('[name="p_assunto"]'); if (campo) campo.focus();
    return;
  }
  const foraDosQuadrados = e.target.classList && ((e.target.classList.contains('at-modal-caixa') && e.target.querySelector('.tf-corpo')) || e.target.classList.contains('tf') || e.target.classList.contains('tf-corpo'));   // a moldura da janela da tarefa é transparente: clicar nela é clicar fora
  if ((e.target.closest && e.target.closest('[data-av-fechar]')) || (e.target.id === 'at-modal') || foraDosQuadrados) { const m = document.getElementById('at-modal'); if (m) m.remove(); }
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
  if (st) { const [id, status] = st.dataset.pend.split('|'); if (status === 'feita' && atas.precisaFuncao(id)) { e.preventDefault(); desenhar(); pedirFuncao(id, () => desenhar()); return; } try { await atas.mudarStatus(id, status); desenhar(); } catch (err) { alert(`Não foi possível (${err.message || err}). Só quem é o responsável, quem criou ou a diretoria pode mudar.`); } return; }
  const pd = e.target.closest('[data-pend-del]');
  if (pd) {
    const dePendencia = atas.pendenciaPorId(pd.dataset.pendDel);
    const daAta = dePendencia && dePendencia.ata_id;
    let esc = 'uma';
    if (dePendencia && dePendencia.serie && !daAta) { esc = await perguntarEscopo('Excluir tarefa recorrente'); if (!esc) return; }
    else if (!confirm(daAta ? 'Tirar esta pendência da sua lista de pendências? O item continua na ata, que não muda.' : 'Excluir esta pendência?')) return;
    try { await atas.apagarPendencia(pd.dataset.pendDel, esc); desenhar(); } catch (err) { alert(`Não foi possível ${daAta ? 'tirar da lista' : 'excluir'} (${err.message || err}).`); }
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
      if (itens.some((p) => p.semTipo)) { alert('Escolha, em cada linha, de onde é a pessoa: Sólida, Terceirizado, Cliente ou Arquitetura. Depois escreva o nome.'); return; }
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
        await atas.criarPendencia({ ata_id: null, ...p, obra: String(new FormData(g).get('av_obra') || ''), setor: setorV, os: g.dataset.os || null, observadores: new FormData(g).getAll('p_obs'), hora: String(new FormData(g).get('p_hora') || ''), duracao: new FormData(g).get('p_dur'), recorrente: new FormData(g).has('p_recor'), frequencia: String(new FormData(g).get('p_freq') || 'semanal') });
        const mod = document.getElementById('at-modal'); if (mod) mod.remove();
      } else await atas.criarPendencia({ ata_id: Number(g.dataset.ata), ...p, obra: g.dataset.obra, setor: g.dataset.setor });
    }
    desenhar();
  } catch (err) { alert(`Não foi possível salvar (${err.message || err}).`); }
});

// Ata de pendências (quadro de metas do dia): cria as obras em orçamento que faltam e depois as tarefas conferidas
async function criarTarefasDaAtaDePendencias(botao) {
  const msg = document.querySelector('.lote-msg'); const linhas = []; let erro = '';
  document.querySelectorAll('.lote-lin').forEach((tr) => {
    if (!tr.querySelector('[data-lote-inc]').checked) return;
    const v = (s) => String((tr.querySelector(s) || {}).value || '').trim();
    const l = { n: tr.dataset.loteI, obra: v('[data-lote-obra]'), assunto: v('[data-lote-assunto]'), desc: v('[data-lote-desc]'), responsavel: v('[data-lote-resp]'), setor: v('[data-lote-setor]'), urgencia: v('[data-lote-urg]'), prazo: v('[data-lote-prazo]'), nota: v('[data-lote-nota]'), hora: tr.dataset.hora || '',
      observadores: String(((tr.querySelector('[data-lote-obs]') || {}).dataset || {}).loteObs || '').split(',').filter(Boolean) };
    if (!erro && (!l.desc || !l.responsavel || !l.setor || !l.prazo)) erro = `Na linha ${l.n}, falta o que fazer, o responsável, o setor ou o prazo.`;
    linhas.push(l);
  });
  if (!linhas.length) { alert('Nenhuma tarefa marcada para criar.'); return; }
  if (erro) { alert(erro); return; }
  botao.disabled = true; if (msg) msg.textContent = 'Criando…';
  try {
    const n = await atas.criarTarefasDoLote(linhas);
    estado.atasMsg = `${n} ${n === 1 ? 'tarefa criada' : 'tarefas criadas'} a partir da ata de pendências.`;
    location.hash = '#/tarefas'; desenhar();
  } catch (err) { botao.disabled = false; if (msg) msg.textContent = ''; alert(`Não foi possível criar as tarefas (${err.message || err}).`); }
}
// Tarefas: importar uma lista de pendências em PDF (cada linha vira uma tarefa)
async function importarListaDePendencias(arquivo) {
  const mv = document.getElementById('modoVis'); const bt = mv && mv.querySelector('[data-lista-importar]'); if (bt) { bt.disabled = true; bt.textContent = 'Lendo…'; }
  try { await atas.importarListaPendencias(arquivo, obrasDeAtas()); desenhar(); }
  catch (err) { alert(err.message || String(err)); desenhar(); }
}
document.addEventListener('click', (e) => {
  if (!(e.target.closest && e.target.closest('[data-lista-importar]'))) return;
  let inp = document.getElementById('lista-pend-arquivo');
  if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.id = 'lista-pend-arquivo'; inp.accept = '.pdf,application/pdf'; inp.hidden = true; document.body.appendChild(inp); }
  inp.value = ''; inp.click();
});
document.addEventListener('change', (e) => { if (e.target && e.target.id === 'lista-pend-arquivo' && e.target.files && e.target.files[0]) importarListaDePendencias(e.target.files[0]); });
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
  if (e.target.closest && e.target.closest('[data-ata-ler-fala]')) { importarAta({ texto: (document.getElementById('ata-fala') || {}).value || '', fala: true }); return; }
  if (e.target.closest && e.target.closest('[data-lote-descartar]')) { if (confirm('Descartar a ata lida?')) { atas.descartarRascunho(); desenhar(); } return; }
  if (e.target.closest && e.target.closest('[data-lote-criar]')) { criarTarefasDaAtaDePendencias(e.target.closest('[data-lote-criar]')); return; }
  if (e.target.closest && e.target.closest('[data-ata-descartar]')) { if (confirm('Descartar a ata lida e começar do zero?')) { atas.descartarRascunho(); desenhar(); } }
});

// uma linha de pendência do formulário (responsável da Sólida ou "Outro": cliente, arquitetura, terceirizado…)
function lerLinhaPendencia(l) {
  const tipo = l.querySelector('[name="p_tipo"]').value;
  return {
    kind: (l.querySelector('[name="p_kind"]') || {}).value || 'pendencia',
    pid: l.dataset.pid || '',
    descricao: [l.querySelector('[name="p_assunto"]').value.trim().replace(/,/g, ' /').toLocaleUpperCase('pt-BR'), l.querySelector('[name="p_desc"]').value.trim()].filter(Boolean).join(', '),
    semTipo: !tipo,
    semAssunto: !!l.querySelector('[name="p_desc"]').value.trim() && !l.querySelector('[name="p_assunto"]').value.trim(),
    semDescritivo: !!l.querySelector('[name="p_assunto"]').value.trim() && !l.querySelector('[name="p_desc"]').value.trim(),
    responsavel: tipo === 'solida' ? l.querySelector('[name="p_resp"]').value : '',
    externoTipo: tipo === 'solida' ? '' : tipo,
    externoCategoria: '',
    externoNome: tipo === 'solida' ? '' : l.querySelector('[name="p_nome"]').value.trim(),
    prazo: l.querySelector('[name="p_prazo"]').value,
    urgencia: (l.querySelector('[name="p_urg"]') || {}).value || '',
    funcaoTarefa: (l.querySelector('[name="p_func"]') || {}).value || '',
  };
}
// Bolinha à esquerda de cada linha da ata: arrastar muda a posição da pendência ou do informativo (a ordem da lista é a ordem salva)
let linhaArrastada = null;
document.addEventListener('dragstart', (e) => {
  const h = e.target.closest && e.target.closest('[data-pf-mover]'); if (!h) return;
  linhaArrastada = h.closest('.pf-linha'); if (!linhaArrastada) return;
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'linha-da-ata');
  try { e.dataTransfer.setDragImage(linhaArrastada, 12, 12); } catch { /* sem imagem de arraste */ }
  setTimeout(() => linhaArrastada && linhaArrastada.classList.add('pf-arrastando'), 0);
});
document.addEventListener('dragover', (e) => {
  if (!linhaArrastada) return;
  const alvo = e.target.closest && e.target.closest('.pf-linha');
  if (!alvo || alvo === linhaArrastada || alvo.parentElement !== linhaArrastada.parentElement) return;
  e.preventDefault();
  const r = alvo.getBoundingClientRect();
  alvo.parentElement.insertBefore(linhaArrastada, e.clientY < r.top + r.height / 2 ? alvo : alvo.nextSibling);
});
document.addEventListener('dragend', () => { if (linhaArrastada) linhaArrastada.classList.remove('pf-arrastando'); linhaArrastada = null; });
document.addEventListener('keydown', (e) => {   // sem mouse: seta para cima/baixo na bolinha
  const h = e.target.closest && e.target.closest('[data-pf-mover]'); if (!h || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault(); const l = h.closest('.pf-linha'); if (!l) return;
  if (e.key === 'ArrowUp' && l.previousElementSibling) l.parentElement.insertBefore(l, l.previousElementSibling);
  if (e.key === 'ArrowDown' && l.nextElementSibling) l.parentElement.insertBefore(l.nextElementSibling, l);
  h.focus();
});

// trocar Sólida / Terceirizado / Cliente mostra os campos certos da mesma linha
document.addEventListener('change', (e) => {
  const kind = e.target.closest && e.target.closest('[data-pf-kind]');
  if (kind) { const l = kind.closest('.pf-linha'); l.dataset.kind = kind.value; l.querySelector('[name="p_desc"]').placeholder = kind.value === 'informativo' ? 'Informação (ex.: Fachada liberada)' : 'O que fazer (ex.: Retirar da área gourmet)'; return; }
  const sel = e.target.closest && e.target.closest('[data-pf-tipo]');
  if (!sel) return;
  const l = sel.closest('.pf-linha'); const tipo = sel.value; l.dataset.tipo = tipo;
  l.querySelector('.pf-sol').hidden = tipo !== 'solida';
  const nome = l.querySelector('.pf-ext'); nome.hidden = tipo === 'solida';
  nome.placeholder = 'Nome da pessoa'; nome.disabled = tipo === '';   // o nome só é liberado depois de escolher de onde é
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
    marca(q('[name="p_tipo"]'), ativa && !tipo);   // de onde é a pessoa ainda não foi escolhido
    const semNome = ativa && !!tipo && tipo !== 'solida' && !v('[name="p_nome"]');   // de fora (terceirizado, cliente, arquitetura) sem o nome da pessoa
    marca(q('[name="p_nome"]'), semNome);
    if (tipo === 'solida' || !tipo) marca(q('[name="p_nome"]'), false);
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
