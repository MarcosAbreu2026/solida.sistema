// Pós-obra mais dinâmico (pedido de 21/10): os pós-obras em andamento aparecem como cartões clicáveis (andamento de cada um,
// de forma simples), as pendências são as mesmas de "Atas e pendências" e a agenda da semana funciona como "Minhas funções":
// uma aba lateral com os cartões dos funcionários, que se arrastam para a obra e o dia.
import { html } from '../formato.js';
import { somarDias, inicioDaSemana } from '../datas.js';
import { PRIORIDADE_SITUACAO, SITUACOES_ABERTAS } from '../regras.js';
import { chipSituacao, rotaObra, fmt } from '../componentes.js';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// em andamento = tem serviço aberto (situação de execução, atraso, planejamento, agendamento, orçamento, análise, fixo ou pausado), mais urgente primeiro
export function obrasEmAndamento(base) {
  const ordem = (o) => { const i = PRIORIDADE_SITUACAO.indexOf(o.situacao); return i < 0 ? 99 : i; };
  return base.obras.filter((o) => SITUACOES_ABERTAS.includes(o.situacao)).sort((a, b) => ordem(a) - ordem(b) || a.obra.localeCompare(b.obra, 'pt-BR'));
}

// ---------------------------------------------------------------- Pós-obras (cartões)
export function renderResumo(base, semanaIni, linhasAgenda) {
  const em = obrasEmAndamento(base);
  const encerradas = base.obras.filter((o) => !SITUACOES_ABERTAS.includes(o.situacao));
  const semana = new Set(Array.from({ length: 7 }, (_, i) => somarDias(semanaIni, i)));
  const gente = (o) => new Set([...linhasAgenda.filter((l) => l.obra === o.obra && semana.has(l.data)).map((l) => l.pessoa)]).size;
  const atrasadas = em.filter((o) => o.situacao === 'Atrasado').length;
  const abertas = em.reduce((t, o) => t + (o.abertas || 0), 0);
  const cartao = (o) => html`<a class="pg-obra pg-${String(o.situacao || 'sem').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')}" href="${rotaObra(o.obra)}">
    <div class="pg-topo"><b>${o.obra}</b>${chipSituacao(o.situacao)}</div>
    <div class="pg-sub">${o.cliente || 'Cliente não informado'}${o.tipo ? html` · <span>${o.tipo}</span>` : ''}</div>
    <div class="pg-nums"><span><b>${o.abertas || 0}</b> ${o.abertas === 1 ? 'serviço aberto' : 'serviços abertos'}</span>
      <span>${o.proximoPrazo ? html`próx. prazo <b>${fmt.data(o.proximoPrazo)}</b>` : 'sem prazo marcado'}</span>
      <span>${gente(o) ? html`<b>${gente(o)}</b> ${gente(o) === 1 ? 'pessoa' : 'pessoas'} na agenda da semana` : 'ninguém escalado na semana'}</span></div>
    <div class="pg-ver">Ver o andamento →</div></a>`;
  return html`<section class="pg-resumo">
    <div class="pg-faixa">
      <div><b>${em.length}</b><span>pós-obras em andamento</span></div>
      <div class="${atrasadas ? 'tom-ruim' : ''}"><b>${atrasadas}</b><span>atrasados</span></div>
      <div><b>${abertas}</b><span>serviços abertos</span></div>
    </div>
    <h2 class="pg-tit">Em andamento <span class="pequeno">clique num pós-obra para ver o andamento dele</span></h2>
    ${em.length ? html`<div class="pg-grade">${em.map(cartao)}</div>` : html`<p class="vazio">Nenhum pós-obra em andamento.</p>`}
    ${encerradas.length ? html`<details class="pg-enc"><summary>Concluídos, cancelados e sem serviço aberto (${encerradas.length})</summary><div class="pg-grade">${encerradas.map(cartao)}</div></details>` : ''}
    <p class="pequeno pg-rodape">Tabelas da planilha: <a class="link" href="#/posobra/painel">painel</a> · <a class="link" href="#/posobra/obras">obras</a> · <a class="link" href="#/posobra/servicos">serviços (planilha)</a>. As pendências novas ficam na aba <a class="link" href="#/posobra/pendencias">Pendências</a>, a mesma lista de Atas e pendências.</p>
  </section>`;
}

