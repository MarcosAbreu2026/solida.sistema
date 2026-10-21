// Mini calendário para escolher uma data (reprogramar o prazo de uma pendência), com feriados do Brasil e do Rio de Janeiro.
// abrirCalendario({ ancora, valor, aoEscolher }) abre uma janelinha junto do elemento clicado.

const pad = (n) => String(n).padStart(2, '0');
const iso = (a, m, d) => `${a}-${pad(m + 1)}-${pad(d)}`;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// Páscoa (algoritmo de Meeus/Jones/Butcher)
function pascoa(ano) {
  const a = ano % 19; const b = Math.floor(ano / 100); const c = ano % 100; const d = Math.floor(b / 4); const e = b % 4;
  const f = Math.floor((b + 8) / 25); const g = Math.floor((b - f + 1) / 3); const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4); const k = c % 4; const l = (32 + 2 * e + 2 * i - h - k) % 7; const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}
const somar = (dt, n) => { const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n); return iso(x.getFullYear(), x.getMonth(), x.getDate()); };

const cache = {};
export function feriados(ano) {
  if (cache[ano]) return cache[ano];
  const p = pascoa(ano); const f = {};
  const fixo = (m, d, nome) => { f[iso(ano, m - 1, d)] = nome; };
  fixo(1, 1, 'Confraternização Universal'); fixo(1, 20, 'Dia de São Sebastião (Rio)'); fixo(4, 21, 'Tiradentes'); fixo(4, 23, 'Dia de São Jorge (Rio)');
  fixo(5, 1, 'Dia do Trabalho'); fixo(9, 7, 'Independência do Brasil'); fixo(10, 12, 'Nossa Senhora Aparecida'); fixo(11, 2, 'Finados');
  fixo(11, 15, 'Proclamação da República'); fixo(11, 20, 'Consciência Negra'); fixo(12, 25, 'Natal');
  f[somar(p, -48)] = 'Carnaval (segunda)'; f[somar(p, -47)] = 'Carnaval (terça)'; f[somar(p, -2)] = 'Sexta-feira Santa'; f[somar(p, 0)] = 'Páscoa'; f[somar(p, 60)] = 'Corpus Christi';
  cache[ano] = f; return f;
}

let aberto = null;
export function fecharCalendario() { if (aberto) { aberto.remove(); aberto = null; } }

export function abrirCalendario({ ancora, valor, aoEscolher }) {
  fecharCalendario();
  const hoje = new Date(); const hojeISO = iso(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const base = valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : hojeISO;
  let ano = Number(base.slice(0, 4)); let mes = Number(base.slice(5, 7)) - 1;
  const caixa = document.createElement('div'); caixa.className = 'cal-pop'; caixa.setAttribute('role', 'dialog'); caixa.setAttribute('aria-label', 'Escolher a nova data');

  const desenhar = () => {
    const fer = feriados(ano); const primeiro = new Date(ano, mes, 1).getDay(); const total = new Date(ano, mes + 1, 0).getDate();
    let celulas = '';
    for (let i = 0; i < primeiro; i++) celulas += '<span class="cal-vazio"></span>';
    for (let d = 1; d <= total; d++) {
      const k = iso(ano, mes, d); const dow = new Date(ano, mes, d).getDay(); const passado = k < hojeISO;
      const cls = ['cal-dia', k === hojeISO ? 'hoje' : '', k === valor ? 'atual' : '', fer[k] ? 'feriado' : '', (dow === 0 || dow === 6) ? 'fds' : ''].filter(Boolean).join(' ');
      celulas += `<button type="button" class="${cls}" data-cal-dia="${k}" ${passado ? 'disabled' : ''} title="${fer[k] ? fer[k] : ''}">${d}</button>`;
    }
    const doMes = Object.entries(fer).filter(([k]) => Number(k.slice(5, 7)) - 1 === mes).sort();
    caixa.innerHTML = `<div class="cal-topo"><button type="button" class="cal-nav" data-cal-nav="-1" aria-label="Mês anterior">‹</button><b>${MESES[mes]} ${ano}</b><button type="button" class="cal-nav" data-cal-nav="1" aria-label="Próximo mês">›</button></div>
      <div class="cal-semana">${DIAS.map((x) => `<span>${x}</span>`).join('')}</div>
      <div class="cal-grade">${celulas}</div>
      ${doMes.length ? `<ul class="cal-feriados">${doMes.map(([k, n]) => `<li><b>${k.slice(8, 10)}</b> ${n}</li>`).join('')}</ul>` : '<p class="cal-sem">Sem feriados neste mês.</p>'}
      <div class="cal-rodape"><button type="button" class="cal-link" data-cal-hoje>Hoje</button><button type="button" class="cal-link" data-cal-fechar>Fechar</button></div>`;
  };
  desenhar(); document.body.appendChild(caixa); aberto = caixa;

  // posição: logo abaixo do elemento clicado, sem sair da tela
  const r = ancora.getBoundingClientRect(); const w = 300;
  let esq = Math.min(Math.max(8, r.left), window.innerWidth - w - 8); let topo = r.bottom + 6;
  caixa.style.width = `${w}px`; caixa.style.left = `${esq + window.scrollX}px`; caixa.style.top = `${topo + window.scrollY}px`;
  const h = caixa.offsetHeight;
  if (topo + h > window.innerHeight - 8) caixa.style.top = `${(r.top - h - 6 > 8 ? r.top - h - 6 : Math.max(8, window.innerHeight - h - 8)) + window.scrollY}px`;

  caixa.addEventListener('click', (e) => {
    e.stopPropagation();
    const nav = e.target.closest('[data-cal-nav]'); if (nav) { mes += Number(nav.dataset.calNav); if (mes < 0) { mes = 11; ano--; } if (mes > 11) { mes = 0; ano++; } desenhar(); return; }
    if (e.target.closest('[data-cal-hoje]')) { ano = hoje.getFullYear(); mes = hoje.getMonth(); desenhar(); return; }
    if (e.target.closest('[data-cal-fechar]')) { fecharCalendario(); return; }
    const dia = e.target.closest('[data-cal-dia]'); if (dia && !dia.disabled) { const k = dia.dataset.calDia; fecharCalendario(); if (k !== valor) aoEscolher(k); }
  });
  setTimeout(() => {
    const fora = (e) => { if (aberto && !aberto.contains(e.target)) { fecharCalendario(); document.removeEventListener('mousedown', fora, true); document.removeEventListener('keydown', esc, true); } };
    const esc = (e) => { if (e.key === 'Escape') { fecharCalendario(); document.removeEventListener('mousedown', fora, true); document.removeEventListener('keydown', esc, true); } };
    document.addEventListener('mousedown', fora, true); document.addEventListener('keydown', esc, true);
  }, 0);
}
