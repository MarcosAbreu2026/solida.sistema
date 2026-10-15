import { html, numero, diaMes, nomeDia } from '../formato.js';
import { inicioDaSemana, somarDias, diasDoIntervalo, hojeISO } from '../datas.js';
import { soma } from '../regras.js';
import { linkObra, secao, vazio, fmt } from '../componentes.js';
import { pessoasDaEntrada } from './obras.js';

export const titulo = 'Agenda';

export function render({ base, p }) {
  const inicio = inicioDaSemana(p.ref);
  const dias = diasDoIntervalo(inicio, somarDias(inicio, 6));
  const fim = dias[6];
  const hoje = hojeISO();
  const daSemana = base.agenda.filter((a) => a.data >= inicio && a.data <= fim);

  // linhas na ordem da aba Obras; obras que só existem na agenda vão no fim
  const ordem = new Map(base.obras.map((o, i) => [o.obra, i]));
  const obras = [...new Set(daSemana.map((a) => a.obra))]
    .sort((a, b) => (ordem.get(a) ?? 1e9) - (ordem.get(b) ?? 1e9) || a.localeCompare(b));

  const nav = html`<div class="nav-semana">
    <button type="button" class="botao" data-ref="${somarDias(inicio, -7)}">← Semana anterior</button>
    <b>Semana de ${fmt.data(inicio)} a ${fmt.data(fim)}</b>
    <button type="button" class="botao" data-ref="${somarDias(inicio, 7)}">Próxima semana →</button>
  </div>`;

  const grade = obras.length === 0 ? vazio('Nada programado nesta semana.') : html`<div class="tabela-rolagem"><table class="tabela agenda">
    <thead><tr><th>Obra</th>${dias.map((d, i) => html`<th class="${d === hoje ? 'hoje' : ''}">${nomeDia(i)} ${diaMes(d)}</th>`)}<th class="n">Diárias</th></tr></thead>
    <tbody>${obras.map((obra) => {
      const linha = daSemana.filter((a) => a.obra === obra);
      return html`<tr>
        <td>${base.obraPorNome.has(obra) ? linkObra(obra) : obra}</td>
        ${dias.map((d) => {
          const e = linha.find((a) => a.data === d);
          return html`<td class="celula ${d === hoje ? 'hoje' : ''}">${e ? html`<div class="texto-agenda">${e.texto}</div>${pessoasDaEntrada(e)}` : ''}</td>`;
        })}
        <td class="n">${fmt.diarias(soma(linha, 'diarias'))}</td>
      </tr>`;
    })}</tbody>
    <tfoot><tr><th>Diárias no dia</th>${dias.map((d) => html`<th class="n">${fmt.diarias(soma(daSemana.filter((a) => a.data === d), 'diarias'))}</th>`)}
      <th class="n">${numero(soma(daSemana, 'diarias'))}</th></tr></tfoot>
  </table></div>`;

  const legenda = html`<p class="legenda-curta">
    <span class="pessoa">Nome</span> reconhecido na Equipe ·
    <span class="pessoa ausente">Nome</span> falta/atestado (não conta) ·
    <span class="pessoa ambigua">Nome ?</span> reconhecido dentro de outra palavra — confira (a planilha conta assim mesmo)
  </p>`;

  return html`${nav}${secao('Programação semanal', html`${legenda}${grade}`)}`;
}
