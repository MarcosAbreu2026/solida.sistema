// Atas e pendências (pedido de 21/10, primeira prioridade da reunião): o Bitrix está sendo pouco usado, então as
// atas e as ações que saem delas ficam aqui. Cada ata é ligada a uma obra ou a um departamento. Item que exige
// ação vira pendência, com responsável e prazo, que dá para filtrar por pessoa, setor ou obra.
// Pendências em quadro por prazo (como o Bitrix: Vencido · Hoje · Esta semana · Próxima semana · Sem prazo ·
// Em duas semanas · Concluído) ou em lista. Na nuvem os dados ficam no Supabase (tabelas atas e pendencias,
// com as regras de quem vê no próprio banco); no computador do escritório ficam só neste navegador (teste).

import { html, data as fmtData } from '../formato.js';
import { hojeISO, somarDias, inicioDaSemana, diasEntre } from '../datas.js';
import { NA_NUVEM, perfilAtual, listarAtasPendencias, criarAtaNuvem, criarPendenciaNuvem, atualizarPendenciaNuvem, apagarPendenciaNuvem, apagarAtaNuvem } from '../nuvem.js';
import { SETORES } from '../funcoes.js';
import { sessao, idPessoa, funcaoReal } from '../sessao.js';
import { lerPessoasTarefas } from '../armazenamento.js';

export const ABAS = [['pendencias', 'Pendências'], ['atas', 'Atas'], ['nova', 'Nova ata']];
export const SETORES_ATA = [...SETORES.map(([, nome]) => nome), 'Diretoria / geral'];

let dados = { atas: [], pendencias: [], pessoas: [], erro: '' };

// ---------------------------------------------------------------- armazenamento
const CHAVE = 'solida.atas';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || { atas: [], pendencias: [], seq: 1 }; } catch { return { atas: [], pendencias: [], seq: 1 }; } };
const gravarLocal = (v) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
function pessoasLocais() {
  const m = new Map([[idPessoa(), { id: idPessoa(), nome: sessao().nome }]]);
  for (const [id, p] of Object.entries(lerPessoasTarefas())) if (p && p.nome && !m.has(id)) m.set(id, { id, nome: p.nome, funcao: p.funcao });
  return [...m.values()];
}
const souEu = () => (NA_NUVEM ? perfilAtual() && perfilAtual().id : idPessoa());

export async function carregar() {
  try {
    if (NA_NUVEM) dados = { ...(await listarAtasPendencias()), erro: '' };
    else { const l = lerLocal(); dados = { atas: [...l.atas].sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.id - a.id), pendencias: l.pendencias, pessoas: pessoasLocais(), erro: '' }; }
  } catch (e) { dados = { ...dados, erro: String(e.message || e) }; }
  return dados;
}
const nomeDe = (id, reserva) => ((dados.pessoas.find((p) => p.id === id) || {}).nome) || reserva || '—';

export async function criarAta({ titulo, data, tipo, obra, setor, participantes, resumo, pendencias }) {
  const ata = { titulo, data, tipo, obra: tipo === 'obra' ? obra : null, setor: tipo === 'departamento' ? setor : null, participantes, resumo };
  const pends = pendencias.map((p) => ({ descricao: p.descricao, responsavel: p.responsavel || null, responsavel_nome: p.responsavel ? nomeDe(p.responsavel) : null, prazo: p.prazo || null, status: 'aberta' }));
  let nova;
  if (NA_NUVEM) nova = await criarAtaNuvem(ata, pends);
  else {
    const l = lerLocal(); const id = l.seq++;
    nova = { id, ...ata, criado_por: idPessoa(), criado_por_nome: sessao().nome, criado_em: new Date().toISOString() };
    l.atas.push(nova);
    for (const p of pends) l.pendencias.push({ id: l.seq++, ata_id: id, ...p, obra: ata.obra, setor: ata.setor, criado_por: idPessoa(), criado_em: new Date().toISOString(), concluida_em: null });
    gravarLocal(l);
  }
  await carregar();
  return nova;
}
export async function criarPendencia({ ata_id, descricao, responsavel, prazo, obra, setor }) {
  const p = { ata_id: ata_id || null, descricao, responsavel: responsavel || null, responsavel_nome: responsavel ? nomeDe(responsavel) : null, prazo: prazo || null, status: 'aberta', obra: obra || null, setor: setor || null };
  if (NA_NUVEM) await criarPendenciaNuvem(p);
  else { const l = lerLocal(); l.pendencias.push({ id: l.seq++, ...p, criado_por: idPessoa(), criado_em: new Date().toISOString(), concluida_em: null }); gravarLocal(l); }
  await carregar();
}
export async function mudarStatus(id, status) {
  const mud = { status, concluida_em: status === 'feita' ? new Date().toISOString() : null };
  if (NA_NUVEM) await atualizarPendenciaNuvem(id, mud);
  else { const l = lerLocal(); const p = l.pendencias.find((x) => String(x.id) === String(id)); if (p) Object.assign(p, mud); gravarLocal(l); }
  await carregar();
}
export async function apagarPendencia(id) {
  if (NA_NUVEM) await apagarPendenciaNuvem(id);
  else { const l = lerLocal(); l.pendencias = l.pendencias.filter((x) => String(x.id) !== String(id)); gravarLocal(l); }
  await carregar();
}
export async function apagarAta(id) {
  if (NA_NUVEM) await apagarAtaNuvem(id);
  else { const l = lerLocal(); l.atas = l.atas.filter((x) => String(x.id) !== String(id)); l.pendencias = l.pendencias.filter((x) => String(x.ata_id) !== String(id)); gravarLocal(l); }
  await carregar();
}