// ---------------------------------------------------------------- Agenda da semana (cartões de funcionários)
export function renderAgenda({ base, semanaIni, linhasAgenda, podeEditar, selecionado, erro }) {
  const obras = obrasEmAndamento(base);
  const dias = DIAS.map((_, i) => somarDias(semanaIni, i));
  const gente = base.equipe.filter((e) => e.profissional && !/\(/.test(e.profissional)).sort((a, b) => a.profissional.localeCompare(b.profissional, 'pt-BR'));
  const naSemana = (nome) => new Set(linhasAgenda.filter((l) => l.pessoa === nome).map((l) => l.data)).size;
  const planilha = (obra, data) => base.agenda.filter((a) => a.obra === obra && a.data === data).map((a) => a.texto).filter(Boolean);
  const partes = (obra, data) => { const mesmoDia = (l) => l.data === data; return { daqui: linhasAgenda.filter((l) => l.obra === obra && mesmoDia(l)), todas: linhasAgenda.filter(mesmoDia) }; };
  const celula = (o, d) => {
    const { daqui, todas } = partes(o.obra, d); const txt = planilha(o.obra, d);
    return html`<td class="ap-cel" data-ap-obra="${o.obra}" data-ap-data="${d}">
      ${daqui.map((l) => { const n = todas.filter((x) => x.pessoa === l.pessoa).length; return html`<span class="ap-chip ${n > 1 ? 'ap-div' : ''}" ${podeEditar ? html.seguro('draggable="true"') : ''} data-ap-chip="${l.id}" title="${n > 1 ? `${l.pessoa} está em ${n} obras neste dia: a diária é dividida` : l.pessoa}">${l.pessoa}${n > 1 ? html` <small>1/${n}</small>` : ''}${podeEditar ? html`<button type="button" data-ap-del="${l.id}" title="Tirar da agenda">×</button>` : ''}</span>`; })}
      ${txt.map((t) => html`<div class="ap-plan" title="Escrito na planilha do pós-obra">${t}</div>`)}
    </td>`;
  };
  const nav = html`<div class="periodo ap-nav">
    <button type="button" class="botao" data-ap-sem="${somarDias(semanaIni, -7)}">← Semana anterior</button>
    <div class="atual"><span>Semana</span><b>${dm(semanaIni)} a ${dm(somarDias(semanaIni, 5))}</b></div>
    <button type="button" class="botao" data-ap-sem="hoje">Esta semana</button>
    <button type="button" class="botao" data-ap-sem="${somarDias(semanaIni, 7)}">Próxima semana →</button>
  </div>`;
  return html`<section class="ap">
    ${nav}
    ${erro ? html`<p class="erro">${erro}</p>` : ''}
    <p class="pequeno">${podeEditar ? 'Arraste o cartão de um funcionário (à esquerda) para a obra e o dia, ou toque no nome e depois no quadrado. Dá para arrastar o nome de um dia para outro e tirar no ×.' : 'Só o gestor do pós-obra, a coordenação e a diretoria mexem na agenda; você vê quem vai para onde.'} Em cinza, o que está escrito na planilha do pós-obra.</p>
    <div class="ap-corpo">
      ${podeEditar ? html`<aside class="ap-func"><h3>Funcionários</h3>
        ${gente.map((e) => html`<div class="ap-card ${selecionado === e.profissional ? 'sel' : ''}" draggable="true" data-ap-pessoa="${e.profissional}">
          <b>${e.profissional}</b><small>${e.funcao || ''}${e.vinculo ? ` · ${e.vinculo}` : ''}</small><span class="ap-n">${naSemana(e.profissional)} ${naSemana(e.profissional) === 1 ? 'dia' : 'dias'}</span></div>`)}
      </aside>` : ''}
      <div class="ap-grade tabela-rolagem"><table class="ap-tab"><thead><tr><th>Obra</th>${dias.map((d, i) => html`<th>${DIAS[i]} <small>${dm(d)}</small></th>`)}</tr></thead>
        <tbody>${obras.map((o) => html`<tr><th class="ap-obra"><a href="${rotaObra(o.obra)}">${o.obra}</a><small>${o.situacao || ''}</small></th>${dias.map((d) => celula(o, d))}</tr>`)}</tbody></table></div>
    </div>
  </section>`;
}

export const segundaDa = (iso) => inicioDaSemana(iso);
