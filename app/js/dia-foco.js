// "Dia a dia" (pedido do Marcos, 20/11/2026): o foco do pós-obra, de Operações e de cada obra em dias ÚTEIS.
// Mostra o dia útil anterior (para marcar feito / não feito), hoje (se for dia útil) e os dois próximos dias úteis. Sábado, domingo e feriado
// não entram e não se cobra nada neles; obras que trabalham em feriado e fim de semana (ex.: Mo602, corporativa) usam todos os dias.
// Também traz as visões das pendências do departamento (Kanban por prazo e por responsável).
import { html } from './formato.js';
import { somarDias, inicioDaSemana } from './datas.js';
import { feriado } from './feriados.js';
import { listaConfig } from './config.js';
import { partesObra } from './obras-pos.js';
import { NA_NUVEM, listarChecagem, gravarChecagem } from './nuvem.js';

// ---------------------------------------------------------------- dias úteis
export const TRABALHAM_FERIADO = ['Mo602'];   // obras que funcionam em feriados e fins de semana (pode ser trocado em Configurações: obras.sem-folga)
const semAc = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const trabalhaTodoDia = (cod) => {
  const l = listaConfig('obras.sem-folga'); const lista = l && l.length ? l : TRABALHAM_FERIADO; const c = semAc(cod);
  return !!c && lista.some((x) => { const k = semAc(x); return c === k || c.startsWith(k); });
};
export const ehDiaUtil = (iso, cod = '') => {
  if (cod && trabalhaTodoDia(cod)) return true;
  const s = new Date(`${iso}T12:00:00`).getDay(); return s !== 0 && s !== 6 && !feriado(iso);
};
export const proximoUtil = (iso, passo, cod = '') => { let x = somarDias(iso, passo); for (let i = 0; i < 14 && !ehDiaUtil(x, cod); i++) x = somarDias(x, passo); return x; };
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const rotSem = (iso) => `${SEMANA[new Date(`${iso}T12:00:00`).getDay()]} ${dm(iso)}`;

// os 4 dias do foco: dia útil anterior, hoje (só se for útil), e os 2 próximos dias úteis
export function diasDoFoco(hoje, cod = '') {
  const util = ehDiaUtil(hoje, cod);
  const anterior = proximoUtil(hoje, -1, cod);
  const p1 = proximoUtil(hoje, 1, cod); const p2 = proximoUtil(p1, 1, cod);
  const dias = [{ data: anterior, tipo: 'anterior', rotulo: anterior === somarDias(hoje, -1) ? 'Ontem' : 'Dia útil anterior' }];
  if (util) dias.push({ data: hoje, tipo: 'hoje', rotulo: 'Hoje' });
  dias.push({ data: p1, tipo: 'proximo', rotulo: p1 === somarDias(hoje, 1) ? 'Amanhã' : 'Próximo dia útil' });
  dias.push({ data: p2, tipo: 'proximo', rotulo: 'Depois' });
  const motivo = util ? '' : (feriado(hoje) ? `Hoje é feriado (${feriado(hoje)}): não se cobra nada.` : 'Hoje não é dia útil: não se cobra nada.');
  return { dias, aviso: motivo };
}
export const faixaDeDias = (dias) => [dias[0].data, dias[dias.length - 1].data];

