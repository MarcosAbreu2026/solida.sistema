// Caixinha BeeVale (POP ADM 11.11) — regras da importação: mapeamento de colunas configurável, validação do arquivo,
// separação de gastos × recargas × transferências, e as impressões digitais que impedem importar em dobro.
// Sem tela e sem banco aqui: só funções puras (a tela e o armazenamento ficam em telas/caixinha.js).

export const CAMPOS = [
  { id: 'data', rotulo: 'Data da movimentação', obrigatorio: true, sinonimos: ['data', 'data da transacao', 'data transacao', 'data da compra', 'data movimentacao', 'dt'] },
  { id: 'valor', rotulo: 'Valor', obrigatorio: true, sinonimos: ['valor', 'valor r$', 'valor (r$)', 'valor da transacao', 'montante', 'total'] },
  { id: 'estabelecimento', rotulo: 'Estabelecimento / descrição', obrigatorio: false, sinonimos: ['estabelecimento', 'descricao', 'historico', 'local', 'comerciante', 'favorecido'] },
  { id: 'tipo', rotulo: 'Tipo (gasto, recarga, transferência)', obrigatorio: false, sinonimos: ['tipo', 'tipo de transacao', 'tipo da transacao', 'operacao', 'movimentacao', 'natureza'] },
  { id: 'saldo', rotulo: 'Saldo depois da movimentação', obrigatorio: false, sinonimos: ['saldo', 'saldo final', 'saldo disponivel'] },
  { id: 'responsavel', rotulo: 'Nome do responsável (portador)', obrigatorio: false, sinonimos: ['responsavel', 'portador', 'nome', 'usuario', 'titular', 'nome do portador'] },
];

// o que fica salvo (configurável pelo ADM): coluna de cada campo e as palavras que dizem o tipo da movimentação
export const MAPEAMENTO_PADRAO = {
  colunas: {},
  palavras: { gasto: 'compra, gasto, débito, debito, pagamento, saque', recarga: 'recarga, crédito, credito, carga, aporte, estorno', transferencia: 'transferência, transferencia, transf' },
  semTipo: 'negativo',   // sem coluna de tipo: valor negativo = gasto, positivo = recarga ('positivo' inverte)
};

const sem = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const lista = (t) => String(t || '').split(',').map(sem).filter(Boolean);

// linha do cabeçalho: a que tem mais células preenchidas nas primeiras 15 linhas (a primeira, se empatar)
export function acharCabecalho(linhas) {
  let melhor = 0; let n = -1;
  linhas.slice(0, 15).forEach((l, i) => { const c = l.filter((x) => String(x).trim() !== '').length; if (c > n) { n = c; melhor = i; } });
  return melhor;
}
// sugere a coluna de cada campo pelo nome do título (o ADM confirma)
export function adivinhar(cabecalho, salvo = {}) {
  const out = {};
  for (const c of CAMPOS) {
    const guardado = salvo[c.id];
    if (guardado && cabecalho.some((h) => sem(h) === sem(guardado))) { out[c.id] = guardado; continue; }
    const i = cabecalho.findIndex((h) => c.sinonimos.includes(sem(h)));
    out[c.id] = i >= 0 ? String(cabecalho[i]) : '';
  }
  return out;
}

