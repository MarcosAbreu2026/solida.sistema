// CRM dos orçamentos novos (pedido do Marcos, 19/11/2026): Kanban do que ainda vamos fechar. Cada card é um orçamento (código Mo###, cliente, arquitetura),
// anda pelas colunas (solicitação · em orçamento · parado no arquiteto/fornecedor · no cliente · obra fechada · não fechou) e tem prazo de entrega,
// início previsto, duração e valor (só sócios). As tarefas ficam DENTRO do card (pendências com os = OQ-###).
// Na nuvem: tabelas orc_quadro e orc_quadro_valor (supabase/37-orc-quadro-e-cronograma.sql); no computador do escritório (teste): neste navegador.
import { html } from './formato.js';
import { hojeISO, somarDias } from './datas.js';
import { NA_NUVEM, listarOrcQuadro, gravarOrcQuadro, apagarOrcQuadro } from './nuvem.js';

export const STATUS = [
  { id: 'solicitacao', nome: 'Solicitação', cor: '#6E7782', cad: 'solicitacao' },
  { id: 'em_orcamento', nome: 'Em orçamento', cor: '#C0692B', cad: 'orcamento' },
  { id: 'arquitetura', nome: 'Parado no arquiteto', cor: '#7B6AA8', cad: 'com_arquitetura' },
  { id: 'fornecedor', nome: 'Parado no fornecedor', cor: '#B58A1B', cad: 'com_fornecedor' },
  { id: 'cliente', nome: 'No cliente / negociação', cor: '#2F5F86', cad: 'orcamento' },
  { id: 'fechado', nome: 'Obra fechada', cor: '#4F7D5C', cad: null },
  { id: 'nao_fechou', nome: 'Não fechou', cor: '#A23B3B', cad: 'nao_fechado' },
];
const porId = Object.fromEntries(STATUS.map((s) => [s.id, s]));
// tipo de obra do orçamento (lista sugerida; dá para digitar outro)
export const TIPOS_OBRA = ['Apartamento – reforma', 'Casa – reforma', 'Casa – construção', 'Cobertura – reforma', 'Escritório', 'Corporativo', 'Loja / comercial', 'Demolição', 'Projeto / consultoria'];
const listaTipos = () => html`<datalist id="oq-tipos">${[...new Set([...TIPOS_OBRA, ...lista.map((o) => o.tipo_obra).filter(Boolean)])].map((t) => html`<option value="${t}">`)}</datalist>`;
export const situacaoCadastro = (status) => (porId[status] || {}).cad || null;
const CHAVE = 'solida.orcQuadro';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch { return []; } };
const gravarLocal = (l) => { try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch { /* sem armazenamento */ } };
const dBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const dCurta = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export let lista = [];
export let erro = '';

export async function carregar() {
  try { lista = NA_NUVEM ? await listarOrcQuadro() : lerLocal().sort((a, b) => b.id - a.id); erro = ''; } catch (e) { erro = String(e.message || e); }
  return lista;
}
export const porIdOrc = (id) => lista.find((o) => String(o.id) === String(id));

// fim previsto = início + meses (quando o fim não foi digitado)
export function fimDe(inicio, meses) {
  if (!inicio || !meses) return null;
  const d = new Date(`${inicio}T12:00:00`); const m = Number(meses); const inteiro = Math.floor(m);
  d.setMonth(d.getMonth() + inteiro); d.setDate(d.getDate() + Math.round((m - inteiro) * 30));
  return d.toISOString().slice(0, 10);
}
function aplicarRegrasLocais(o) {
  if (!o.codigo) o.codigo = `OQ-${String(o.id).padStart(3, '0')}`;
  o.d_fechado = o.status === 'fechado' ? (o.d_fechado || hojeISO()) : null;
  return o;
}
async function gravar(linha) {
  if (NA_NUVEM) { const r = await gravarOrcQuadro(linha); const i = lista.findIndex((o) => o.id === r.id); const novo = { ...(i >= 0 ? lista[i] : {}), ...r, valor: r.valor === undefined ? (i >= 0 ? lista[i].valor : null) : r.valor }; if (i >= 0) lista[i] = novo; else lista.unshift(novo); return novo; }
  const todas = lerLocal(); let o;
  if (linha.id) { o = todas.find((x) => String(x.id) === String(linha.id)); if (!o) throw new Error('Card não encontrado.'); Object.assign(o, { ...linha, id: o.id }); }
  else { o = { id: todas.reduce((m, x) => Math.max(m, x.id), 0) + 1, criado_em: new Date().toISOString(), viavel: false, ...linha }; todas.push(o); }
  aplicarRegrasLocais(o); gravarLocal(todas); lista = todas.sort((a, b) => b.id - a.id); return o;
}
export const criar = (c) => gravar({ obra: String(c.obra || '').trim(), cliente: c.cliente || null, arquitetura: c.arquitetura || null, tipo_obra: c.tipo_obra || null, titulo: String(c.titulo || '').trim(), status: c.status || 'solicitacao' });
export const salvar = (id, campos) => gravar({ id, ...campos });
export const mover = (id, status) => gravar({ id, status });
export async function apagar(id) {
  if (NA_NUVEM) { await apagarOrcQuadro(id); lista = lista.filter((x) => String(x.id) !== String(id)); return; }
  const t = lerLocal().filter((x) => String(x.id) !== String(id)); gravarLocal(t); lista = t;
}