// ---------------------------------------------------------------- marcas "feito / não feito" do dia anterior
const CH = 'solida.checagemDia';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CH)) || {}; } catch { return {}; } };
export const checks = {};   // escopo → { 'AAAA-MM-DD|chave': { feito: true|false|null, qtd: número|null } }
export const marca = (escopo, data, chave) => ((checks[escopo] || {})[`${data}|${chave}`] || null);
export async function carregarChecks(escopo, de, ate) {
  try {
    const linhas = NA_NUVEM ? await listarChecagem(escopo, de, ate) : Object.entries(lerLocal()).filter(([k]) => k.startsWith(`${escopo}|`)).map(([k, v]) => { const [, data, chave] = k.split('|'); return { data, chave, feito: typeof v === 'object' ? v.feito : v, qtd: typeof v === 'object' ? v.qtd : null }; });
    const mapa = {}; for (const l of linhas) mapa[`${String(l.data).slice(0, 10)}|${l.chave}`] = { feito: l.feito, qtd: l.qtd == null ? null : Number(l.qtd) };
    const mudou = JSON.stringify(checks[escopo] || {}) !== JSON.stringify(mapa); checks[escopo] = mapa; return mudou;
  } catch { return false; }
}
export async function marcar(escopo, data, chave, feito, qtd = null) {
  if (NA_NUVEM) await gravarChecagem({ escopo, data, chave, feito, qtd });
  else { const l = lerLocal(); l[`${escopo}|${data}|${chave}`] = { feito, qtd }; try { localStorage.setItem(CH, JSON.stringify(l)); } catch { /* sem armazenamento */ } }
  (checks[escopo] = checks[escopo] || {})[`${data}|${chave}`] = { feito, qtd };
}

