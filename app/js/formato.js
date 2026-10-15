import { ehData } from './datas.js';

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];

export const reais = (v) => MOEDA.format(v || 0);
export const numero = (v) => NUM.format(v || 0);

export function data(iso) {
  if (!ehData(iso)) return iso || '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function diaMes(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function nomeDia(i) {
  return DIAS[i];
}

export function descreverPeriodo(p) {
  if (p.verPor === 'Mês') {
    const [a, m] = p.inicio.split('-').map(Number);
    return `${MESES[m - 1][0].toUpperCase()}${MESES[m - 1].slice(1)}/${a}`;
  }
  return `${diaMes(p.inicio)} a ${diaMes(p.fim)}`;
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

// Template literal que escapa os valores interpolados, exceto os marcados com html.seguro()
export function html(partes, ...valores) {
  let out = partes[0];
  valores.forEach((v, i) => {
    out += render(v) + partes[i + 1];
  });
  return new Seguro(out);
}
class Seguro {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
html.seguro = (s) => new Seguro(s);
function render(v) {
  if (v instanceof Seguro) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(v);
}
