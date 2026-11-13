// "Minha semana" (antes "Meu dia"): duas abas, as duas no formato de quadro da semana.
//   Semana  — itens da programação × segunda a sexta: programado na semana, meta e executado de cada dia,
//             lançado direto na célula (só funções de obra, sócio e coordenação)
//   Funções — tarefas da função (POP R14) × segunda a sábado, com ✓ feito / ✕ não feito em cada célula

import { html, data as fmtData } from '../formato.js';
import { somarDias, hojeISO, inicioDaSemana } from '../datas.js';
import { FUNCOES, TAREFAS, valeNoDia, descreverDias, naGrade, OBSERVACOES, diaSemana, soMinhasFuncoes } from '../funcoes.js';
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

// Quadro da semana (Funções): dias em colunas, horas na vertical (8h às 17h, faixas de 30 min).
// Cada tarefa é um cartão: arrastar muda o dia/horário, puxar a borda de baixo muda a duração, clicar abre
// uma janelinha com os detalhes (e os mesmos ajustes, para quem está no celular). Cartões no mesmo horário
// ficam lado a lado, com o texto cortado em "…". O ajuste fica guardado neste navegador, por dia da tarefa.
export const GRADE = { ini: 8 * 60, passo: 30, faixas: 18, alt: 44 };   // alt = altura de cada meia hora (maior = cartões com o texto inteiro)
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
// Consulta (só o gestor de obra): ver, sem marcar nem mexer, o quadro do estagiário ou do encarregado. Não vale para os funcionários.
const CONSULTAVEIS = ['estagiario', 'encarregado', 'ajudante'];
let consulta = null;
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
function situacao(t, data, estado, hoje, prova, curto, dataVista = null) {
  const btn = (v, txt, pressionado) => html`<button type="button" class="fn-b fn-${v}" data-check="${t.id}|${data}|${v}" aria-pressed="${pressionado ? 'true' : 'false'}" title="${pressionado ? 'Clique para desfazer' : (v === 'feito' ? 'Marcar como feito' : 'Marcar como não feito')}">${txt}</button>`;
  if ((dataVista || data) > hoje && !estado) return { cls: 'futuro', marca: '', acoes: '' };   // vale o dia em que o cartão está (se a pessoa mudou de dia)
  if (estado === 'feito') return { cls: 'ok', marca: '✓', acoes: btn('feito', curto ? '✓' : '✓ Feito', true) };
  if (estado === 'nao') return { cls: 'nao', marca: '✕', acoes: btn('nao', curto ? '✕' : '✕ Não feito', true) };
  if (prova) return { cls: 'ok', marca: '✓', acoes: html`<span class="fn-auto" title="${descreverProva(prova)}">${curto ? '✓ auto' : '✓ automático'}</span>${btn('nao', curto ? '✕' : '✕ Não', false)}` };
  return { cls: 'sem', marca: '', acoes: html`${btn('feito', curto ? '✓' : '✓ Feito', false)}${btn('nao', curto ? '✕' : '✕ Não', false)}` };
}
const infoTarefa = (t) => [NOME_AREA[t.area] || t.area, t.processo && t.processo !== '—' ? `POP ${t.processo}` : '', descreverDias(t.dias), t.hora ? `quadro: ${t.hora}` : ''].filter(Boolean).join(' · ');