// quantas pendências abertas são minhas (para a bolinha do menu)
export function minhasAbertas() {
  const eu = souEu();
  return dados.pendencias.filter((p) => p.status === 'aberta' && p.responsavel && p.responsavel === eu).length;
}

// ---------------------------------------------------------------- apoio
const dm = (iso) => (iso ? fmtData(iso) : '');
const textoRico = (t) => html.seguro(String(t || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`).replace(/\n/g, '<br>'));
const ataDe = (p) => dados.atas.find((a) => a.id === p.ata_id);
const onde = (x) => x.obra || x.setor || '';

// em que coluna do quadro a pendência cai
function coluna(p, hoje) {
  if (p.status === 'feita') return 'concluido';
  if (!p.prazo) return 'sem';
  if (p.prazo < hoje) return 'vencido';
  if (p.prazo === hoje) return 'hoje';
  const fimSemana = somarDias(inicioDaSemana(hoje), 6);
  if (p.prazo <= fimSemana) return 'semana';
  if (p.prazo <= somarDias(fimSemana, 7)) return 'proxima';
  return 'duas';
}
const COLUNAS = [
  ['vencido', 'Vencido'], ['hoje', 'Vencimento hoje'], ['semana', 'Vencimento esta semana'], ['proxima', 'Vencimento na próxima semana'],
  ['sem', 'Sem prazo'], ['duas', 'Vencimento em duas semanas ou mais'], ['concluido', 'Concluído'],
];

const opcoesPessoas = (sel = '') => dados.pessoas.map((p) => html`<option value="${p.id}" ${p.id === sel ? html.seguro('selected') : ''}>${p.nome}</option>`);

export function linhaForm() {
  return String(html`<div class="pf-linha"><input name="p_desc" placeholder="O que precisa ser feito" autocomplete="off">
    <select name="p_resp"><option value="">Responsável…</option>${opcoesPessoas()}</select>
    <input type="date" name="p_prazo" title="Prazo"><button type="button" class="pf-x" data-pf-del title="Tirar esta linha">×</button></div>`);
}

function filtrar(params) {
  const q = (params.get('q') || '').trim().toLocaleLowerCase('pt-BR');
  const pessoa = params.get('pessoa') || ''; const setor = params.get('setor') || ''; const obra = params.get('obra') || '';
  const eu = souEu();
  return dados.pendencias.filter((p) => {
    if (p.status === 'cancelada') return false;
    if (pessoa === 'eu' ? p.responsavel !== eu : pessoa && p.responsavel !== pessoa) return false;
    if (setor && p.setor !== setor) return false;
    if (obra && p.obra !== obra) return false;
    if (q && !`${p.descricao} ${nomeDe(p.responsavel, p.responsavel_nome)} ${onde(p)} ${(ataDe(p) || {}).titulo || ''}`.toLocaleLowerCase('pt-BR').includes(q)) return false;
    return true;
  });
}

// ---------------------------------------------------------------- telas
function barraFiltros(params, obras, aba) {
  const sel = (nome, rotulo, opcoes, atual) => html`<label>${rotulo}<select data-atas-filtro="${nome}"><option value="">Todos</option>${opcoes.map(([v, t]) => html`<option value="${v}" ${atual === v ? html.seguro('selected') : ''}>${t}</option>`)}</select></label>`;
  const vista = params.get('vista') === 'lista' ? 'lista' : 'prazo';
  return html`<div class="at-filtros">
    ${aba === 'atas' ? '' : html`<div class="subnav" role="tablist"><a role="tab" class="${vista === 'prazo' ? 'on' : ''}" href="#/atas?vista=prazo">Prazo</a><a role="tab" class="${vista === 'lista' ? 'on' : ''}" href="#/atas?vista=lista">Lista</a></div>`}
    ${aba === 'atas' ? '' : sel('pessoa', 'Pessoa', [['eu', 'Só as minhas'], ...dados.pessoas.map((p) => [p.id, p.nome])], params.get('pessoa') || '')}
    ${sel('setor', 'Setor', SETORES_ATA.map((s) => [s, s]), params.get('setor') || '')}
    ${sel('obra', 'Obra', obras.map((o) => [o, o]), params.get('obra') || '')}
    <label>Procurar<input type="search" data-atas-filtro="q" value="${params.get('q') || ''}" placeholder="texto…"></label>
  </div>`;
}

function cartao(p, hoje) {
  const a = ataDe(p); const col = coluna(p, hoje);
  const dias = p.prazo ? diasEntre(hoje, p.prazo) : null;
  const rotuloPrazo = !p.prazo ? 'Sem prazo' : col === 'vencido' ? `${dm(p.prazo)} · ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'} de atraso` : col === 'hoje' ? 'Hoje' : dm(p.prazo);
  return html`<article class="at-card at-${col}">
    <div class="at-tit">${p.descricao}</div>
    <div class="at-meta"><span class="at-prazo at-p-${col}">${rotuloPrazo}</span>${onde(p) ? html`<span class="at-chip">${onde(p)}</span>` : ''}</div>
    <div class="at-quem"><span class="at-pessoa">${nomeDe(p.responsavel, p.responsavel_nome)}</span>${a ? html`<a class="at-ata" href="#/atas?aba=atas&ata=${a.id}" title="Ata de origem">ata ${dm(a.data).slice(0, 5)}</a>` : ''}</div>
    <div class="at-acoes">
      ${p.status === 'feita' ? html`<button type="button" class="ac-mini" data-pend="${p.id}|aberta">↺ reabrir</button>` : html`<button type="button" class="ac-mini at-ok" data-pend="${p.id}|feita">✓ concluir</button>`}
      <button type="button" class="ac-mini" data-pend-del="${p.id}" title="Excluir esta pendência">excluir</button>
    </div></article>`;
}

function vistaPrazo(lista, hoje) {
  return html`<div class="at-quadro">${COLUNAS.map(([id, nome]) => {
    let itens = lista.filter((p) => coluna(p, hoje) === id);
    if (id === 'concluido') itens = itens.sort((a, b) => String(b.concluida_em).localeCompare(String(a.concluida_em))).slice(0, 30);
    return html`<section class="at-col at-c-${id}"><header><b>${nome}</b><span>${lista.filter((p) => coluna(p, hoje) === id).length}</span></header>
      <div class="at-itens">${itens.map((p) => cartao(p, hoje))}</div></section>`;
  })}</div>`;
}

function vistaLista(lista, hoje, params) {
  const st = params.get('status') || 'abertas';
  const itens = lista.filter((p) => (st === 'todas' ? true : st === 'feitas' ? p.status === 'feita' : p.status === 'aberta'));
  return html`<div class="at-lista-topo"><label>Mostrar<select data-atas-filtro="status"><option value="abertas" ${st === 'abertas' ? html.seguro('selected') : ''}>Abertas</option><option value="feitas" ${st === 'feitas' ? html.seguro('selected') : ''}>Concluídas</option><option value="todas" ${st === 'todas' ? html.seguro('selected') : ''}>Todas</option></select></label></div>
    <div class="tabela-rolagem"><table class="tab ordenavel at-tab"><thead><tr><th>Pendência</th><th>Responsável</th><th>Prazo</th><th>Obra / setor</th><th>Ata</th><th>Situação</th><th></th></tr></thead><tbody>
      ${itens.map((p) => { const col = coluna(p, hoje); const a = ataDe(p); return html`<tr><td>${p.descricao}</td><td>${nomeDe(p.responsavel, p.responsavel_nome)}</td>
        <td class="${col === 'vencido' ? 'pendente' : ''}">${p.prazo ? dm(p.prazo) : html`<span class="muted">—</span>`}</td><td>${onde(p)}</td>
        <td>${a ? html`<a class="link" href="#/atas?aba=atas&ata=${a.id}">${dm(a.data).slice(0, 5)}</a>` : ''}</td>
        <td>${p.status === 'feita' ? 'Concluída' : col === 'vencido' ? 'Atrasada' : 'Aberta'}</td>
        <td class="at-acoes">${p.status === 'feita' ? html`<button type="button" class="ac-mini" data-pend="${p.id}|aberta">↺</button>` : html`<button type="button" class="ac-mini at-ok" data-pend="${p.id}|feita">✓ concluir</button>`} <button type="button" class="ac-mini" data-pend-del="${p.id}">excluir</button></td></tr>`; })}
    </tbody></table></div>${itens.length ? '' : html`<p class="vazio">Nenhuma pendência com esses filtros.</p>`}`;
}

function listaAtas(params, obras) {
  const obra = params.get('obra') || ''; const setor = params.get('setor') || ''; const q = (params.get('q') || '').toLocaleLowerCase('pt-BR');
  const atas = dados.atas.filter((a) => (!obra || a.obra === obra) && (!setor || a.setor === setor) && (!q || `${a.titulo} ${a.resumo} ${onde(a)}`.toLocaleLowerCase('pt-BR').includes(q)));
  return html`${atas.length ? html`<div class="at-atas">${atas.map((a) => {
    const ps = dados.pendencias.filter((p) => p.ata_id === a.id && p.status !== 'cancelada'); const ab = ps.filter((p) => p.status === 'aberta').length;
    return html`<a class="at-ata-card" href="#/atas?aba=atas&ata=${a.id}"><b>${a.titulo}</b><span class="pequeno">${dm(a.data)} · ${onde(a) || 'sem vínculo'}${a.criado_por_nome ? ` · por ${a.criado_por_nome}` : ''}</span>
      <span class="at-contagem ${ab ? 'tem' : ''}">${ps.length ? `${ab} aberta${ab === 1 ? '' : 's'} de ${ps.length}` : 'sem pendências'}</span></a>`; })}</div>` : html`<p class="vazio">Nenhuma ata ainda. Crie a primeira em "Nova ata".</p>`}`;
}

function detalheAta(id, hoje, obras) {
  const a = dados.atas.find((x) => String(x.id) === String(id));
  if (!a) return html`<p class="vazio">Ata não encontrada (ou você não tem acesso a ela). <a class="link" href="#/atas?aba=atas">Voltar às atas</a></p>`;
  const ps = dados.pendencias.filter((p) => p.ata_id === a.id && p.status !== 'cancelada');
  const podeApagar = funcaoReal().id === 'socio' || a.criado_por === souEu();
  return html`<p><a class="link" href="#/atas?aba=atas">← Todas as atas</a></p>
    <article class="at-ata-det">
      <h2>${a.titulo}</h2>
      <p class="pequeno">${dm(a.data)} · ${a.tipo === 'obra' ? 'Obra' : 'Departamento'}: <b>${onde(a) || '—'}</b>${a.criado_por_nome ? ` · registrada por ${a.criado_por_nome}` : ''}</p>
      ${a.participantes && a.participantes.length ? html`<p class="pequeno">Participantes: ${a.participantes.join(', ')}</p>` : ''}
      <div class="at-resumo">${a.resumo ? textoRico(a.resumo) : html`<span class="muted">Sem texto.</span>`}</div>
      <h3>Pendências desta ata <span class="pequeno">${ps.length}</span></h3>
      <div class="at-quadro-ata">${ps.length ? ps.map((p) => cartao(p, hoje)) : html`<p class="pequeno">Nenhuma pendência saiu desta ata.</p>`}</div>
      <form class="at-nova-pend" id="pend-form" data-ata="${a.id}" data-obra="${a.obra || ''}" data-setor="${a.setor || ''}">${html.seguro(linhaForm())}<button type="submit" class="botao">Acrescentar pendência</button></form>
      ${podeApagar ? html`<p style="margin-top:18px"><button type="button" class="botao at-excluir" data-ata-del="${a.id}">Excluir esta ata e as pendências dela</button></p>` : ''}
    </article>`;
}

function formNova(obras) {
  const hoje = hojeISO();
  return html`<form class="at-form" id="ata-form">
    <div class="at-form-grade">
      <label>Título da ata<input name="titulo" required placeholder="ex.: Reunião de obra Mo531" autocomplete="off"></label>
      <label>Data<input type="date" name="data" value="${hoje}" required></label>
      <label>Ligada a<select name="vinculo" required><option value="">— escolher —</option>
        <optgroup label="Obra">${obras.map((o) => html`<option value="obra:${o}">${o}</option>`)}</optgroup>
        <optgroup label="Departamento">${SETORES_ATA.map((s) => html`<option value="dep:${s}">${s}</option>`)}</optgroup></select></label>
    </div>
    <fieldset class="at-part"><legend>Participantes</legend>${dados.pessoas.map((p) => html`<label class="ac-chip"><input type="checkbox" name="participantes" value="${p.nome}"><span>${p.nome}</span></label>`)}</fieldset>
    <label>O que foi tratado (pauta e decisões)<textarea name="resumo" rows="7" placeholder="Escreva ou cole o texto da ata…"></textarea></label>
    <h3>Pendências <span class="pequeno">o que precisa de ação: quem faz e até quando</span></h3>
    <div id="pend-linhas">${html.seguro(linhaForm())}</div>
    <p><button type="button" class="ac-mini" data-pf-add>+ outra pendência</button></p>
    <p style="margin-top:14px"><button type="submit" class="botao on">Salvar ata</button> <span class="pequeno at-msg"></span></p>
  </form>`;
}

export function render({ params, obras = [], msg = '' }) {
  const hoje = hojeISO();
  const aba = ABAS.some(([id]) => id === params.get('aba')) ? params.get('aba') : 'pendencias';
  const abertas = dados.pendencias.filter((p) => p.status === 'aberta');
  const atrasadas = abertas.filter((p) => p.prazo && p.prazo < hoje).length;
  const minhas = minhasAbertas();
  const topo = html`<div class="subnav at-abas" role="tablist">${ABAS.map(([id, nome]) => html`<a role="tab" class="${id === aba ? 'on' : ''}" href="#/atas${id === 'pendencias' ? '' : `?aba=${id}`}">${nome}${id === 'pendencias' ? html` <span class="est-n">${abertas.length}</span>` : id === 'atas' ? html` <span class="est-n">${dados.atas.length}</span>` : ''}</a>`)}</div>`;
  let corpo;
  if (aba === 'nova') corpo = formNova(obras);
  else if (aba === 'atas') corpo = params.get('ata') ? detalheAta(params.get('ata'), hoje, obras) : html`${barraFiltros(params, obras, 'atas')}${listaAtas(params, obras)}`;
  else {
    const lista = filtrar(params);
    corpo = html`<div class="cards at-cards"><div class="card"><div class="card-valor">${abertas.length}</div><div class="card-rotulo">Pendências abertas</div></div>
      <div class="card"><div class="card-valor ${atrasadas ? 'tom-ruim' : ''}">${atrasadas}</div><div class="card-rotulo">Atrasadas</div></div>
      <div class="card"><div class="card-valor">${minhas}</div><div class="card-rotulo">Abertas comigo</div></div></div>
      ${barraFiltros(params, obras, 'pendencias')}
      ${params.get('vista') === 'lista' ? vistaLista(lista, hoje, params) : vistaPrazo(lista, hoje)}`;
  }
  return html`<div class="pagina atas">
    ${dados.erro ? html`<p class="erro">Não consegui carregar: ${dados.erro}</p>` : ''}
    ${msg ? html`<p class="msg ok">${msg}</p>` : ''}
    ${topo}<div style="margin-top:16px">${corpo}</div>
    ${NA_NUVEM ? '' : html`<p class="pequeno" style="margin-top:20px">Modo de teste (computador do escritório): as atas ficam só neste navegador. Na internet elas ficam no banco, compartilhadas.</p>`}
  </div>`;
}