// ---------------------------------------------------------------- telas
const sel = (cond) => (cond ? html.seguro('selected') : '');
const tarefasDo = (o, pendencias) => pendencias.filter((p) => p.os === o.codigo && p.status !== 'cancelada');
const lista3 = (t) => { const a = t.filter((p) => p.status === 'aberta'); if (!a.length) return ''; return html`<ul class="osq-card-tarefas">${a.slice(0, 3).map((p) => html`<li title="${p.descricao}">${String(p.descricao).length > 48 ? `${String(p.descricao).slice(0, 46)}…` : p.descricao}${p.responsavel_nome ? html` <span class="pequeno">· ${p.responsavel_nome}</span>` : ''}</li>`)}${a.length > 3 ? html`<li class="pequeno">+ ${a.length - 3} tarefa(s)</li>` : ''}</ul>`; };
// situação do prazo: atrasado · até 3 dias · ok
const prazoCls = (o, hoje) => (!o.prazo || ['fechado', 'nao_fechou'].includes(o.status) ? '' : o.prazo < hoje ? 'oq-atrasado' : o.prazo <= somarDias(hoje, 3) ? 'oq-perto' : '');
const opcoesObra = (obras) => html`<datalist id="oq-obras">${obras.map((c) => html`<option value="${c.codigo}">${c.nome || c.cliente || ''}</option>`)}</datalist>`;

const filtrar = (params, pendencias) => {
  const q = (params.get('oqq') || '').toLocaleLowerCase('pt-BR'); const v = params.get('oqv') || ''; const tp = params.get('oqtipo') || '';
  return lista.filter((o) => (!q || `${o.obra} ${o.cliente || ''} ${o.arquitetura || ''} ${o.titulo || ''} ${o.tipo_obra || ''}`.toLocaleLowerCase('pt-BR').includes(q)) && (!tp || o.tipo_obra === tp)
    && (!v || (v === 'sim' ? o.viavel : !o.viavel)) && (params.get('oqt') !== 'com' || tarefasDo(o, pendencias).some((p) => p.status === 'aberta')));
};

