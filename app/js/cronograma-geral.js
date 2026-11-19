// Cronograma geral de obras (pedido do Marcos, 19/11/2026), em Operações. Mesmo desenho da planilha R106: uma linha por obra, uma coluna por semana
// (segunda-feira) nos próximos 4 meses, e em cada semana "S##" = a semana da obra (S01 = semana do início). Obras pausadas ficam sem andamento.
// Embaixo: pós-obras com mais de 4 semanas de serviço e os orçamentos que acreditamos fechar (★ viável no CRM de orçamentos), já com as semanas previstas.
// Dados: Cadastros (código, cliente, arquitetura, situação) + tabela cronograma_obras (coordenação, gestores, estagiário, encarregado, início e fim).
import { html } from './formato.js';
import { hojeISO, somarDias, inicioDaSemana } from './datas.js';
import { NA_NUVEM, listarCronogramaObras, gravarCronogramaObra } from './nuvem.js';
import { tipoDe, situacaoDe } from './obras-tipos.js';

export const SEMANAS = 17;   // ≈ 4 meses
const CHAVE = 'solida.cronogramaObras';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch { return []; } };
export let linhas = [];
export let erro = '';

export async function carregar() {
  try { linhas = NA_NUVEM ? await listarCronogramaObras() : lerLocal(); erro = ''; } catch (e) { erro = String(e.message || e); }
  return linhas;
}
export async function salvar(l) {
  const limpo = { codigo: l.codigo, coord: l.coord || null, gestor1: l.gestor1 || null, gestor2: l.gestor2 || null, estagiario: l.estagiario || null, encarregado: l.encarregado || null, inicio: l.inicio || null, fim: l.fim || null };
  if (NA_NUVEM) await gravarCronogramaObra(limpo);
  else { const t = lerLocal().filter((x) => x.codigo !== limpo.codigo); t.push(limpo); try { localStorage.setItem(CHAVE, JSON.stringify(t)); } catch { /* sem armazenamento */ } }
  linhas = [...linhas.filter((x) => x.codigo !== limpo.codigo), limpo];
}

const dias = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
// número da semana da obra naquela segunda-feira (null = fora do período da obra)
export function semanaDaObra(inicio, fim, segunda) {
  if (!inicio) return null;
  const i0 = inicioDaSemana(inicio); const n = Math.floor(dias(i0, segunda) / 7) + 1;
  if (n < 1) return null;
  if (fim && segunda > fim) return null;
  return n;
}
const totalSemanas = (inicio, fim) => (inicio && fim ? Math.floor(dias(inicioDaSemana(inicio), inicioDaSemana(fim)) / 7) + 1 : null);
const nomeNumero = (c, k) => String(c || '').localeCompare(String(k || ''), 'pt-BR', { numeric: true });
const ddmm = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const dBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const sel = (cond) => (cond ? html.seguro('selected') : '');

