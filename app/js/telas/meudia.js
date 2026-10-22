// "Minha semana" (antes "Meu dia"): duas abas, as duas no formato de quadro da semana.
//   Semana  — itens da programação × segunda a sexta: programado na semana, meta e executado de cada dia,
//             lançado direto na célula (só funções de obra, sócio e coordenação)
//   Funções — tarefas da função (POP R14) × segunda a sábado, com ✓ feito / ✕ não feito em cada célula

import { html, data as fmtData } from '../formato.js';
import { somarDias, hojeISO, inicioDaSemana } from '../datas.js';
import { TAREFAS, valeNoDia, descreverDias, naGrade, OBSERVACOES, diaSemana, soMinhasFuncoes } from '../funcoes.js';
import { sessao, funcaoAtual, idPessoa, obrasDaPessoa } from '../sessao.js';
import { lerChecks, lerHorarios, moverHorario, primeiroDia, lerHorariosFixos, fixarHorario } from '../armazenamento.js';
import { programacoes } from '../programacao.js';
import { feriado } from '../feriados.js';
import { telaSemana } from './produtividade.js';
import { provaDe, descreverProva } from '../evidencias.js';

const NOME_AREA = {
  geral: 'Geral', operacao: 'Operação', posobra: 'Pós-obra', transporte: 'Transporte', suprimentos: 'Suprimentos',
  planejamento: 'Planejamento', comercial: 'Comercial', financeiro: 'Financeiro', rh: 'RH',
};
const DIA_CURTO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Texto da tarefa como no quadro: negrito = compromisso fixo; selo = acrescentada pelo POP, aguardando confirmação
export const textoTarefa = (t) => html`<b class="${t.fixo ? 'tf-fixo' : 'tf-normal'}">${t.texto}</b>${t.pop ? html`<span class="selo-pop" title="Tarefa acrescentada a partir do POP R14, aguardando confirmação">sugerida pelo POP</span>` : ''}`;

// Rodapé "Fora do quadro": tarefas mensais, quinzenais e ocasionais + observações da função
export function foraDoQuadro(funcaoId) {
  const fora = TAREFAS.filter((t) => t.funcao === funcaoId && !naGrade(t));
  const obs = OBSERVACOES[funcaoId] || [];
  if (!fora.length && !obs.length) return '';
  return html`<div class="fora-quadro"><b>Fora do quadro</b><ul>
    ${fora.map((t) => html`<li><span class="pequeno">${descreverDias(t.dias)}:</span> ${textoTarefa(t)}</li>`)}
    ${obs.map((o) => html`<li class="muted">${o}</li>`)}
  </ul></div>`;
}

export const ABAS = [
  { id: 'semana', nome: 'Semana', obra: true },
  { id: 'funcoes', nome: 'Funções' },
];

