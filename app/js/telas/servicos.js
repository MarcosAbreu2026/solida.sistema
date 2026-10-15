import { html, descreverPeriodo } from '../formato.js';
import { noPeriodo } from '../datas.js';
import { PRIORIDADE_SITUACAO } from '../regras.js';
import { chipSituacao, chipPrazo, linkObra, fmt, secao, vazio } from '../componentes.js';

export const titulo = 'Serviços';

const STATUS = ['Vencido', 'Vence em 7 dias', 'No prazo', 'Sem prazo', 'Encerrado'];

export function render({ base, p, params }) {
  const situacao = params.get('situacao') || '';
  const prazo = params.get('prazo') || '';
  const abertos = params.get('abertos') === '1';
  const concluidos = params.get('concluidos') === '1';
  const busca = (params.get('busca') || '').toLocaleLowerCase('pt-BR');

  const lista = base.servicos.filter((s) =>
    (!situacao || s.situacao === situacao) &&
    (!prazo || s.statusPrazo === prazo) &&
    (!abertos || (s.aberta && base.obraPorNome.has(s.obra))) &&
    (!concluidos || (s.situacao === 'Concluído' && noPeriodo(s.concluido_em, p))) &&
    (!busca || [s.os, s.obra, s.relato, s.obs, s.profissionais].some((c) => c && c.toLocaleLowerCase('pt-BR').includes(busca))))
    .sort((a, b) => (b.diasAtraso ?? -1) - (a.diasAtraso ?? -1));

  const filtros = html`<form class="filtros" data-filtros>
    <label>Buscar <input type="search" name="busca" value="${params.get('busca') || ''}" placeholder="OS, obra, relato…"></label>
    <label>Situação <select name="situacao"><option value="">Todas</option>
      ${PRIORIDADE_SITUACAO.map((s) => html`<option ${s === situacao ? html.seguro('selected') : ''}>${s}</option>`)}</select></label>
    <label>Prazo <select name="prazo"><option value="">Todos</option>
      ${STATUS.map((s) => html`<option ${s === prazo ? html.seguro('selected') : ''}>${s}</option>`)}</select></label>
    <label class="check"><input type="checkbox" name="abertos" value="1" ${abertos ? html.seguro('checked') : ''}> Só abertos</label>
    <label class="check"><input type="checkbox" name="concluidos" value="1" ${concluidos ? html.seguro('checked') : ''}> Concluídos em ${descreverPeriodo(p)}</label>
  </form>`;

  const tabela = lista.length === 0 ? vazio('Nenhum serviço com esses filtros.') : html`<div class="tabela-rolagem"><table class="tabela">
    <thead><tr><th>OS</th><th>Obra</th><th>Situação</th><th>Prazo</th><th>Status do prazo</th><th class="n">Atraso</th>
      <th>Concluído em</th><th>Profissionais</th><th>Relato</th></tr></thead>
    <tbody>${lista.map((s) => html`<tr>
      <td class="nowrap">${s.os || '—'}</td>
      <td>${linkObra(s.obra)}</td>
      <td>${chipSituacao(s.situacao)}</td>
      <td>${fmt.data(s.prazo)}</td>
      <td>${chipPrazo(s.statusPrazo)}</td>
      <td class="n">${s.diasAtraso ? `${s.diasAtraso} d` : '—'}</td>
      <td>${fmt.data(s.concluido_em)}</td>
      <td>${s.profissionais || '—'}</td>
      <td class="texto-longo">${s.relato || ''}</td>
    </tr>`)}</tbody></table></div>`;

  return html`${filtros}${secao(`${lista.length} serviços`, tabela)}`;
}
