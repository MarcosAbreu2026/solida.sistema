import { html, descreverPeriodo } from '../formato.js';
import { noPeriodo, ehData } from '../datas.js';
import { financeiroNoPeriodo, soma } from '../regras.js';
import { card, secao, vazio, aviso, fmt } from '../componentes.js';
import { tabelaLancamentos } from './obras.js';

export const titulo = 'Financeiro';

export function render({ base, p, params }) {
  const f = financeiroNoPeriodo(base, p);
  const periodo = descreverPeriodo(p);
  const ver = params.get('ver') || 'periodo';
  const tipo = params.get('tipo') || '';
  const busca = (params.get('busca') || '').toLocaleLowerCase('pt-BR');
  const tipos = base.listas['Tipo de lançamento'] || [];

  const filtroVer = {
    periodo: (x) => noPeriodo(x.data, p),
    receber: (x) => x.receita && !x.quitado,
    pagar: (x) => !x.receita && !x.quitado,
    semdata: (x) => !ehData(x.data),
    todos: () => true,
  }[ver] || (() => true);

  const lista = base.financeiro.filter((x) =>
    filtroVer(x) &&
    (!tipo || x.tipo === tipo) &&
    (!busca || [x.obra, x.descricao, x.contraparte].some((c) => c && c.toLocaleLowerCase('pt-BR').includes(busca))))
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));

  const opcao = (v, rot) => html`<option value="${v}" ${v === ver ? html.seguro('selected') : ''}>${rot}</option>`;

  const cards = html`<div class="cards">
    ${card(`Receita · ${periodo}`, fmt.reais(f.receitaPeriodo), { sub: `Recebido ${fmt.reais(f.recebidoPeriodo)}`, link: '#/posobra/financeiro?ver=periodo' })}
    ${card(`Custos lançados · ${periodo}`, fmt.reais(f.custoLancadoPeriodo), { sub: `Pago ${fmt.reais(f.pagoPeriodo)} · sem mão de obra própria` })}
    ${card('A receber (em aberto)', fmt.reais(f.aReceber), { link: '#/posobra/financeiro?ver=receber' })}
    ${card('A pagar (em aberto)', fmt.reais(f.aPagar), { link: '#/posobra/financeiro?ver=pagar' })}
  </div>`;

  const filtros = html`<form class="filtros" data-filtros>
    <label>Mostrar <select name="ver">
      ${opcao('periodo', `Lançamentos de ${periodo}`)}${opcao('receber', 'A receber')}${opcao('pagar', 'A pagar')}
      ${opcao('semdata', 'Sem data')}${opcao('todos', 'Todos')}
    </select></label>
    <label>Tipo <select name="tipo"><option value="">Todos</option>
      ${tipos.map((t) => html`<option ${t === tipo ? html.seguro('selected') : ''}>${t}</option>`)}</select></label>
    <label>Buscar <input type="search" name="busca" value="${params.get('busca') || ''}" placeholder="obra, descrição, cliente…"></label>
  </form>`;

  const total = soma(lista.filter((x) => x.receita), 'valor');
  const totalCusto = soma(lista.filter((x) => !x.receita), 'valor');

  return html`
    ${f.semData.length ? aviso(`${f.semData.length} lançamentos estão sem data (${fmt.reais(soma(f.semData, 'valor'))}) e não entram em nenhum período.`) : ''}
    ${cards}
    ${filtros}
    ${secao(`${lista.length} lançamentos`, lista.length ? tabelaLancamentos(lista, { comObra: true }) : vazio('Nenhum lançamento com esses filtros.'),
      { extra: html`<span class="nota">Receitas ${fmt.reais(total)} · custos ${fmt.reais(totalCusto)}</span>` })}
  `;
}
