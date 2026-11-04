// Agenda (desenho do Marcos: "Agenda" no topo do menu) = as funções da semana de cada pessoa (antes "Minhas funções")
// com as tarefas da aba Tarefas no mesmo calendário, como no Google Agenda: em cada dia, cartõezinhos pequenos
// (uma linha cada) com as pendências de prazo naquele dia. Pedido do Felipe (04/11/2026).
//   cor: vencida = vermelho · de hoje = azul · futura = cinza-azulado · concluída = riscada
//   A tarefa fica no dia do prazo (vencida NÃO é puxada para hoje: a pessoa vê o vermelho no dia que passou e reprograma pelo ↻).
//   Entram só as tarefas da própria pessoa (responsável ou gestora), inclusive para a diretoria. Mais de 3 num dia: mostra 3 e "+N".

import { html } from '../formato.js';
import { hojeISO, somarDias, inicioDaSemana } from '../datas.js';
import { feriado } from '../feriados.js';
import * as meudia from './meudia.js';

const DIA_CURTO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MAX_DIA = 3;
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
// "ACM, retirar da área gourmet" → assunto ACM (mesma regra das atas)
const assunto = (t) => { const s = String(t || ''); const i = s.indexOf(','); return i > 0 && i < 60 ? [s.slice(0, i).trim(), s.slice(i + 1).trim()] : ['', s]; };

function cartaozinho(p, { eu, hoje, nomeDe }) {
  const [ass, resto] = assunto(p.descricao);
  const feita = p.status === 'feita';
  const cls = feita ? 'ag-feita' : p.prazo < hoje ? 'ag-venc' : p.prazo === hoje ? 'ag-hoje' : 'ag-futura';
  const quem = p.responsavel ? (nomeDe ? nomeDe(p.responsavel, p.responsavel_nome) : p.responsavel_nome) : p.responsavel_nome;
  const sup = eu && p.responsavel !== eu && (p.gestores || []).includes(eu);
  const titulo = [`${ass ? `${ass}: ` : ''}${resto}`, p.obra || p.setor, `prazo ${dm(p.prazo)}${p.prazo < hoje && !feita ? ' (vencida)' : ''}`, quem ? `responsável: ${quem}${sup ? ' · você é gestor' : ''}` : '', feita ? 'concluída' : ''].filter(Boolean).join(' · ');
  const venc = !feita && p.prazo < hoje;
  const card = html`<a class="ag-mini ${cls}" href="#/atas" data-tarefa="${p.id}" draggable="true" title="${titulo} · clique para abrir · arraste para outro dia">${p.obra ? html`<b>${p.obra}</b>` : ''}${ass ? `${ass} · ` : ''}${resto}</a>`;
  // vencida: botão ↻ para reprogramar o prazo (abre o calendário com feriados, o mesmo da aba Tarefas)
  return venc ? html`<span class="ag-linha-venc">${card}<button type="button" class="ag-repro" data-cal-prazo="${p.id}" title="Reprogramar o prazo" aria-label="Reprogramar o prazo">↻</button></span>` : card;
}

// tarefas de cada dia da semana, já com as vencidas no dia de hoje
function tarefasPorDia({ pendencias = [], eu, ref }) {
  const hoje = hojeISO();
  const ini = inicioDaSemana(ref || hoje);
  const dias = [0, 1, 2, 3, 4, 5].map((i) => somarDias(ini, i));
  const lista = pendencias.filter((p) => p.prazo && p.na_lista !== false && ['aberta', 'feita'].includes(p.status)
    && (eu && (p.responsavel === eu || (p.gestores || []).includes(eu))));
  const mapa = {};
  for (const d of dias) {
    const ordem = (p) => (p.status === 'feita' ? 2 : 1);
    mapa[d] = lista.filter((p) => p.prazo === d).sort((a, b) => ordem(a) - ordem(b));
  }
  return { dias, mapa, hoje };
}

