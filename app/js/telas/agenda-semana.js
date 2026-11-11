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
import { TAREFAS, valeNoDia, naGrade, grupoDaTarefa, funcoesDoCargo } from '../funcoes.js';
import { funcaoAtual, idPessoa } from '../sessao.js';
import { lerChecks } from '../armazenamento.js';

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
// Cards das funções (grupos de tarefas do cargo) com uma bolinha por dia útil. A bolinha do dia fica VERDE quando tudo o que era daquela função
// naquele dia foi concluído: as tarefas do quadro (✓ feito) e as tarefas da aba Tarefas ligadas à função (concluídas).
//   cinza vazado = nada previsto · azul = de hoje, em aberto · cinza cheio = dia que vem · amarelo = parte feita · vermelho = dia passado sem concluir · verde = concluído
function cardsFuncoes({ pendencias = [], eu, ref }) {
  const f = funcaoAtual(); const hoje = hojeISO(); const ini = inicioDaSemana(ref || hoje);
  const dias = [0, 1, 2, 3, 4].map((i) => somarDias(ini, i));
  const checks = lerChecks(idPessoa());
  const minhas = pendencias.filter((p) => p.prazo && p.funcao_tarefa && p.na_lista !== false && ['aberta', 'feita'].includes(p.status) && eu && (p.responsavel === eu || (p.gestores || []).includes(eu)));
  const grupos = funcoesDoCargo(f.id);
  // funções que só aparecem porque uma tarefa foi ligada a elas
  for (const p of minhas) if (!grupos.includes(p.funcao_tarefa)) grupos.push(p.funcao_tarefa);
  const linhas = grupos.map((g) => {
    const bol = dias.map((d, i) => {
      const rot = TAREFAS.filter((t) => t.funcao === f.id && naGrade(t) && grupoDaTarefa(t) === g && !feriado(d) && valeNoDia(t, d));
      const pend = minhas.filter((p) => p.funcao_tarefa === g && p.prazo === d);
      const total = rot.length + pend.length;
      const feitos = rot.filter((t) => ((checks[d] || {})[t.id]) === 'feito').length + pend.filter((p) => p.status === 'feita').length;
      let cls = 'vazio';
      if (total) cls = feitos === total ? 'ok' : d > hoje ? 'futuro' : d === hoje ? (feitos ? 'parcial' : 'hoje') : (feitos ? 'parcial' : 'falha');
      const nomes = [...rot.map((t) => t.texto), ...pend.map((p) => p.descricao)];
      const rotulo = { ok: 'concluído', futuro: 'a fazer', hoje: 'de hoje, em aberto', parcial: 'parte concluída', falha: 'não concluído', vazio: 'nada previsto' }[cls];
      return { d, i, cls, total, feitos, title: `${DIA_CURTO[i]} ${dm(d)} · ${rotulo}${total ? ` (${feitos}/${total})` : ''}${nomes.length ? `\n• ${nomes.join('\n• ')}` : ''}` };
    });
    return { g, bol, tem: bol.some((b) => b.total) };
  });
  return html`<aside class="ag-funcoes"><h3>Funções</h3><p class="pequeno">A bolinha do dia fica verde quando a tarefa daquela função é concluída.</p>
    ${linhas.length ? [...linhas.filter((l) => l.tem), ...linhas.filter((l) => !l.tem)].map((l) => html`<div class="ag-func ${l.tem ? '' : 'ag-func-livre'}"><b>${l.g}</b>
      <div class="ag-bols">${l.bol.map((b) => html`<span class="ag-bol-col"><i class="ag-bol ag-b-${b.cls}" title="${b.title}"></i><small>${DIA_CURTO[b.i][0]}</small></span>`)}</div></div>`) : html`<p class="vazio">Sem funções cadastradas para o seu cargo.</p>`}
    <div class="ag-bol-leg"><span><i class="ag-bol ag-b-ok"></i> concluído</span><span><i class="ag-bol ag-b-parcial"></i> em parte</span><span><i class="ag-bol ag-b-hoje"></i> hoje</span><span><i class="ag-bol ag-b-falha"></i> não concluído</span><span><i class="ag-bol ag-b-futuro"></i> a fazer</span></div>
  </aside>`;
}

export function render(opts) {
  const principal = renderPrincipal(opts);
  const lateral = cardsFuncoes({ pendencias: opts.pendencias || [], eu: opts.eu, ref: opts.semanaRef || opts.dia });
  return html`<div class="ag-layout">${lateral}<div class="ag-principal">${principal}</div></div>`;
}
function renderPrincipal(opts) {
  const base = String(meudia.render({ ...opts, soFuncoes: true, aba: 'funcoes', semFuncoes: true, pendencias: opts.pendencias || [], eu: opts.eu }));
  return html.seguro(base);
}

// Arrastar o cartão da tarefa na grade (e puxar a borda de baixo): muda dia, horário e duração. Clicar (sem arrastar) abre a tarefa.
export function instalarTarefasNaGrade(mover) {
  const ALT = 44; const PASSO = 30; const INI = 8 * 60; const FAIXAS = 18;
  let a = null;
  const limitar = (v, x, y) => Math.max(x, Math.min(y, v));
  const reset = () => { if (a) { a.card.classList.remove('arrastando'); a.card.style.transform = ''; a = null; } };
  document.addEventListener('pointerdown', (e) => {
    if (e.button || a) return;
    const card = e.target.closest && e.target.closest('.ag-tcard'); if (!card || e.target.closest('button, a')) return;
    const r = card.getBoundingClientRect();
    a = { card, trilho: card.parentElement, alca: !!e.target.closest('.ag-alca'), x0: e.clientX, y0: e.clientY, moveu: false, h0: r.height, desloc: e.clientY - r.top, id: card.dataset.tcard, span: Number(card.dataset.span) };
    if (a.alca) e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!a) return;
    const dx = e.clientX - a.x0; const dy = e.clientY - a.y0;
    if (!a.moveu && Math.hypot(dx, dy) < 5) return;
    if (!a.moveu) { a.moveu = true; a.card.classList.add('arrastando'); a.card.dataset.arrastou = '1'; }
    e.preventDefault();
    if (a.alca) a.card.style.height = `${Math.max(ALT - 2, a.h0 + dy)}px`; else a.card.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  document.addEventListener('pointerup', (e) => {
    if (!a) return;
    const x = a;
    if (!x.moveu) { reset(); return; }
    setTimeout(() => { delete x.card.dataset.arrastou; }, 80);   // o clique que vem logo depois do arraste não abre a tarefa
    const trilhos = [...document.querySelectorAll('.fq-trilho')];
    const alvo = x.alca ? x.trilho : (trilhos.find((t) => { const r = t.getBoundingClientRect(); return e.clientX >= r.left && e.clientX < r.right; }) || x.trilho);
    const r = alvo.getBoundingClientRect();
    let span = x.span; let faixa = Math.round((x.card.getBoundingClientRect().top - r.top) / ALT);
    if (x.alca) { span = Math.max(1, Math.round((x.h0 + (e.clientY - x.y0) + 2) / ALT)); faixa = Math.round((parseFloat(x.card.style.top) || 0) / ALT); }
    else faixa = Math.round((e.clientY - x.desloc - r.top) / ALT);
    faixa = limitar(faixa, 0, FAIXAS - span); span = limitar(span, 1, FAIXAS - faixa);
    const min = INI + faixa * PASSO; const hora = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
    const id = x.id; reset();
    mover(id, { prazo: alvo.dataset.trilho, hora, duracao: span * PASSO });
  });
  document.addEventListener('pointercancel', reset);
}