// ---------------------------------------------------------------- tela dos dias
// cartoes(dia) → [{ chave, titulo, link, sub, pessoas: [{ nome, periodo }], itens: [texto], aviso }]; livres(dia) → html (opcional)
export function renderDias({ escopo, dias, aviso = '', cartoes, livres = null, podeChecar = false, vazio = 'Nada programado.' }) {
  const marcas = checks[escopo] || {};
  const PER = { manha: 'manhã', tarde: 'tarde' };
  const cartao = (d, c) => {
    const m = marcas[`${d.data}|${c.chave}`] || null;
    const ant = d.tipo === 'anterior';
    // controles de um item (ou do cartão todo): feito / não feito e, no item, a quantidade quando for diferente da meta
    const controles = (chave, meta) => { const x = marcas[`${d.data}|${chave}`] || null; const f = x ? x.feito : null;
      return html`<span class="df-chk-i">${podeChecar ? html`<button type="button" class="ac-mini ${f === true ? 'on' : ''}" data-dia-chk="${escopo}|${d.data}|${chave}|1" title="Feito">✔</button><button type="button" class="ac-mini ${f === false ? 'on nao' : ''}" data-dia-chk="${escopo}|${d.data}|${chave}|0" title="Não feito">✖</button>${meta != null ? html`<input type="number" class="df-qtd" step="0.1" min="0" value="${x && x.qtd != null ? x.qtd : ''}" placeholder="fez" title="Quantidade feita, se for diferente da meta (${meta})" data-dia-qtd="${escopo}|${d.data}|${chave}" data-meta="${meta}">` : ''}` : html`<b>${f === true ? '✔' : f === false ? '✖' : '·'}</b>${x && x.qtd != null ? html` <small>fez ${x.qtd}</small>` : ''}`}</span>`; };
    const item = (s) => html`<li class="df-it ${ant && (marcas[`${d.data}|${c.chave}~${s.k}`] || {}).feito === true ? 'df-it-ok' : ant && (marcas[`${d.data}|${c.chave}~${s.k}`] || {}).feito === false ? 'df-it-nao' : ''}">
      <span class="df-it-txt">${s.texto}</span>
      <span class="df-it-quem">${s.tipo === 'laranja' ? (s.empresa ? html`<span class="df-emp">${s.empresa}</span>` : html`<span class="df-sem">empresa não informada</span>`) : (s.quem || []).length ? html`${s.quem.map((n) => html`<span class="df-chip">${n}</span>`)}${s.sugerido ? html` <i class="df-sug" title="O sistema sugeriu quem faz, pela função e pela produtividade">sugerido</i>` : ''}` : html`<span class="df-sem">${s.semQuem || 'sem funcionário'}</span>`}</span>
      ${ant ? controles(`${c.chave}~${s.k}`, s.qtd) : ''}</li>`;
    const grupo = (rot, cls, l) => (l.length ? html`<div class="df-grupo ${cls}"><h5>${rot}</h5><ul class="df-lista">${l.map(item)}</ul></div>` : '');
    const origemCls = { drive: 'df-or-drive', meta: 'df-or-meta', nada: 'df-or-nada' };
    return html`<article class="df-card ${!c.servicos && ant && m && m.feito === true ? 'df-ok' : !c.servicos && ant && m && m.feito === false ? 'df-nao' : ''}">
      <div class="df-tit">${c.link ? html`<a href="${c.link}">${c.titulo}</a>` : html`<b>${c.titulo}</b>`}${c.sub ? html`<small>${c.sub}</small>` : ''}</div>
      ${c.servicos ? html`${grupo('Escopo cinza · Sólida', 'df-cinza', c.servicos.filter((s) => s.tipo !== 'laranja'))}${grupo('Laranja · terceirizados', 'df-laranja', c.servicos.filter((s) => s.tipo === 'laranja'))}
        ${c.servicos.length ? '' : html`<p class="df-vazio">Nenhum serviço para este dia.</p>`}
        ${(c.pessoasLivres || []).length ? html`<p class="df-livre-sem">Alocado na obra, sem serviço: ${c.pessoasLivres.map((p) => html`<span class="df-chip">${p.nome}${p.periodo && p.periodo !== 'dia' ? html` <small>${PER[p.periodo] || ''}</small>` : ''}</span>`)}</p>` : ''}
        ${c.aviso ? html`<p class="df-aviso">${c.aviso}</p>` : ''}
        ${c.origemInfo ? html`<p class="df-origem-rod ${origemCls[c.origemInfo.tipo] || ''}">${c.origemInfo.texto}</p>` : ''}`
      : html`${(c.pessoas || []).length ? html`<div class="df-pes">${c.pessoas.map((p) => html`<span class="df-chip">${p.nome}${p.periodo && p.periodo !== 'dia' ? html` <small>${PER[p.periodo] || ''}</small>` : ''}</span>`)}</div>` : html`<div class="df-pes"><span class="df-sem">sem funcionário alocado</span></div>`}
        ${(c.itens || []).length ? html`<ul class="df-itens">${c.itens.map((t) => html`<li>${t}</li>`)}</ul>` : ''}
        ${c.aviso ? html`<p class="df-aviso">${c.aviso}</p>` : ''}
        ${ant ? html`<div class="df-chk"><span class="pequeno">Foi feito?</span>${podeChecar ? html`<button type="button" class="ac-mini ${m && m.feito === true ? 'on' : ''}" data-dia-chk="${escopo}|${d.data}|${c.chave}|1">✔ feito</button><button type="button" class="ac-mini ${m && m.feito === false ? 'on nao' : ''}" data-dia-chk="${escopo}|${d.data}|${c.chave}|0">✖ não feito</button>` : html`<b>${m && m.feito === true ? '✔ feito' : m && m.feito === false ? '✖ não feito' : 'sem marca'}</b>`}</div>` : ''}`}
    </article>`;
  };
  return html`<div class="df">
    ${aviso ? html`<p class="df-feriado">${aviso}</p>` : ''}
    <div class="df-grade" style="grid-template-columns:repeat(${dias.length},minmax(0,1fr))">${dias.map((d) => {
    const l = cartoes(d);
    return html`<section class="df-col df-${d.tipo}"><header><b>${d.rotulo}</b><span>${rotSem(d.data)}</span></header>
      ${l.length ? l.map((c) => cartao(d, c)) : html`<p class="df-vazio">${vazio}</p>`}
      ${livres ? livres(d) : ''}</section>`;
  })}</div></div>`;
}