function faixaTarefas(opts) {
  const { dias, mapa, hoje } = tarefasPorDia(opts);
  const cols = dias.filter((d, i) => i < 5 || mapa[d].length);
  const total = cols.reduce((s, d) => s + mapa[d].filter((p) => p.status === 'aberta').length, 0);
  const venc = cols.reduce((n, d) => n + mapa[d].filter((p) => p.status === 'aberta' && p.prazo < hoje).length, 0);
  const cel = (d) => {
    const l = mapa[d]; const ctx = { eu: opts.eu, hoje, nomeDe: opts.nomeDe };
    return html`${l.slice(0, MAX_DIA).map((p) => cartaozinho(p, ctx))}
      ${l.length > MAX_DIA ? html`<details class="ag-mais"><summary>+${l.length - MAX_DIA}</summary>${l.slice(MAX_DIA).map((p) => cartaozinho(p, ctx))}</details>` : ''}`;
  };
  return html`<section class="ag-tarefas">
    <div class="ag-h"><h3>Tarefas do dia</h3>
      <span class="pequeno">${total ? `${total} em aberto nesta semana${venc ? `, ${venc} ${venc === 1 ? 'vencida' : 'vencidas'} (reprograme pelo ↻)` : ''}` : 'nenhuma tarefa com prazo nesta semana'}</span>
      <a class="link" href="#/atas">Abrir Tarefas →</a></div>
    <div class="ag-faixa" style="--nd:${cols.length}">
      ${cols.map((d) => html`<div class="ag-dia ${d === hoje ? 'hoje' : ''}">
        <div class="ag-dia-h"><b>${DIA_CURTO[dias.indexOf(d)]} ${dm(d)}</b>${feriado(d) ? html`<small>feriado</small>` : ''}</div>
        ${mapa[d].length ? cel(d) : html`<span class="ag-livre">—</span>`}
      </div>`)}
    </div>
    <p class="legenda-semana"><span class="lg ag-lg-venc"></span> vencida <span class="lg ag-lg-hoje"></span> de hoje <span class="lg ag-lg-futura"></span> próximos dias <span class="lg ag-lg-feita"></span> concluída · clique no cartão para abrir a tarefa</p>
  </section>`;
}

// Como no Google Agenda (print do Felipe, 04/11): as tarefas ficam DENTRO da grade, na linha de cima de cada dia,
// logo abaixo do nome do dia (como os eventos de dia inteiro). Acima da grade fica só uma linha de resumo.
export function render(opts) {
  const base = String(meudia.render({ ...opts, soFuncoes: true, aba: 'funcoes' }));
  const t = tarefasPorDia({ pendencias: opts.pendencias || [], eu: opts.eu, ref: opts.semanaRef || opts.dia });
  const ctx = { eu: opts.eu, hoje: t.hoje, nomeDe: opts.nomeDe };
  const porRotulo = new Map(t.dias.map((d, i) => [`${DIA_CURTO[i]} ${dm(d)}`, d]));
  const chips = (d) => {
    const l = t.mapa[d] || [];
    if (!l.length) return '';
    return String(html`<div class="ag-cab-tarefas">${l.slice(0, MAX_DIA).map((p) => cartaozinho(p, ctx))}${l.length > MAX_DIA ? html`<details class="ag-mais"><summary>+${l.length - MAX_DIA}</summary>${l.slice(MAX_DIA).map((p) => cartaozinho(p, ctx))}</details>` : ''}</div>`);
  };
  let n = 0;
  const comChips = base.replace(/(<div class="fq-cab[^"]*">\s*<b>((?:Seg|Ter|Qua|Qui|Sex|Sáb) \d\d\/\d\d)<\/b>(?:\s*<small>[^<]*<\/small>)?)/g, (m, ini, rot) => {
    const d = porRotulo.get(rot); if (!d) return m; n++; return `${ini.replace('<div class="fq-cab', `<div data-ag-dia="${d}" class="fq-cab`)}${chips(d)}`;
  });
  const total = t.dias.reduce((s, d) => s + (t.mapa[d] || []).filter((p) => p.status === 'aberta').length, 0);
  const venc = t.dias.reduce((n, d) => n + (t.mapa[d] || []).filter((p) => p.status === 'aberta' && p.prazo < t.hoje).length, 0);
  const resumo = String(html`<div class="ag-resumo"><span><b>Tarefas</b> ${total ? `${total} em aberto nesta semana${venc ? `, ${venc} ${venc === 1 ? 'vencida' : 'vencidas'} (reprograme pelo ↻)` : ''}` : 'nenhuma tarefa com prazo nesta semana'}</span>
    <span class="legenda-semana"><span class="lg ag-lg-venc"></span> vencida <span class="lg ag-lg-hoje"></span> de hoje <span class="lg ag-lg-futura"></span> próximos dias <span class="lg ag-lg-feita"></span> concluída</span>
    <a class="link" href="#/atas">Abrir Tarefas →</a></div>`);
  if (n) {
    const i = comChips.indexOf('<section class="fn-painel');
    return html.seguro(i >= 0 ? `${comChips.slice(0, i)}${resumo}${comChips.slice(i)}` : `${resumo}${comChips}`);
  }
  // grade não encontrada (ex.: sem funções): cai na faixa separada
  const faixa = String(faixaTarefas({ pendencias: opts.pendencias || [], eu: opts.eu, ref: opts.semanaRef || opts.dia, nomeDe: opts.nomeDe }));
  const marca = '<section class="fn-painel';
  const i = base.indexOf(marca);
  if (i >= 0) return html.seguro(`${base.slice(0, i)}${faixa}${base.slice(i)}`);
  const j = base.lastIndexOf('</div>');
  return html.seguro(j >= 0 ? `${base.slice(0, j)}${faixa}${base.slice(j)}` : `${base}${faixa}`);
}