// Quadro da semana (Funções): dias em colunas, horas na vertical (7h às 19h, faixas de 30 min).
// Cada tarefa é um cartão: arrastar muda o dia/horário, puxar a borda de baixo muda a duração, clicar abre
// uma janelinha com os detalhes (e os mesmos ajustes, para quem está no celular). Cartões no mesmo horário
// ficam lado a lado, com o texto cortado em "…". O ajuste fica guardado neste navegador, por dia da tarefa.
export const GRADE = { ini: 7 * 60, passo: 30, faixas: 24, alt: 52 };   // alt = altura de cada meia hora (maior = cartões com o texto inteiro)
const PADRAO = 8 * 60; // sem horário no quadro: começa às 8h
function previsto(t) {
  const txt = String(t.hora || '');
  const m = txt.match(/(\d{1,2})h(\d{2})?/);
  const ini = m ? Number(m[1]) * 60 + Number(m[2] || 0) : PADRAO;
  const f = txt.match(/(\d{1,2})h(\d{2})?\s*[–-]\s*(\d{1,2})h(\d{2})?/);
  const dur = f ? Math.max(30, Number(f[3]) * 60 + Number(f[4] || 0) - ini) : 60;
  return { ini, dur };
}
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const durTxt = (min) => { const h = Math.floor(min / 60); const m = min % 60; return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`; };
const limitar = (v, a, b) => Math.max(a, Math.min(b, v));

// Como a pessoa vê as tarefas: 'lista' (padrão, texto inteiro) ou 'quadro' (por horário). Guardado neste navegador.
const CHAVE_VISTA = 'solida.funcoesVista';
let vista = 'lista';   // 21/10: a vista "Por horário" (quadro com horas) foi desligada: com várias tarefas no mesmo horário o texto ficava cortado e sobreposto
function trocarVista() { vista = 'lista'; try { localStorage.removeItem(CHAVE_VISTA); } catch { /* sem armazenamento */ } }

// Posição de uma tarefa (do dia d) no quadro, já com o que a pessoa ajustou
function efetivo(t, d, horarios, dias) {
  const p = previsto(t);
  const o = (horarios[d] || {})[t.id] || {};
  const dur = limitar(o.dur ?? p.dur, GRADE.passo, GRADE.faixas * GRADE.passo);
  const span = Math.round(dur / GRADE.passo);
  const faixa = limitar(Math.round(((o.ini ?? p.ini) - GRADE.ini) / GRADE.passo), 0, GRADE.faixas - span);
  const dia = dias.includes(o.dia) ? o.dia : d;
  return { t, d, dia, faixa, span, dur: span * GRADE.passo, ini: GRADE.ini + faixa * GRADE.passo, mudou: dia !== d || (o.ini != null && o.ini !== p.ini) || (o.dur != null && o.dur !== p.dur) };
}
// Cartões que se sobrepõem dividem a largura da coluna (lane / n)
function lados(itens) {
  itens.sort((a, b) => a.faixa - b.faixa || b.span - a.span);
  let grupo = []; let lanes = []; let fim = -1;
  const fechar = () => { grupo.forEach((i) => { i.n = lanes.length; }); grupo = []; lanes = []; fim = -1; };
  for (const it of itens) {
    if (grupo.length && it.faixa >= fim) fechar();
    let l = lanes.findIndex((f) => f <= it.faixa);
    if (l < 0) { l = lanes.length; lanes.push(0); }
    lanes[l] = it.faixa + it.span; it.lane = l; grupo.push(it); fim = Math.max(fim, it.faixa + it.span);
  }
  fechar();
  return itens;
}

// Situação da tarefa no dia (cor do cartão + botões ✓ / ✕)
function situacao(t, data, estado, hoje, prova, curto) {
  const btn = (v, txt, pressionado) => html`<button type="button" class="fn-b fn-${v}" data-check="${t.id}|${data}|${v}" aria-pressed="${pressionado ? 'true' : 'false'}" title="${pressionado ? 'Clique para desfazer' : (v === 'feito' ? 'Marcar como feito' : 'Marcar como não feito')}">${txt}</button>`;
  if (data > hoje) return { cls: 'futuro', marca: '', acoes: '' };
  if (estado === 'feito') return { cls: 'ok', marca: '✓', acoes: btn('feito', curto ? '✓' : '✓ Feito', true) };
  if (estado === 'nao') return { cls: 'nao', marca: '✕', acoes: btn('nao', curto ? '✕' : '✕ Não feito', true) };
  if (prova) return { cls: 'ok', marca: '✓', acoes: html`<span class="fn-auto" title="${descreverProva(prova)}">${curto ? '✓ auto' : '✓ automático'}</span>${btn('nao', curto ? '✕' : '✕ Não', false)}` };
  return { cls: 'sem', marca: '', acoes: html`${btn('feito', curto ? '✓' : '✓ Feito', false)}${btn('nao', curto ? '✕' : '✕ Não', false)}` };
}
const infoTarefa = (t) => [NOME_AREA[t.area] || t.area, t.processo && t.processo !== '—' ? `POP ${t.processo}` : '', descreverDias(t.dias), t.hora ? `quadro: ${t.hora}` : ''].filter(Boolean).join(' · ');

// Cartão da lista "ficaram sem marcar" (sem horário)
function caixaTarefa(t, data, estado, hoje, prova, rotuloDia = '', opc = {}) {
  const { cls, acoes } = situacao(t, data, estado, hoje, prova, false);
  const meta = [rotuloDia, opc.mover ? '' : t.hora].filter(Boolean).join(' · ');
  // opc.mover: o cartão pode ser arrastado para outro dia ou horário (grade por hora); opc.mudou: já foi movido do horário do quadro
  if (opc.mover) {
    // a altura mínima cresce com o tempo que a tarefa ocupa no dia (30 min = baixa; 3 h = alta)
    const alt = opc.dur ? Math.round((opc.dur / 30) * 26) : 0;
    return html`<div class="fn-caixa fn-${cls} fn-movivel ${opc.mudou ? 'fn-mudou' : ''}" ${alt ? html.seguro(`style="min-height:${alt}px"`) : ''} draggable="true" data-mover="${t.id}|${data}" title="${infoTarefa(t)} — clique para mudar a duração; arraste para outra hora do dia">
    <div class="fn-nome">${textoTarefa(t)}</div>
    ${meta || opc.mudou ? html`<div class="fn-meta">${meta}${opc.mudou ? html` <button type="button" class="fn-volta" data-volta="${t.id}|${data}" title="Voltar ao dia e horário do quadro">↺ movida</button>` : ''}</div>` : ''}
    ${acoes ? html`<div class="fn-acoes">${acoes}</div>` : ''}
  </div>`;
  }
  return html`<div class="fn-caixa fn-${cls}" title="${infoTarefa(t)}">
    <div class="fn-nome">${textoTarefa(t)}</div>
    ${meta ? html`<div class="fn-meta">${meta}</div>` : ''}
    ${acoes ? html`<div class="fn-acoes">${acoes}</div>` : ''}
  </div>`;
}

// Cartão no quadro
function cartao(e, estado, hoje, prova) {
  const { t } = e;
  const altura = e.span * GRADE.alt - 2;
  const grande = e.n === 1 && e.span >= 3;
  const { cls, marca, acoes } = situacao(t, e.d, estado, hoje, prova, true);
  const linhas = Math.max(1, Math.floor((altura - 8 - (grande ? 28 : 0) - (e.n === 1 && e.span >= 2 ? 14 : 0)) / 17));
  const estilo = `top:${e.faixa * GRADE.alt}px;height:${altura}px;left:calc(${e.lane} * 100% / ${e.n} + 2px);width:calc(100% / ${e.n} - 4px);--l:${linhas}`;
  return html`<div class="fq-card fn-${cls} ${e.mudou ? 'mudou' : ''}" style="${estilo}" title="${t.texto} — ${hhmm(e.ini)} a ${hhmm(e.ini + e.dur)} (${durTxt(e.dur)})" data-card="${t.id}|${e.d}" data-faixa="${e.faixa}" data-span="${e.span}">
    ${marca ? html`<span class="fq-marca">${marca}</span>` : ''}
    <div class="fq-nome">${t.texto}</div>
    ${e.n === 1 && e.span >= 2 ? html`<div class="fn-meta">${hhmm(e.ini)}–${hhmm(e.ini + e.dur)}</div>` : ''}
    ${grande && acoes ? html`<div class="fn-acoes">${acoes}</div>` : ''}
    <div class="fq-alca" title="Puxe para mudar a duração"></div>
  </div>`;
}

// Janelinha com os detalhes do cartão
let popup = null; // { id, d }
function janela(e, dias, hoje, estado, prova) {
  const { t } = e;
  const { acoes } = situacao(t, e.d, estado, hoje, prova, false);
  const fmt = (d) => `${DIA_CURTO[dias.indexOf(d)]} ${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return html`<div class="fq-fundo" data-fn="fechar"></div>
    <div class="fq-pop" role="dialog" aria-label="Detalhes da tarefa">
      <button type="button" class="fq-x" data-fn="fechar" title="Fechar">×</button>
      <div class="fq-pop-nome">${textoTarefa(t)}</div>
      <p class="pequeno">${infoTarefa(t)}${e.dia !== e.d ? ` · previsto para ${fmt(e.d)}` : ''}</p>
      <div class="fq-pop-linha"><span>Duração</span><div><button type="button" class="fn-b" data-fn="dur|-30">− 30 min</button> <b>${durTxt(e.dur)}</b> <button type="button" class="fn-b" data-fn="dur|30">+ 30 min</button></div></div>
      ${acoes ? html`<div class="fq-pop-linha"><span>Situação</span><div class="fn-acoes">${acoes}</div></div>` : html`<p class="pequeno">A marcação de feito/não feito abre no dia da tarefa.</p>`}
      ${e.mudou ? html`<button type="button" class="botao" data-fn="volta">↺ Voltar ao quadro (${t.hora || '08:00'})</button>` : ''}
    </div>`;
}

function funcoesSemana(ref, CFG) {
  const f = funcaoAtual();
  const checks = lerChecks(idPessoa());
  const eu = { funcao: f.id, obras: obrasDaPessoa() };
  const hoje = hojeISO();
  const ini = inicioDaSemana(ref);
  const dias = [0, 1, 2, 3, 4, 5].map((i) => somarDias(ini, i));
  const tarefas = TAREFAS.filter((t) => t.funcao === f.id && naGrade(t));
  const estadoDe = (t, d) => (checks[d] || {})[t.id];
  // Pedido do Felipe (21/10): o sistema NÃO marca nada sozinho. Só vale o que a pessoa marcar: ✓ feito ou ✕ não feito.
  const provaDoDia = () => null;
  const feita = (t, d) => estadoDe(t, d) === 'feito' || (!estadoDe(t, d) && !!provaDoDia(t, d));
  const doDia = (d) => (feriado(d) ? [] : tarefas.filter((t) => valeNoDia(t, d)));

  let feitas = 0; let previstas = 0;
  for (const d of dias) { if (d > hoje) continue; for (const t of doDia(d)) { previstas++; if (feita(t, d)) feitas++; } }

  const nav = html`<div class="periodo">
    <button type="button" class="botao" data-semana-md="${somarDias(ini, -7)}">← Semana anterior</button>
    <div class="atual"><span>Semana</span><b>${fmtData(ini).slice(0, 5)} a ${fmtData(somarDias(ini, 5)).slice(0, 5)}</b></div>
    ${hoje < ini || hoje > somarDias(ini, 6) ? html`<button type="button" class="botao" data-semana-md="${hoje}">Esta semana</button>` : ''}
    <button type="button" class="botao" data-semana-md="${somarDias(ini, 7)}">Próxima semana →</button>
  </div>`;

  if (!tarefas.length) return html`${nav}<p class="vazio">Nenhuma tarefa cadastrada para a sua função.</p>`;

  // horário escolhido pela pessoa: vale para a tarefa em TODOS os dias e semanas, só para ela (não muda sozinho)
  const fixos = lerHorariosFixos(idPessoa());
  const horarios = {};
  for (const d of dias) { horarios[d] = {}; for (const [tid, v] of Object.entries(fixos)) horarios[d][tid] = { ...v }; }
  const todos = [];
  for (const d of dias) for (const t of doDia(d)) todos.push(efetivo(t, d, horarios, dias));
  const colunas = dias.map((c) => { const l = lados(todos.filter((e) => e.dia === c)); return { c, l, fe: l.filter((e) => feita(e.t, e.d)).length }; });
  const altTotal = GRADE.faixas * GRADE.alt;
  const horas = Array.from({ length: GRADE.faixas / 2 }, (_, i) => html`<span style="top:${i * 2 * GRADE.alt}px">${GRADE.ini / 60 + i}h</span>`);
  const cabecas = colunas.map(({ c, l, fe }, i) => html`<div class="fq-cab ${c === hoje ? 'hoje' : ''}"><b>${DIA_CURTO[i]} ${c.slice(8, 10)}/${c.slice(5, 7)}</b><small>${feriado(c) ? 'feriado' : l.length ? (c > hoje ? `${l.length} previstas` : `${fe} de ${l.length}`) : 'sem tarefas'}</small></div>`);
  const trilhos = colunas.map(({ c, l }) => html`<div class="fq-trilho ${c === hoje ? 'hoje' : ''}" data-trilho="${c}" style="height:${altTotal}px">${l.map((e) => cartao(e, estadoDe(e.t, e.d), hoje, provaDoDia(e.t, e.d)))}</div>`);

  // Vista em lista (padrão, 21/10): um cartão por tarefa, com o texto inteiro e os botões ✓ Feito / ✕ Não feito na própria tarefa.
  // A vista "Por horário" (quadro com horas) continua disponível para quem quer arrastar e mudar horários.
  const dispo = (e) => `${hhmm(e.ini)}–${hhmm(e.ini + e.dur)} · ${durTxt(e.dur)}`;
  const vistaLista = html`<div class="fl-lista">${colunas.map(({ c, l, fe }, i) => html`<div class="fl-col ${c === hoje ? 'hoje' : ''}">
      <div class="fq-cab ${c === hoje ? 'hoje' : ''}"><b>${DIA_CURTO[i]} ${c.slice(8, 10)}/${c.slice(5, 7)}</b><small>${feriado(c) ? 'feriado' : l.length ? (c > hoje ? `${l.length} previstas` : `${fe} de ${l.length} feitas`) : 'sem tarefas'}</small></div>
      ${[...l].sort((a, b) => a.ini - b.ini).map((e) => caixaTarefa(e.t, e.d, estadoDe(e.t, e.d), hoje, null, dispo(e)))}
    </div>`)}</div>`;
  // Grade por hora (padrão em tela larga): horas na lateral, um dia por coluna. Tarefas do mesmo horário ficam empilhadas na célula
  // (cada uma com o texto inteiro), então nada fica espremido nem cortado e os 6 dias cabem na tela sem rolar para o lado.
  // todas as horas do dia de trabalho (7h às 18h, ou mais se houver tarefa fora disso): assim dá para soltar um cartão em qualquer horário
  const hs = colunas.flatMap(({ l }) => l.map((e) => Math.floor(e.ini / 60)));
  const horasComTarefa = Array.from({ length: Math.max(18, ...hs) - Math.min(7, ...hs) + 1 }, (_, i) => Math.min(7, ...hs) + i);
  const vistaHoras = html`<div class="fh-grade">
    <div class="fh-canto"></div>
    ${colunas.map(({ c, l, fe }, i) => html`<div class="fq-cab fh-dia ${c === hoje ? 'hoje' : ''}"><b>${DIA_CURTO[i]} ${c.slice(8, 10)}/${c.slice(5, 7)}</b><small>${feriado(c) ? 'feriado' : l.length ? (c > hoje ? `${l.length} previstas` : `${fe} de ${l.length}`) : 'sem tarefas'}</small></div>`)}
    ${horasComTarefa.map((h) => html`<div class="fh-hora"><b>${h}h</b></div>${colunas.map(({ c, l }) => html`<div class="fh-cel ${c === hoje ? 'hoje' : ''}" data-cel-dia="${c}" data-cel-hora="${h}">${l.filter((e) => Math.floor(e.ini / 60) === h).sort((a, b) => a.ini - b.ini).map((e) => caixaTarefa(e.t, e.d, estadoDe(e.t, e.d), hoje, null, dispo(e), { mover: true, mudou: e.mudou, dur: e.dur }))}</div>`)}`)}
  </div>
  <p class="legenda-semana">Para mudar o horário de uma tarefa, segure o cartão e arraste para outra hora do mesmo dia (solte na metade de cima da hora para hora cheia, ou na de baixo para "e meia"). Para mudar quanto tempo ela ocupa no dia, clique na tarefa. O que você ajustar vale para todas as semanas e é só seu. "↺ movida" volta ao quadro original.</p>`;
  const botoesVista = html`<div class="fl-vista" role="group" aria-label="Como ver as tarefas"><span class="pequeno">Ver:</span>
    <button type="button" class="botao ${vista === 'lista' ? 'on' : ''}" data-vista-fn="lista">Lista por dia</button>
    <button type="button" class="botao ${vista === 'quadro' ? 'on' : ''}" data-vista-fn="quadro">Por horário</button></div>`;

  let pop = '';
  if (popup) {   // janelinha ao clicar na tarefa: mudar quanto tempo ela ocupa no dia, marcar feito/não feito
    const e = todos.find((x) => x.t.id === popup.id && x.d === popup.d);
    if (e) pop = janela(e, dias, hoje, estadoDe(e.t, e.d), provaDoDia(e.t, e.d)); else popup = null;
  }

  return html`${nav}
    <section class="fn-painel">
      <header class="fn-cab"><h3>${f.nome}</h3>
        <span class="pequeno">${previstas ? `${feitas} de ${previstas} feitas até hoje` : 'nenhuma tarefa até hoje'}</span></header>
      ${previstas ? html`<div class="pct" style="margin:6px 0 12px"><i style="width:${Math.round((feitas / previstas) * 100)}%"></i></div>` : ''}
      ${vista === 'lista' ? html`<div class="fh-larga">${vistaHoras}</div><div class="fh-estreita">${vistaLista}</div>` : html`<div class="fq-quadro"><div class="fq-canto"></div>${cabecas}<div class="fq-horas" style="height:${altTotal}px">${horas}</div>${trilhos}</div>
      <p class="legenda-semana">Arraste um cartão para outro dia ou horário; puxe a borda de baixo para mudar a duração; clique para ver os detalhes. Cartões no mesmo horário ficam lado a lado. O ajuste fica guardado neste navegador.</p>`}
      <p class="legenda-semana"><span class="lg lg-ok"></span> feito <span class="lg lg-abaixo"></span> não feito <span class="lg lg-sem"></span> falta marcar · você mesmo marca cada tarefa: ✓ Feito ou ✕ Não feito · clique numa marcação para desfazer</p>
    </section>
    ${pop}
    ${foraDoQuadro(f.id)}
    <p class="pequeno">Quadro de Tarefas Semanal (SL_TAREFAS_FUNC_R37 + POP R14). As marcações valem pontos${soMinhasFuncoes(f) ? '' : html` no seu <a class="link" href="#/perfil">Perfil</a>`}: tarefa sem marcação conta como não entregue.
      <button type="button" class="botao" data-trein-slides="funcoes-usar" style="margin-left:8px">▶ Como funciona esta página</button></p>`;
}

// Ligações do quadro (uma vez só, no início): arrastar, puxar a borda, abrir e ajustar a janelinha.
export function instalarQuadro(aoMudar) {
  // Mover tarefas dentro do próprio dia (grade por hora): segure o cartão, arraste e solte na hora que quiser (metade de cima da célula = hora cheia,
  // metade de baixo = e meia). O horário vale para a tarefa em todas as semanas e fica só para esta pessoa. "↺ movida" volta ao horário do quadro.
  let movendo = null;
  const celula = (e) => (e.target.closest ? e.target.closest('.fh-cel') : null);
  document.addEventListener('dragstart', (e) => {
    const c = e.target.closest && e.target.closest('[data-mover]'); if (!c) return;
    const [id, d] = c.dataset.mover.split('|'); movendo = { id, d, card: c };
    e.dataTransfer.setData('text/plain', c.dataset.mover); e.dataTransfer.effectAllowed = 'move'; c.classList.add('arrastando');
  });
  document.addEventListener('dragend', () => { if (movendo) movendo.card.classList.remove('arrastando'); movendo = null; document.querySelectorAll('.fh-cel.alvo').forEach((x) => x.classList.remove('alvo')); });
  document.addEventListener('dragover', (e) => {
    const cel = celula(e); if (!cel || !movendo || cel.dataset.celDia !== movendo.d) return;   // só dentro do próprio dia
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.fh-cel.alvo').forEach((x) => { if (x !== cel) x.classList.remove('alvo'); }); cel.classList.add('alvo');
  });
  document.addEventListener('drop', (e) => {
    const cel = celula(e); if (!cel || !movendo || cel.dataset.celDia !== movendo.d) return;
    e.preventDefault();
    const r = cel.getBoundingClientRect(); const meia = (e.clientY - r.top) / Math.max(1, r.height) >= 0.5;
    const ini = Number(cel.dataset.celHora) * 60 + (meia ? 30 : 0);
    fixarHorario(idPessoa(), movendo.id, { ini });
    movendo = null; aoMudar();
  });
  document.addEventListener('click', (e) => {
    const v = e.target.closest && e.target.closest('[data-volta]');
    if (v) { fixarHorario(idPessoa(), v.dataset.volta.split('|')[0], null); aoMudar(); return; }
    // clicar na tarefa (fora dos botões) abre a janelinha com a duração e a situação
    const c = e.target.closest && e.target.closest('.fn-movivel');
    if (c && !e.target.closest('button, a')) { const [id, d] = c.dataset.mover.split('|'); popup = { id, d }; aoMudar(); }
  });

  let a = null;
  const reset = () => { if (a) { a.card.classList.remove('arrastando'); a.card.style.transform = ''; a = null; } };
  document.addEventListener('pointerdown', (e) => {
    if (e.button || a) return;
    const card = e.target.closest && e.target.closest('.fq-card');
    if (!card || e.target.closest('button')) return;
    const trilho = card.parentElement;
    a = { card, trilho, alca: !!e.target.closest('.fq-alca'), x0: e.clientX, y0: e.clientY, moveu: false,
      h0: card.getBoundingClientRect().height, desloc: e.clientY - card.getBoundingClientRect().top };
    const [id, d] = card.dataset.card.split('|');
    a.id = id; a.d = d; a.span = Number(card.dataset.span);
    if (a.alca) e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!a) return;
    const dx = e.clientX - a.x0; const dy = e.clientY - a.y0;
    if (!a.moveu && Math.hypot(dx, dy) < 5) return;
    if (!a.moveu) { a.moveu = true; a.card.classList.add('arrastando'); }
    e.preventDefault();
    if (a.alca) a.card.style.height = `${Math.max(GRADE.alt - 2, a.h0 + dy)}px`;
    else a.card.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  document.addEventListener('pointerup', (e) => {
    if (!a) return;
    const x = a;
    const pessoa = idPessoa();
    if (!x.moveu) { reset(); if (!x.alca) { popup = { id: x.id, d: x.d }; aoMudar(); } return; }
    if (x.alca) {
      const span = Math.max(1, Math.round((x.h0 + (e.clientY - x.y0) + 2) / GRADE.alt));
      moverHorario(pessoa, x.d, x.id, { dur: span * GRADE.passo });
    } else {
      const trilhos = [...document.querySelectorAll('.fq-trilho')];
      const alvo = trilhos.find((t) => { const r = t.getBoundingClientRect(); return e.clientX >= r.left && e.clientX < r.right; }) || x.trilho;
      const r = alvo.getBoundingClientRect();
      const faixa = limitar(Math.round((e.clientY - x.desloc - r.top) / GRADE.alt), 0, GRADE.faixas - x.span);
      moverHorario(pessoa, x.d, x.id, { dia: alvo.dataset.trilho, ini: GRADE.ini + faixa * GRADE.passo });
    }
    reset();
    aoMudar();
  });
  document.addEventListener('pointercancel', reset);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && popup) { popup = null; aoMudar(); } });
  document.addEventListener('click', (e) => {
    const v = e.target.closest && e.target.closest('[data-vista-fn]');
    if (v) { trocarVista(v.dataset.vistaFn); aoMudar(); return; }
    const b = e.target.closest && e.target.closest('[data-fn]');
    if (!b || !popup) return;
    const [acao, valor] = b.dataset.fn.split('|');
    const pessoa = idPessoa();
    if (acao === 'fechar') popup = null;
    else if (acao === 'volta') fixarHorario(pessoa, popup.id, null);
    else if (acao === 'dur') {   // quanto tempo a tarefa ocupa no dia: vale para todas as semanas, só para esta pessoa
      const t = TAREFAS.find((x) => x.id === popup.id);
      const ini = inicioDaSemana(popup.d);
      const dias = [0, 1, 2, 3, 4, 5].map((i) => somarDias(ini, i));
      const fx = lerHorariosFixos(pessoa);
      const atual = efetivo(t, popup.d, { [popup.d]: { [t.id]: fx[t.id] || {} } }, dias);
      fixarHorario(pessoa, popup.id, { dur: limitar(atual.dur + Number(valor), GRADE.passo, 12 * 60) });
    }
    aoMudar();
  });
}
// Preencher é de quem está na obra. Sócio e coordenação consultam em Operação › Metas e produtividade.
const veTodasAsObras = () => false;

