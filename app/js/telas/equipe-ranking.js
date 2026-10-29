// Equipe (só o sócio / diretoria vê): ranking, funcionário do mês e recompensas.
// A pontuação vem das marcações ✓ feito / ✕ não feito que cada pessoa faz em Minhas funções. Cada tarefa pesa o TEMPO PADRÃO previsto
// no quadro (igual para todo mundo), então quem faz muitas tarefas rápidas não ganha mais que quem faz poucas longas: o que conta é
// quanto do trabalho previsto foi entregue. Ver perfil.js › pontuar.

import { html, data as fmtData } from '../formato.js';
import { hojeISO } from '../datas.js';
import { rankingPeriodo, avatar } from './perfil.js';
import { funcaoPorId, RECOMPENSAS, MIN_TAREFAS_FUNCIONARIO_DO_MES } from '../funcoes.js';

const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const pad = (n) => String(n).padStart(2, '0');
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const horas = (h) => `${(Math.round(h * 10) / 10).toString().replace('.', ',')} h`;
const nivel = (v) => (v == null ? '' : v >= 0.9 ? 'bom' : v >= 0.6 ? 'medio' : 'baixo');

export function render({ params, extra = '' } = {}) {
  const hoje = hojeISO();
  const gp = (k) => String((params && typeof params.get === 'function' ? params.get(k) : params && params[k]) || '');
  const mes = /^\d{4}-\d{2}$/.test(gp('mes')) ? gp('mes') : hoje.slice(0, 7);
  const [a, m] = mes.split('-').map(Number);
  const fimMes = `${mes}-${pad(new Date(a, m, 0).getDate())}`;
  const parcial = fimMes >= hoje;
  const ate = parcial ? hoje : fimMes;
  const mesAnt = m === 1 ? `${a - 1}-12` : `${a}-${pad(m - 1)}`; const mesProx = m === 12 ? `${a + 1}-01` : `${a}-${pad(m + 1)}`;

  const rk = rankingPeriodo(`${mes}-01`, ate, null);
  const elegiveis = rk.filter((p) => p.esperadas >= MIN_TAREFAS_FUNCIONARIO_DO_MES);
  const vencedor = elegiveis[0] || null;
  const alcancou = (min) => elegiveis.filter((p) => p.taxa != null && p.taxa >= min);
  const faixasDe = (p) => RECOMPENSAS.filter((r) => p.esperadas >= MIN_TAREFAS_FUNCIONARIO_DO_MES && p.taxa != null && p.taxa >= r.min);

  return html`<div class="pagina equipe">
    <div class="periodo eq-nav">
      <a class="botao" href="#/equipe?mes=${mesAnt}">← ${NOME_MES[(m + 10) % 12]}</a>
      <div class="atual"><span>Mês</span><b>${NOME_MES[m - 1]} de ${a}</b></div>
      ${mes < hoje.slice(0, 7) ? html`<a class="botao" href="#/equipe?mes=${mesProx}">${NOME_MES[m % 12]} →</a>` : ''}
      <span class="pequeno eq-parcial">${parcial ? `Parcial: de 01/${pad(m)} até hoje (${fmtData(hoje).slice(0, 5)})` : `Mês fechado: de 01/${pad(m)} a ${fmtData(fimMes).slice(0, 5)}`}</span>
    </div>

    <section class="eq-heroi ${vencedor ? '' : 'eq-heroi-vazio'}">
      <div class="eq-heroi-tit"><span class="eq-trofeu" aria-hidden="true">🏆</span><div><small>Funcionário do mês${parcial ? ' (até agora)' : ''}</small><h2>${NOME_MES[m - 1]} de ${a}</h2></div></div>
      ${vencedor ? html`<div class="eq-vencedor">${avatar(vencedor.nome, 72)}<div><b>${vencedor.nome}</b><span>${funcaoPorId(vencedor.funcao).nome}</span>
          <p><strong>${pct(vencedor.taxa)}</strong> do trabalho previsto entregue · ${horas(vencedor.horasFeitas)} de ${horas(vencedor.horasEsperadas)} · ${vencedor.pontos} pontos</p></div></div>`
        : html`<p class="eq-vazio">Ainda não há dados suficientes. Para concorrer, a pessoa precisa de pelo menos ${MIN_TAREFAS_FUNCIONARIO_DO_MES} tarefas previstas no mês, marcadas em Minhas funções.</p>`}
    </section>

    <section class="secao"><h2>Ranking da equipe <span class="pequeno">${NOME_MES[m - 1]} · % do trabalho previsto entregue</span></h2>
      ${rk.length ? html`<div class="pf-rank">${rk.map((p, i) => { const f = faixasDe(p); return html`<a class="pf-rk" href="#/perfil?p=${encodeURIComponent(p.chave)}" title="Ver o perfil de ${p.nome}">
        <span class="pf-rk-n">${i + 1}º</span>${avatar(p.nome, 34)}<span class="pf-rk-nome"><b>${p.nome}</b><small>${funcaoPorId(p.funcao).nome}</small></span>
        <span class="pf-b ${nivel(p.taxa)}"><i style="width:${Math.round((p.taxa || 0) * 100)}%"></i></span><b class="pf-rk-t">${pct(p.taxa)}</b>
        <span class="pequeno eq-hs">${horas(p.horasFeitas)} entregues</span><span class="pequeno">${p.pontos} pts</span>
        <span class="eq-faixas">${f.map((r) => html`<span class="eq-faixa" title="${r.nome}: a partir de ${Math.round(r.min * 100)}%">${r.nome}</span>`)}</span></a>`; })}</div>`
        : html`<p class="vazio">Ninguém marcou tarefas neste mês ainda. A pontuação aparece assim que as pessoas começarem a marcar em Minhas funções.</p>`}
    </section>

    <section class="secao"><h2>Recompensas <span class="pequeno">padrão provisório · prêmios a definir com o Marcos</span></h2>
      <div class="eq-recs">${RECOMPENSAS.map((r) => { const q = alcancou(r.min); return html`<div class="eq-rec"><div class="eq-rec-cab"><b>${r.nome}</b><span class="eq-rec-min">${Math.round(r.min * 100)}%</span></div>
        <p class="pequeno">A partir de ${Math.round(r.min * 100)}% do trabalho previsto entregue no mês.</p><p><b>Prêmio:</b> ${r.premio}</p>
        <p class="eq-rec-quem"><b>${q.length}</b> ${q.length === 1 ? 'pessoa alcançou' : 'pessoas alcançaram'} neste mês${q.length ? ': ' : ''}${q.map((p) => p.nome).join(', ')}</p></div>`; })}</div>
    </section>

    <details class="caixa eq-como"><summary><span class="caixa-tit">Como a pontuação é calculada</span><span class="pequeno">clique para ver</span></summary><div class="caixa-corpo"><ul>
      <li><b>Cada tarefa pesa o seu tempo padrão</b>, o previsto no quadro (uma tarefa de 1 hora pesa 60 minutos; uma de 3 horas, 180). É igual para todas as pessoas que têm a tarefa.</li>
      <li><b>A porcentagem</b> é o tempo das tarefas feitas dividido pelo tempo das tarefas previstas no período. Quem faz 50 tarefas rápidas e quem faz poucas tarefas longas são comparados pelo <b>trabalho entregue</b>, não pela quantidade de tarefas.</li>
      <li><b>Mudar a duração do cartão</b> em Minhas funções não muda o peso, para ninguém "inflar" a própria pontuação.</li>
      <li><b>Tarefa sem marcação</b> conta como não entregue. Feriados e fins de semana não entram. Só valem as marcações que a própria pessoa fez.</li>
      <li><b>Pontos:</b> 10 por hora de trabalho previsto entregue.</li>
      <li><b>Velocidade real:</b> o sistema hoje só sabe se a tarefa foi feita ou não, não quanto tempo cada um levou. Para comparar quem faz mais rápido ou mais devagar seria preciso registrar início e fim de algumas tarefas-chave.</li>
    </ul></div></details>
    ${extra}
  </div>`;
}
