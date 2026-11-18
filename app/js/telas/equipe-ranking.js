// Equipe (só o sócio / diretoria vê): ranking por TAREFAS resolvidas.
// Pedido do Felipe (18/11/2026): antes o ranking vinha das marcações ✓ de "Minhas funções"; agora vem das TAREFAS (pendências) concluídas.
// Quem resolve mais tarefas DIFERENTES vai ganhando pontos: cada tarefa concluída pelo responsável no período vale 10 pontos; uma tarefa
// recorrente (que se repete toda semana/mês) conta UMA vez no período, não uma por repetição.

import { html, data as fmtData } from '../formato.js';
import { hojeISO, somarDias, inicioDaSemana } from '../datas.js';
import { avatar } from './perfil.js';
import { funcaoPorId } from '../funcoes.js';
import { tarefasConcluidas, pessoasSelecionaveis } from './atas.js';

const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const pad = (n) => String(n).padStart(2, '0');
const PONTOS_POR_TAREFA = 10;

// tarefas concluídas no período, por pessoa (responsável). Retorna a lista já ordenada: mais tarefas primeiro, depois no prazo, depois nome
export function rankingTarefas(de, ate) {
  const pessoas = new Map(pessoasSelecionaveis().map((p) => [String(p.id), p]));
  const porPessoa = new Map();
  for (const t of tarefasConcluidas()) {
    const dia = String(t.concluida_em || '').slice(0, 10);
    if (!dia || dia < de || dia > ate) continue;
    const id = String(t.responsavel);
    if (!porPessoa.has(id)) porPessoa.set(id, { id, nome: (pessoas.get(id) || {}).nome || t.responsavel_nome || 'Sem nome', funcao: (pessoas.get(id) || {}).funcao || '', tarefas: new Map() });
    const chave = t.serie ? `s:${t.serie}` : `p:${t.id}`;   // tarefa repetida (série) conta uma vez
    const g = porPessoa.get(id);
    const noPrazo = !!t.prazo && dia <= String(t.prazo).slice(0, 10);
    if (!g.tarefas.has(chave)) g.tarefas.set(chave, { noPrazo });
    else if (noPrazo) g.tarefas.get(chave).noPrazo = true;
  }
  return [...porPessoa.values()].map((g) => { const n = g.tarefas.size; return { id: g.id, nome: g.nome, funcao: g.funcao, tarefas: n, noPrazo: [...g.tarefas.values()].filter((x) => x.noPrazo).length, pontos: n * PONTOS_POR_TAREFA }; })
    .sort((a, b) => b.tarefas - a.tarefas || b.noPrazo - a.noPrazo || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function render({ params, extra = '' } = {}) {
  const hoje = hojeISO();
  const gp = (k) => String((params && typeof params.get === 'function' ? params.get(k) : params && params[k]) || '');
  // por padrão: as últimas 4 semanas; ?mes=AAAA-MM mostra um mês fechado
  const rolante = !/^\d{4}-\d{2}$/.test(gp('mes'));
  const mes = rolante ? hoje.slice(0, 7) : gp('mes');
  const [a, m] = mes.split('-').map(Number);
  const fimMes = `${mes}-${pad(new Date(a, m, 0).getDate())}`;
  const parcial = fimMes >= hoje;
  const ate = rolante || parcial ? hoje : fimMes;
  const de = rolante ? somarDias(inicioDaSemana(hoje), -21) : `${mes}-01`;
  const rotuloPeriodo = rolante ? 'últimas 4 semanas' : `${NOME_MES[m - 1]} de ${a}`;
  const mesAnt = m === 1 ? `${a - 1}-12` : `${a}-${pad(m - 1)}`; const mesProx = m === 12 ? `${a + 1}-01` : `${a}-${pad(m + 1)}`;

  const rk = rankingTarefas(de, ate);
  const topo = rk.length ? rk[0].tarefas : 0;
  const vencedor = rk[0] || null;

  return html`<div class="pagina equipe">
    <div class="periodo eq-nav">
      <a class="botao ${rolante ? 'on' : ''}" href="#/equipe">Últimas 4 semanas</a>
      <a class="botao" href="#/equipe?mes=${mesAnt}">← ${NOME_MES[(m + 10) % 12]}</a>
      <div class="atual"><span>${rolante ? 'Período' : 'Mês'}</span><b>${rolante ? `${fmtData(de).slice(0, 5)} a ${fmtData(hoje).slice(0, 5)}` : `${NOME_MES[m - 1]} de ${a}`}</b></div>
      ${rolante ? html`<a class="botao" href="#/equipe?mes=${mes}">${NOME_MES[m - 1]} (mês) →</a>` : (mes < hoje.slice(0, 7) ? html`<a class="botao" href="#/equipe?mes=${mesProx}">${NOME_MES[m % 12]} →</a>` : '')}
      <span class="pequeno eq-parcial">${rolante ? 'Tarefas concluídas nas últimas 4 semanas (começa na segunda-feira de 3 semanas atrás)' : parcial ? `Parcial: de 01/${pad(m)} até hoje (${fmtData(hoje).slice(0, 5)})` : `Mês fechado: de 01/${pad(m)} a ${pad(new Date(a, m, 0).getDate())}/${pad(m)}`}</span>
    </div>

    <section class="eq-heroi ${vencedor ? '' : 'eq-heroi-vazio'}">
      <div class="eq-heroi-tit"><span class="eq-trofeu" aria-hidden="true">🏆</span><div><small>${rolante ? 'Destaque do período' : `Destaque do mês${parcial ? ' (até agora)' : ''}`}</small><h2>${rotuloPeriodo}</h2></div></div>
      ${vencedor ? html`<div class="eq-vencedor">${avatar(vencedor.nome, 72)}<div><b>${vencedor.nome}</b><span>${vencedor.funcao ? funcaoPorId(vencedor.funcao).nome : ''}</span>
          <p><strong>${vencedor.tarefas}</strong> ${vencedor.tarefas === 1 ? 'tarefa resolvida' : 'tarefas resolvidas'} · ${vencedor.noPrazo} no prazo · ${vencedor.pontos} pontos</p></div></div>`
        : html`<p class="eq-vazio">Ainda não há tarefas concluídas neste período. Os pontos aparecem quando as pessoas concluírem tarefas.</p>`}
    </section>

    <section class="secao"><h2>Ranking da equipe <span class="pequeno">${rotuloPeriodo} · tarefas resolvidas</span></h2>
      ${rk.length ? html`<div class="pf-rank">${rk.map((p, i) => html`<div class="pf-rk" title="${p.nome}">
        <span class="pf-rk-n">${i + 1}º</span>${avatar(p.nome, 34)}<span class="pf-rk-nome"><b>${p.nome}</b><small>${p.funcao ? funcaoPorId(p.funcao).nome : ''}</small></span>
        <span class="pf-b bom"><i style="width:${topo ? Math.round((p.tarefas / topo) * 100) : 0}%"></i></span><b class="pf-rk-t">${p.tarefas}</b>
        <span class="pequeno eq-hs">${p.noPrazo} no prazo</span><span class="pequeno">${p.pontos} pts</span></div>`)}</div>`
        : html`<p class="vazio">Ninguém concluiu tarefas neste período ainda.</p>`}
    </section>

    <details class="caixa eq-como"><summary><span class="caixa-tit">Como a pontuação é calculada</span><span class="pequeno">clique para ver</span></summary><div class="caixa-corpo"><ul>
      <li><b>Cada tarefa diferente que a pessoa conclui vale ${PONTOS_POR_TAREFA} pontos.</b> Vale a tarefa de que ela é a responsável e que foi marcada como concluída dentro do período.</li>
      <li><b>Tarefa que se repete</b> (toda semana ou todo mês) conta uma vez só no período, para ninguém ganhar muitos pontos repetindo a mesma tarefa.</li>
      <li><b>No prazo:</b> a tarefa concluída até a data limite. Serve de desempate e aparece ao lado de cada nome.</li>
      <li>Valem as tarefas de pessoas e as pendências por obra. Tarefa cancelada ou sem responsável não conta.</li>
    </ul></div></details>
    ${extra}
  </div>`;
}