export function renderQuadro({ params, podeEditar, veValores = false, obrasCad = [], pendencias = [], hoje = hojeISO() }) {
  const itens = filtrar(params, pendencias);
  const abertos = lista.filter((o) => !['fechado', 'nao_fechou'].includes(o.status));
  const soma = veValores ? abertos.reduce((s, o) => s + (Number(o.valor) || 0), 0) : 0;
  const cartao = (o) => {
    const t = tarefasDo(o, pendencias); const ab = t.filter((p) => p.status === 'aberta').length;
    return html`<article class="at-card osq-card oq-card ${prazoCls(o, hoje)}" data-oq="${o.id}" ${podeEditar ? html.seguro('draggable="true"') : ''} title="Clique para abrir${podeEditar ? ' · arraste para mudar a coluna' : ''}">
      <div class="at-tit"><b>${o.obra}</b> ${o.viavel ? html`<span class="oq-viavel" title="Orçamento que acreditamos fechar">★ viável</span>` : ''}</div>
      <div class="oq-cli">${o.cliente || ''}</div>
      <div class="at-meta">${o.tipo_obra ? html`<span class="at-chip oq-tipo">${o.tipo_obra}</span>` : html`<span class="at-chip oq-tipo oq-sem" title="Falta dizer o tipo de obra">tipo?</span>`}${o.arquitetura ? html`<span class="at-chip">🏛 ${o.arquitetura}</span>` : ''}${o.titulo ? html`<span class="at-chip">${o.titulo}</span>` : ''}${t.length ? html`<span class="at-chip" title="Tarefas em aberto / total">☑ ${ab}/${t.length}</span>` : ''}</div>
      <div class="oq-datas">${o.prazo ? html`<span class="oq-prazo" title="Prazo para entregar o orçamento">⏱ entrega ${dCurta(o.prazo)}</span>` : ''}${o.inicio_previsto ? html`<span title="Início previsto da obra${o.fim_previsto ? ` · fim previsto ${dBR(o.fim_previsto)}` : ''}">🏗 ${dCurta(o.inicio_previsto)}${o.fim_previsto ? ` → ${dCurta(o.fim_previsto)}` : ''}</span>` : ''}${veValores && o.valor ? html`<span class="oq-valor">${brl(o.valor)}</span>` : ''}</div>
      ${lista3(t)}</article>`;
  };
  return html`<section class="osq">
    ${erro ? html`<p class="erro">${erro}</p>` : ''}
    <div class="at-filtros">
      <label>Procurar<input type="search" data-atas-filtro="oqq" value="${params.get('oqq') || ''}" placeholder="Código, cliente, arquiteto…"></label>
      <label>Tipo de obra<select data-atas-filtro="oqtipo"><option value="">Todos</option>${[...new Set([...TIPOS_OBRA, ...lista.map((o) => o.tipo_obra).filter(Boolean)])].map((t) => html`<option value="${t}" ${sel(t === params.get('oqtipo'))}>${t}</option>`)}</select></label>
      <label>Viabilidade<select data-atas-filtro="oqv"><option value="">Todos</option><option value="sim" ${sel(params.get('oqv') === 'sim')}>★ Viáveis de fechar</option><option value="nao" ${sel(params.get('oqv') === 'nao')}>Sem marcação</option></select></label>
      <label>Tarefas<select data-atas-filtro="oqt"><option value="">Todos os cards</option><option value="com" ${sel(params.get('oqt') === 'com')}>Com tarefa em aberto</option></select></label>
    </div>
    <p class="pequeno">${abertos.length} orçamento(s) em andamento${soma ? ` · ${brl(soma)} em negociação` : ''}. ${podeEditar ? 'Arraste o card para a coluna certa ou clique nele para abrir (prazo, datas, tarefas). O + cria um orçamento novo naquela coluna.' : 'Só o orçamento de obras novas, o planejamento e a diretoria mexem nos cards; você acompanha por aqui.'}</p>
    <div class="at-quadro osq-quadro" style="grid-template-columns:repeat(${STATUS.length},minmax(150px,1fr));overflow-x:auto">${STATUS.map((s) => {
    const col = itens.filter((o) => o.status === s.id);
    const ordenado = [...col].sort((a, b) => (s.id === 'fechado' || s.id === 'nao_fechou' ? String(b.d_fechado || b.atualizado_em || '').localeCompare(String(a.d_fechado || a.atualizado_em || '')) : String(a.prazo || '9999').localeCompare(String(b.prazo || '9999'))));
    return html`<section class="at-col" data-oq-col="${s.id}"><header style="background:${s.cor}"><b>${s.nome}</b><span>${col.length}</span>${podeEditar ? html`<button type="button" class="at-col-mais" data-oq-nova="${s.id}" title="Novo orçamento em ${s.nome}">+</button>` : ''}</header>
      <div class="at-itens">${ordenado.slice(0, 40).map(cartao)}</div></section>`;
  })}</div>${opcoesObra(obrasCad)}</section>`;
}

export function formNova(status, obrasCad = []) {
  const s = porId[status] || STATUS[0];
  return html`<form class="at-nova-pend at-avulsa" id="oq-form-nova" data-status="${s.id}">
    <h3>Novo orçamento</h3><p class="pequeno at-av-sub">Entra na coluna "${s.nome}". Se o código ainda não existe no Cadastros, ele é criado lá como obra em orçamento.</p>
    <div class="at-av-grade">
      <label class="av-m">Código<input name="obra" list="oq-obras" required autocomplete="off" placeholder="ex.: Mo613"></label>
      <label class="av-m">Cliente<input name="cliente" required autocomplete="off" placeholder="ex.: Ana Paula e Flávio"></label>
      <label class="av-m">Arquitetura<input name="arquitetura" autocomplete="off" placeholder="ex.: PKB"></label>
      <label class="av-m">Tipo de obra<input name="tipo_obra" list="oq-tipos" autocomplete="off" placeholder="ex.: Apartamento – reforma"></label>
      <label class="av-m">Observação curta<input name="titulo" autocomplete="off" placeholder="ex.: 3 quartos"></label>
    </div>
    ${opcoesObra(obrasCad)}${listaTipos()}
    <div class="at-av-botoes"><button type="button" class="botao" data-av-fechar>Cancelar</button><button type="submit" class="botao on">Criar card</button></div></form>`;
}

