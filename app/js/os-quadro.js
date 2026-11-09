// Quadro de OS do pós-obra (pedido do Felipe, 09/11/2026). Cada cartão é uma OS (PO tal + assunto) e anda pelas colunas
// Solicitação > Análise > Orçamento > Falta agendar > Agendado > Em execução > Concluído. Ao clicar abre a OS (cliente, assunto,
// status, problema, solução, fotos e, nas colunas em andamento, responsável e data limite, que viram pendência de quem responde).
// Segundo quadro: as datas de cada etapa de todas as OS. Na nuvem: tabela os_quadro (supabase/12-os-quadro.sql); no computador do
// escritório (teste): neste navegador.
import { html } from './formato.js';
import { hojeISO } from './datas.js';
import { NA_NUVEM, listarOsQuadro, gravarOsQuadro, apagarOsQuadro, enviarFotoOs, apagarFotoOs, urlsFotosOs } from './nuvem.js';
import { pessoasDaEquipe } from './telas/atas.js';

export const STATUS = [
  { id: 'solicitacao', nome: 'Solicitação', cor: '#6E7782', data: 'd_solicitacao' },
  { id: 'analise', nome: 'Análise', cor: '#7B6AA8', data: 'd_analise' },
  { id: 'orcamento', nome: 'Orçamento', cor: '#B58A1B', data: 'd_orcamento' },
  { id: 'falta_agendar', nome: 'Falta agendar', cor: '#C0692B', data: null },
  { id: 'agendado', nome: 'Agendado', cor: '#3C7480', data: 'd_agendamento' },
  { id: 'execucao', nome: 'Em execução', cor: '#2F5F86', data: 'd_execucao' },
  { id: 'concluido', nome: 'Concluído', cor: '#4F7D5C', data: 'd_concluido' },
];
export const DATAS = [['d_solicitacao', 'Solicitação'], ['d_analise', 'Análise'], ['d_orcamento', 'Orçamento'], ['d_agendamento', 'Agendamento'], ['d_execucao', 'Execução'], ['d_concluido', 'Concluído']];
const porId = Object.fromEntries(STATUS.map((s) => [s.id, s]));
const CHAVE = 'solida.osQuadro';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch { return []; } };
const gravarLocal = (l) => { try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch { /* sem armazenamento */ } };
const dBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

export let lista = [];
export let erro = '';
let urls = {};   // caminho da foto → endereço para mostrar

export async function carregar() {
  try {
    lista = NA_NUVEM ? await listarOsQuadro() : lerLocal().sort((a, b) => b.id - a.id);
    erro = '';
    const caminhos = [...new Set(lista.flatMap((o) => o.fotos || []).filter((c) => !c.startsWith('data:')))];
    if (NA_NUVEM && caminhos.length) urls = { ...urls, ...(await urlsFotosOs(caminhos)) };
  } catch (e) { erro = String(e.message || e); }
  return lista;
}
export const porIdOs = (id) => lista.find((o) => String(o.id) === String(id));
const urlFoto = (c) => (c.startsWith('data:') ? c : urls[c] || '');

// no computador do escritório (teste) faz o que os gatilhos do banco fazem na nuvem
function aplicarRegrasLocais(o) {
  const hoje = hojeISO();
  const s = porId[o.status];
  if (s && s.data && !o[s.data]) o[s.data] = hoje;
  if (!o.codigo) o.codigo = `OS-${String(o.id).padStart(3, '0')}`;
  const p = pessoasDaEquipe().find((x) => x.id === o.responsavel); if (p) o.responsavel_nome = p.nome;
  return o;
}
async function gravar(linha) {
  if (NA_NUVEM) { const r = await gravarOsQuadro(linha); const i = lista.findIndex((o) => o.id === r.id); if (i >= 0) lista[i] = r; else lista.unshift(r); return r; }
  const todas = lerLocal(); let o;
  if (linha.id) { o = todas.find((x) => x.id === linha.id); Object.assign(o, linha); } else { o = { id: todas.reduce((m, x) => Math.max(m, x.id), 0) + 1, fotos: [], criado_em: new Date().toISOString(), d_solicitacao: hojeISO(), ...linha }; todas.push(o); }
  aplicarRegrasLocais(o); gravarLocal(todas); lista = todas.sort((a, b) => b.id - a.id); return o;
}

