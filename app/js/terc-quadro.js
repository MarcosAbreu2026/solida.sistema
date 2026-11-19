// Cards (Kanban) do Orçamento Terceirizado Laranja (pedido do Marcos, 19/11/2026). Mesmo desenho do Quadro de OS do pós-obra, mas
// cada card é um item a contratar/comprar de terceiros (ex.: "louças e metais") ligado a uma obra/projeto, e o que há para fazer
// são TAREFAS (pendências) dentro do card, em vez de problema e solução. Também aceita fotos.
// Na nuvem: tabela terc_quadro (supabase/32-terc-quadro.sql); no computador do escritório (teste): neste navegador.
import { html } from './formato.js';
import { hojeISO } from './datas.js';
import { NA_NUVEM, listarTercQuadro, gravarTercQuadro, apagarTercQuadro, enviarFotoTerc, apagarFotoTerc, urlsFotosTerc } from './nuvem.js';

export const STATUS = [
  { id: 'solicitado', nome: 'Solicitado', cor: '#6E7782' },
  { id: 'cotacao', nome: 'Cotação', cor: '#B58A1B' },
  { id: 'arq_aguardando', nome: 'Arquitetura aguardando', cor: '#7B6AA8' },
  { id: 'cliente_aguardando', nome: 'Cliente aguardando', cor: '#A23B72' },
  { id: 'pagamento_enviado', nome: 'Pagamento enviado', cor: '#3C7480' },
  { id: 'pagamento_aguardando', nome: 'Pagamento aguardando', cor: '#C0692B' },
  { id: 'entrega_aguardando', nome: 'Entrega aguardando', cor: '#2F5F86' },
  { id: 'ja_temos', nome: 'ARC / orçamento já temos', cor: '#8A6D3B' },
  { id: 'concluido', nome: 'Concluído', cor: '#4F7D5C' },
];
const porId = Object.fromEntries(STATUS.map((s) => [s.id, s]));
const CHAVE = 'solida.tercQuadro';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch { return []; } };
const gravarLocal = (l) => { try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch { /* sem armazenamento */ } };
const dBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

export let lista = [];
export let erro = '';
let urls = {};

export async function carregar() {
  try {
    lista = NA_NUVEM ? await listarTercQuadro() : lerLocal().sort((a, b) => b.id - a.id);
    erro = '';
    const caminhos = [...new Set(lista.flatMap((o) => o.fotos || []).filter((c) => !c.startsWith('data:')))];
    if (NA_NUVEM && caminhos.length) urls = { ...urls, ...(await urlsFotosTerc(caminhos)) };
  } catch (e) { erro = String(e.message || e); }
  return lista;
}
export const porIdTerc = (id) => lista.find((o) => String(o.id) === String(id));
const urlFoto = (c) => (c.startsWith('data:') ? c : urls[c] || '');

function aplicarRegrasLocais(o) {
  if (!o.codigo) o.codigo = `TL-${String(o.id).padStart(3, '0')}`;
  o.d_concluido = o.status === 'concluido' ? (o.d_concluido || hojeISO()) : null;
  return o;
}
async function gravar(linha) {
  if (NA_NUVEM) { const r = await gravarTercQuadro(linha); const i = lista.findIndex((o) => o.id === r.id); if (i >= 0) lista[i] = r; else lista.unshift(r); return r; }
  const todas = lerLocal(); let o;
  if (linha.id) { o = todas.find((x) => String(x.id) === String(linha.id)); if (!o) throw new Error('Card não encontrado.'); Object.assign(o, { ...linha, id: o.id }); }
  else { o = { id: todas.reduce((m, x) => Math.max(m, x.id), 0) + 1, fotos: [], criado_em: new Date().toISOString(), ...linha }; todas.push(o); }
  aplicarRegrasLocais(o); gravarLocal(todas); lista = todas.sort((a, b) => b.id - a.id); return o;
}
export const criar = (c) => gravar({ projeto: String(c.projeto || '').trim(), titulo: String(c.titulo || '').trim(), status: c.status || 'solicitado' });
export const salvar = (id, campos) => gravar({ id, ...campos });
export const mover = (id, status) => gravar({ id, status });
export async function apagar(id) {
  const o = porIdTerc(id);
  if (NA_NUVEM) { await apagarTercQuadro(id); for (const c of (o && o.fotos) || []) await apagarFotoTerc(c); lista = lista.filter((x) => x.id !== o.id); return; }
  const t = lerLocal().filter((x) => String(x.id) !== String(id)); gravarLocal(t); lista = t;
}

