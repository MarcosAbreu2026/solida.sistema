// Operação: acompanhamento de todas as obras, só consulta. Abas:
// Resumo · Programação semanal · Metas · Produtividade · Medições · Diário de obra.
// As abas de Medições e Diário leem o que o agente de Operação escreveu (Mais Controle) e separam por obra.

import { html, data as fmtData } from '../formato.js';
import { hojeISO, somarDias, inicioDaSemana } from '../datas.js';
import { programacoes, registroDoDia, feriado, classificar, ordenarObras } from '../programacao.js';

// Divisão pedida em 15/10: metas e medições são da Operação; produtividade e diário de obra são do
// Planejamento; a programação semanal aparece nos dois.
// Operação (15/10): sem abas — só o Resumo (todas as obras) e, embaixo, Por obra.

export const ABAS_PLANEJAMENTO = [
  { id: '', nome: 'Resumo' },
  { id: 'programacao', nome: 'Programação semanal' },
  { id: 'produtividade', nome: 'Produtividade' },
  { id: 'diario', nome: 'Diário de obra' },
];

const MK = {
  ok: html.seguro('<span class="mk y" aria-label="Em dia">✓</span>'),
  nao: html.seguro('<span class="mk n" aria-label="Pendente">✕</span>'),
  q: html.seguro('<span class="mk q" aria-label="Sem informação">–</span>'),
};

// Obras acompanhadas (as do planejamento, sem as concluídas)
export function obrasAcompanhadas(CFG, visiveis = null) {
  const plan = (CFG.areas.find((a) => a.id === 'planejamento') || {}).porObra || [];
  return ordenarObras(plan.filter((o) => !/conclu[ií]da|100% executada/i.test(`${(o.cronograma || {}).info || ''} ${(o.cronograma || {}).obs || ''}`))
    .filter((o) => !visiveis || visiveis.includes(o.obra)));
}

// Trecho do que o agente escreveu sobre uma obra num assunto (ex.: medições, diário), com um status estimado
export function infoDoAgente(CFG, areaId, obra, assunto) {
  const area = CFG.areas.find((a) => a.id === areaId) || {};
  const textos = [...(area.alertas || []).map((a) => a.texto), area.resumo || ''];
  const codigo = obra.replace(/^Mo/i, '');
  // frases de outro assunto (ex.: diário dentro de um alerta de medição) ficam de fora
  const outro = assunto.source.includes('medi') ? /di[áa]rio/i : /medi[çc]/i;
  const trechos = [];
  for (const t of textos) {
    if (!assunto.test(t)) continue;
    for (const parte of t.split(/[.;]\s+/)) {
      if (outro.test(parte) && !assunto.test(parte)) continue;
      if (new RegExp(`Mo\\s?${codigo}\\b`, 'i').test(parte)) trechos.push(parte.trim());
    }
  }
  if (!trechos.length) return { status: 'q', texto: 'Sem informação do agente' };
  const t = trechos.join(' · ');
  const ruim = /\bsem\b|não |parad|atras|rascunho|faltou|pendente/i.test(t);
  const bom = /registrou|aprovad|lan[çc]ad|lan[çc]ou|em dia|enviad/i.test(t);
  return { status: ruim ? 'nao' : bom ? 'ok' : 'q', texto: t };
}

// ---------------------------------------------------------------- Programação semanal

