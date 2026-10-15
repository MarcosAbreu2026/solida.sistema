// Quadro de funções: grade da semana por função (mesmo formato do quadro de cronograma por obra).
// ✓ feito · ✕ não feito · – sem check · célula vazia = tarefa não vale naquele dia.

import { html, diaMes } from '../formato.js';
import { somarDias, inicioDaSemana, hojeISO } from '../datas.js';
import { FUNCOES, TAREFAS, valeNoDia, descreverDias, naGrade } from '../funcoes.js';
import { lerTodosChecks } from '../armazenamento.js';
import { textoTarefa, foraDoQuadro } from './meudia.js';

const MK = {
  feito: html.seguro('<span class="mk y" aria-label="Feito">✓</span>'),
  nao: html.seguro('<span class="mk n" aria-label="Não feito">✕</span>'),
  sem: html.seguro('<span class="mk q" aria-label="Sem check">–</span>'),
};

export function render({ funcaoId, ref }) {
  const funcao = FUNCOES.find((f) => f.id === funcaoId) || FUNCOES[1];
  const inicio = inicioDaSemana(ref);
  const dias = [0, 1, 2, 3, 4, 5].map((i) => somarDias(inicio, i));
  const hoje = hojeISO();
  const tarefas = TAREFAS.filter((t) => t.funcao === funcao.id && naGrade(t));

  // junta os checks de todas as pessoas desta função
  const todos = lerTodosChecks();
  const estado = (tarefa, dia) => {
    let r = null;
    for (const [pessoa, porDia] of Object.entries(todos)) {
      if (!pessoa.startsWith(`${funcao.id}:`)) continue;
      const e = (porDia[dia] || {})[tarefa];
      if (e === 'feito') return 'feito';
      if (e === 'nao') r = 'nao';
    }
    return r;
  };

  let feitas = 0;
  let previstas = 0;
  const linhas = tarefas.map((t) => html`<tr>
    <td>${textoTarefa(t)}<div class="pequeno">${t.processo && t.processo !== '—' ? `POP ${t.processo} · ` : ''}${descreverDias(t.dias)}${t.hora ? ` · ${t.hora}` : ''}</div></td>
    ${dias.map((d) => {
      if (!valeNoDia(t, d)) return html`<td class="dia"></td>`;
      const e = estado(t.id, d);
      if (d <= hoje) { previstas++; if (e === 'feito') feitas++; }
      return html`<td class="dia ${d === hoje ? 'hoje' : ''}">${d > hoje && !e ? html`<span class="pequeno">previsto</span>` : MK[e || 'sem']}</td>`;
    })}
  </tr>`);

  return html`<div class="pagina">
    <div class="periodo">
      <label>Função<select id="quadro-funcao">${FUNCOES.map((f) => html`<option value="${f.id}" ${f.id === funcao.id ? html.seguro('selected') : ''}>${f.nome}</option>`)}</select></label>
      <button type="button" class="botao" data-semana="${somarDias(inicio, -7)}">← Semana anterior</button>
      <button type="button" class="botao" data-semana="${somarDias(inicio, 7)}">Próxima semana →</button>
      <div class="atual"><span>Semana</span><b>${diaMes(dias[0])} a ${diaMes(dias[5])}</b></div>
    </div>
    <p class="resumo" style="margin:0">${funcao.nome}${funcao.pop ? html` <span class="pequeno">(no POP: ${funcao.pop})</span>` : ''} · ${previstas ? `${feitas} de ${previstas} tarefas feitas até hoje` : 'nenhuma tarefa até hoje'}</p>
    ${tarefas.length ? html`<div class="tabela-rolagem"><table class="tab quadro">
      <thead><tr><th>Tarefa</th>${dias.map((d) => html`<th class="dia ${d === hoje ? 'hoje' : ''}">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dias.indexOf(d)]} ${diaMes(d)}</th>`)}</tr></thead>
      <tbody>${linhas}</tbody></table></div>` : html`<p class="vazio">Nenhuma tarefa cadastrada para esta função.</p>`}
    ${foraDoQuadro(funcao.id)}
    <p class="pequeno">✓ feito · ✕ não feito · – sem check. Junta os checks de todas as pessoas da função.</p>
  </div>`;
}
