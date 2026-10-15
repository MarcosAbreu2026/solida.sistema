import { html, numero, descreverPeriodo } from '../formato.js';
import { equipeNoPeriodo, diasPorObra, soma } from '../regras.js';
import { linkObra, secao, vazio, fmt, aviso, ehSocio } from '../componentes.js';

export const titulo = 'Equipe e PJ';

export function render({ base, p }) {
  const linhas = equipeNoPeriodo(base, p);
  const pj = linhas.filter((l) => l.pessoa.vinculo === 'PJ');
  const semDiaria = linhas.filter((l) => !l.pessoa.diariaInformada);
  const periodo = descreverPeriodo(p);

  // valores em R$ (diária e custo) só aparecem no perfil Sócio
  const s = ehSocio();
  const tabela = (ls, totalRotulo) => html`<div class="tabela-rolagem"><table class="tabela">
    <thead><tr><th>Profissional</th><th>Função</th><th>Vínculo</th>${s ? html`<th class="n">Diária</th>` : ''}
      <th class="n">Diárias (${periodo})</th>${s ? html`<th class="n">Custo (${periodo})</th>` : ''}
      <th class="n">Diárias (total)</th>${s ? html`<th class="n">Custo (total)</th>` : ''}</tr></thead>
    <tbody>${ls.map((l) => html`<tr class="${l.diarias ? '' : 'apagada'}">
      <td><b>${l.pessoa.nome}</b>${l.pessoa.apelido_1 || l.pessoa.apelido_2
        ? html`<div class="apelidos">também: ${[l.pessoa.apelido_1, l.pessoa.apelido_2].filter(Boolean).join(', ')}</div>` : ''}</td>
      <td>${l.pessoa.funcao || '—'}</td>
      <td>${l.pessoa.vinculo || '—'}</td>
      ${s ? html`<td class="n">${l.pessoa.diariaInformada ? fmt.reais(l.pessoa.diaria) : html`<span class="pendente">não informada</span>`}</td>` : ''}
      <td class="n">${fmt.diarias(l.diarias)}</td>
      ${s ? html`<td class="n">${fmt.reais(l.custo)}</td>` : ''}
      <td class="n">${fmt.diarias(l.diariasTotal)}</td>
      ${s ? html`<td class="n">${fmt.reais(l.custoTotal)}</td>` : ''}
    </tr>`)}</tbody>
    <tfoot><tr><th colspan="${s ? 4 : 3}">${totalRotulo}</th>
      <th class="n">${numero(soma(ls, 'diarias'))}</th>${s ? html`<th class="n">${fmt.reais(soma(ls, 'custo'))}</th>` : ''}
      <th class="n">${numero(soma(ls, 'diariasTotal'))}</th>${s ? html`<th class="n">${fmt.reais(soma(ls, 'custoTotal'))}</th>` : ''}</tr></tfoot>
  </table></div>`;

  const matriz = (pessoas, vazioTxt) => {
    const linhasM = diasPorObra(base, p, pessoas);
    if (linhasM.length === 0) return vazio(vazioTxt);
    const ordem = new Map(base.obras.map((o, i) => [o.obra, i]));
    linhasM.sort((a, b) => (ordem.get(a.obra) ?? 1e9) - (ordem.get(b.obra) ?? 1e9));
    const ativos = pessoas.filter((x) => linhasM.some((l) => l.dias[x.nome]));
    return html`<div class="tabela-rolagem"><table class="tabela matriz">
      <thead><tr><th>Obra</th>${ativos.map((x) => html`<th class="n">${x.nome}</th>`)}</tr></thead>
      <tbody>${linhasM.map((l) => html`<tr><td>${base.obraPorNome.has(l.obra) ? linkObra(l.obra) : l.obra}</td>
        ${ativos.map((x) => html`<td class="n">${l.dias[x.nome] || ''}</td>`)}</tr>`)}</tbody>
    </table></div>`;
  };

  const notaDias = html`<p class="legenda-curta">Dias em que o nome aparece na linha da obra, sem contar falta/atestado. Se a pessoa vai em duas obras no mesmo dia, o dia aparece nas duas; nas diárias acima ele é dividido.</p>`;

  return html`
    ${semDiaria.length && s ? aviso(`Diária não informada: ${semDiaria.map((l) => l.pessoa.nome).join(', ')}. O custo dessas pessoas aparece como R$ 0,00.`) : ''}
    ${secao('Equipe', tabela(linhas, 'Total da equipe'))}
    ${secao(`Dias escalados por obra · ${periodo}`, html`${notaDias}${matriz(base.equipe, 'Ninguém escalado neste período.')}`)}
    ${secao('PJ — prestadores pagos por diária', html`<p class="legenda-curta">Entram nas diárias da Agenda como a equipe própria. Não lance o custo deles também no Financeiro.</p>${tabela(pj, 'Total PJ')}`)}
    ${secao(`PJ — dias escalados por obra · ${periodo}`, html`${notaDias}${matriz(pj.map((l) => l.pessoa), 'Nenhum PJ escalado neste período.')}`)}
  `;
}
