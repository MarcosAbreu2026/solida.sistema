// Gráficos em SVG puro (sem biblioteca externa, funciona sem internet).
// Barras com no máximo 24px, ponta arredondada de 4px e base reta; valor na ponta; dica ao passar o mouse.

import { esc, numero } from './formato.js';

const R = 4;

// Retângulo com os dois cantos da ponta arredondados (horizontal: ponta à direita; vertical: ponta em cima)
function barraH(x, y, w, h) {
  if (w <= 0) return '';
  const r = Math.min(R, w, h / 2);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}
function barraV(x, y, w, h) {
  if (h <= 0) return '';
  const r = Math.min(R, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function escalaLimpa(max) {
  if (max <= 0) return { topo: 1, passo: 1 };
  const bruto = max / 4;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= bruto);
  return { topo: Math.ceil(max / passo) * passo, passo };
}

// itens: [{ rotulo, valor, dica, link? }]
export function barrasHorizontais(itens, { largura = 520 } = {}) {
  const linha = 34, esq = 120, dir = 44, espessura = 20;
  const altura = itens.length * linha;
  const max = Math.max(1, ...itens.map((i) => i.valor));
  const util = largura - esq - dir;
  const partes = itens.map((it, i) => {
    const y = i * linha;
    const w = (it.valor / max) * util;
    const yb = y + (linha - espessura) / 2;
    const alvo = `<rect class="alvo" x="0" y="${y}" width="${largura}" height="${linha}" data-dica="${esc(it.dica)}"${it.link ? ` data-link="${esc(it.link)}"` : ''}></rect>`;
    return `<g class="item${it.link ? ' clicavel' : ''}">
      ${alvo}
      <text class="rotulo" x="${esq - 12}" y="${y + linha / 2}" text-anchor="end" dominant-baseline="central">${esc(it.rotulo)}</text>
      <path class="marca" d="${barraH(esq, yb, w, espessura)}"></path>
      <text class="valor" x="${esq + w + 8}" y="${y + linha / 2}" dominant-baseline="central">${numero(it.valor)}</text>
    </g>`;
  });
  return `<svg class="grafico" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gráfico de barras">
    <line class="eixo" x1="${esq}" x2="${esq}" y1="0" y2="${altura}"></line>
    ${partes.join('')}
  </svg>`;
}

// Barras empilhadas, uma por linha, em HTML: o texto usa o tamanho de letra padrão do painel (um SVG ampliaria as letras com a tela).
// linhas: [{ rotulo, sub, segs: [{ valor, cls }], fim, dica, vazio?, extra? (HTML já pronto, última coluna) }]; cls: ok · abaixo · sem (cores no CSS); o número fica dentro de cada trecho e `fim` (ex.: "71%") à direita.
export function barrasEmpilhadas(linhas, { vazio = 'sem metas conferidas' } = {}) {
  const linha = (l) => {
    const total = l.segs.reduce((t, s) => t + s.valor, 0);
    const barra = total
      ? l.segs.filter((s) => s.valor > 0).map((s) => `<span class="pd-emp-seg pd-emp-${s.cls}" style="flex:${s.valor} 1 0">${numero(s.valor)}</span>`).join('')
      : `<span class="pd-emp-vazio">${esc(l.vazio || vazio)}</span>`;
    return `<div class="pd-emp-linha" title="${esc(l.dica || '')}">
      <div class="pd-emp-rot"><span class="pd-obra">${esc(l.rotulo)}</span>${l.sub ? `<span class="pd-obra-sub">${esc(l.sub)}</span>` : ''}</div>
      <div class="pd-emp-barra" role="img" aria-label="${esc(l.dica || l.rotulo)}">${barra}</div>
      <b class="pd-emp-fim">${esc(l.fim || '')}</b>
      ${l.extra || ''}
    </div>`;
  };
  return `<div class="pd-emp-linhas">${linhas.map(linha).join('')}</div>`;
}

// itens: [{ rotulo, valor, dica, destaque }]
export function colunas(itens, { largura = 560, altura = 230 } = {}) {
  const esq = 36, dir = 8, topo = 22, base = 28;
  const util = largura - esq - dir;
  const alturaUtil = altura - topo - base;
  const faixa = util / itens.length;
  const espessura = Math.min(24, faixa * 0.6);
  const { topo: vmax, passo } = escalaLimpa(Math.max(0, ...itens.map((i) => i.valor)));
  const yDe = (v) => topo + alturaUtil - (v / vmax) * alturaUtil;

  const grade = [];
  for (let v = 0; v <= vmax + 1e-9; v += passo) {
    const y = yDe(v);
    grade.push(`<line class="${v === 0 ? 'eixo' : 'grade'}" x1="${esq}" x2="${largura - dir}" y1="${y}" y2="${y}"></line>
      <text class="tick" x="${esq - 8}" y="${y}" text-anchor="end" dominant-baseline="central">${numero(v)}</text>`);
  }
  const cols = itens.map((it, i) => {
    const cx = esq + faixa * i + faixa / 2;
    const y = yDe(it.valor);
    const h = topo + alturaUtil - y;
    return `<g class="item${it.destaque ? ' destaque' : ''}">
      <rect class="alvo" x="${cx - faixa / 2}" y="${topo}" width="${faixa}" height="${alturaUtil}" data-dica="${esc(it.dica)}"></rect>
      <path class="marca" d="${barraV(cx - espessura / 2, y, espessura, h)}"></path>
      ${it.destaque || it.valor === Math.max(...itens.map((x) => x.valor))
        ? `<text class="valor" x="${cx}" y="${y - 7}" text-anchor="middle">${numero(it.valor)}</text>` : ''}
      <text class="tick" x="${cx}" y="${altura - 8}" text-anchor="middle">${esc(it.rotulo)}</text>
    </g>`;
  });
  return `<svg class="grafico colunas" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gráfico de colunas">
    ${grade.join('')}${cols.join('')}
  </svg>`;
}
