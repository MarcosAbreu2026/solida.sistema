// "Minha semana" (antes "Meu dia"): duas abas, as duas no formato de quadro da semana.
//   Semana  — itens da programação × segunda a sexta: programado na semana, meta e executado de cada dia,
//             lançado direto na célula (só funções de obra, sócio e coordenação)
//   Funções — tarefas da função (POP R14) × segunda a sábado, com ✓ feito / ✕ não feito em cada célula

import { html, data as fmtData } from '../formato.js';
import { somarDias, hojeISO, inicioDaSemana } from '../datas.js';
import { TAREFAS, valeNoDia, descreverDias, naGrade, OBSERVACOES } from '../funcoes.js';
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

// Uma célula tarefa × dia
function celulaTarefa(t, data, estado, hoje, prova = null) {
  if (feriado(data)) return html`<td class="qs-cel qs-feriado" title="${feriado(data)}">feriado</td>`;
  if (!valeNoDia(t, data)) return html`<td class="qs-cel qs-vazia">—</td>`;
  if (data > hoje) return html`<td class="qs-cel qs-futuro"><span>previsto</span></td>`;
  const marca = (v, txt, cls) => html`<button type="button" class="fn-marca ${cls}" data-check="${t.id}|${data}|${v}" aria-pressed="true" title="Clique para desmarcar">${txt}</button>`;
  if (estado === 'feito') return html`<td class="qs-cel qs-ok ${data === hoje ? 'qs-hoje' : ''}">${marca('feito', '✓ feito', '')}</td>`;
  // sem marcação, mas o sistema achou a prova (arquivo no Drive ou produtividade no grupo): feito automático
  if (!estado && prova) return html`<td class="qs-cel qs-ok qs-auto ${data === hoje ? 'qs-hoje' : ''}" title="${descreverProva(prova)}"><span class="fn-auto">✓ feito <small>automático</small></span>
    <div class="qs-sim-nao"><button type="button" data-check="${t.id}|${data}|nao" aria-pressed="false" title="Não foi feito">✕ Não</button></div></td>`;
  if (estado === 'nao') return html`<td class="qs-cel qs-abaixo ${data === hoje ? 'qs-hoje' : ''}">${marca('nao', '✕ não feito', '')}</td>`;
  return html`<td class="qs-cel qs-sem ${data === hoje ? 'qs-hoje' : ''}">
    <span>falta marcar</span>
    <div class="qs-sim-nao"><button type="button" data-check="${t.id}|${data}|feito" aria-pressed="false">✓ Feito</button><button type="button" data-check="${t.id}|${data}|nao" aria-pressed="false">✕ Não</button></div>
  </td>`;
}

function funcoesSemana(ref, CFG) {
  const f = funcaoAtual();
  const checks = lerChecks(idPessoa());
  const eu = { funcao: f.id, obras: obrasDaPessoa() };
  const hoje = hojeISO();
  const ini = inicioDaSemana(ref);
  const dias = [0, 1, 2, 3, 4, 5].map((i) => somarDias(ini, i));
  const tarefas = TAREFAS.filter((t) => t.funcao === f.id && naGrade(t));

  let feitas = 0;
  let previstas = 0;
  for (const t of tarefas) {
    for (const d of dias) {
      if (!valeNoDia(t, d) || d > hoje || feriado(d)) continue;
      previstas++;
      if ((checks[d] || {})[t.id] === 'feito' || (!(checks[d] || {})[t.id] && provaDe(t, d, eu, CFG))) feitas++;
    }
  }
  // pendências de semanas anteriores (desde que a pessoa começou a usar)
  const desde = primeiroDia(idPessoa(), hoje);
  let antigas = 0;
  for (let d = somarDias(ini, -1); d >= desde && d >= somarDias(ini, -28); d = somarDias(d, -1)) {
    for (const t of tarefas) if (valeNoDia(t, d) && !feriado(d) && (checks[d] || {})[t.id] !== 'feito') antigas++;
  }

  const nav = html`<div class="periodo">
    <button type="button" class="botao" data-semana-md="${somarDias(ini, -7)}">← Semana anterior</button>
    <div class="atual"><span>Semana</span><b>${fmtData(ini).slice(0, 5)} a ${fmtData(somarDias(ini, 5)).slice(0, 5)}</b></div>
    ${hoje < ini || hoje > somarDias(ini, 6) ? html`<button type="button" class="botao" data-semana-md="${hoje}">Esta semana</button>` : ''}
    <button type="button" class="botao" data-semana-md="${somarDias(ini, 7)}">Próxima semana →</button>
  </div>`;

  if (!tarefas.length) return html`${nav}<p class="vazio">Nenhuma tarefa cadastrada para a sua função.</p>`;

  return html`${nav}
    <article class="cartao cartao-largo">
      <header class="cartao-cab"><h3>Suas funções na semana</h3><span class="pequeno">${f.nome} · ${previstas ? `${feitas} de ${previstas} feitas até hoje` : 'nenhuma tarefa até hoje'}</span></header>
      ${previstas ? html`<div class="pct" style="margin:0"><i style="width:${Math.round((feitas / previstas) * 100)}%"></i></div>` : ''}
      ${antigas ? html`<p class="alerta-linha">⚠ ${antigas} ${antigas > 1 ? 'tarefas' : 'tarefa'} sem "feito" nas semanas anteriores — clique em "Semana anterior" para marcar</p>` : ''}
      <div class="tabela-rolagem"><table class="quadro-semana">
        <thead><tr><th>Tarefa</th><th class="qs-total">Quando</th>${dias.map((d, i) => html`<th class="${d === hoje ? 'qs-hoje' : ''}">${DIA_CURTO[i]} ${d.slice(8, 10)}/${d.slice(5, 7)}</th>`)}</tr></thead>
        <tbody>${tarefas.map((t) => html`<tr>
          <td class="qs-item">${textoTarefa(t)}<span class="pequeno">${NOME_AREA[t.area] || t.area}${t.processo && t.processo !== '—' ? ` · POP ${t.processo}` : ''}</span></td>
          <td class="qs-total">${descreverDias(t.dias)}${t.hora ? html`<br><span class="pequeno">${t.hora}</span>` : ''}</td>
          ${dias.map((d) => { const v = (checks[d] || {})[t.id]; return celulaTarefa(t, d, v, hoje, !v && d <= hoje && !feriado(d) && valeNoDia(t, d) ? provaDe(t, d, eu, CFG) : null); })}
        </tr>`)}</tbody></table></div>
      <p class="legenda-semana"><span class="lg lg-ok"></span> feito <span class="lg lg-abaixo"></span> não feito <span class="lg lg-sem"></span> falta marcar · "automático" = o sistema achou a prova (arquivo no Drive ou produtividade no grupo) <span class="lg lg-futuro"></span> ainda não chegou · clique numa marcação para desfazer</p>
    </article>
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