export function abaProgramacao(CFG, visiveis, linkObra = (o) => `#/planejamento/obra/${encodeURIComponent(o)}`) {
  const progs = programacoes(CFG);
  const obras = obrasAcompanhadas(CFG, visiveis);
  const semanas = ((CFG.areas.find((a) => a.id === 'planejamento') || {}).semanas) || {};
  const ini = inicioDaSemana(hojeISO());
  // só se está atualizado ou não, com um textinho curto (pedido do Felipe, 15/10)
  const curto = (s, n = 34) => { const t = String(s || '').split(/\s[·—–-]\s|\(|;|\.\s/)[0].trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
  const marca = (ok) => (ok === true ? MK.ok : ok === false ? MK.nao : MK.q);
  return html`<section class="secao">
    <div class="painel-h" style="margin-bottom:14px"><h2>Cronograma, programação e medições por obra</h2>
      <p>${semanas.atual ? `Semana atual de ${semanas.atual}` : ''}</p></div>
    <div class="tabela-rolagem"><table class="tab tab-status">
      <thead><tr><th>Obra</th><th>Cronograma</th><th>Programação semanal</th><th>Metas diárias</th><th>Medições</th><th></th></tr></thead>
      <tbody>${obras.map((o) => {
        const p = progs.find((x) => x.obra === o.obra);
        const doDia = p ? p.dias.filter((d) => d.data >= ini && d.data <= somarDias(ini, 6)) : [];
        const metasFeitas = doDia.some((d) => d.fonte === 'whatsapp');
        const med = infoDoAgente(CFG, 'operacao', o.obra, /medi[çc]/i);
        const cron = o.cronograma || {}; const prog = o.programacao || {};
        return html`<tr class="lnk" data-href="${linkObra(o.obra)}" tabindex="0">
          <td class="cod">${o.obra}</td>
          <td>${marca(cron.ok)}<span class="muted">${curto(cron.info)}</span></td>
          <td>${marca(prog.ok)}<span class="muted">${curto(prog.info)}</span></td>
          <td>${metasFeitas ? html`${MK.ok}<span class="muted">feito</span>` : html`${MK.nao}<span class="muted">${p && p.faseFinal ? 'pendências' : 'não feito'}</span>`}</td>
          <td>${MK[med.status]}<span class="muted" title="${med.texto}">${{ ok: 'em dia', nao: 'pendente', q: 'sem informação' }[med.status]}</span></td>
          <td class="ver"><span>${linkObra(o.obra).startsWith('#/operacao') ? 'Abrir obra' : 'Ver semana'}</span></td>
        </tr>`;
      })}</tbody></table></div>
  </section>`;
}
// ---------------------------------------------------------------- Por obra
// Pedido do Felipe (15/10): a Operação tem só o Resumo (todas as obras: cronograma, programação e medições)
// e, embaixo, Por obra. Clicando numa obra, abrem as abas dela, lidas direto das pastas da obra no Drive
// (scripts/exportar-drive.ps1 → projetos.json):
//   Cronograma          GERENCIAMENTO\CRONOGRAMA\<obra>_CRONOGRAMA_Rnn.xlsx (barras = células pintadas)
//   Programação semanal GERENCIAMENTO\PROGRAMAÇÃO SEMANAL, o PDF mais novo (programação, metas ou pendências finais)
//   Medições            o que o agente de Operação leu no Mais Controle
//   Escopo              GERENCIAMENTO\DOC\ESCOPO\<obra>_ESCOPO_Rnn.xlsx (sem valores) e os aditivos

export const ABAS_DA_OBRA = [
  { id: 'cronograma', nome: 'Cronograma' },
  { id: 'programacao', nome: 'Programação semanal' },
  { id: 'medicoes', nome: 'Medições' },
  { id: 'escopo', nome: 'Escopo' },
  { id: 'aditivos', nome: 'Aditivos' },
];

// listas vindas do PowerShell: lista de 1 item às vezes vem como valor solto
const lista = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
const textos = (v) => lista(v).filter((x) => typeof x === 'string' && x.trim());
const pct = (v) => `${Math.round((v || 0) * 100)}%`;
const barra = (v, cls = '') => html`<span class="ob-barra ${cls}"><i style="width:${Math.max(0, Math.min(100, Math.round((v || 0) * 100)))}%"></i></span>`;
const dm = (iso) => (iso ? fmtData(iso).slice(0, 5) : '—');
const qtdFmt = (n) => (typeof n === 'number' ? (Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })) : '');

