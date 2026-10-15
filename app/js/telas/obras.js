import { html, numero, descreverPeriodo } from '../formato.js';
import { resumoPeriodo, soma, PRIORIDADE_SITUACAO } from '../regras.js';
import { chipSituacao, chipPrazo, linkObra, fmt, secao, vazio, card, ehSocio, CHEV_VOLTAR } from '../componentes.js';

export const titulo = 'Obras';

export function render({ base, p, params }) {
  const busca = (params.get('busca') || '').toLocaleLowerCase('pt-BR');
  const situacao = params.get('situacao') || '';
  const soAtividade = params.get('atividade') === '1';
  const ativas = new Set(resumoPeriodo(base, p).resumo.map((r) => r.obra.obra));

  const lista = base.obras.filter((o) =>
    (!situacao || o.situacao === situacao) &&
    (!soAtividade || ativas.has(o.obra)) &&
    (!busca || [o.obra, o.cliente, o.endereco, o.responsavel].some((c) => c && c.toLocaleLowerCase('pt-BR').includes(busca))));

  const situacoes = [...PRIORIDADE_SITUACAO, 'Sem OS', 'Sem situação'];
  const filtros = html`<form class="filtros" data-filtros>
    <label>Buscar <input type="search" name="busca" value="${params.get('busca') || ''}" placeholder="obra, cliente, endereço…"></label>
    <label>Situação <select name="situacao">
      <option value="">Todas</option>
      ${situacoes.map((s) => html`<option ${s === situacao ? html.seguro('selected') : ''}>${s}</option>`)}
    </select></label>
    <label class="check"><input type="checkbox" name="atividade" value="1" ${soAtividade ? html.seguro('checked') : ''}> Só com atividade em ${descreverPeriodo(p)}</label>
  </form>`;

  const tabela = lista.length === 0 ? vazio('Nenhuma obra com esses filtros.') : html`<div class="tabela-rolagem"><table class="tabela">
    <thead><tr><th>Obra</th><th>Cliente</th><th>Tipo</th><th>Situação</th><th>Responsável</th>
      <th class="n">OS abertas</th><th>Próx. prazo</th></tr></thead>
    <tbody>${lista.map((o) => html`<tr>
      <td>${linkObra(o.obra)}</td>
      <td>${o.cliente || '—'}</td>
      <td>${o.tipo || '—'}</td>
      <td>${chipSituacao(o.situacao)}</td>
      <td>${o.responsavel || '—'}</td>
      <td class="n">${o.abertas}</td>
      <td>${fmt.data(o.proximoPrazo)}</td>
    </tr>`)}</tbody>
  </table></div>`;

  return html`${filtros}${secao(`${lista.length} de ${base.obras.length} obras`, tabela)}`;
}

