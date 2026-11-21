// Orçamentos (operação da empresa): o orçamento de cada OBRA EM ANDAMENTO, ou seja, o escopo contratado e os aditivos.
// (Os orçamentos de propostas, a conversão e as arquiteturas são do Comercial.)
// Fonte: GERENCIAMENTO › DOC › ESCOPO de cada obra, lida pelo coletor (projetos.json). Os valores em R$ só aparecem para quem vê valores.

import { html, reais } from '../formato.js';

const ST = { aprovado: 'Aprovado', aguardando: 'Aguardando', nao: 'Não aprovado', sem: 'Sem indicação' };
const lista = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
const soma = (xs) => xs.reduce((s, a) => s + (typeof a.total === 'number' ? a.total : 0), 0);
const dataBR = (s) => String(s || '').replace(/\./g, '/');
const revTxt = (r) => (r && typeof r === 'object' ? String(r.rev || r.revisao || r.codigo || r.nome || r.arquivo || '—') : r || '—');
const casaObra = (o, p) => p.obra === o || p.obra.startsWith(o) || o.startsWith(p.obra);

// Tarefas dentro do card da obra (pendências com os = AD-<obra>), como nos cards do pós-obra e do CRM
const tarefasHtml = (obra, pendencias, podeEditar) => {
  const os = `AD-${obra}`; const t = (pendencias || []).filter((p) => p.os === os && p.status !== 'cancelada');
  const ab = t.filter((p) => p.status === 'aberta');
  return html`<div class="osq-pends or-tarefas"><h4>Tarefas dos aditivos <span class="pequeno">${ab.length} em aberto · ${t.length} no total</span>${podeEditar ? html`<button type="button" class="ac-mini" data-oq-pend="${os}" data-oq-obra="${obra}">+ Nova tarefa</button>` : ''}</h4>
    ${t.length ? '' : html`<p class="pequeno">Nenhuma tarefa ainda.</p>`}
    ${t.map((p) => html`<div class="osq-pend" data-tarefa="${p.id}"><span class="osq-pend-txt">${p.descricao}</span><span class="osq-pend-quem">${p.responsavel_nome || html`<span class="pc-sem-txt">[definir]</span>`}</span><span class="osq-pend-st ${p.status === 'feita' ? 'ok' : ''}">${p.status === 'feita' ? 'feita' : `aberta${p.prazo && /^\d{4}-/.test(p.prazo) ? ` · ${p.prazo.slice(0, 10).split('-').reverse().join('/')}` : ''}`}</span></div>`)}</div>`;
};

export function render(CFG, projetos, veValores, visiveis = null, { pendencias = [], podeEditar = false } = {}) {
  const todas = lista(projetos && projetos.obras);
  const ativas = ((CFG && CFG.obras) || []).filter((o) => /^Mo/i.test(o) && (!visiveis || visiveis.includes(o)));
  const obras = ativas.map((o) => {
    const p = todas.find((x) => casaObra(o, x));
    const e = p && p.escopo;
    const grupos = lista(e && e.grupos); const ads = lista(e && e.aditivos).filter((a) => a && typeof a === 'object');
    const itens = grupos.reduce((s, g) => s + lista(g.itens).length, 0);
    const por = (st) => ads.filter((a) => a.situacao === st);
    return { o, e, grupos: grupos.length, itens, ads, por, cliente: (e && e.cliente) || '' };
  }).sort((x, y) => (y.ads.length - x.ads.length) || x.o.localeCompare(y.o));

  const todosAds = obras.flatMap((x) => x.ads);
  const aprov = todosAds.filter((a) => a.situacao === 'aprovado'); const agu = todosAds.filter((a) => a.situacao === 'aguardando');
  const comEscopo = obras.filter((x) => x.e).length;
  const kpi = (rot, val, sub = '') => html`<div class="or-kpi"><span>${rot}</span><b>${val}</b>${sub ? html`<small>${sub}</small>` : ''}</div>`;

  return html`<div class="pagina orcamentos">
    <div class="painel-h"><h2>Orçamentos das obras em andamento</h2><p>Escopo contratado e aditivos de cada obra que está em andamento. Os orçamentos de propostas e as arquiteturas ficam em <a class="link" href="#/comercial">Comercial</a>.</p></div>
    <div class="or-kpis">
      ${kpi('Obras em andamento', String(obras.length), `${comEscopo} com planilha de escopo`)}
      ${kpi('Aditivos aprovados', String(aprov.length), veValores ? reais(soma(aprov)) : '')}
      ${kpi('Aditivos aguardando', String(agu.length), veValores ? reais(soma(agu)) : '')}
      ${kpi('Aditivos no total', String(todosAds.length), veValores ? `${reais(soma(todosAds))} somando todos` : '')}
    </div>
    <div class="or-grade">${obras.length ? obras.map((x) => html`<article class="or-card">
      <header><b class="or-cod">${x.o}</b><span>${x.cliente || 'sem cliente na planilha'}</span></header>
      ${x.e ? html`<p class="or-escopo"><b>Escopo ${revTxt(x.e.rev)}</b>${x.e.data ? html` · ${dataBR(x.e.data)}` : ''}<small>${x.itens} itens em ${x.grupos} grupos</small></p>`
        : html`<p class="or-escopo or-sem">Sem planilha de escopo na pasta da obra (GERENCIAMENTO › DOC › ESCOPO).</p>`}
      <div class="or-ads"><b>${x.ads.length} ${x.ads.length === 1 ? 'aditivo' : 'aditivos'}</b>${['aprovado', 'aguardando', 'nao', 'sem'].map((s) => (x.por(s).length ? html`<span class="or-ad or-ad-${s}" title="${ST[s]}">${x.por(s).length} ${ST[s].toLowerCase()}</span>` : ''))}</div>
      ${veValores && x.ads.length ? html`<p class="or-val"><span>Aprovados: <b>${reais(soma(x.por('aprovado')))}</b></span><span>Aguardando: <b>${reais(soma(x.por('aguardando')))}</b></span></p>` : ''}
      ${tarefasHtml(x.o, pendencias, podeEditar)}
      <footer><a class="botao" href="#/operacao?obra=${encodeURIComponent(x.o)}&aba=escopo">Escopo</a><a class="botao" href="#/operacao?obra=${encodeURIComponent(x.o)}&aba=aditivos">Aditivos</a></footer>
    </article>`) : html`<p class="vazio">Nenhuma obra em andamento encontrada.</p>`}</div>
    <p class="legenda-semana">Dados lidos das planilhas de escopo das obras no Drive. "Sem indicação" = o aditivo está na planilha, mas sem a situação marcada.</p>
  </div>`;
}