export const criar = (c) => gravar({ cliente: String(c.cliente || '').trim(), assunto: String(c.assunto || '').trim(), status: c.status || 'solicitacao', problema: c.problema || null });
export const salvar = (id, campos) => gravar({ id, ...campos });
export const mover = (id, status) => gravar({ id, status });
export async function apagar(id) {
  const o = porIdOs(id);
  if (NA_NUVEM) { await apagarOsQuadro(id); for (const c of (o && o.fotos) || []) await apagarFotoOs(c); lista = lista.filter((x) => x.id !== o.id); return; }
  const t = lerLocal().filter((x) => String(x.id) !== String(id)); gravarLocal(t); lista = t;
}

// foto reduzida (largura máxima 1280) antes de guardar
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
  const o = porIdOs(id); if (!o) return;
  const blob = await reduzir(arquivo);
  let caminho;
  if (NA_NUVEM) { caminho = await enviarFotoOs(o.id, blob); }
  else caminho = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  await salvar(o.id, { fotos: [...(o.fotos || []), caminho] });
  if (NA_NUVEM) urls = { ...urls, ...(await urlsFotosOs([caminho])) };
}
export async function tirarFoto(id, indice) {
  const o = porIdOs(id); if (!o) return;
  const f = [...(o.fotos || [])]; const [tirada] = f.splice(indice, 1);
  await salvar(o.id, { fotos: f }); if (NA_NUVEM && tirada && !tirada.startsWith('data:')) await apagarFotoOs(tirada);
}