export function renderDetalhe({ base, p, nome }) {
  const o = base.obraPorNome.get(nome);
  if (!o) return vazio(`Obra "${nome}" não encontrada.`);

  const resumo = resumoPeriodo(base, p).resumo.find((r) => r.obra.obra === nome);
  const agenda = base.agenda.filter((a) => a.obra === nome).sort((a, b) => b.data.localeCompare(a.data));
  const fin = base.financeiro.filter((f) => f.obra === nome)
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  const receitaTotal = soma(fin.filter((f) => f.receita), 'valor');
  const custoLancadoTotal = soma(fin.filter((f) => !f.receita), 'valor');
  const custoMOTotal = soma(agenda, 'custo');

  const topo = html`<div class="obra-topo">
    <div>
      <a class="voltar" href="#/posobra/obras">${CHEV_VOLTAR}Obras</a>
      <h2 class="titulo-obra">${o.obra}</h2>
      <p class="obra-info">${[o.cliente, o.endereco, o.tipo].filter(Boolean).join(' · ') || 'Sem cliente/endereço cadastrado'}</p>
    </div>
    <div class="obra-meta">${chipSituacao(o.situacao)}<span>Responsável: <b>${o.responsavel || '—'}</b></span></div>
  </div>`;

  const cards = html`<div class="cards">
    ${card(`Diárias em ${descreverPeriodo(p)}`, fmt.diarias(resumo?.diarias || 0), { sub: `Total: ${numero(soma(agenda, 'diarias'))}` })}
    ${card('Custo total', fmt.reais(custoMOTotal + custoLancadoTotal), { sub: html`MO ${fmt.reais(custoMOTotal)} · lançados ${fmt.reais(custoLancadoTotal)}`, restrito: true })}
    ${card('Receita total', fmt.reais(receitaTotal), { sub: html`A receber ${fmt.reais(soma(fin.filter((f) => f.receita && !f.quitado), 'valor'))}`, restrito: true })}
    ${card('OS abertas', numero(o.abertas), { sub: o.proximoPrazo ? `Próximo prazo ${fmt.data(o.proximoPrazo)}` : 'Sem prazo definido' })}
  </div>`;

  const os = o.servicos.length === 0 ? vazio('Nenhuma OS cadastrada.') : html`<div class="lista-os">${o.servicos.map((s) => html`
    <article class="os ${s.aberta ? '' : 'encerrada'}">
      <header><b>${s.os || '—'}</b>${chipSituacao(s.situacao)}${chipPrazo(s.statusPrazo)}
        ${s.diasAtraso ? html`<span class="atraso">${s.diasAtraso} dias em atraso</span>` : ''}</header>
      <dl>
        <div><dt>Início</dt><dd>${fmt.data(s.data_inicio)}</dd></div>
        <div><dt>Prazo</dt><dd>${fmt.data(s.prazo)}</dd></div>
        <div><dt>Concluído em</dt><dd>${fmt.data(s.concluido_em)}</dd></div>
        <div><dt>Profissionais</dt><dd>${s.profissionais || '—'}</dd></div>
      </dl>
      ${s.relato ? html`<p><span class="rot">Relato</span>${s.relato}</p>` : ''}
      ${s.obs ? html`<p><span class="rot">Obs.</span>${s.obs}</p>` : ''}
    </article>`)}</div>`;

  const tabAgenda = agenda.length === 0 ? vazio('Sem registros na agenda.') : html`<div class="tabela-rolagem altura-limitada"><table class="tabela">
    <thead><tr><th>Data</th><th>Agenda</th><th>Reconhecidos</th><th class="n">Diárias</th>${ehSocio() ? html`<th class="n">Custo MO</th>` : ''}</tr></thead>
    <tbody>${agenda.map((a) => html`<tr>
      <td>${fmt.data(a.data)}</td><td>${a.texto}</td>
      <td>${pessoasDaEntrada(a)}</td>
      <td class="n">${fmt.diarias(a.diarias)}</td>${ehSocio() ? html`<td class="n">${fmt.reais(a.custo)}</td>` : ''}
    </tr>`)}</tbody></table></div>`;

  const tabFin = fin.length === 0 ? vazio('Sem lançamentos.') : tabelaLancamentos(fin);

  return html`${topo}${cards}
    ${secao('Serviços (OS)', os)}
    ${secao('Agenda', tabAgenda)}
    ${ehSocio() ? secao('Financeiro', tabFin) : ''}`;
}

export function pessoasDaEntrada(a) {
  return html`<span class="pessoas">
    ${a.pessoas.map((x) => html`<span class="pessoa ${x.ambiguo ? 'ambigua' : ''}" title="${x.ambiguo ? 'Reconhecido dentro de outra palavra — confira' : `${numero(x.fracao)} diária`}">${x.pessoa.nome}${x.ambiguo ? ' ?' : ''}</span>`)}
    ${a.ausentes.map((n) => html`<span class="pessoa ausente" title="Falta ou atestado — não conta diária">${n}</span>`)}
  </span>`;
}

export function tabelaLancamentos(fin, { comObra = false } = {}) {
  return html`<div class="tabela-rolagem altura-limitada"><table class="tabela">
    <thead><tr><th>Data</th>${comObra ? html`<th>Obra</th>` : ''}<th>Tipo</th><th>Descrição</th><th>Fornecedor / cliente</th>
      <th class="n">Valor</th><th>Pago / recebido</th></tr></thead>
    <tbody>${fin.map((f) => html`<tr>
      <td>${f.data ? fmt.data(f.data) : html`<span class="sem-data">sem data</span>`}</td>
      ${comObra ? html`<td>${linkObra(f.obra)}</td>` : ''}
      <td>${f.receita ? html`<span class="tag-receita">Receita</span>` : f.tipo || '—'}</td>
      <td>${f.descricao || '—'}</td><td>${f.contraparte || '—'}</td>
      <td class="n ${f.receita ? 'pos' : ''}">${fmt.reais(f.valor)}</td>
      <td>${f.quitado ? 'Sim' : html`<span class="pendente">Não</span>`}</td>
    </tr>`)}</tbody></table></div>`;
}
