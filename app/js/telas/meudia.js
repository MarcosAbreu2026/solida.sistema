// "Minha semana" (antes "Meu dia"): duas abas, as duas no formato de quadro da semana.
//   Semana  — itens da programação × segunda a sexta: programado na semana, meta e executado de cada dia,
//             lançado direto na célula (só funções de obra, sócio e coordenação)
//   Funções — tarefas da função (POP R14) × segunda a sábado, com ✓ feito / ✕ não feito em cada célula

import { html, data as fmtData } from '../formato.js';
import { somarDias, hojeISO, inicioDaSemana } from '../datas.js';
import { TAREFAS, valeNoDia, descreverDias, naGrade, OBSERVACOES, diaSemana } from '../funcoes.js';
import { sessao, funcaoAtual, idPessoa, obrasDaPessoa } from '../sessao.js';
import { lerChecks, primeiroDia } from '../armazenamento.js';
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

// Quadro da semana: uma coluna por dia (seg a sáb); em cada dia, uma caixinha por tarefa com o nome dentro
// e ✓ Feito / ✕ Não na própria caixinha (pedido do Felipe, 16/10). A semana inteira aparece de uma vez.
const horaDe = (t) => { const m = String(t.hora || '').match(/(\d{1,2})h/); return m ? Number(m[1]) : 99; };

