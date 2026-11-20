// Operações › Funcionários › distribuição da SEMANA PASSADA (pedido do Marcos, 20/11/2026): quem esteve em qual obra em cada dia.
// Fonte 1 (real): efetivo lido dos grupos de WhatsApp das obras (ctx.efetivo.dias, nomes da Sólida). Fonte 2 (previsto): onde NÃO houve
// efetivo naquela obra naquele dia, vale a alocação (alocacao_obras) daquele dia, desenhada tracejada. Férias lançadas pelo RH aparecem em laranja.
import { html } from './formato.js';
import { somarDias } from './datas.js';
import { feriado } from './feriados.js';
import { mesmaPessoa, feriasDe } from './ferias.js';
import { corDaFuncao } from './alocacao.js';
import * as oc from './deps/obras-comum.js';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const rotuloObra = (k) => { const m = /^\s*(mo|po)\s*-?\s*(\d+[a-z]?)/i.exec(String(k || '')); return m ? `${m[1][0].toUpperCase()}${m[1][1].toLowerCase()}${m[2]}` : String(k || ''); };

// devolve { dias, linhas:[{ nome, funcao, celulas:[[{obra, tipo:'real'|'prev'|'fer', periodo}]×6], total }], ferias:[…], semEfetivo }
export function montar({ ctx, semanaIni, alocLinhas = [], ferias = [] }) {
  const dias = DIAS.map((_, i) => somarDias(semanaIni, i));
  const pessoasRH = [];
  for (const p of ((ctx.equipeProg && ctx.equipeProg.pessoas) || [])) {
    const nome = String(p.nome || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    if (nome.length > 2 && !pessoasRH.some((x) => mesmaPessoa(x.nome, nome) && x.nome.toLowerCase() === nome.toLowerCase())) pessoasRH.push({ nome, funcao: p.funcao || '' });
  }
  const linhas = [];
  const achar = (nome) => linhas.find((l) => mesmaPessoa(l.nome, nome));
  const garantir = (nome, funcao = '') => { let l = achar(nome); if (!l) { l = { nome, funcao, celulas: dias.map(() => []) }; linhas.push(l); } return l; };
  for (const p of pessoasRH) garantir(p.nome, p.funcao);
  const poe = (nome, i, item) => { const c = garantir(nome).celulas[i]; if (!c.some((x) => x.obra === item.obra && x.tipo === item.tipo)) c.push(item); };
  let semEfetivo = true;
  dias.forEach((d, i) => {
    const grupos = Object.keys(((ctx.efetivo && ctx.efetivo.dias) || {})[d] || {});
    const obrasComEfetivo = new Set();
    for (const k of grupos) {
      const e = oc.efetivo(ctx, d, k);
      if (!e.enviado) continue;
      obrasComEfetivo.add(rotuloObra(k).toLowerCase()); semEfetivo = false;
      for (const n of e.nomes) poe(n, i, { obra: rotuloObra(k), tipo: 'real' });
    }
    for (const a of alocLinhas) {
      if (a.data !== d || obrasComEfetivo.has(rotuloObra(a.obra).toLowerCase())) continue;
      poe(a.pessoa, i, { obra: rotuloObra(a.obra), tipo: 'prev', periodo: a.periodo || 'dia' });
    }
    for (const l of linhas) if (feriasDe(l.nome, d, ferias)) l.celulas[i].unshift({ obra: 'Férias', tipo: 'fer' });
  });
  const cheias = linhas.filter((l) => l.celulas.some((c) => c.length)).map((l) => ({ ...l, total: l.celulas.filter((c) => c.some((x) => x.tipo !== 'fer')).length }));
  cheias.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return { dias, linhas: cheias, semEfetivo };
}

export function render({ ctx, semanaIni, alocLinhas = [], ferias = [], hoje }) {
  const { dias, linhas, semEfetivo } = montar({ ctx, semanaIni, alocLinhas, ferias });
  const fim = somarDias(semanaIni, 5);
  const feriasSem = ferias.filter((f) => f.inicio <= fim && f.fim >= semanaIni);
  const agora = ferias.filter((f) => f.inicio <= hoje && f.fim >= hoje);
  const chip = (x, cor) => x.tipo === 'fer' ? html`<span class="sp-chip sp-fer" title="De férias (lançado pelo RH)">Férias</span>`
    : x.tipo === 'prev' ? html`<span class="sp-chip sp-prev" style="color:${cor};border-color:${cor}" title="Sem efetivo lido neste dia: vale a alocação planejada">${x.obra}${x.periodo && x.periodo !== 'dia' ? ` (${x.periodo === 'manha' ? 'manhã' : 'tarde'})` : ''}</span>`
      : html`<span class="sp-chip" style="background:${cor}" title="Efetivo real, lido do grupo da obra">${x.obra}</span>`;
  return html`<div class="sp">
    <p class="pequeno">Semana passada: ${dm(semanaIni)} a ${dm(fim)}. <b>Cheio</b> = efetivo real lido dos grupos de WhatsApp das obras · <b>tracejado</b> = onde o grupo não enviou efetivo, vale o que foi alocado/programado · <span class="sp-chip sp-fer">Férias</span> = lançado pelo RH.</p>
    ${semEfetivo ? html`<p class="pd-vazio">O efetivo dos grupos não tem nenhum envio nesta semana (ou ainda não foi lido): só aparece a alocação planejada.</p>` : ''}
    ${linhas.length ? html`<div class="tabela-rolagem"><table class="pd-tab"><thead><tr><th>Funcionário</th>${dias.map((d, i) => html`<th>${DIAS[i]} <small>${dm(d)}</small></th>`)}<th>Dias</th></tr></thead>
      <tbody>${linhas.map((l) => html`<tr><td class="pd-t1"><b>${l.nome}</b><small>${l.funcao ? ` · ${l.funcao}` : ''}</small></td>${l.celulas.map((c, i) => html`<td>${c.length ? c.map((x) => chip(x, corDaFuncao(l.funcao))) : (feriado(dias[i]) ? html`<small title="${feriado(dias[i])}">feriado</small>` : '')}</td>`)}<td class="n">${l.total}</td></tr>`)}</tbody></table></div>`
      : html`<p class="pd-vazio">Nada para mostrar na semana passada: sem efetivo lido e sem alocação.</p>`}
    <h3 class="pd-sub">Funcionários em férias</h3>
    ${agora.length || feriasSem.length ? html`<ul class="pd-lista">${[...new Map([...agora, ...feriasSem].map((f) => [f.id, f])).values()].map((f) => html`<li><b>${f.funcionario}</b> · ${dm(f.inicio)} a ${dm(f.fim)}/${f.fim.slice(0, 4)} <small>${f.fim < hoje ? 'já voltou' : f.inicio <= hoje ? 'de férias agora' : 'programadas'}</small></li>`)}</ul>`
      : html`<p class="pd-vazio">Ninguém de férias na semana passada nem agora. O RH lança em RH › Controle de férias.</p>`}
  </div>`;
}
