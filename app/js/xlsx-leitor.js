// Leitor de .xlsx sem biblioteca: o arquivo é um zip de XMLs; o navegador descompacta (DecompressionStream) e lemos as células.
// Devolve as linhas da planilha como listas de valores: texto, número ou data (já em AAAA-MM-DD quando a célula tem formato de data).

const u16 = (v, o) => v.getUint16(o, true);
const u32 = (v, o) => v.getUint32(o, true);
const dec = new TextDecoder('utf-8');

async function inflar(bytes) {
  const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

// nome do arquivo dentro do zip → função que devolve o conteúdo em texto
function abrirZip(buf) {
  const v = new DataView(buf); const bytes = new Uint8Array(buf);
  let fim = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) { if (u32(v, i) === 0x06054b50) { fim = i; break; } }
  if (fim < 0) throw new Error('O arquivo não é um Excel (.xlsx) válido.');
  const n = u16(v, fim + 10); let p = u32(v, fim + 16);
  const itens = new Map();
  for (let k = 0; k < n; k++) {
    if (u32(v, p) !== 0x02014b50) break;
    const metodo = u16(v, p + 10); const tam = u32(v, p + 20);
    const nl = u16(v, p + 28); const el = u16(v, p + 30); const cl = u16(v, p + 32); const lh = u32(v, p + 42);
    itens.set(dec.decode(bytes.subarray(p + 46, p + 46 + nl)), { metodo, tam, lh });
    p += 46 + nl + el + cl;
  }
  return async (nome) => {
    const it = itens.get(nome); if (!it) return null;
    const ini = it.lh + 30 + u16(v, it.lh + 26) + u16(v, it.lh + 28);
    const dados = bytes.subarray(ini, ini + it.tam);
    return dec.decode(it.metodo === 0 ? dados : await inflar(dados));
  };
}

const xml = (t) => new DOMParser().parseFromString(t, 'application/xml');
const filhos = (no, nome) => [...no.getElementsByTagName(nome)];
const colunaDe = (ref) => { let n = 0; for (const c of String(ref).replace(/\d/g, '')) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };

// formatos de data embutidos no Excel + os personalizados que têm d/m/a
const DATAS_PADRAO = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
const iso = (serial) => new Date(Math.round((serial - 25569) * 86400000)).toISOString().slice(0, 10);

export async function lerXlsx(arquivo, { planilha = 0 } = {}) {
  const ler = abrirZip(await arquivo.arrayBuffer());
  const livro = await ler('xl/workbook.xml');
  if (!livro) throw new Error('O arquivo não é um Excel (.xlsx) válido.');
  const nomes = filhos(xml(livro), 'sheet').map((s) => s.getAttribute('name'));
  const rels = await ler('xl/_rels/workbook.xml.rels');
  const alvos = new Map(filhos(xml(rels || '<r/>'), 'Relationship').map((r) => [r.getAttribute('Id'), r.getAttribute('Target')]));
  const idPlan = filhos(xml(livro), 'sheet').map((s) => s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'))[planilha];
  let alvo = alvos.get(idPlan) || `worksheets/sheet${planilha + 1}.xml`;
  alvo = alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo}`;
  const folha = await ler(alvo);
  if (!folha) throw new Error('Não encontrei a planilha dentro do arquivo.');

  const ss = await ler('xl/sharedStrings.xml');
  const textos = ss ? filhos(xml(ss), 'si').map((si) => filhos(si, 't').map((t) => t.textContent).join('')) : [];
  // quais estilos (cellXfs) são data
  const est = await ler('xl/styles.xml'); const ehData = [];
  if (est) {
    const doc = xml(est);
    const custom = new Map(filhos(doc, 'numFmt').map((f) => [Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode') || '']));
    const xfs = doc.getElementsByTagName('cellXfs')[0];
    if (xfs) for (const x of [...xfs.children]) {
      const id = Number(x.getAttribute('numFmtId') || 0);
      ehData.push(DATAS_PADRAO.has(id) || (custom.has(id) && /[dmy]/i.test(custom.get(id).replace(/"[^"]*"|\[[^\]]*\]/g, '')) && !/^general$/i.test(custom.get(id))));
    }
  }

  const linhas = [];
  for (const tr of filhos(xml(folha), 'row')) {
    const lin = [];
    for (const c of [...tr.children].filter((e) => e.localName === 'c')) {
      const tipo = c.getAttribute('t'); const e = Number(c.getAttribute('s') || 0);
      const v = c.getElementsByTagName('v')[0]; const bruto = v ? v.textContent : '';
      let val = '';
      if (tipo === 's') val = textos[Number(bruto)] ?? '';
      else if (tipo === 'inlineStr') val = filhos(c, 't').map((t) => t.textContent).join('');
      else if (tipo === 'str' || tipo === 'e') val = bruto;
      else if (tipo === 'b') val = bruto === '1' ? 'sim' : 'não';
      else if (bruto !== '') { const n = Number(bruto); val = ehData[e] && Number.isFinite(n) ? iso(n) : n; }
      lin[colunaDe(c.getAttribute('r') || 'A1')] = val;
    }
    const r = Number(tr.getAttribute('r')) || linhas.length + 1;
    linhas[r - 1] = Array.from(lin, (x) => (x === undefined ? '' : x));
  }
  return { planilhas: nomes, linhas: Array.from(linhas, (l) => l || []) };
}