// ---------------------------------------------------------------- telas
const opcoesCliente = (clientes) => html`<datalist id="osq-clientes">${clientes.map((c) => html`<option value="${c}">`)}</datalist>`;
const filtrar = (params) => {
  const cli = params.get('cliente') || ''; const q = (params.get('q') || '').toLocaleLowerCase('pt-BR');
  return lista.filter((o) => (!cli || o.cliente === cli) && (!q || `${o.codigo} ${o.cliente} ${o.assunto} ${o.problema || ''}`.toLocaleLowerCase('pt-BR').includes(q)));
};
const clientesDe = (extras = []) => [...new Set([...extras, ...lista.map((o) => o.cliente)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
const filtros = (params, extras) => html`<div class="at-filtros">
  <label>PO / cliente<select data-atas-filtro="cliente"><option value="">Todos</option>${clientesDe(extras).map((c) => html`<option value="${c}" ${c === params.get('cliente') ? html.seguro('selected') : ''}>${c}</option>`)}</select></label>
  <label>Procurar<input type="search" data-atas-filtro="q" value="${params.get('q') || ''}" placeholder="OS, assunto, problema…"></label></div>`;

export function renderQuadro({ params, podeEditar, clientesPos = [], semFiltros = false }) {
  const itens = filtrar(params);
  const hoje = hojeISO();
  const cartao = (o) => {
    const atrasada = o.status !== 'concluido' && o.data_limite && o.data_limite < hoje;
    return html`<article class="at-card osq-card" data-osq="${o.id}" ${podeEditar ? html.seguro('draggable="true"') : ''} title="Clique para abrir${podeEditar ? ' · arraste para mudar o status' : ''}">
      <div class="at-tit"><b>${o.cliente}</b>${o.assunto ? `, ${o.assunto}` : ''}</div>
      <div class="at-meta"><span class="at-chip">${o.codigo}</span>${o.status !== 'concluido' && o.data_limite ? html`<span class="at-prazo ${atrasada ? 'at-p-vencido' : ''}">até ${dm(o.data_limite)}</span>` : ''}${(o.fotos || []).length ? html`<span class="at-chip">📷 ${o.fotos.length}</span>` : ''}</div>
      ${o.status !== 'concluido' && o.responsavel_nome ? html`<div class="at-quem"><span class="at-pessoa">${o.responsavel_nome}</span></div>` : ''}</article>`;
  };
  return html`<section class="osq">
    ${erro ? html`<p class="erro">${erro}</p>` : ''}
    ${semFiltros ? '' : filtros(params, clientesPos)}
    <p class="pequeno">${podeEditar ? 'Arraste o cartão para a coluna certa ou clique nele para abrir a OS. O + cria uma OS nova naquela coluna.' : 'Só o pós-obra, a coordenação e a diretoria mexem nas OS; você acompanha por aqui.'}</p>
    <div class="at-quadro osq-quadro">${STATUS.map((s) => {
    const col = itens.filter((o) => o.status === s.id);
    const mostra = s.id === 'concluido' ? [...col].sort((a, b) => String(b.d_concluido || '').localeCompare(String(a.d_concluido || ''))).slice(0, 30) : col;
    return html`<section class="at-col" data-osq-col="${s.id}"><header style="background:${s.cor}"><b>${s.nome}</b><span>${col.length}</span>${podeEditar ? html`<button type="button" class="at-col-mais" data-osq-nova="${s.id}" title="Nova OS em ${s.nome}">+</button>` : ''}</header>
      <div class="at-itens">${mostra.map(cartao)}</div></section>`;
  })}</div>
    ${opcoesCliente(clientesDe(clientesPos))}</section>`;
}

// quadro de datas: uma linha por OS, uma coluna por etapa
export function renderDatas({ params, podeEditar, clientesPos = [] }) {
  const itens = filtrar(params);
  const hoje = hojeISO();
  const dias = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 86400000) : null);
  return html`<section class="osq">
    ${erro ? html`<p class="erro">${erro}</p>` : ''}
    ${filtros(params, clientesPos)}
    <p class="pequeno">A data de cada etapa é preenchida sozinha quando a OS entra na coluna do quadro${podeEditar ? ' (dá para corrigir aqui)' : ''}. "Total" = dias da solicitação até a conclusão (ou até hoje, se ainda aberta).</p>
    <div class="pd-tab-caixa"><div class="tabela-rolagem"><table class="pd-tab osq-datas">
      <thead><tr><th>OS</th><th>PO / cliente — assunto</th><th>Status</th>${DATAS.map(([, n]) => html`<th>Data de ${n.toLocaleLowerCase('pt-BR')}</th>`)}<th>Total</th></tr></thead>
      <tbody>${itens.length ? itens.map((o) => html`<tr>
        <td class="pd-t1"><a href="#" data-osq="${o.id}">${o.codigo}</a></td>
        <td><b>${o.cliente}</b>${o.assunto ? `, ${o.assunto}` : ''}</td>
        <td><span class="osq-st" style="background:${(porId[o.status] || {}).cor}">${(porId[o.status] || {}).nome}</span></td>
        ${DATAS.map(([campo]) => html`<td>${podeEditar ? html`<input type="date" data-osq-data="${o.id}|${campo}" value="${o[campo] || ''}">` : (dBR(o[campo]) || html`<span class="muted">—</span>`)}</td>`)}
        <td class="n">${(() => { const t = dias(o.d_solicitacao, o.d_concluido || hoje); return t == null ? '—' : `${t} d`; })()}</td></tr>`) : html`<tr><td colspan="10"><p class="pd-vazio">Nenhuma OS ainda. Crie a primeira no Quadro de OS.</p></td></tr>`}</tbody>
    </table></div></div></section>`;
}

export function formNova(status, clientesPos = []) {
  const s = porId[status] || STATUS[0];
  return html`<form class="at-nova-pend at-avulsa" id="osq-form-nova" data-status="${s.id}">
    <h3>Nova OS</h3><p class="pequeno at-av-sub">Entra na coluna "${s.nome}". Os demais campos (problema, solução, fotos, responsável…) ficam dentro da OS.</p>
    <div class="at-av-grade">
      <label class="av-m">PO ou cliente<input name="cliente" list="osq-clientes" required autocomplete="off" placeholder="ex.: Po566"></label>
      <label class="av-m">Assunto<input name="assunto" required autocomplete="off" placeholder="ex.: Infiltração no banheiro"></label>
    </div>
    ${opcoesCliente(clientesDe(clientesPos))}
    <div class="at-av-botoes"><button type="button" class="botao" data-av-fechar>Cancelar</button><button type="submit" class="botao on">Criar OS</button></div></form>`;
}

export function detalhe(id, { podeEditar, clientesPos = [], msg = '' }) {
  const o = porIdOs(id);
  if (!o) return html`<div class="tf"><p class="erro">Não achei esta OS.</p><div class="at-av-botoes"><button type="button" class="botao" data-av-fechar>Fechar</button></div></div>`;
  const dis = podeEditar ? '' : html.seguro('disabled');
  const andamento = o.status !== 'concluido';
  const pessoas = pessoasDaEquipe();
  return html`<div class="tf" data-osq-raiz="${o.id}">
    <div class="tf-cab"><h3>${o.codigo}</h3><span class="osq-st" style="background:${porId[o.status].cor}">${porId[o.status].nome}</span></div>
    <form id="osq-form" data-osq-form="${o.id}" autocomplete="off">
      <div class="tf-grade osq-grade">
        <label>PO ou cliente<input name="cliente" list="osq-clientes" value="${o.cliente}" required ${dis}></label>
        <label>Assunto<input name="assunto" value="${o.assunto}" ${dis}></label>
        <label>Status<select name="status" ${dis}>${STATUS.map((s) => html`<option value="${s.id}" ${s.id === o.status ? html.seguro('selected') : ''}>${s.nome}</option>`)}</select></label>
        <label class="osq-largo">Problema<textarea name="problema" rows="3" ${dis}>${o.problema || ''}</textarea></label>
        <label class="osq-largo">Solução<textarea name="solucao" rows="3" ${dis}>${o.solucao || ''}</textarea></label>
        ${andamento ? html`<label>Responsável<select name="responsavel" ${dis}><option value="">— escolher —</option>${pessoas.map((p) => html`<option value="${p.id}" ${p.id === o.responsavel ? html.seguro('selected') : ''}>${p.nome}</option>`)}</select></label>
        <label>Data limite<input type="date" name="data_limite" value="${o.data_limite || ''}" ${dis}></label>` : ''}
      </div>
      ${andamento ? html`<p class="pequeno">Responsável e data limite viram uma pendência dele em Tarefas.</p>` : html`<p class="pequeno">Concluída em ${dBR(o.d_concluido) || '—'}. A pendência dela foi encerrada.</p>`}
      <div class="osq-fotos"><h4>Fotos <span class="pequeno">${(o.fotos || []).length}</span></h4>
        <div class="osq-galeria">${(o.fotos || []).map((c, i) => html`<figure>${urlFoto(c) ? html`<a href="${urlFoto(c)}" target="_blank" rel="noopener"><img src="${urlFoto(c)}" alt="Foto ${i + 1} da ${o.codigo}"></a>` : html`<span class="pequeno">carregando…</span>`}${podeEditar ? html`<button type="button" class="ac-mini" data-osq-foto-del="${o.id}|${i}">tirar</button>` : ''}</figure>`)}</div>
        ${podeEditar ? html`<label class="botao osq-add">+ Adicionar foto<input type="file" accept="image/*" multiple hidden data-osq-foto="${o.id}"></label>` : ''}</div>
      ${opcoesCliente(clientesDe(clientesPos))}
      <div class="tf-botoes">
        ${podeEditar ? html`<button type="submit" class="botao on">Salvar</button><button type="button" class="botao ac-excluir" data-osq-del="${o.id}">Excluir OS</button>` : ''}
        <button type="button" class="botao" data-av-fechar>Fechar</button>${msg ? html`<span class="tf-msg">${msg}</span>` : ''}
      </div>
    </form></div>`;
}