// ---------------------------------------------------------------- cartões do pós-obra
const chaveObra = (n) => { const s = String(n || '').trim(); const m = /^(?:mo|po)\s*[-_]?\s*(\d+[a-z]?)/i.exec(s); return m ? `${/^mo/i.test(s) ? 'mo' : 'po'}${m[1].toLowerCase()}` : s.toLowerCase(); };
const curto = (t, n = 70) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : s; };
export function cartoesPos({ dia, linhas = [], base = { agenda: [], obraPorNome: new Map() }, osLista = [] }) {
  const porObra = new Map();
  const pega = (obra) => { const k = chaveObra(obra); if (!porObra.has(k)) porObra.set(k, { obra, pessoas: [] }); return porObra.get(k); };
  for (const l of linhas.filter((x) => x.data === dia)) { const g = pega(l.obra); if (!g.pessoas.some((p) => p.nome === l.pessoa)) g.pessoas.push({ nome: l.pessoa, periodo: l.periodo || 'dia' }); }
  // sem lançamento no sistema: o que está escrito na planilha do pós-obra
  for (const a of (base.agenda || []).filter((x) => x.data === dia)) {
    if (porObra.has(chaveObra(a.obra))) continue;
    const g = pega(a.obra); for (const n of (a.pessoas && a.pessoas.length ? a.pessoas : [])) if (!g.pessoas.some((p) => p.nome === n)) g.pessoas.push({ nome: n, periodo: 'dia' });
    if (!g.pessoas.length && a.texto) g.texto = a.texto;
  }
  return [...porObra.values()].sort((a, b) => a.obra.localeCompare(b.obra, 'pt-BR', { numeric: true })).map((g) => {
    const o = (base.obraPorNome && base.obraPorNome.get(g.obra)) || { obra: g.obra };
    const pt = partesObra(o);
    const os = osLista.filter((x) => chaveObra(x.cliente) === chaveObra(g.obra) && ['agendado', 'execucao'].includes(x.status));
    const servs = ((o.servicos || []).filter((s) => s.aberta && ['Execução', 'Agendamento', 'Planejamento'].includes(s.situacao)));
    const itens = [...os.map((x) => `${x.codigo}: ${curto(x.assunto)}`), ...(os.length ? [] : servs.slice(0, 2).map((s) => `${s.os}: ${curto(s.relato)}`))].slice(0, 3);
    if (g.texto) itens.push(`Planilha: ${curto(g.texto, 60)}`);
    return { chave: chaveObra(g.obra), titulo: pt.titulo || g.obra, sub: pt.sub, link: /^po/i.test(g.obra) ? `#/posobra/obra/${encodeURIComponent(g.obra)}` : `#/obra/${encodeURIComponent(g.obra)}`, pessoas: g.pessoas, itens };
  });
}