function caixaTarefa(t, data, estado, hoje, prova, rotuloDia = '') {
  const btn = (v, txt, pressionado) => html`<button type="button" class="fn-b fn-${v}" data-check="${t.id}|${data}|${v}" aria-pressed="${pressionado ? 'true' : 'false'}" title="${pressionado ? 'Clique para desfazer' : ''}">${txt}</button>`;
  let cls = 'sem'; let acoes;
  if (data > hoje) { cls = 'futuro'; acoes = ''; }
  else if (estado === 'feito') { cls = 'ok'; acoes = btn('feito', '✓ Feito', true); }
  else if (estado === 'nao') { cls = 'nao'; acoes = btn('nao', '✕ Não feito', true); }
  else if (prova) { cls = 'ok'; acoes = html`<span class="fn-auto" title="${descreverProva(prova)}">✓ automático</span>${btn('nao', '✕ Não', false)}`; }
  else acoes = html`${btn('feito', '✓ Feito', false)}${btn('nao', '✕ Não', false)}`;
  const meta = [rotuloDia, t.hora].filter(Boolean).join(' · ');
  const dica = [NOME_AREA[t.area] || t.area, t.processo && t.processo !== '—' ? `POP ${t.processo}` : '', descreverDias(t.dias)].filter(Boolean).join(' · ');
  return html`<div class="fn-caixa fn-${cls}" title="${dica}">
    <div class="fn-nome">${textoTarefa(t)}</div>
    ${meta ? html`<div class="fn-meta">${meta}</div>` : ''}
    ${acoes ? html`<div class="fn-acoes">${acoes}</div>` : ''}
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
  const provaDoDia = (t, d) => (!estadoDe(t, d) && d <= hoje && !feriado(d) && valeNoDia(t, d) ? provaDe(t, d, eu, CFG) : null);
  const feita = (t, d) => estadoDe(t, d) === 'feito' || (!estadoDe(t, d) && !!provaDoDia(t, d));
  const doDia = (d) => (feriado(d) ? [] : tarefas.filter((t) => valeNoDia(t, d)).sort((a, b) => horaDe(a) - horaDe(b)));

  let feitas = 0; let previstas = 0;
  for (const d of dias) { if (d > hoje) continue; for (const t of doDia(d)) { previstas++; if (feita(t, d)) feitas++; } }

  const nav = html`<div class="periodo">
    <button type="button" class="botao" data-semana-md="${somarDias(ini, -7)}">← Semana anterior</button>
    <div class="atual"><span>Semana</span><b>${fmtData(ini).slice(0, 5)} a ${fmtData(somarDias(ini, 5)).slice(0, 5)}</b></div>
    ${hoje < ini || hoje > somarDias(ini, 6) ? html`<button type="button" class="botao" data-semana-md="${hoje}">Esta semana</button>` : ''}
    <button type="button" class="botao" data-semana-md="${somarDias(ini, 7)}">Próxima semana →</button>
  </div>`;

  if (!tarefas.length) return html`${nav}<p class="vazio">Nenhuma tarefa cadastrada para a sua função.</p>`;

  const colunas = dias.map((d, i) => {
    const l = doDia(d); const fe = l.filter((t) => feita(t, d)).length;
    return html`<div class="fn-col ${d === hoje ? 'hoje' : ''} ${d > hoje ? 'futuro' : ''}">
      <header><b>${DIA_CURTO[i]} ${d.slice(8, 10)}/${d.slice(5, 7)}</b><small>${feriado(d) ? 'feriado' : l.length ? (d > hoje ? `${l.length} previstas` : `${fe} de ${l.length}`) : 'sem tarefas'}</small></header>
      ${l.map((t) => caixaTarefa(t, d, estadoDe(t, d), hoje, provaDoDia(t, d)))}
    </div>`;
  });

  // ficaram sem marcar em semanas anteriores (até 4 semanas, desde que a pessoa começou a usar)
  const desde = primeiroDia(idPessoa(), hoje);
  const atrasadas = [];
  for (let d = somarDias(ini, -1); d >= desde && d >= somarDias(ini, -28); d = somarDias(d, -1)) {
    if (d > hoje) continue;
    for (const t of doDia(d)) if (!estadoDe(t, d) && !provaDoDia(t, d)) atrasadas.push({ t, d });
  }
  const nomeDia = (d) => `${DIA_CURTO[(diaSemana(d) + 6) % 7] || ''} ${d.slice(8, 10)}/${d.slice(5, 7)}`;

  return html`${nav}
    <section class="fn-painel">
      <header class="fn-cab"><h3>${f.nome}</h3>
        <span class="pequeno">${previstas ? `${feitas} de ${previstas} feitas até hoje` : 'nenhuma tarefa até hoje'}</span></header>
      ${previstas ? html`<div class="pct" style="margin:6px 0 12px"><i style="width:${Math.round((feitas / previstas) * 100)}%"></i></div>` : ''}
      <div class="fn-semana" style="grid-template-columns:${dias.map((d) => (doDia(d).length ? 'minmax(138px,1fr)' : 'minmax(78px,.4fr)')).join(' ')}">${colunas}</div>
      <p class="legenda-semana"><span class="lg lg-ok"></span> feito <span class="lg lg-abaixo"></span> não feito <span class="lg lg-sem"></span> falta marcar · "automático" = o sistema achou a prova (arquivo no Drive ou produtividade no grupo) · clique numa marcação para desfazer</p>
      ${atrasadas.length ? html`<h4 class="fn-sub">⚠ Ficaram sem marcar em semanas anteriores <span class="pequeno">${atrasadas.length} ${atrasadas.length > 1 ? 'tarefas' : 'tarefa'} — marque aqui ou em "Semana anterior"</span></h4>
        <div class="fn-grade">${atrasadas.map(({ t, d }) => caixaTarefa(t, d, undefined, hoje, null, nomeDia(d)))}</div>` : ''}
    </section>
    ${foraDoQuadro(f.id)}
    <p class="pequeno">Quadro de Tarefas Semanal (SL_TAREFAS_FUNC_R37 + POP R14). As marcações valem pontos no seu <a class="link" href="#/perfil">Perfil</a>: tarefa sem marcação conta como não entregue.</p>`;
}

// Preencher é de quem está na obra. Sócio e coordenação consultam em Operação › Metas e produtividade.
const veTodasAsObras = () => false;

export function render({ dia, CFG, aba, semanaRef }) {
  const s = sessao();
  const f = funcaoAtual();
  const todas = veTodasAsObras(f);
  const todasProgs = CFG ? programacoes(CFG) : [];
  const obras = todas ? todasProgs.map((p) => p.obra) : obrasDaPessoa();
  // a aba Semana (lançar produtividade) é de quem preenche: gestor de obra, estagiário e encarregado
  const abas = ABAS.filter((a) => !a.obra || f.editaProdutividade || todas);
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