export function detalhe(id, { podeEditar, veValores = false, obrasCad = [], msg = '', pendencias = [] }) {
  const o = porIdOrc(id);
  if (!o) return html`<div class="tf"><p class="erro">Não achei este card.</p><div class="at-av-botoes"><button type="button" class="botao" data-av-fechar>Fechar</button></div></div>`;
  const dis = podeEditar ? '' : html.seguro('disabled');
  const tarefas = tarefasDo(o, pendencias);
  return html`<div class="tf" data-oq-raiz="${o.id}">
    <div class="tf-cab"><h3>${o.obra} · ${o.cliente || ''}</h3><span class="osq-st" style="background:${porId[o.status].cor}">${porId[o.status].nome}</span></div>
    <form id="oq-form" data-oq-form="${o.id}" autocomplete="off">
      <div class="tf-grade osq-grade">
        <label>Código<input name="obra" list="oq-obras" value="${o.obra}" required ${dis}></label>
        <label>Cliente<input name="cliente" value="${o.cliente || ''}" ${dis}></label>
        <label>Arquitetura<input name="arquitetura" value="${o.arquitetura || ''}" ${dis}></label>
        <label>Tipo de obra<input name="tipo_obra" list="oq-tipos" value="${o.tipo_obra || ''}" placeholder="casa, apartamento, escritório…" ${dis}></label>
        <label>Observação curta<input name="titulo" value="${o.titulo || ''}" ${dis}></label>
        <label>Coluna<select name="status" ${dis}>${STATUS.map((s) => html`<option value="${s.id}" ${sel(s.id === o.status)}>${s.nome}</option>`)}</select></label>
        <label>Responsável pelo orçamento<input name="responsavel" value="${o.responsavel || ''}" ${dis}></label>
        <label>Prazo para entregar o orçamento<input type="date" name="prazo" value="${o.prazo || ''}" ${dis}></label>
        <label class="oq-chk"><input type="checkbox" name="viavel" ${o.viavel ? html.seguro('checked') : ''} ${dis}> ★ Acreditamos que vai fechar (aparece no cronograma geral)</label>
        <label>Início previsto da obra<input type="date" name="inicio_previsto" value="${o.inicio_previsto || ''}" ${dis}></label>
        <label>Duração (meses)<input type="number" name="meses" step="0.5" min="0" value="${o.meses == null ? '' : o.meses}" ${dis}></label>
        <label>Fim previsto<input type="date" name="fim_previsto" value="${o.fim_previsto || ''}" ${dis}></label>
        ${veValores ? html`<label>Valor do orçamento (R$)<input type="number" name="valor" step="0.01" min="0" value="${o.valor == null ? '' : o.valor}" ${dis}></label>` : ''}
        <label class="osq-largo">Observações<textarea name="descricao" rows="3" ${dis}>${o.descricao || ''}</textarea></label>
      </div>
      <p class="pequeno">Se o fim previsto ficar vazio, o sistema usa o início + a duração. ${o.status === 'fechado' ? html`Fechado em ${dBR(o.d_fechado) || '—'}: cadastre a obra no Cadastros (tipo Obra) para ela entrar no cronograma.` : ''}</p>
      <div class="osq-pends"><h4>Tarefas deste orçamento <span class="pequeno">${tarefas.filter((p) => p.status === 'aberta').length} em aberto · ${tarefas.length} no total</span>${podeEditar ? html`<button type="button" class="ac-mini" data-oq-pend="${o.codigo}" data-oq-obra="${o.obra}" data-oq-fase="${o.status}">+ Nova tarefa</button>` : ''}</h4>
        ${tarefas.length ? '' : html`<p class="pequeno">Nenhuma tarefa ainda.</p>`}
        ${tarefas.map((p) => html`<div class="osq-pend" data-tarefa="${p.id}"><span class="osq-pend-txt">${p.descricao}</span><span class="osq-pend-quem">${p.responsavel_nome || html`<span class="pc-sem-txt">[definir]</span>`}${p.executor && p.executor !== p.responsavel_nome ? html` → ${p.executor}` : ''}</span><span class="osq-pend-st ${p.status === 'feita' ? 'ok' : ''}">${p.status === 'feita' ? 'feita' : `aberta${p.prazo && /^\d{4}/.test(p.prazo) ? ` · ${dBR(p.prazo)}` : ''}`}</span>${podeEditar ? html`<button type="button" class="ac-mini pc-pdel" data-pc-pdel="${p.id}" title="Excluir só esta tarefa (o card continua)">excluir</button>` : ''}</div>`)}</div>
      ${opcoesObra(obrasCad)}${listaTipos()}
      <div class="tf-botoes">
        ${podeEditar ? html`<button type="submit" class="botao on">Salvar</button><button type="button" class="botao ac-excluir" data-oq-del="${o.id}">Excluir card</button>` : ''}
        <button type="button" class="botao" data-av-fechar>Fechar</button>${msg ? html`<span class="tf-msg">${msg}</span>` : ''}
      </div>
    </form></div>`;
}