// Cartão da lista "ficaram sem marcar" (sem horário)
function caixaTarefa(t, data, estado, hoje, prova, rotuloDia = '', opc = {}) {
  const { cls, acoes } = situacao(t, data, estado, hoje, prova, false, opc.dataVista || null);
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
// Um cartão só por tarefa, com a altura do tempo que ela ocupa (8h às 9h = duas linhas de meia hora). Tarefas no mesmo horário ficam lado a lado.
function cartao(e, estado, hoje, prova) {
  const { t } = e;
  const altura = e.span * GRADE.alt - 2;
  const { cls, acoes } = situacao(t, e.d, estado, hoje, prova, true, e.dia);
  const estilo = `top:${e.faixa * GRADE.alt}px;height:${altura}px;left:calc(${e.lane} * 100% / ${e.n} + 2px);width:calc(100% / ${e.n} - 4px)`;
  return html`<div class="fq-card fn-${cls} ${e.mudou ? 'mudou' : ''} ${e.n > 1 ? 'fq-estreito' : ''}" style="${estilo}" title="${t.texto} — ${hhmm(e.ini)} a ${hhmm(e.ini + e.dur)} (${durTxt(e.dur)}). Arraste para mudar o horário ou o dia; puxe a borda de baixo para mudar a duração; clique para ver os detalhes." data-card="${t.id}|${e.d}" data-faixa="${e.faixa}" data-span="${e.span}">
    <div class="fq-nome">${t.texto}</div>
    <div class="fn-meta">${hhmm(e.ini)}–${hhmm(e.ini + e.dur)}${e.mudou ? ' · ↺' : ''}</div>
    ${acoes ? html`<div class="fn-acoes">${acoes}</div>` : ''}
    <div class="fq-alca" title="Puxe para mudar a duração"></div>
  </div>`;
}

// Janelinha com os detalhes do cartão
let popup = null; // { id, d }
function janela(e, dias, hoje, estado, prova) {
  const { t } = e;
  const { acoes } = situacao(t, e.d, estado, hoje, prova, false, e.dia);
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
  const eu0 = funcaoAtual();
  const cons = eu0.id === 'gestor_obra' && CONSULTAVEIS.includes(consulta) ? consulta : null;   // quadro de outra função, só para olhar
  const f = cons ? FUNCOES.find((x) => x.id === cons) : eu0;
  const checks = cons ? {} : lerChecks(idPessoa());
  const eu = { funcao: f.id, obras: obrasDaPessoa() };
  const hoje = hojeISO();
  const hojeCard = cons ? '0000-00-00' : hoje;   // na consulta os cartões ficam neutros e sem botões
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
    <div class="atual"><span>Semana</span><b>${fmtData(ini).slice(0, 5)} a ${fmtData(somarDias(ini, doDia(dias[5]).length ? 5 : 4)).slice(0, 5)}</b></div>
    ${hoje < ini || hoje > somarDias(ini, 6) ? html`<button type="button" class="botao" data-semana-md="${hoje}">Esta semana</button>` : ''}
    <button type="button" class="botao" data-semana-md="${somarDias(ini, 7)}">Próxima semana →</button>
  </div>`;

  if (!tarefas.length) return html`${nav}<p class="vazio">Nenhuma tarefa cadastrada para a sua função.</p>`;

  // horário escolhido pela pessoa: vale para a tarefa em TODOS os dias e semanas, só para ela (não muda sozinho)
  const fixos = cons ? {} : lerHorariosFixos(idPessoa());
  const horarios = {};
  for (const d of dias) {
    horarios[d] = {}; const dow = String(new Date(`${d}T12:00:00`).getDay());   // 1 = segunda … 6 = sábado
    for (const [tid, v] of Object.entries(fixos)) { const { dias: mapa, ...resto } = v; const alvo = mapa && mapa[dow] ? dias[Number(mapa[dow]) - 1] : null; horarios[d][tid] = { ...resto, ...(alvo ? { dia: alvo } : {}) }; }
  }
  const todos = [];
  for (const d of dias) for (const t of doDia(d)) todos.push(efetivo(t, d, horarios, dias));
  // a semana é de segunda a sexta: o sábado só aparece se a pessoa tiver alguma tarefa nele
  const colunas = dias.map((c) => { const l = lados(todos.filter((e) => e.dia === c)); return { c, l, fe: l.filter((e) => feita(e.t, e.d)).length }; }).filter(({ l }, i) => i < 5 || l.length);
  const altTotal = GRADE.faixas * GRADE.alt;
  const rotuloSlot = (s) => (s % 60 ? `${Math.floor(s / 60)}h30` : `${s / 60}h`);
  const horas = Array.from({ length: GRADE.faixas }, (_, i) => html`<span style="top:${i * GRADE.alt}px">${rotuloSlot(GRADE.ini + i * GRADE.passo)}</span>`);
  const cabecas = colunas.map(({ c, l, fe }, i) => html`<div class="fq-cab ${c === hoje ? 'hoje' : ''}"><b>${DIA_CURTO[i]} ${c.slice(8, 10)}/${c.slice(5, 7)}</b><small>${feriado(c) ? 'feriado' : l.length ? (cons || c > hoje ? `${l.length} tarefas` : `${fe} de ${l.length}`) : 'sem tarefas'}</small></div>`);
  const trilhos = colunas.map(({ c, l }) => html`<div class="fq-trilho ${c === hoje ? 'hoje' : ''}" data-trilho="${c}" style="height:${altTotal}px">${l.map((e) => cartao(e, estadoDe(e.t, e.d), hojeCard, provaDoDia(e.t, e.d)))}</div>`);

  // Vista em lista (padrão, 21/10): um cartão por tarefa, com o texto inteiro e os botões ✓ Feito / ✕ Não feito na própria tarefa.
  // A vista "Por horário" (quadro com horas) continua disponível para quem quer arrastar e mudar horários.
  const dispo = (e) => `${hhmm(e.ini)}–${hhmm(e.ini + e.dur)} · ${durTxt(e.dur)}`;
  const vistaLista = html`<div class="fl-lista" style="--nd:${colunas.length}">${colunas.map(({ c, l, fe }, i) => html`<div class="fl-col ${c === hoje ? 'hoje' : ''}">
      <div class="fq-cab ${c === hoje ? 'hoje' : ''}"><b>${DIA_CURTO[i]} ${c.slice(8, 10)}/${c.slice(5, 7)}</b><small>${feriado(c) ? 'feriado' : l.length ? (cons || c > hoje ? `${l.length} tarefas` : `${fe} de ${l.length} feitas`) : 'sem tarefas'}</small></div>
      ${[...l].sort((a, b) => a.ini - b.ini).map((e) => caixaTarefa(e.t, e.d, estadoDe(e.t, e.d), hojeCard, null, dispo(e)))}
    </div>`)}</div>`;
  // Agenda (padrão em tela larga): horas de meia em meia hora na lateral, um dia por coluna, e UM cartão por tarefa com a altura do tempo
  // que ela ocupa (8h às 9h ocupa as linhas de 8h e 8h30). Tarefas no mesmo horário ficam lado a lado e a coluna do dia alarga para caber.
  const lanes = (l) => Math.max(1, ...l.map((e) => e.n || 1));
  const colsCss = `52px repeat(${colunas.length}, minmax(0, 1fr))`;   // todos os dias com a mesma largura: o que se achata são os cartões que caem no mesmo horário, não a coluna   // no mínimo ~48 px por cartão lado a lado (a página não rola para o lado)
  const vistaQuadro = html`<div class="fq-quadro" style="grid-template-columns:${colsCss}"><div class="fq-canto"></div>${cabecas}<div class="fq-horas" style="height:${altTotal}px">${horas}</div>${trilhos}</div>
  <p class="legenda-semana">Segure um cartão e arraste para outro horário ou outro dia da semana (cada linha é meia hora); puxe a borda de baixo do cartão para mudar quanto tempo a tarefa ocupa; clique no cartão para ver os detalhes. O que você ajustar vale para as próximas semanas e é só seu. "↺" no cartão = foi mexido; abra o cartão para voltar ao quadro original.</p>`;  const botoesVista = html`<div class="fl-vista" role="group" aria-label="Como ver as tarefas"><span class="pequeno">Ver:</span>
    <button type="button" class="botao ${vista === 'lista' ? 'on' : ''}" data-vista-fn="lista">Lista por dia</button>
    <button type="button" class="botao ${vista === 'quadro' ? 'on' : ''}" data-vista-fn="quadro">Por horário</button></div>`;

  // "Outras funções" (pedido do Felipe, 04/11): em vez de botões, uma caixa de seleção no canto direito do quadro (só o gestor de obra);
  // escolher uma função mostra o quadro dela só para consulta; "Minhas funções" volta ao seu.
  const seletor = eu0.id === 'gestor_obra' ? html`<label class="fn-outras">Outras funções
    <select data-consulta-sel aria-label="Ver o quadro de outra função"><option value="" ${cons ? '' : html.seguro('selected')}>Minhas funções</option>
    ${CONSULTAVEIS.map((id) => html`<option value="${id}" ${cons === id ? html.seguro('selected') : ''}>${FUNCOES.find((x) => x.id === id).nome}</option>`)}</select></label>` : '';

  let pop = '';
  if (cons) popup = null;
  if (popup) {   // janelinha ao clicar na tarefa: mudar quanto tempo ela ocupa no dia, marcar feito/não feito
    const e = todos.find((x) => x.t.id === popup.id && x.d === popup.d);
    if (e) pop = janela(e, dias, hoje, estadoDe(e.t, e.d), provaDoDia(e.t, e.d)); else popup = null;
  }

  return html`${nav}
    <section class="fn-painel ${cons ? 'fq-consulta' : ''}">
      <header class="fn-cab"><h3>${f.nome}</h3>
        <span class="fn-cab-dir"><span class="pequeno">${cons ? 'só para consultar' : previstas ? `${feitas} de ${previstas} feitas até hoje` : 'nenhuma tarefa até hoje'}</span>${seletor}</span></header>
      ${previstas && !cons ? html`<div class="pct" style="margin:6px 0 12px"><i style="width:${Math.round((feitas / previstas) * 100)}%"></i></div>` : ''}
      ${vista === 'lista' ? html`<div class="fh-larga">${vistaQuadro}</div><div class="fh-estreita">${vistaLista}</div>` : html`<div class="fq-quadro"><div class="fq-canto"></div>${cabecas}<div class="fq-horas" style="height:${altTotal}px">${horas}</div>${trilhos}</div>
      <p class="legenda-semana">Arraste um cartão para outro dia ou horário; puxe a borda de baixo para mudar a duração; clique para ver os detalhes. Cartões no mesmo horário ficam lado a lado. O ajuste fica guardado neste navegador.</p>`}
      ${cons ? html`<p class="legenda-semana">Visualização só para consulta: é o quadro de tarefas de ${f.nome.toLowerCase()}, para você saber o que essa função faz. Aqui não dá para marcar nem mexer.</p>` : html`<p class="legenda-semana"><span class="lg lg-ok"></span> feito <span class="lg lg-abaixo"></span> não feito <span class="lg lg-sem"></span> falta marcar · você mesmo marca cada tarefa: ✓ Feito ou ✕ Não feito · clique numa marcação para desfazer</p>`}
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
    const cel = celula(e); if (!cel || !movendo) return;   // pode soltar em qualquer dia e hora da semana
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.fh-cel.alvo').forEach((x) => { if (x !== cel) x.classList.remove('alvo'); }); cel.classList.add('alvo');
  });
  document.addEventListener('drop', (e) => {
    const cel = celula(e); if (!cel || !movendo) return;
    e.preventDefault();
    const ini = Number(cel.dataset.celMin);   // o horário é o da linha em que o cartão foi solto
    // dia da semana de origem (da tarefa) e de destino (da célula): o novo dia vale para essa ocorrência em todas as semanas
    const dowDe = (iso) => new Date(`${iso}T12:00:00`).getDay();
    const origem = dowDe(movendo.d); const destino = dowDe(cel.dataset.celDia);
    fixarHorario(idPessoa(), movendo.id, { ini, dias: { [origem]: destino === origem ? null : destino } });
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
    if (!card || e.target.closest('button, .fq-consulta')) return;
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
      fixarHorario(pessoa, x.id, { dur: span * GRADE.passo });   // quanto tempo a tarefa ocupa: vale para todas as semanas, só para esta pessoa
    } else {
      const trilhos = [...document.querySelectorAll('.fq-trilho')];
      const alvo = trilhos.find((t) => { const r = t.getBoundingClientRect(); return e.clientX >= r.left && e.clientX < r.right; }) || x.trilho;
      const r = alvo.getBoundingClientRect();
      const faixa = limitar(Math.round((e.clientY - x.desloc - r.top) / GRADE.alt), 0, GRADE.faixas - x.span);
      // horário novo (linha de meia hora) e dia da semana novo: valem para a tarefa nas próximas semanas, só para esta pessoa
      const dowDe = (iso) => new Date(`${iso}T12:00:00`).getDay();
      const origem = dowDe(x.d); const destino = dowDe(alvo.dataset.trilho);
      fixarHorario(pessoa, x.id, { ini: GRADE.ini + faixa * GRADE.passo, dias: { [origem]: destino === origem ? null : destino } });
    }
    reset();
    aoMudar();
  });
  document.addEventListener('pointercancel', reset);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && popup) { popup = null; aoMudar(); } });
  document.addEventListener('change', (e) => { const sel = e.target.closest && e.target.closest('[data-consulta-sel]'); if (sel) { consulta = sel.value || null; popup = null; aoMudar(); } });
  document.addEventListener('click', (e) => {
    const q = e.target.closest && e.target.closest('[data-consulta]');
    if (q) { consulta = q.dataset.consulta || null; popup = null; aoMudar(); return; }
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
// ---------------------------------------------------------------- Agenda só com as TAREFAS (pedido do Felipe, 11/11/2026)
// As funções deixam de aparecer nos horários do dia (elas ficam na lateral, com as bolinhas). Na grade do dia aparecem as tarefas da aba Tarefas como
// cartões, no horário que a pessoa definiu (sem horário: 8h, tracejado) e pelo tempo da duração. Arrastar muda o dia e o horário; puxar a borda de baixo
// muda a duração; clicar abre a tarefa. Vencida = vermelho · de hoje = azul · dos próximos dias = cinza · concluída = verde.
const hm = (txt) => { const m = String(txt || '').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const assuntoDe = (t) => { const s = String(t || ''); const i = s.indexOf(','); return i > 0 && i < 60 ? [s.slice(0, i).trim(), s.slice(i + 1).trim()] : ['', s.trim()]; };
// botões do cartão da Agenda: concluir (ou reabrir) e excluir; quem trata o clique é o main.js (data-pend / data-pend-del)
const acoesCartao = (p) => html`<span class="ag-acoes"><button type="button" class="ag-del" data-pend-del="${p.id}" title="${p.ata_id ? 'Tirar da lista (continua na ata)' : 'Excluir a tarefa'}">×</button>${p.status === 'feita' ? html`<button type="button" data-pend="${p.id}|aberta" title="Reabrir a tarefa">↺</button>` : html`<button type="button" class="ag-ok" data-pend="${p.id}|feita" title="Concluir a tarefa">✓</button>`}</span>`;
function cartaoTarefa(e, hoje, grande = false) {
  const p = e.p; const feita = p.status === 'feita'; const venc = !feita && p.prazo < hoje;
  const cls = feita ? 'ok' : venc ? 'venc' : p.prazo === hoje ? 'hoje' : 'futura';
  const [ass, resto] = assuntoDe(p.descricao);
  const estilo = `top:${e.faixa * GRADE.alt}px;height:${e.span * GRADE.alt - 2}px;left:calc(${e.lane} * 100% / ${e.n} + 2px);width:calc(100% / ${e.n} - 4px)`;
  return html`<div class="ag-tcard ag-t-${cls} ${e.semHora ? 'ag-t-semhora' : ''} ${e.n > 1 ? 'fq-estreito' : ''}" style="${estilo}" data-tarefa="${p.id}" data-tcard="${p.id}" data-span="${e.span}"
    title="${ass ? `${ass}: ` : ''}${resto}${p.obra ? ` · ${p.obra}` : ''} — ${hhmm(e.ini)} a ${hhmm(e.ini + e.dur)}${e.semHora ? ' (sem horário definido: está no início do dia; arraste para escolher)' : ''}. Clique para abrir; arraste para mudar o horário ou o dia; puxe a borda de baixo para mudar a duração.">
    ${p.obra ? html`<b class="ag-t-obra">${p.obra}</b>` : ''}<div class="fq-nome">${ass ? `${ass} · ` : ''}${resto}</div>
    <div class="fn-meta">${e.semHora ? 'sem horário' : `${hhmm(e.ini)}–${hhmm(e.ini + e.dur)}`}</div>
    ${grande && e.span >= 2 ? html`<div class="ag-t-det">${p.setor ? html`<span>${p.setor}</span>` : ''}${p.responsavel_nome ? html`<span>${p.responsavel_nome}</span>` : ''}${p.urgencia ? html`<span class="ag-t-urg ag-u-${p.urgencia}">${{ alta: 'Alta', media: 'Média', baixa: 'Baixa' }[p.urgencia] || ''}</span>` : ''}</div>` : ''}
    ${acoesCartao(p)}<div class="ag-alca" title="Puxe para mudar a duração"></div></div>`;
}
function agendaDeTarefas(ref, { pendencias = [], eu, modo = 'semana', diaRef = null }) {
  const hoje = hojeISO(); const ini = inicioDaSemana(ref);
  const modoDia = modo === 'dia'; const diaVis = diaRef || hoje;
  const dias = modoDia ? [diaVis] : [0, 1, 2, 3, 4, 5].map((i) => somarDias(ini, i));
  const SEMANA7 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']; const nomeDia = (d) => SEMANA7[new Date(`${d}T12:00:00`).getDay()];
  const minhas = pendencias.filter((p) => p.prazo && p.na_lista !== false && ['aberta', 'feita'].includes(p.status) && eu && (p.responsavel === eu || (p.gestores || []).includes(eu) || (p.observadores || []).includes(eu)) && dias.includes(p.prazo));
  const entradas = minhas.map((p) => {
    const m = hm(p.hora); const dur = limitar(Number(p.duracao) || 60, GRADE.passo, GRADE.faixas * GRADE.passo);
    const span = Math.round(dur / GRADE.passo);
    const faixa = limitar(Math.round(((m ?? GRADE.ini) - GRADE.ini) / GRADE.passo), 0, GRADE.faixas - span);
    return { p, dia: p.prazo, faixa, span, dur: span * GRADE.passo, ini: GRADE.ini + faixa * GRADE.passo, semHora: m == null };
  });
  const iniDaVis = inicioDaSemana(diaVis);
  const navDia = html`<div class="periodo">
    <button type="button" class="botao" data-ag-dia="${somarDias(diaVis, -1)}">← Dia anterior</button>
    <div class="atual"><span>${nomeDia(diaVis)}${diaVis === hoje ? ' · hoje' : ''}</span><b>${fmtData(diaVis)}</b></div>
    ${diaVis !== hoje ? html`<button type="button" class="botao" data-ag-dia="${hoje}">Hoje</button>` : ''}
    <button type="button" class="botao" data-ag-dia="${somarDias(diaVis, 1)}">Próximo dia →</button>
  </div>
  <div class="ag-chips-dia">${[0, 1, 2, 3, 4, 5].map((i) => { const d = somarDias(iniDaVis, i); const n = pendencias.filter((p) => p.prazo === d && p.na_lista !== false && ['aberta', 'feita'].includes(p.status) && eu && (p.responsavel === eu || (p.gestores || []).includes(eu) || (p.observadores || []).includes(eu))).length; return html`<button type="button" class="ag-chip-dia ${d === diaVis ? 'on' : ''} ${d === hoje ? 'hj' : ''}" data-ag-dia="${d}">${SEMANA7[(i + 1) % 7]} ${d.slice(8, 10)}${n ? html`<small>${n}</small>` : ''}</button>`; })}</div>`;
  const nav = modoDia ? navDia : html`<div class="periodo">
    <button type="button" class="botao" data-semana-md="${somarDias(ini, -7)}">← Semana anterior</button>
    <div class="atual"><span>Semana</span><b>${fmtData(ini).slice(0, 5)} a ${fmtData(somarDias(ini, entradas.some((e) => e.dia === dias[5]) ? 5 : 4)).slice(0, 5)}</b></div>
    ${hoje < ini || hoje > somarDias(ini, 6) ? html`<button type="button" class="botao" data-semana-md="${hoje}">Esta semana</button>` : ''}
    <button type="button" class="botao" data-semana-md="${somarDias(ini, 7)}">Próxima semana →</button>
  </div>`;
  // sem horário = faixa "dia todo" no alto de cada dia (como no Google Agenda); com horário = cartão na grade, no horário e pela duração
  const colunas = dias.map((c) => { const todas = entradas.filter((e) => e.dia === c); return { c, l: lados(todas.filter((e) => !e.semHora)), livres: todas.filter((e) => e.semHora), fe: todas.filter((e) => e.p.status === 'feita').length, total: todas.length }; }).filter(({ total }, i) => modoDia || i < 5 || total);
  const feitas = entradas.filter((e) => e.p.status === 'feita').length;
  const altTotal = GRADE.faixas * GRADE.alt;
  const rotuloSlot = (s) => (s % 60 ? `${Math.floor(s / 60)}h30` : `${s / 60}h`);
  const horas = Array.from({ length: GRADE.faixas }, (_, i) => html`<span style="top:${i * GRADE.alt}px">${rotuloSlot(GRADE.ini + i * GRADE.passo)}</span>`);
  const resumoDia = (total, fe, c) => (feriado(c) ? 'feriado' : total ? `${fe} de ${total} feitas` : 'sem tarefas');
  const cabecas = colunas.map(({ c, total, fe }, i) => html`<div class="fq-cab ${c === hoje ? 'hoje' : ''}"><b>${modoDia ? nomeDia(c) : DIA_CURTO[i]} ${c.slice(8, 10)}/${c.slice(5, 7)}</b><small>${resumoDia(total, fe, c)}</small></div>`);
  const cartaoLivre = (e) => { const p = e.p; const feita = p.status === 'feita'; const cls = feita ? 'ok' : p.prazo < hoje ? 'venc' : p.prazo === hoje ? 'hoje' : 'futura'; const [ass, resto] = assuntoDe(p.descricao);
    return html`<div class="ag-lcard ag-t-${cls}" data-tarefa="${p.id}" data-tcard="${p.id}" data-livre="1" title="${ass ? `${ass}: ` : ''}${resto}${p.obra ? ` · ${p.obra}` : ''} — sem horário (dia todo). Arraste para um horário do dia; clique para abrir.">${p.obra ? html`<b>${p.obra}</b> ` : ''}${ass ? `${ass} · ` : ''}${resto}${acoesCartao(p)}</div>`; };
  const livres = colunas.map(({ c, livres: l }) => html`<div class="ag-livres ${c === hoje ? 'hoje' : ''}" data-livres="${c}">${l.map(cartaoLivre)}</div>`);
  const trilhos = colunas.map(({ c, l }) => html`<div class="fq-trilho ${c === hoje ? 'hoje' : ''}" data-trilho="${c}" style="height:${altTotal}px">${l.map((e) => cartaoTarefa(e, hoje, modoDia))}</div>`);
  const colsCss = `52px repeat(${colunas.length}, minmax(0, 1fr))`;   // todos os dias com a mesma largura: o que se achata são os cartões que caem no mesmo horário, não a coluna
  const vistaQuadro = html`<div class="fq-quadro" style="grid-template-columns:${colsCss}"><div class="fq-canto"></div>${cabecas}<div class="ag-livre-rot">dia todo</div>${livres}<div class="fq-horas" style="height:${altTotal}px">${horas}</div>${trilhos}</div>`;
  const caixa = (e) => { const [ass, resto] = assuntoDe(e.p.descricao); const cls = e.p.status === 'feita' ? 'ok' : e.p.prazo < hoje ? 'venc' : e.p.prazo === hoje ? 'hoje' : 'futura';
    return html`<div class="ag-tcaixa ag-t-${cls}" data-tarefa="${e.p.id}"><b>${e.p.obra || ''}</b> ${ass ? `${ass} · ` : ''}${resto}<small>${e.semHora ? 'sem horário (dia todo)' : hhmm(e.ini)}</small>${acoesCartao(e.p)}</div>`; };
  const vistaLista = html`<div class="fl-lista" style="--nd:${colunas.length}">${colunas.map(({ c, l, livres: lv, fe, total }, i) => html`<div class="fl-col ${c === hoje ? 'hoje' : ''}">
      <div class="fq-cab ${c === hoje ? 'hoje' : ''}"><b>${modoDia ? nomeDia(c) : DIA_CURTO[i]} ${c.slice(8, 10)}/${c.slice(5, 7)}</b><small>${resumoDia(total, fe, c)}</small></div>
      ${lv.map(caixa)}${[...l].sort((a, b) => a.faixa - b.faixa).map(caixa)}</div>`)}</div>`;
  return html`${nav}
    <section class="fn-painel ${modoDia ? 'ag-dia' : ''}">
      <header class="fn-cab"><h3>Agenda${modoDia ? ' do dia' : ''}</h3><span class="fn-cab-dir"><span class="pequeno">${entradas.length ? `${feitas} de ${entradas.length} tarefas concluídas ${modoDia ? 'neste dia' : 'nesta semana'}` : `nenhuma tarefa com prazo ${modoDia ? 'neste dia' : 'nesta semana'}`}</span></span></header>
      ${entradas.length ? html`<div class="pct" style="margin:6px 0 12px"><i style="width:${Math.round((feitas / entradas.length) * 100)}%"></i></div>` : ''}
      <div class="fh-larga">${vistaQuadro}</div><div class="fh-estreita">${vistaLista}</div>
      <p class="legenda-semana">Cada cartão é uma tarefa da aba Tarefas, no horário e pelo tempo que você definiu (sem horário fica na faixa "dia todo", no alto do dia, como no Google Agenda: arraste para um horário). Arraste para outro horário ou dia, puxe a borda de baixo para mudar a duração e clique para abrir. O horário também se escolhe dentro da tarefa.</p>
    </section>`;
}
// Preencher é de quem está na obra. Sócio e coordenação consultam em Operação › Metas e produtividade.
const veTodasAsObras = () => false;

export function render({ dia, CFG, aba, semanaRef, soFuncoes = false, semFuncoes = false, pendencias = [], eu = null, modo = 'semana', diaRef = null }) {
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
  else if (semFuncoes) corpo = agendaDeTarefas(ref, { pendencias, eu, modo, diaRef });
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
