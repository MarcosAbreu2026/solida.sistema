// Lê, por regras (sem IA), a mensagem de EFETIVO que cada obra posta no grupo de WhatsApp. Exemplos do modelo usado nas obras:
//   "Data : 20/10/2026 / EFETIVO : Retificando. / Equipe Sólida: / Quantidade: 02 / Nomes: Wanderson ; Marcelo. / Equipe(s) terceirizada(s): / TODESQUINI / Quantidade: 05 / Total de colaboradores: 07"
//   "Efetivo Sólida MO533 Quarta-Feira, 21/10/26. / Equipe Sólida: / Edvan ( Ladrilheiro) / ... / Total: 04 / Terceirizados: / Rio Pinturas. / 01 Pintor."
// Devolve null quando o texto não é um efetivo.

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const limpa = (s) => String(s || '').replace(/[‎‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
const pad = (n) => String(n).padStart(2, '0');

export function ehEfetivo(texto) {
  const t = semAcento(texto);
  return /efetivo/.test(t) && /equipe\s*(s[oó]lida|\(s\)|terceir)/.test(t);
}

export function lerEfetivo(texto, dataMsg = '') {
  if (!ehEfetivo(texto)) return null;
  const linhas = String(texto).split(/\r?\n/).map(limpa).filter(Boolean);
  // data escrita na mensagem (dd/mm/aaaa ou dd/mm/aa); senão, o dia em que a mensagem foi postada
  let data = dataMsg;
  const md = String(texto).match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/);
  if (md) { const a = md[3].length === 2 ? `20${md[3]}` : md[3]; data = `${a}-${pad(md[2])}-${pad(md[1])}`; }

  const iSol = linhas.findIndex((l) => /^equipe\s+s[oó]lida/i.test(semAcento(l)));
  const iTer = linhas.findIndex((l, i) => i > iSol && /terceiriz/.test(semAcento(l)));
  const fimSol = iTer > -1 ? iTer : linhas.length;
  const blocoSol = iSol > -1 ? linhas.slice(iSol + 1, fimSol) : [];
  const blocoTer = iTer > -1 ? linhas.slice(iTer + 1) : [];

  // Equipe Sólida
  let qtd = null; let nomes = [];
  const total = (linhas.map((l) => semAcento(l).match(/^total[^:\d]*[: ]\s*(\d+)/)).find(Boolean) || [])[1];
  const nomesLinha = blocoSol.find((l) => /^nomes\s*:/i.test(semAcento(l)));
  for (const l of blocoSol) { const m = semAcento(l).match(/^quantidade\s*:\s*(\d+)/); if (m) qtd = Number(m[1]); }
  if (nomesLinha) {
    nomes = limpa(nomesLinha.replace(/^nomes\s*:/i, '')).split(/\s*[;,]\s*|\s+e\s+/i).map((n) => n.replace(/[.\s]+$/g, '').trim()).filter(Boolean);
  } else {
    nomes = blocoSol.filter((l) => !/^(quantidade|total|nomes)\b/i.test(semAcento(l)) && !/^at[ée] o momento/i.test(semAcento(l))).map((n) => n.replace(/[.\s]+$/g, '').trim()).filter(Boolean);
  }
  nomes = nomes.map((n) => n.replace(/\s*\(\s*([^)]*)\)\s*$/, ' ($1)').trim());
  if (qtd == null) qtd = nomes.length;

  // Terceirizados
  const terceiros = [];
  let atual = null;
  for (const l of blocoTer) {
    const s = semAcento(l);
    if (/^total/.test(s)) break;
    if (/^at[ée] o momento|^nenhum/.test(s)) continue;
    const q = s.match(/^quantidade\s*:\s*(\d+)/);
    if (q) { if (atual) atual.qtd = Number(q[1]); continue; }
    const n = l.match(/^(\d+)\s+(.+)$/);
    if (n && atual) { atual.qtd = Number(n[1]); atual.funcao = n[2].replace(/[.\s]+$/g, ''); continue; }
    atual = { empresa: l.replace(/[.:\s]+$/g, ''), qtd: null };
    terceiros.push(atual);
  }
  for (const t of terceiros) if (t.qtd == null) t.qtd = 1;
  const totalTer = terceiros.reduce((a, t) => a + (t.qtd || 0), 0);
  return { data, solida: { qtd, nomes }, terceiros, total: total != null ? Number(total) : qtd + totalTer };
}
