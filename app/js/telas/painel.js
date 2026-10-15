import { html, numero, descreverPeriodo, diaMes } from '../formato.js';
import { resumoPeriodo } from '../regras.js';
import { card, chipSituacao, linkObra, fmt, secao, aviso, vazio, ehSocio } from '../componentes.js';
import { barrasHorizontais, colunas } from '../graficos.js';

export const titulo = 'Painel';

export function render({ base, p }) {
  const r = resumoPeriodo(base, p);
  const c = r.cards;

  const cards = html`<div class="cards">
    ${card('Obras com atividade no período', numero(c.obrasComAtividade), { link: '#/posobra/obras?atividade=1' })}
    ${card('Serviços abertos', numero(c.servicosAbertos), { link: '#/posobra/servicos?abertos=1' })}
    ${card('Serviços concluídos no período', numero(c.concluidosNoPeriodo), { link: '#/posobra/servicos?concluidos=1' })}
    ${card('Prazos vencidos', numero(c.prazosVencidos), { link: '#/posobra/servicos?prazo=Vencido', tom: c.prazosVencidos ? 'tom-alerta' : '' })}
  </div>
  <div class="cards">
    ${card('Diárias no período', numero(c.diarias), { link: '#/posobra/equipe' })}
    ${card('Custo do período', fmt.reais(c.custo), { sub: html`Mão de obra ${fmt.reais(c.custoMO)} · lançados ${fmt.reais(c.custoLancado)}`, restrito: true })}
    ${card('Receita do período', fmt.reais(c.receita), { link: ehSocio() ? '#/posobra/financeiro' : '', restrito: true })}
    ${card('Margem do período', fmt.margem(c.margem), { tom: c.margem === null ? '' : c.margem >= 0 ? 'tom-bom' : 'tom-ruim', restrito: true })}
  </div>`;

  const sit = barrasHorizontais(r.obrasPorSituacao.map((s) => ({
    rotulo: s.situacao,
    valor: s.obras,
    dica: `${s.situacao}: ${s.obras} ${s.obras === 1 ? 'obra' : 'obras'}`,
    link: `#/posobra/obras?situacao=${encodeURIComponent(s.situacao)}`,
  })));

  const semanas = colunas(r.diariasPorSemana.map((s, i, arr) => ({
    rotulo: diaMes(s.inicio),
    valor: s.diarias,
    destaque: i === arr.length - 1,
    dica: `Semana ${diaMes(s.inicio)} a ${diaMes(s.fim)}: ${numero(s.diarias)} diárias`,
  })));

  const graficos = html`<div class="grade-2">
    ${secao('Obras em aberto por situação', html.seguro(sit))}
    ${secao('Diárias por semana', html`<p class="legenda-curta">8 semanas até a semana de ${diaMes(r.diariasPorSemana.at(-1).inicio)}</p>${html.seguro(semanas)}`)}
  </div>`;

  const tabela = r.resumo.length === 0
    ? vazio('Nenhuma obra com equipe, custo, receita ou serviço concluído neste período.')
    : html`<div class="tabela-rolagem"><table class="tabela">
      <thead><tr>
        <th>Obra</th><th>Situação</th><th>Responsável</th>
        <th class="n">Serv. abertos</th><th class="n">Concluídos</th><th>Próx. prazo</th>
        <th class="n">Diárias</th>
        ${ehSocio() ? html`<th class="n">Custo</th><th class="n">Receita</th><th class="n">Margem</th>` : ''}
      </tr></thead>
      <tbody>${r.resumo.map((l) => html`<tr>
        <td>${linkObra(l.obra.obra)}</td>
        <td>${chipSituacao(l.obra.situacao)}</td>
        <td>${l.obra.responsavel || '—'}</td>
        <td class="n">${l.obra.abertas}</td>
        <td class="n">${l.concluidos}</td>
        <td>${fmt.data(l.obra.proximoPrazo)}</td>
        <td class="n">${fmt.diarias(l.diarias)}</td>
        ${ehSocio() ? html`<td class="n">${fmt.reais(l.custo)}</td>
        <td class="n">${fmt.reais(l.receita)}</td>
        <td class="n">${fmt.margem(l.margem)}</td>` : ''}
      </tr>`)}</tbody>
    </table></div>`;

  return html`
    ${r.avisoSemData ? aviso('Há receitas sem data (Financeiro) ou serviços concluídos sem data de conclusão (Serviços). Eles não entram em nenhum período.') : ''}
    ${cards}
    ${graficos}
    ${secao(`Resumo do período · ${descreverPeriodo(p)}`, tabela, { extra: html`<span class="nota">só obras com equipe, custo, receita ou serviço concluído no período</span>` })}
  `;
}