function reduzir(arquivo) {
  return new Promise((ok, falha) => {
    const img = new Image(); const u = URL.createObjectURL(arquivo);
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u); c.toBlob((b) => (b ? ok(b) : falha(new Error('Foto inválida'))), 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(u); falha(new Error('Não consegui abrir esta foto.')); };
    img.src = u;
  });
}
export async function adicionarFoto(id, arquivo) {
  const o = porIdTerc(id); if (!o) return;
  const blob = await reduzir(arquivo);
  const caminho = NA_NUVEM ? await enviarFotoTerc(o.id, blob) : await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  await salvar(o.id, { fotos: [...(o.fotos || []), caminho] });
  if (NA_NUVEM) urls = { ...urls, ...(await urlsFotosTerc([caminho])) };
}
export async function tirarFoto(id, indice) {
  const o = porIdTerc(id); if (!o) return;
  const f = [...(o.fotos || [])]; const [tirada] = f.splice(indice, 1);
  await salvar(o.id, { fotos: f }); if (NA_NUVEM && tirada && !tirada.startsWith('data:')) await apagarFotoTerc(tirada);
}

// ---------------------------------------------------------------- telas
const opcoesProjeto = (projetos) => html`<datalist id="tcq-projetos">${projetos.map((c) => html`<option value="${c}">`)}</datalist>`;
const projetosDe = (extras = []) => [...new Set([...extras, ...lista.map((o) => o.projeto)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
const tarefasDo = (o, pendencias) => pendencias.filter((p) => p.os === o.codigo && p.status !== 'cancelada');
const filtrar = (params, pendencias = []) => {
  const pj = params.get('tcprojeto') || ''; const q = (params.get('tcq') || '').toLocaleLowerCase('pt-BR'); const tar = params.get('tctarefas') || '';
  const abertas = (o) => tarefasDo(o, pendencias).filter((p) => p.status === 'aberta').length;
  return lista.filter((o) => (!pj || o.projeto === pj) && (!q || `${o.codigo} ${o.projeto} ${o.titulo} ${o.descricao || ''}`.toLocaleLowerCase('pt-BR').includes(q))
    && (!tar || (tar === 'com' ? abertas(o) > 0 : abertas(o) === 0)));
};
const sel = (cond) => (cond ? html.seguro('selected') : '');
const filtros = (params, extras) => html`<div class="at-filtros">
  <label>Obra / projeto<select data-atas-filtro="tcprojeto"><option value="">Todos</option>${projetosDe(extras).map((c) => html`<option value="${c}" ${sel(c === params.get('tcprojeto'))}>${c}</option>`)}</select></label>
  <label>Tarefas<select data-atas-filtro="tctarefas"><option value="">Todos os cards</option><option value="com" ${sel(params.get('tctarefas') === 'com')}>Com tarefa em aberto</option><option value="sem" ${sel(params.get('tctarefas') === 'sem')}>Sem tarefa em aberto</option></select></label>
  <label>Procurar<input type="search" data-atas-filtro="tcq" value="${params.get('tcq') || ''}" placeholder="Card, obra…"></label></div>`;

export function renderQuadro({ params, podeEditar, projetos = [], pendencias = [] }) {
  const itens = filtrar(params, pendencias);
  const cartao = (o) => {
    const t = tarefasDo(o, pendencias); const ab = t.filter((p) => p.status === 'aberta').length;
    return html`<article class="at-card osq-card" data-tcq="${o.id}" ${podeEditar ? html.seguro('draggable="true"') : ''} title="Clique para abrir${podeEditar ? ' · arraste para mudar a coluna' : ''}">
      <div class="at-tit"><b>${o.titulo || o.codigo}</b></div>
      <div class="at-meta"><span class="at-chip">${o.projeto}</span><span class="at-chip">${o.codigo}</span>${t.length ? html`<span class="at-chip" title="Tarefas em aberto / total">☑ ${ab}/${t.length}</span>` : ''}${(o.fotos || []).length ? html`<span class="at-chip">📷 ${o.fotos.length}</span>` : ''}</div></article>`;
  };
  return html`<section class="osq">
    ${erro ? html`<p class="erro">${erro}</p>` : ''}
    ${filtros(params, projetos)}
    <p class="pequeno">${podeEditar ? 'Arraste o card para a coluna certa ou clique nele para abrir (tarefas e fotos). O + cria um card novo naquela coluna.' : 'Só o orçamento terceirizado, o planejamento, a coordenação e a diretoria mexem nos cards; você acompanha por aqui.'}</p>
    <div class="at-quadro osq-quadro" style="grid-template-columns:repeat(${STATUS.length},minmax(150px,1fr));overflow-x:auto">${STATUS.map((s) => {
    const col = itens.filter((o) => o.status === s.id);
    const mostra = s.id === 'concluido' ? [...col].sort((a, b) => String(b.d_concluido || '').localeCompare(String(a.d_concluido || ''))).slice(0, 30) : col;
    return html`<section class="at-col" data-tcq-col="${s.id}"><header style="background:${s.cor}"><b>${s.nome}</b><span>${col.length}</span>${podeEditar ? html`<button type="button" class="at-col-mais" data-tcq-nova="${s.id}" title="Novo card em ${s.nome}">+</button>` : ''}</header>
      <div class="at-itens">${mostra.map(cartao)}</div></section>`;
  })}</div>
    ${opcoesProjeto(projetosDe(projetos))}</section>`;
}

export function formNova(status, projetos = []) {
  const s = porId[status] || STATUS[0];
  return html`<form class="at-nova-pend at-avulsa" id="tcq-form-nova" data-status="${s.id}">
    <h3>Novo card</h3><p class="pequeno at-av-sub">Entra na coluna "${s.nome}". As tarefas e as fotos ficam dentro do card.</p>
    <div class="at-av-grade">
      <label class="av-m">Obra / projeto<input name="projeto" list="tcq-projetos" required autocomplete="off" placeholder="ex.: Mo602"></label>
      <label class="av-m">Nome do card<input name="titulo" required autocomplete="off" placeholder="ex.: Louças e metais"></label>
    </div>
    ${opcoesProjeto(projetosDe(projetos))}
    <div class="at-av-botoes"><button type="button" class="botao" data-av-fechar>Cancelar</button><button type="submit" class="botao on">Criar card</button></div></form>`;
}

export function detalhe(id, { podeEditar, projetos = [], msg = '', pendencias = [] }) {
  const o = porIdTerc(id);
  if (!o) return html`<div class="tf"><p class="erro">Não achei este card.</p><div class="at-av-botoes"><button type="button" class="botao" data-av-fechar>Fechar</button></div></div>`;
  const dis = podeEditar ? '' : html.seguro('disabled');
  const tarefas = tarefasDo(o, pendencias);
  return html`<div class="tf" data-tcq-raiz="${o.id}">
    <div class="tf-cab"><h3>${o.codigo}</h3><span class="osq-st" style="background:${porId[o.status].cor}">${porId[o.status].nome}</span></div>
    <form id="tcq-form" data-tcq-form="${o.id}" autocomplete="off">
      <div class="tf-grade osq-grade">
        <label>Obra / projeto<input name="projeto" list="tcq-projetos" value="${o.projeto}" required ${dis}></label>
        <label>Nome do card<input name="titulo" value="${o.titulo}" ${dis}></label>
        <label>Coluna<select name="status" ${dis}>${STATUS.map((s) => html`<option value="${s.id}" ${sel(s.id === o.status)}>${s.nome}</option>`)}</select></label>
        <label class="osq-largo">Observações<textarea name="descricao" rows="3" ${dis}>${o.descricao || ''}</textarea></label>
      </div>
      <p class="pequeno">${o.status === 'concluido' ? html`Concluído em ${dBR(o.d_concluido) || '—'}.` : 'O que há para fazer são as tarefas abaixo: cada uma tem responsável, executor e prazo.'}</p>
      <div class="osq-pends"><h4>Tarefas deste card <span class="pequeno">${tarefas.filter((p) => p.status === 'aberta').length} em aberto · ${tarefas.length} no total</span>${podeEditar ? html`<button type="button" class="ac-mini" data-tc-pend="${o.codigo}" data-tc-obra="${o.projeto}" data-tc-fase="${o.status}">+ Nova tarefa</button>` : ''}</h4>
        ${tarefas.length ? '' : html`<p class="pequeno">Nenhuma tarefa ainda.</p>`}
        ${tarefas.map((p) => html`<div class="osq-pend" data-tarefa="${p.id}"><span class="osq-pend-txt">${p.descricao}</span><span class="osq-pend-quem">${p.responsavel_nome || html`<span class="pc-sem-txt">[definir]</span>`}${p.executor && p.executor !== p.responsavel_nome ? html` → ${p.executor}` : ''}</span><span class="osq-pend-st ${p.status === 'feita' ? 'ok' : ''}">${p.status === 'feita' ? 'feita' : `aberta${p.prazo && /^\d{4}/.test(p.prazo) ? ` · ${dBR(p.prazo)}` : ''}`}</span>${podeEditar ? html`<button type="button" class="ac-mini pc-pdel" data-pc-pdel="${p.id}" title="Excluir só esta tarefa (o card continua)">excluir</button>` : ''}</div>`)}</div>
      <div class="osq-fotos"><h4>Fotos <span class="pequeno">${(o.fotos || []).length}</span></h4>
        <div class="osq-galeria">${(o.fotos || []).map((c, i) => html`<figure>${urlFoto(c) ? html`<a href="${urlFoto(c)}" target="_blank" rel="noopener"><img src="${urlFoto(c)}" alt="Foto ${i + 1} do card ${o.codigo}"></a>` : html`<span class="pequeno">carregando…</span>`}${podeEditar ? html`<button type="button" class="ac-mini" data-tcq-foto-del="${o.id}|${i}">tirar</button>` : ''}</figure>`)}</div>
        ${podeEditar ? html`<label class="botao osq-add">+ Adicionar foto<input type="file" accept="image/*" multiple hidden data-tcq-foto="${o.id}"></label>` : ''}</div>
      ${opcoesProjeto(projetosDe(projetos))}
      <div class="tf-botoes">
        ${podeEditar ? html`<button type="submit" class="botao on">Salvar</button><button type="button" class="botao ac-excluir" data-tcq-del="${o.id}">Excluir card</button>` : ''}
        <button type="button" class="botao" data-av-fechar>Fechar</button>${msg ? html`<span class="tf-msg">${msg}</span>` : ''}
      </div>
    </form></div>`;
}