// ---------------------------------------------------------------- cartões de Operações (uma obra por cartão) e de uma obra
// obras: códigos em andamento; linhas: alocação das obras; itensDoDia(cod, dia) → [{ item, meta, unidade }]
export function cartoesOperacao({ dia, obras = [], linhas = [], itensDoDia = () => [], semProgramacao = () => false, programar = null }) {
  const txt = (i) => `${i.item}${i.meta != null ? `: ${Number(i.meta).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${i.unidade || ''}` : ''}`.trim();
  return obras.filter((cod) => ehDiaUtil(dia, cod)).map((cod) => {
    const pessoas = linhas.filter((l) => l.data === dia && l.obra === cod).map((l) => ({ nome: l.pessoa, periodo: l.periodo || 'dia' }));
    if (programar) {   // quem executa o quê: programação da pasta ou montada pela meta da semana × produtividade (programar-dia.js)
      const r = programar(cod, dia, pessoas);
      return { chave: cod, titulo: cod, link: `#/obra/${encodeURIComponent(cod)}`, servicos: r.servicos, pessoasLivres: r.pessoasLivres, aviso: r.aviso, origemInfo: r.origemInfo };
    }
    const itens = itensDoDia(cod, dia).filter((i) => i.item).map(txt).slice(0, 4);
    return { chave: cod, titulo: cod, link: `#/obra/${encodeURIComponent(cod)}`, pessoas, itens, aviso: !itens.length ? (semProgramacao(cod) ? 'Sem programação semanal na pasta da obra.' : 'Sem meta para este dia.') : '' };
  });
}

// ---------------------------------------------------------------- pendências do departamento: Kanban por prazo e por responsável
const dBR = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
export function renderPendenciasDep({ pendencias = [], hoje, visao = 'kanban', vazio = 'Nenhuma pendência do departamento.' }) {
  const abertas = pendencias.filter((p) => p.status === 'aberta');
  const fimSem = somarDias(inicioDaSemana(hoje), 6);
  const comPrazo = (p) => (p.prazo && /^\d{4}-\d{2}-\d{2}/.test(p.prazo) ? p.prazo.slice(0, 10) : '');
  const COLS = [
    ['Atrasadas', '#9B3A33', (p) => comPrazo(p) && comPrazo(p) < hoje],
    ['Esta semana', '#C0692B', (p) => comPrazo(p) && comPrazo(p) >= hoje && comPrazo(p) <= fimSem],
    ['Depois', '#2F5F86', (p) => comPrazo(p) && comPrazo(p) > fimSem],
    ['Sem prazo', '#6E7782', (p) => !comPrazo(p)],
  ];
  const feitas = pendencias.filter((p) => p.status === 'feita').sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 8);
  const cartao = (p) => html`<article class="at-card df-pend ${p.urgencia === 'alta' ? 'df-alta' : ''}" data-tarefa="${p.id}" title="Clique para abrir a tarefa">
    <div class="df-pend-tit">${curto(p.descricao, 80)}</div>
    <div class="at-meta">${p.obra ? html`<span class="at-chip">${p.obra}</span>` : ''}${p.os ? html`<span class="at-chip">${p.os}</span>` : ''}${p.urgencia === 'alta' ? html`<span class="at-chip df-urg">alta</span>` : ''}<span class="at-chip">${p.responsavel_nome || 'sem responsável'}</span>${comPrazo(p) ? html`<span class="at-chip">${dBR(comPrazo(p))}</span>` : ''}</div></article>`;
  const ordena = (l) => [...l].sort((a, b) => (a.urgencia === 'alta' ? 0 : 1) - (b.urgencia === 'alta' ? 0 : 1) || String(comPrazo(a) || '9').localeCompare(String(comPrazo(b) || '9')));
  let corpo;
  if (visao === 'resp') {
    const g = new Map(); for (const p of abertas) { const k = p.responsavel_nome || 'Sem responsável'; (g.get(k) || g.set(k, []).get(k)).push(p); }
    corpo = abertas.length ? html`<div class="df-resp">${[...g.entries()].sort((a, b) => b[1].length - a[1].length).map(([nome, l]) => {
      const atr = l.filter((p) => comPrazo(p) && comPrazo(p) < hoje).length;
      return html`<details class="caixa" ${atr ? html.seguro('open') : ''}><summary><span class="caixa-tit">${nome}</span><span class="pequeno">${l.length} em aberto${atr ? ` · ${atr} atrasada(s)` : ''}</span></summary><div class="df-resp-lista">${ordena(l).map(cartao)}</div></details>`;
    })}</div>` : html`<p class="pd-vazio">${vazio}</p>`;
  } else {
    corpo = html`<div class="at-quadro df-quadro" style="grid-template-columns:repeat(${COLS.length + 1},minmax(0,1fr));overflow-x:auto">${COLS.map(([nome, cor, f]) => {
      const l = ordena(abertas.filter(f));
      return html`<section class="at-col"><header style="background:${cor}"><b>${nome}</b><span>${l.length}</span></header><div class="at-itens">${l.slice(0, 12).map(cartao)}${l.length > 12 ? html`<p class="pequeno">e mais ${l.length - 12}</p>` : ''}${l.length ? '' : html`<p class="df-vazio">nenhuma</p>`}</div></section>`;
    })}<section class="at-col"><header style="background:#4F7D5C"><b>Feitas</b><span>${feitas.length}</span></header><div class="at-itens">${feitas.map(cartao)}${feitas.length ? '' : html`<p class="df-vazio">nenhuma</p>`}</div></section></div>`;
  }
  return html`<section class="df-pends"><div class="at-filtros"><label>Visão<select data-atas-filtro="pdv"><option value="kanban" ${visao !== 'resp' ? html.seguro('selected') : ''}>Kanban por prazo</option><option value="resp" ${visao === 'resp' ? html.seguro('selected') : ''}>Por responsável</option></select></label>
    <span class="pequeno">${abertas.length} em aberto · ${abertas.filter((p) => comPrazo(p) && comPrazo(p) < hoje).length} atrasada(s)</span></div>${corpo}</section>`;
}