export function render({ hoje = hojeISO(), obrasCad = [], orcs = [], podeEditar = false, pessoas = [] }) {
  const seg0 = inicioDaSemana(hoje);
  const cols = Array.from({ length: SEMANAS }, (_, i) => somarDias(seg0, i * 7));
  const porCod = Object.fromEntries(linhas.map((l) => [String(l.codigo).toUpperCase(), l]));
  const cad = (cod) => obrasCad.find((c) => String(c.codigo).toUpperCase() === String(cod).toUpperCase());
  const cabecalho = html`<thead><tr><th class="cg-cod">Código</th><th class="cg-nome">Cliente · arquitetura</th><th>Coord.</th><th>Gestor 1</th><th>Gestor 2</th><th>Estagiário</th><th>Encarreg.</th>${cols.map((c, i) => html`<th class="cg-sem ${i === 0 ? 'cg-hoje' : ''} ${i > 0 && c.slice(0, 7) !== cols[i - 1].slice(0, 7) ? 'cg-mes' : ''}" title="Semana de ${dBR(c)}">${ddmm(c)}${i === 0 || c.slice(0, 4) !== cols[i - 1].slice(0, 4) ? html`<small>${c.slice(0, 4)}</small>` : ''}</th>`)}</tr></thead>`;
  const nomeDe = (cod, c, extra = {}) => {
    const cli = (c && (c.cliente || c.nome)) || extra.cliente || ''; const arq = (c && c.arquitetura) || extra.arquitetura || '';
    return html`<td class="cg-nome" title="${(c && c.endereco) || ''}"><b>${cli || '—'}</b>${arq ? html` <span class="cg-arq">· ${arq}</span>` : ''}</td>`;
  };
  const celulas = (inicio, fim, cls, parada = false) => (parada
    ? html`<td class="cg-parada" colspan="${SEMANAS}">Obra parada: sem andamento</td>`
    : !inicio ? html`<td class="cg-sem-data" colspan="${SEMANAS}">${podeEditar ? 'clique na linha para definir o início e o fim' : 'início e fim ainda não definidos'}</td>`
      : cols.map((c, i) => { const n = semanaDaObra(inicio, fim, c); return html`<td class="cg-sem ${n ? cls : ''} ${i === 0 ? 'cg-hoje' : ''} ${i > 0 && c.slice(0, 7) !== cols[i - 1].slice(0, 7) ? 'cg-mes' : ''}">${n ? `S${String(n).padStart(2, '0')}` : ''}</td>`; }));
  const pe = (v) => html`<td class="cg-pes">${v || ''}</td>`;
  const linhaObra = (cod, c, l, cls, { parada = false, tituloLinha = '' } = {}) => html`<tr class="cg-lin ${podeEditar ? 'cg-edita' : ''} ${parada ? 'cg-lin-parada' : ''}" ${podeEditar ? html.seguro(`data-cg-edit="${String(cod).replace(/"/g, '')}"`) : ''} title="${tituloLinha || (podeEditar ? 'Clique para editar a equipe e as datas' : '')}">
    <td class="cg-cod"><b>${cod}</b></td>${nomeDe(cod, c)}${pe(l && l.coord)}${pe(l && l.gestor1)}${pe(l && l.gestor2)}${pe(l && l.estagiario)}${pe(l && l.encarregado)}${celulas(l && l.inicio, l && l.fim, cls, parada)}</tr>`;
  const titulo = (txt, n) => html`<tr class="cg-grupo"><td colspan="${7 + SEMANAS}">${txt}${n != null ? html` <span class="cg-n">${n}</span>` : ''}</td></tr>`;

  // 1) obras em curso (Cadastros: tipo obra, andamento ou pausada)
  const obras = obrasCad.filter((c) => tipoDe(c) === 'obra' && situacaoDe(c) !== 'finalizada' && /^mo/i.test(String(c.codigo))).sort((a, b) => nomeNumero(a.codigo, b.codigo));
  const emCurso = obras.map((c) => { const l = porCod[String(c.codigo).toUpperCase()] || null; return linhaObra(c.codigo, c, l, 'cg-obra', { parada: situacaoDe(c) === 'pausada' }); });
  // 2) pós-obras com mais de 4 semanas de serviço
  const pos = linhas.filter((l) => /^po/i.test(String(l.codigo)) && (totalSemanas(l.inicio, l.fim) || 0) > 4 && (!l.fim || l.fim >= seg0)
    && (!cad(l.codigo) || situacaoDe(cad(l.codigo)) !== 'finalizada')).sort((a, b) => nomeNumero(a.codigo, b.codigo));
  const linhasPos = pos.map((l) => linhaObra(l.codigo, cad(l.codigo), l, 'cg-pos'));
  // 3) orçamentos que acreditamos fechar
  const viaveis = orcs.filter((o) => o.viavel && o.inicio_previsto && !['fechado', 'nao_fechou'].includes(o.status)).sort((a, b) => String(a.inicio_previsto).localeCompare(String(b.inicio_previsto)) || nomeNumero(a.obra, b.obra));
  const linhasOrc = viaveis.map((o) => html`<tr class="cg-lin cg-lin-orc" data-oq="${o.id}" title="Clique para abrir o card deste orçamento">
    <td class="cg-cod"><b>${o.obra}</b></td><td class="cg-nome"><b>${o.cliente || '—'}</b>${o.arquitetura ? html` <span class="cg-arq">· ${o.arquitetura}</span>` : ''}</td>
    <td class="cg-pes cg-prev" colspan="5">${o.meses ? `${String(o.meses).replace('.', ',')} meses` : o.fim_previsto ? `até ${dBR(o.fim_previsto)}` : ''} · início ${dBR(o.inicio_previsto)}${o.prazo ? ` · orçamento até ${dBR(o.prazo)}` : ''}</td>${celulas(o.inicio_previsto, o.fim_previsto, 'cg-orc')}</tr>`);

  return html`<div class="cg">
    ${erro ? html`<p class="erro">${erro}</p>` : ''}
    <div class="cg-topo"><span class="pequeno">Próximos 4 meses, semana a semana (segunda-feira). S## = semana da obra. A coluna marcada é a semana de hoje.${podeEditar ? ' Clique numa linha para editar a equipe e as datas.' : ''}</span><button type="button" class="botao" data-imprimir="cronograma" title="Imprimir o cronograma (ou salvar em PDF)">🖨 Imprimir</button></div>
    <h2 class="cg-imp-tit">Cronograma geral de obras · ${dBR(hoje)}</h2>
    <div class="tabela-rolagem"><table class="cg-tab">${cabecalho}<tbody>
      ${titulo('EM CURSO', obras.length)}${emCurso.length ? emCurso : html`<tr><td colspan="${7 + SEMANAS}" class="vazio">Nenhuma obra em andamento no Cadastros.</td></tr>`}
      ${titulo('PÓS-OBRA · mais de 4 semanas de serviço', pos.length)}${linhasPos.length ? linhasPos : html`<tr><td colspan="${7 + SEMANAS}" class="vazio">Nenhum pós-obra com mais de 4 semanas de serviço.</td></tr>`}
      ${titulo('ORÇAMENTOS · acreditamos fechar', viaveis.length)}${linhasOrc.length ? linhasOrc : html`<tr><td colspan="${7 + SEMANAS}" class="vazio">Marque ★ "Acreditamos que vai fechar" no card do orçamento (aba Orçamentos novas) e preencha o início previsto.</td></tr>`}
    </tbody></table></div></div>`;
}

export function formEditar(codigo, { obrasCad = [], pessoas = [], orcs = [] }) {
  const c = obrasCad.find((x) => String(x.codigo).toUpperCase() === String(codigo).toUpperCase());
  const l = linhas.find((x) => String(x.codigo).toUpperCase() === String(codigo).toUpperCase()) || { codigo };
  const eh = /^po/i.test(String(codigo));
  const total = totalSemanas(l.inicio, l.fim);
  return html`<form class="at-nova-pend at-avulsa" id="cg-form" data-cg-form="${codigo}" autocomplete="off">
    <h3>${codigo} · ${(c && (c.cliente || c.nome)) || ''}</h3><p class="pequeno at-av-sub">${eh ? 'Pós-obra: aparece no cronograma quando passa de 4 semanas de serviço.' : 'S01 é a semana do início; as semanas seguintes são contadas até o fim.'}${total ? ` Hoje: ${total} semana(s).` : ''}</p>
    <div class="at-av-grade">
      <label class="av-m">Coordenação<input name="coord" list="cg-pessoas" value="${l.coord || ''}"></label>
      <label class="av-m">Gestor 1<input name="gestor1" list="cg-pessoas" value="${l.gestor1 || ''}"></label>
      <label class="av-m">Gestor 2<input name="gestor2" list="cg-pessoas" value="${l.gestor2 || ''}"></label>
      <label class="av-m">Estagiário<input name="estagiario" list="cg-pessoas" value="${l.estagiario || ''}"></label>
      <label class="av-m">Encarregado<input name="encarregado" list="cg-pessoas" value="${l.encarregado || ''}"></label>
      <label class="av-m">Início da obra<input type="date" name="inicio" value="${l.inicio || ''}"></label>
      <label class="av-m">Fim previsto<input type="date" name="fim" value="${l.fim || ''}"></label>
    </div>
    <datalist id="cg-pessoas">${pessoas.map((p) => html`<option value="${p}">`)}</datalist>
    <div class="at-av-botoes"><button type="button" class="botao" data-av-fechar>Cancelar</button><button type="submit" class="botao on">Salvar</button></div></form>`;
}