export function render({ dia, CFG, aba, semanaRef, soFuncoes = false }) {
  const s = sessao();
  const f = funcaoAtual();
  const todas = veTodasAsObras(f);
  const todasProgs = CFG ? programacoes(CFG) : [];
  const obras = todas ? todasProgs.map((p) => p.obra) : obrasDaPessoa();
  // a aba Semana (lançar produtividade) é de quem preenche: gestor de obra, estagiário e encarregado
  // "Minhas funções" é uma página própria no menu; em "Minha semana" fica só o lançamento da semana
  const abas = ABAS.filter((a) => (soFuncoes ? a.id === 'funcoes' : a.id !== 'funcoes') && (!a.obra || f.editaProdutividade || todas));
  const ativa = abas.find((a) => a.id === aba) || abas[0];
  const progs = todasProgs.filter((p) => obras.includes(p.obra));
  const ref = semanaRef || dia;

  let corpo;
  if (ativa.obra && !CFG) corpo = html`<p class="vazio">Carregando…</p>`;
  else if (ativa.obra && !obras.length) corpo = html`<p class="vazio">Nenhuma obra vinculada ao seu acesso.</p>`;
  else if (ativa.id === 'semana') corpo = telaSemana({ CFG, progs, ref });
  else corpo = funcoesSemana(ref, CFG);

  return html`<div class="pagina">
    <div class="cabeca-setor">
      <p class="resumo">${s.nome} · ${f.nome}${f.pop ? html` <span class="pequeno">(no POP: ${f.pop})</span>` : ''}</p>
      ${f.porObra ? html`<p class="pequeno" style="margin:0">Suas obras: ${obras.length ? obras.join(', ') : '—'}</p>` : ''}
      ${todas ? html`<p class="pequeno" style="margin:0">Todas as obras</p>` : ''}
    </div>
    ${abas.length > 1 ? html`<div class="subnav" role="tablist">${abas.map((a) => html`<a href="#/meudia/${a.id}" class="${a.id === ativa.id ? 'on' : ''}" role="tab">${a.nome}</a>`)}</div>` : ''}
    ${corpo}
  </div>`;
}
