// Tabelas ordenáveis: clicar no título de uma coluna ordena por ela (clicar de novo inverte).
// Basta a tabela ter a classe "ordenavel". Reconhece números (R$ 1.234, 12 m², 25%, "R$ 1,2 mi"), datas
// dd/mm/aaaa e texto. Célula vazia ou "—" vai sempre para o fim. A escolha fica guardada enquanto a página
// está aberta, mesmo quando a tela se redesenha (a cada 5 minutos ou ao trocar o ano).

const estados = new Map(); // chave da tabela → { col, dir }

function valor(txt) {
  const t = String(txt || '').replace(/\s+/g, ' ').trim();
  if (!t || /^[—–-]$/.test(t) || /^sem (resposta|cor|dado)/i.test(t)) return null;
  if (/^nenhum/i.test(t)) return 0;
  const d = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (d) return Number(`${d[3]}${d[2]}${d[1]}`);
  const m = t.match(/-?\d[\d.]*(?:,\d+)?/);
  if (!m) return NaN;
  let n = Number(m[0].replace(/\./g, '').replace(',', '.'));
  if (/\bmi\b/i.test(t)) n *= 1e6;
  return n;
}

const tabelas = () => [...document.querySelectorAll('table.ordenavel')];
const chaveDe = (t) => `${location.hash.split('?')[0]}#${tabelas().indexOf(t)}`;

function ordenar(t, col, dir) {
  const corpo = t.tBodies[0]; if (!corpo) return;
  const linhas = [...corpo.rows];
  const celulas = linhas.map((r) => (r.cells[col] ? r.cells[col].innerText : ''));
  const vals = celulas.map(valor);
  const preenchidas = vals.filter((v) => v !== null);
  const numerica = preenchidas.length > 0 && preenchidas.filter((v) => !Number.isNaN(v)).length / preenchidas.length >= 0.6;
  const idx = linhas.map((_, i) => i);
  idx.sort((a, b) => {
    const va = vals[a]; const vb = vals[b];
    const ea = va === null || (numerica && Number.isNaN(va)); const eb = vb === null || (numerica && Number.isNaN(vb));
    if (ea || eb) return ea === eb ? a - b : (ea ? 1 : -1);   // vazio sempre no fim, qualquer direção
    const c = numerica ? va - vb : celulas[a].trim().localeCompare(celulas[b].trim(), 'pt-BR', { numeric: true, sensitivity: 'base' });
    return (dir === 'desc' ? -c : c) || a - b;
  });
  for (const i of idx) corpo.appendChild(linhas[i]);
}

function marcar(t, col, dir) {
  [...(t.tHead ? t.tHead.rows[t.tHead.rows.length - 1].cells : [])].forEach((th, i) => {
    th.classList.remove('ord-asc', 'ord-desc');
    if (i === col && dir) { th.classList.add(dir === 'asc' ? 'ord-asc' : 'ord-desc'); th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending'); }
    else th.removeAttribute('aria-sort');
  });
}

// depois de cada desenho da tela: deixa os títulos clicáveis e reaplica a ordem escolhida
export function aplicar() {
  for (const t of tabelas()) {
    const cab = t.tHead && t.tHead.rows[t.tHead.rows.length - 1]; if (!cab) continue;
    [...cab.cells].forEach((th) => { th.tabIndex = 0; th.title = 'Clique para ordenar'; });
    const e = estados.get(chaveDe(t));
    if (e) { ordenar(t, e.col, e.dir); marcar(t, e.col, e.dir); }
  }
}

function alternar(th) {
  const t = th.closest('table.ordenavel'); if (!t) return;
  const col = th.cellIndex; const chave = chaveDe(t);
  const e = estados.get(chave);
  const dir = e && e.col === col && e.dir === 'asc' ? 'desc' : 'asc';
  estados.set(chave, { col, dir });
  ordenar(t, col, dir); marcar(t, col, dir);
}

export function instalar() {
  document.addEventListener('click', (ev) => { const th = ev.target.closest && ev.target.closest('table.ordenavel th'); if (th) alternar(th); });
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const th = ev.target.closest && ev.target.closest('table.ordenavel th'); if (th) { ev.preventDefault(); alternar(th); }
  });
}