export function lerNumero(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v ?? '').trim(); if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /-\s*$/.test(s) || /^-/.test(s) || /^r\$\s*-/i.test(s);
  s = s.replace(/[^\d,.]/g, '');
  if (!/\d/.test(s)) return null;
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}
export function lerData(v) {
  const s = String(v ?? '').trim(); if (!s) return null;
  let a; let m; let d;
  let r = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (r) { a = +r[1]; m = +r[2]; d = +r[3]; } else if ((r = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) { d = +r[1]; m = +r[2]; a = +r[3]; if (a < 100) a += 2000; } else return null;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

// classifica uma movimentação: gasto · recarga · transferencia · null (não reconhecida)
function classificar(tipoTxt, valor, mapa) {
  if (mapa.colunas.tipo) {
    const t = sem(tipoTxt);
    for (const k of ['transferencia', 'recarga', 'gasto']) if (lista(mapa.palavras[k]).some((p) => t.includes(p))) return k;   // transferência e recarga primeiro: "débito" pode aparecer em "transferência (débito)"
    return null;
  }
  return (valor < 0) === (mapa.semTipo !== 'positivo') ? 'gasto' : 'recarga';
}

// valida e separa. linhas = todas as linhas da planilha; cab = índice da linha de cabeçalho
export function analisar(linhas, cab, mapa) {
  const cabecalho = (linhas[cab] || []).map((x) => String(x ?? ''));
  const col = {};
  const erros = []; const avisos = [];
  for (const c of CAMPOS) {
    const nome = mapa.colunas[c.id];
    if (!nome) { if (c.obrigatorio) erros.push({ linha: null, msg: `Falta indicar a coluna "${c.rotulo}".` }); continue; }
    const i = cabecalho.findIndex((h) => sem(h) === sem(nome));
    if (i < 0) erros.push({ linha: null, msg: `A coluna "${nome}" (${c.rotulo}) não existe neste arquivo. Colunas encontradas: ${cabecalho.filter(Boolean).join(', ') || 'nenhuma'}.` });
    else col[c.id] = i;
  }
  const out = { gastos: [], recargas: 0, transferencias: 0, erros, avisos, periodo: null, saldo: null, responsaveis: [], linhasLidas: 0 };
  if (erros.length) return out;
  const datas = []; const nomes = new Set();
  for (let i = cab + 1; i < linhas.length; i++) {
    const l = linhas[i] || [];
    if (!l.some((x) => String(x ?? '').trim() !== '')) continue;
    const n = i + 1; out.linhasLidas++;
    const data = lerData(l[col.data]); const valor = lerNumero(l[col.valor]);
    if (!data) { erros.push({ linha: n, msg: `Linha ${n}: data inválida ("${l[col.data] ?? ''}").` }); continue; }
    if (valor === null) { erros.push({ linha: n, msg: `Linha ${n}: valor não numérico ("${l[col.valor] ?? ''}").` }); continue; }
    datas.push(data);
    if (col.responsavel != null && String(l[col.responsavel] ?? '').trim()) nomes.add(String(l[col.responsavel]).trim());
    if (col.saldo != null) { const s = lerNumero(l[col.saldo]); if (s !== null) out.saldo = { valor: s, data }; }
    const tipo = classificar(col.tipo != null ? l[col.tipo] : '', valor, mapa);
    if (!tipo) { erros.push({ linha: n, msg: `Linha ${n}: não sei se "${l[col.tipo] ?? ''}" é gasto, recarga ou transferência. Ajuste as palavras do tipo no mapeamento.` }); continue; }
    if (tipo === 'recarga') { out.recargas++; continue; }
    if (tipo === 'transferencia') { out.transferencias++; continue; }
    out.gastos.push({ data, valor: Math.round(Math.abs(valor) * 100) / 100, estabelecimento: col.estabelecimento != null ? String(l[col.estabelecimento] ?? '').trim() : '', linha: n });
  }
  if (datas.length) { const o = [...datas].sort(); out.periodo = { ini: o[0], fim: o[o.length - 1] }; }
  else if (!erros.length) erros.push({ linha: null, msg: 'O arquivo não tem nenhuma movimentação abaixo do cabeçalho.' });
  out.responsaveis = [...nomes];
  if (!out.gastos.length && !erros.length) avisos.push('Não há gastos neste arquivo (só recargas ou transferências).');
  if (col.saldo == null) avisos.push('Sem coluna de saldo: o saldo do cartão não será atualizado por este arquivo.');
  return out;
}

// impressão digital (SHA-256) de texto e de cada gasto; gastos idênticos no mesmo arquivo ganham ordem (1ª, 2ª…) para não se confundirem
export async function sha256(texto) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function hashDoArquivo(arquivo) {
  const b = await crypto.subtle.digest('SHA-256', await arquivo.arrayBuffer());
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function comImpressao(gastos, cartaoId) {
  const visto = new Map();
  const out = [];
  for (const g of gastos) {
    const base = `${cartaoId}|${g.data}|${g.valor.toFixed(2)}|${sem(g.estabelecimento)}`;
    const k = (visto.get(base) || 0) + 1; visto.set(base, k);
    out.push({ ...g, linha_hash: await sha256(`${base}|${k}`) });
  }
  return out;
}

// sugestão (nunca vínculo automático): o usuário cujo nome mais combina com o nome do BeeVale
export function sugerirUsuario(nomeBeevale, usuarios) {
  const alvo = sem(nomeBeevale).split(' ').filter((p) => p.length > 1);
  if (!alvo.length) return null;
  let melhor = null; let pontos = 0;
  for (const u of usuarios) {
    const nome = sem(u.nome).split(' ');
    const p = alvo.filter((a) => nome.includes(a)).length;
    if (p > pontos) { pontos = p; melhor = u; }
  }
  return melhor;
}
