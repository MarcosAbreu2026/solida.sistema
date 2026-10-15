// Datas são tratadas como texto ISO "aaaa-mm-dd" (sem fuso horário), igual ao JSON exportado.
// Comparar duas datas ISO como texto já dá a ordem certa.

const RE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function ehData(v) {
  return typeof v === 'string' && RE_ISO.test(v);
}

function paraDate(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function paraISO(dt) {
  return dt.toISOString().slice(0, 10);
}

export function hojeISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function somarDias(iso, n) {
  const dt = paraDate(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return paraISO(dt);
}

export function diasEntre(de, ate) {
  return Math.round((paraDate(ate) - paraDate(de)) / 86400000);
}

// WEEKDAY(data; 3) do Excel: segunda = 0 … domingo = 6
export function diaDaSemana(iso) {
  return (paraDate(iso).getUTCDay() + 6) % 7;
}

export function inicioDaSemana(iso) {
  return somarDias(iso, -diaDaSemana(iso));
}

// Mesmo cálculo da aba Cálculos (R2/R3)
export function periodo(verPor, ref) {
  if (verPor === 'Mês') {
    const [a, m] = ref.split('-').map(Number);
    const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const mm = String(m).padStart(2, '0');
    return { verPor, ref, inicio: `${a}-${mm}-01`, fim: `${a}-${mm}-${String(ultimo).padStart(2, '0')}` };
  }
  const inicio = inicioDaSemana(ref);
  return { verPor: 'Semana', ref, inicio, fim: somarDias(inicio, 6) };
}

export function noPeriodo(iso, p) {
  return ehData(iso) && iso >= p.inicio && iso <= p.fim;
}

export function diasDoIntervalo(inicio, fim) {
  const out = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) out.push(d);
  return out;
}