// Atividades do cronograma (sem a linha de cabeçalho), com % executado e situação na data
function lerCronograma(proj) {
  const c = proj && proj.cronograma;
  if (!c || c.erro || !(c.atividades || []).length) return { erro: c ? (c.erro || 'cronograma sem atividades') : 'Cronograma não encontrado na pasta da obra', arquivo: c && c.arquivo };
  const hoje = hojeISO();
  const ini = inicioDaSemana(hoje); const fim = somarDias(ini, 6);
  const semanas = lista(c.semanas).map((s, i) => ({ ...s, i, atual: s.inicio && s.inicio <= hoje && somarDias(s.inicio, 6) >= hoje }));
  const atual = semanas.findIndex((s) => s.atual);
  const ativ = lista(c.atividades).filter((a) => a.nome && !/^ATIVIDADE$/i.test(a.nome) && a.cod !== 'cod')
    .map((a) => {
      // % executado da planilha (0 a 1); quem digitou "100" em vez de "100%" vira 1
      const exe = typeof a.exe === 'number' ? Math.min(1, a.exe > 1 ? a.exe / 100 : a.exe) : 0;
      const atrasada = a.fim && a.fim < hoje && exe < 1;
      const naSemana = a.inicio && a.fim && a.inicio <= fim && a.fim >= ini && exe < 1;
      return { ...a, exe, atrasada, naSemana, barras: lista(a.barras) };
    });
  const exe = ativ.length ? ativ.reduce((s, a) => s + a.exe, 0) / ativ.length : 0;
  const total = c.inicioObra && c.fimObra ? (new Date(c.fimObra) - new Date(c.inicioObra)) : 0;
  const tempo = total > 0 ? Math.max(0, Math.min(1, (new Date(hoje) - new Date(c.inicioObra)) / total)) : null;
  const grupos = [];
  for (const a of ativ) {
    const chave = a.grupo || 'Outros';
    let g = grupos.find((x) => x.chave === chave);
    if (!g) grupos.push(g = { chave, nome: a.grupoNome && a.grupoNome !== chave ? `${chave} · ${a.grupoNome}` : chave, ativ: [] });
    g.ativ.push(a);
  }
  grupos.forEach((g) => { g.exe = g.ativ.reduce((s, a) => s + a.exe, 0) / g.ativ.length; g.feitas = g.ativ.filter((a) => a.exe >= 1).length; });
  return { ...c, ativ, exe, tempo, grupos, semanas, atual };
}

function cardObra(o, proj, cr, aberta, href) {
  const nome = proj && proj.endereco ? proj.endereco.replace(/_/g, ' · ') : '';
  const prog = o.programacao || {}; const cron = o.cronograma || {};
  const ok = (x) => (x.ok === true ? 'ok' : x.ok === false ? 'nao' : 'q');
  return html`<a class="ob-card ${aberta ? 'on' : ''}" href="${href}">
    <span class="ob-topo"><b class="ob-cod">${o.obra}</b>${cr.erro ? '' : html`<span class="ob-pct">${pct(cr.exe)}</span>`}</span>
    <span class="ob-nome">${nome || '—'}</span>
    ${cr.erro ? html`<span class="ob-sub">sem cronograma lido</span>` : html`${barra(cr.exe)}<span class="ob-sub">${dm(cr.inicioObra)} a ${dm(cr.fimObra)}${cr.ativ.some((a) => a.atrasada) ? html` · <b class="pendente">${cr.ativ.filter((a) => a.atrasada).length} atrasadas</b>` : ''}</span>`}
    <span class="ob-selos"><span class="ob-selo ${ok(cron)}">cronograma</span><span class="ob-selo ${ok(prog)}">programação</span></span>
  </a>`;
}

// ---- Planilha do Drive numa caixa, só leitura (como no Excel: letras das colunas, números das linhas, cores)
const escuro = (hex) => { if (!hex) return false; const n = parseInt(hex, 16); const r = n >> 16; const g = (n >> 8) & 255; const b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 < 120; };
const refCel = (ref) => { const m = String(ref).match(/^([A-Z]+)(\d+)$/); if (!m) return null; let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; return { c, n: Number(m[2]) }; };

export function gradePlanilha(grade, { ocultar = [], altura = 620 } = {}) {
  if (!grade || !lista(grade.cols).length) return html`<p class="vazio">Não consegui montar a visualização desta planilha.</p>`;
  const esconder = new Set(lista(ocultar));
  const cols = lista(grade.cols).filter((c) => !esconder.has(c.i));
  const estilos = lista(grade.estilos);
  // mescladas: a célula de cima/esquerda ganha colspan/rowspan; as outras somem
  const linhasN = lista(grade.linhas).map((l) => l.n);
  const span = new Map(); const coberta = new Set();
  for (const m of lista(grade.mesclas)) {
    const [a, b] = String(m).split(':').map(refCel); if (!a || !b) continue;
    const cs = cols.filter((c) => c.i >= a.c && c.i <= b.c).length;
    const rs = linhasN.filter((n) => n >= a.n && n <= b.n).length;
    if (!cs || !rs) continue;
    span.set(`${a.c}:${a.n}`, { cs, rs });
    for (let n = a.n; n <= b.n; n++) for (let c = a.c; c <= b.c; c++) if (n !== a.n || c !== a.c) coberta.add(`${c}:${n}`);
  }
  const linha = (l) => {
    const porCol = new Map(lista(l.c).map((x) => [x[0], x]));
    return html`<tr style="${l.h ? `height:${Math.round(l.h * 1.33)}px` : ''}"><th class="xl-n">${l.n}</th>${cols.map((c) => {
      if (coberta.has(`${c.i}:${l.n}`)) return '';
      const x = porCol.get(c.i); const e = x ? estilos[x[2]] || {} : {};
      const sp = span.get(`${c.i}:${l.n}`);
      const st = [e.bg ? `background:#${e.bg}` : '', e.fg ? `color:#${e.fg}` : (escuro(e.bg) ? 'color:#fff' : ''), e.b ? 'font-weight:700' : '', e.i ? 'font-style:italic' : '',
        e.al === 'center' || e.al === 'centerContinuous' ? 'text-align:center' : e.al === 'right' ? 'text-align:right' : '', e.q ? 'white-space:normal' : ''].filter(Boolean).join(';');
      return html`<td style="${st}" ${sp && sp.cs > 1 ? html.seguro(`colspan="${sp.cs}"`) : ''} ${sp && sp.rs > 1 ? html.seguro(`rowspan="${sp.rs}"`) : ''}>${x ? x[1] : ''}</td>`;
    })}</tr>`;
  };
  return html`<div class="xl-caixa" style="max-height:${altura}px"><table class="xl">
    <colgroup><col class="xl-ncol">${cols.map((c) => html`<col style="width:${Math.max(18, Math.round((c.w || 9) * 7))}px">`)}</colgroup>
    <thead><tr><th class="xl-n"></th>${cols.map((c) => html`<th>${c.l}</th>`)}</tr></thead>
    <tbody>${lista(grade.linhas).map(linha)}</tbody>
  </table></div>`;
}

// ---- Cronograma: prazo decorrido, início e fim + a planilha do Drive
function abaCronograma(cr) {
  if (cr.erro) return html`<p class="vazio">${cr.erro}${cr.arquivo ? ` (${cr.arquivo})` : ''}.</p>`;
  return html`<div class="ob-resumo ob-resumo-3">
      ${cr.tempo != null ? html`<div><span>Prazo decorrido</span><b>${pct(cr.tempo)}</b>${barra(cr.tempo, 'tempo')}</div>` : ''}
      <div><span>Início</span><b>${cr.inicioObra ? fmtData(cr.inicioObra) : '—'}</b></div>
      <div><span>Fim</span><b>${cr.fimObra ? fmtData(cr.fimObra) : '—'}</b></div>
    </div>
    <div class="cg-topo"><span class="pequeno">${cr.arquivo}${typeof cr.status === 'string' ? ` · ${cr.status.replace(/^.*?\|\s*/, '')}` : ''} · Drive › GERENCIAMENTO › CRONOGRAMA</span><span class="pequeno">só leitura</span></div>
    ${gradePlanilha(cr.grade)}`;
}

// ---- Programação semanal / pendências (PDF mais novo da pasta), separada em Sólida · Terceiros · Avisos
const STATUS_CLS = (s) => (/atras/i.test(s) ? 'st-atraso' : /andamento/i.test(s) ? 'st-and' : /conclu|feito|ok/i.test(s) ? 'st-ok' : /agend|planej|fazer|contrat/i.test(s) ? 'st-plan' : 'st-outro');

function abaProgramacaoObra(proj) {
  const p0 = proj && proj.programacao;
  const p = p0 && { ...p0, secoes: lista(p0.secoes).map((s) => ({ ...s, avisos: textos(s.avisos), linhas: lista(s.linhas).filter((l) => l && l.item) })) };
  if (!p) return html`<p class="vazio">Nenhuma programação semanal ou lista de pendências em PDF na pasta GERENCIAMENTO › PROGRAMAÇÃO SEMANAL.</p>`;
  if (p.erro) return html`<p class="vazio">Não consegui ler ${p.arquivo}: ${p.erro}</p>`;
  if (p.antigo) return html`<p class="vazio">O último arquivo da pasta é ${p.arquivo}, de ${fmtData(p.modificado.slice(0, 10))} — mais de 90 dias, não foi lido.</p>`;
  const pend = p.tipo === 'pendencias';
  // alerta = item que só pede para preparar/contratar antes (vem com "ALERTA"/"CONTRATAÇÃO" no status)
  const ehAviso = (l) => /alerta|contrata[çc][ãa]o|equipe cinza/i.test(l.status || '');
  const tabela = (linhas) => html`<div class="tabela-rolagem"><table class="tab pg-tab">
    <thead><tr><th>${pend ? 'Pendência' : 'Serviço'}</th>${pend ? '' : html`<th>Quantidade</th>`}<th>Responsável</th><th>Status</th></tr></thead>
    <tbody>${linhas.map((l) => html`<tr>
      <td>${l.etapa ? html`<span class="pg-etapa">${l.etapa}</span>` : ''}<b class="pg-item">${l.item}</b>${l.obs ? html`<span class="pg-obs">${l.obs}</span>` : ''}</td>
      ${pend ? '' : html`<td class="pg-qtd">${l.qtd && l.qtd !== '-' ? l.qtd : ''}</td>`}
      <td class="pg-resp">${l.resp && l.resp !== '-' ? l.resp : ''}</td>
      <td><span class="pg-st ${STATUS_CLS(l.status || '')}">${l.status || ''}</span></td></tr>`)}</tbody></table></div>`;
  const bloco = (cls, titulo, linhas) => (linhas.length ? html`<div class="pg-bloco ${cls}"><h5><i></i>${titulo} <span class="pequeno">${linhas.length}</span></h5>${tabela(linhas)}</div>` : '');
  return html`<div class="cg-topo"><span class="pequeno">${p.arquivo} · salvo em ${fmtData(p.modificado.slice(0, 10))} · Drive › GERENCIAMENTO › PROGRAMAÇÃO SEMANAL</span></div>
    ${pend ? html`<p class="pg-aviso">Obra na fase final: sem programação semanal, o acompanhamento é pela lista de pendências.</p>` : ''}
    ${p.secoes.map((s) => {
      const avisoLinhas = s.linhas.filter(ehAviso);
      const resto = s.linhas.filter((l) => !ehAviso(l));
      return html`<section class="pg-secao">
        ${s.titulo ? html`<h4>${s.titulo.replace(/\s*\|\s*/, ' · ')}</h4>` : ''}
        ${s.avisos.length || avisoLinhas.length ? html`<div class="pg-bloco pg-avisos"><h5><i></i>Avisos</h5>
          ${s.avisos.map((a) => html`<p class="pg-aviso">${a}</p>`)}
          ${avisoLinhas.length ? tabela(avisoLinhas) : ''}</div>` : ''}
        ${bloco('pg-cinza', 'Equipe Sólida', resto.filter((l) => l.tipo !== 'laranja'))}
        ${bloco('pg-laranja', 'Terceiros / fornecedores', resto.filter((l) => l.tipo === 'laranja'))}
      </section>`;
    })}`;
}

// ---- Medições (agente de Operação, Mais Controle)
function abaMedicoesObra(CFG, o) {
  const i = infoDoAgente(CFG, 'operacao', o.obra, /medi[çc]/i);
  return html`<div class="ob-med ${i.status}">${MK[i.status]}<div><b>${i.status === 'ok' ? 'Medição em dia' : i.status === 'nao' ? 'Medição com pendência' : 'Sem informação de medição'}</b><p>${i.texto}</p></div></div>
    <p class="pequeno">Lido no Mais Controle pelo agente de Operação (POP 1.1 a 1.4).</p>`;
}

// ---- Escopo: a planilha do Drive (valores só para sócios)
function abaEscopo(proj, veValores) {
  const e = proj && proj.escopo;
  if (!e) return html`<p class="vazio">Nenhuma planilha de escopo na pasta GERENCIAMENTO › DOC › ESCOPO.</p>`;
  if (e.erro) return html`<p class="vazio">${e.erro} (${e.arquivo}).</p>`;
  return html`<div class="cg-topo"><span class="pequeno">${e.arquivo} · aba ${e.abaGrade || e.aba}${e.rev ? ` · orçamento ${e.rev}` : ''}${typeof e.data === 'string' ? ` de ${e.data.replace(/\./g, '/')}` : ''}${typeof e.cliente === 'string' ? ` · ${e.cliente}` : ''}</span>
      <span class="pequeno">${veValores ? 'só leitura' : 'só leitura · valores só para sócios'}</span></div>
    ${gradePlanilha(e.grade, { ocultar: veValores ? [] : lista(e.colunasValor) })}`;
}

// ---- Aditivos: todas as abas AD da planilha de escopo, com a aprovação escrita nelas
const SIT_AD = { aprovado: 'Aprovado', aguardando: 'Aguardando', nao: 'Não aprovado / cancelado', sem: 'Sem indicação na planilha' };
function abaAditivos(proj, params, base, obra, veValores) {
  const e = proj && proj.escopo;
  const ads = lista(e && e.aditivos);
  if (!ads.length) return html`<p class="vazio">Nenhum aditivo (abas AD01, AD02…) na planilha de escopo${e && e.arquivo ? ` (${e.arquivo})` : ''}.</p>`;
  const aberto = params.get('ad');
  const conta = (s) => ads.filter((a) => a.situacao === s).length;
  const brl = (v) => (typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '');
  return html`<div class="ad-resumo">${['aprovado', 'aguardando', 'nao', 'sem'].map((s) => html`<div class="ad-cont ad-${s}"><b>${conta(s)}</b><span>${SIT_AD[s]}</span></div>`)}</div>
    <p class="pequeno">${e.arquivo} · a aprovação é o que está escrito em cada aba (ex.: "APROVADO PELO CLIENTE 26/08")${lista(e.aditivos).some((a) => a.corAba) ? ' · aba colorida na planilha marcada com •' : ''}</p>
    <div class="ad-lista">${ads.slice().reverse().map((a) => {
      const ab = aberto === a.aba;
      return html`<div class="ad-item ${ab ? 'on' : ''}">
        <a class="ad-cab" href="${base}?obra=${encodeURIComponent(obra)}&aba=aditivos${ab ? '' : `&ad=${encodeURIComponent(a.aba)}`}">
          <b class="ad-num">${a.corAba ? html`<i class="ad-cor" style="background:#${a.corAba}"></i>` : ''}${a.aba}</b>
          <span class="ad-tit">${typeof a.titulo === 'string' ? a.titulo : ''}<span class="pequeno">${typeof a.data === 'string' ? a.data : ''}${a.nota && a.situacao !== 'sem' ? ` · ${a.nota}` : ''}</span></span>
          ${veValores && typeof a.total === 'number' ? html`<span class="ad-total">${brl(a.total)}</span>` : ''}
          <span class="ad-sit ad-${a.situacao}">${SIT_AD[a.situacao] || ''}</span>
        </a>
        ${ab ? html`<div class="ad-corpo">${gradePlanilha(a.grade, { ocultar: veValores ? [] : lista(a.colunasValor), altura: 520 })}</div>` : ''}
      </div>`;
    })}</div>`;
}

// Para a página nova da obra (#/obra/<cod>, desenho do Marcos): o corpo de uma aba antiga e a leitura do cronograma
export const cronogramaDa = (projetosDrive, cod) => lerCronograma(((projetosDrive && projetosDrive.obras) || []).find((p) => p.obra === cod));
export function abaDaObra(CFG, projetosDrive, cod, abaId, params, base, { veValores = false } = {}) {
  const p = ((projetosDrive && projetosDrive.obras) || []).find((x) => x.obra === cod);
  const o = obrasAcompanhadas(CFG).find((x) => x.obra === cod) || { obra: cod };
  const corpo = {
    cronograma: () => abaCronograma(lerCronograma(p)),
    programacao: () => abaProgramacaoObra(p),
    medicoes: () => abaMedicoesObra(CFG, o),
    escopo: () => html`${abaEscopo(p, veValores)}<h3 style="margin:30px 0 12px">Aditivos</h3>${abaAditivos(p, params, base, cod, veValores)}`,
  }[abaId];
  return corpo ? corpo() : '';
}
export const enderecoDa = (projetosDrive, cod) => { const p = ((projetosDrive && projetosDrive.obras) || []).find((x) => x.obra === cod); return p && p.endereco ? p.endereco.replace(/_/g, ' · ') : ''; };

export function porObra(CFG, visiveis, projetosDrive, params, base, { veValores = false } = {}) {
  const obras = obrasAcompanhadas(CFG, visiveis);
  if (!obras.length) return { cards: '', painel: '' };
  const proj = (cod) => ((projetosDrive && projetosDrive.obras) || []).find((p) => p.obra === cod);
  const escolhida = obras.find((o) => o.obra === params.get('obra'));
  const aba = ABAS_DA_OBRA.find((a) => a.id === params.get('aba')) || ABAS_DA_OBRA[0];
  const crs = new Map(obras.map((o) => [o.obra, lerCronograma(proj(o.obra))]));
  const link = (obra, abaId) => `${base}?obra=${encodeURIComponent(obra)}&aba=${abaId}`;
  let painel = '';
  if (escolhida) {
    const cr = crs.get(escolhida.obra); const p = proj(escolhida.obra);
    const corpo = {
      cronograma: () => abaCronograma(cr),
      programacao: () => abaProgramacaoObra(p),
      medicoes: () => abaMedicoesObra(CFG, escolhida),
      escopo: () => abaEscopo(p, veValores),
      aditivos: () => abaAditivos(p, params, base, escolhida.obra, veValores),
    }[aba.id]();
    const nomeAba = (a) => (a.id === 'programacao' && p && p.programacao && p.programacao.tipo === 'pendencias' ? 'Pendências finais'
      : a.id === 'aditivos' && p && p.escopo ? `Aditivos (${lista(p.escopo.aditivos).length})` : a.nome);
    painel = html`<div class="ob-painel" id="ob-painel">
      <a class="ob-voltar" href="${base}">← Todas as obras</a>
      <header class="ob-painel-h"><div><h3>${escolhida.obra}</h3><span class="pequeno">${p && p.endereco ? p.endereco.replace(/_/g, ' · ') : ''}</span></div></header>
      <div class="subnav" role="tablist">${ABAS_DA_OBRA.map((a) => html`<a role="tab" class="${a.id === aba.id ? 'on' : ''}" href="${link(escolhida.obra, a.id)}">${nomeAba(a)}</a>`)}</div>
      <div class="ob-corpo">${corpo}</div>
    </div>`;
  }
  return { painel, aberta: !!escolhida, cards: html`<section class="ob-sec">
    <div class="painel-h"><h2>Por obra</h2><p>Clique numa obra para ver cronograma, programação semanal, medições, escopo e aditivos</p></div>
    <div class="ob-cards">${obras.map((o) => cardObra(o, proj(o.obra), crs.get(o.obra), false, link(o.obra, 'cronograma')))}</div>
  </section>` };
}
// ---------------------------------------------------------------- Produtividade (envio diário)

export function abaProdutividade(CFG, visiveis, ref) {
  const progs = programacoes(CFG).filter((p) => !visiveis || visiveis.includes(p.obra));
  const hoje = hojeISO();
  const ini = inicioDaSemana(ref || hoje);
  const dias = [0, 1, 2, 3, 4].map((i) => somarDias(ini, i));
  const nav = html`<div class="periodo">
    <button type="button" class="botao" data-semana-md="${somarDias(ini, -7)}">← Semana anterior</button>
    <div class="atual"><span>Semana</span><b>${fmtData(ini).slice(0, 5)} a ${fmtData(dias[4]).slice(0, 5)}</b></div>
    ${hoje < ini || hoje > somarDias(ini, 6) ? html`<button type="button" class="botao" data-semana-md="${hoje}">Esta semana</button>` : ''}
    <button type="button" class="botao" data-semana-md="${somarDias(ini, 7)}">Próxima semana →</button>
  </div>`;
  const cel = (p, d) => {
    if (feriado(d)) return html`<td class="qs-cel qs-feriado">feriado</td>`;
    if (d >= hoje) return html`<td class="qs-cel qs-futuro"><span>${d === hoje ? 'hoje' : '—'}</span></td>`;
    const r = registroDoDia(p, d);
    if (!r) return html`<td class="qs-cel qs-sem"><span>não verificado</span></td>`;
    if (r.semRelatorio) return html`<td class="qs-cel qs-abaixo"><b class="qs-situacao">✕ não enviada</b>${(r.avisos || [])[0] ? html`<em>${r.avisos[0]}</em>` : ''}</td>`;
    return html`<td class="qs-cel qs-ok"><b class="qs-situacao">✓ enviada</b>${r.relatorio ? html`<em>${r.relatorio.por}, ${r.relatorio.hora}</em>` : ''}${!r.programacao ? html`<em>sem programação do dia</em>` : ''}</td>`;
  };
  return html`${nav}
    <article class="cartao cartao-largo">
      <header class="cartao-cab"><h3>Produtividade diária enviada no grupo</h3><span class="pequeno">lida no WhatsApp toda manhã, do dia anterior</span></header>
      <div class="tabela-rolagem"><table class="quadro-semana">
        <thead><tr><th>Obra</th>${dias.map((d, i) => html`<th class="${d === hoje ? 'qs-hoje' : ''}">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex'][i]} ${d.slice(8, 10)}/${d.slice(5, 7)}</th>`)}</tr></thead>
        <tbody>${progs.map((p) => html`<tr><td class="qs-item"><b>${p.obra}</b></td>${dias.map((d) => cel(p, d))}</tr>`)}</tbody>
      </table></div>
      <p class="legenda-semana"><span class="lg lg-ok"></span> enviada <span class="lg lg-abaixo"></span> não enviada <span class="lg lg-sem"></span> não verificado <span class="lg lg-futuro"></span> ainda não chegou</p>
    </article>`;
}

// ---------------------------------------------------------------- Medições e Diário de obra (do agente)

function abaPorObra(CFG, visiveis, { titulo, assunto, kpi, fonte }) {
  const op = CFG.areas.find((a) => a.id === 'operacao') || {};
  const k = (op.kpis || []).filter((x) => kpi.test(x.label));
  const obras = obrasAcompanhadas(CFG, visiveis);
  return html`<section class="secao" style="margin-top:0">
    <div class="painel-h" style="margin-bottom:14px"><h2>${titulo}</h2><p>${fonte}</p></div>
    ${k.length ? html`<div class="cards">${k.map((x) => html`<div class="card"><div class="card-valor">${String(x.valor).split(' · ')[0]}</div><div class="card-rotulo">${x.label}</div>${String(x.valor).includes(' · ') ? html`<div class="card-sub">${String(x.valor).split(' · ').slice(1).join(' · ')}</div>` : ''}</div>`)}</div>` : ''}
    <div class="tabela-rolagem" style="margin-top:18px"><table class="tab">
      <thead><tr><th>Obra</th><th>Situação</th></tr></thead>
      <tbody>${obras.map((o) => { const i = infoDoAgente(CFG, 'operacao', o.obra, assunto); return html`<tr><td class="cod">${o.obra}</td><td>${MK[i.status]}<span>${i.texto}</span></td></tr>`; })}</tbody>
    </table></div>
  </section>`;
}

export const abaMedicoes = (CFG, visiveis) => abaPorObra(CFG, visiveis, {
  titulo: 'Medições por obra', assunto: /medi[çc]/i, kpi: /medi[çc]/i,
  fonte: 'Mais Controle, lido pelo agente de Operação (POP 1.1 a 1.4)',
});

export const abaDiario = (CFG, visiveis) => abaPorObra(CFG, visiveis, {
  titulo: 'Diário de obra por obra', assunto: /di[áa]rio/i, kpi: /di[áa]rio/i,
  fonte: 'Mais Controle, lido pelo agente de Operação (POP 1.8)',
});
