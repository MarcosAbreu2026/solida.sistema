// Leitor de atas: transforma o texto de uma ata (PDF, .txt ou colado) num rascunho de ata com pendências.
// Sem IA paga (regra do projeto): são regras de leitura, em duas camadas.
//  1. Padrão de ata da Sólida (tabela ITEM · TIPO · RESPONSÁVEL · DATA LIMITE, com "ATA DE REUNIÃO dd.mm.aaaa MoXXX
//     R00", LOCAL e PARTICIPANTES com a empresa entre parênteses): lê a tabela pela posição de cada coluna no PDF.
//     PENDÊNCIA vira pendência; INFORMATIVO vai para o texto da ata. O responsável pode ser de fora da Sólida
//     (cliente, arquitetura, terceirizado): o papel vem dos participantes.
//  2. Qualquer outro texto: acha título, data, obra e as linhas que parecem ação ("Enviar a planilha até 25/10",
//     "Larissa: cobrar a Humber", itens sob "Ações" ou "Pendências"), com responsável e prazo.
// O rascunho sempre passa por conferência antes de salvar: onde o leitor não tem certeza, deixa em branco.

const VERBOS = 'enviar|mandar|cobrar|verificar|conferir|fazer|entregar|definir|agendar|marcar|revisar|atualizar|comprar|solicitar|pedir|providenciar|criar|contratar|confirmar|ligar|retornar|alinhar|preparar|organizar|passar|levar|buscar|trocar|corrigir|instalar|medir|orçar|lançar|cadastrar|reunir|acompanhar|validar|aprovar|programar|resolver|ver|checar|emitir|cotar|negociar|imprimir|publicar|separar|retirar|devolver|lembrar|analisar|finalizar|concluir|incluir|protocolar|formalizar|regularizar|reforçar|treinar|divulgar|montar|rever|ajustar|avisar|informar|responder|encaminhar|repassar';
const RE_VERBO = new RegExp(`^(?:[\\p{L}][\\p{L}.\\s]{0,30}?\\s*[:\\-–—]\\s*)?(?:${VERBOS})\\b`, 'iu');
const RE_MARCADOR = /^\s*(?:[-–—•*·▪●○□☐■▶>]+|\[\s?[xX ]?\s?\]|\d{1,2}[.)])\s*/u;
const RE_SECAO_ACOES = /^\s*(?:a[çc][õo]es?|pend[êe]ncias?|encaminhamentos?|pr[óo]ximos passos|tarefas|a fazer|to-?do|delibera[çc][õo]es|a[çc][õo]es a tomar|combinados)\b[^\n]{0,40}$/iu;
const RE_SECAO_OUTRA = /^\s*(?:pauta|assuntos?|participantes|presentes|presen[çc]a|resumo|decis[õo]es|observa[çc][õo]es|informes?|discuss[ãa]o|ata\b|local|data|hor[áa]rio)\b[^\n]{0,60}$/iu;

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const primeiroNome = (nome) => norm(nome).replace(/\(.*?\)/g, ' ').split(/[\s.]+/).filter((t) => t.length >= 2)[0] || '';
const DIAS = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const capitalizar = (s) => String(s).toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const doIso = (s) => new Date(`${s}T12:00:00`);
const somar = (s, n) => { const d = doIso(s); d.setDate(d.getDate() + n); return iso(d); };

// "25/10", "25/10/26", "25/10/2026". Sem ano: o ano da referência (data da ata); se cair muito antes dela, o ano seguinte
function dataBR(m, ref) {
  const dia = Number(m[1]); const mes = Number(m[2]); if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  let ano = m[3] ? Number(m[3]) : Number(ref.slice(0, 4)); if (ano < 100) ano += 2000;
  let r = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  if (!m[3] && r < somar(ref, -45)) r = `${ano + 1}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  return Number.isNaN(doIso(r).getTime()) ? null : r;
}

// prazo escrito: data, "dia 28", "amanhã", "hoje" ou "até sexta" (hoje = base das palavras; ref = referência do ano)
export function acharPrazo(linha, hoje, ref = hoje) {
  const t = linha;
  let m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) { const d = dataBR(m, ref); if (d) return d; }
  m = t.match(/\bdia\s+(\d{1,2})\b/i);
  if (m) { const dia = Number(m[1]); const d = doIso(ref); let r = new Date(d.getFullYear(), d.getMonth(), dia, 12); if (iso(r) < ref) r = new Date(d.getFullYear(), d.getMonth() + 1, dia, 12); return iso(r); }
  if (/\bamanh[ãa](?![\p{L}])/iu.test(t)) return somar(hoje, 1);
  if (/\bhoje\b/i.test(t)) return hoje;
  m = norm(t).match(/\b(?:ate|para|na|no|ate a|ate o)\s+(?:a\s+|o\s+)?(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira| feira)?\b/);
  if (m) { const alvo = DIAS[m[1]]; const atual = doIso(ref).getDay(); return somar(ref, (alvo - atual + 7) % 7 || 7); }
  return '';
}

// pessoa da Sólida citada na linha, pelo primeiro nome (se o nome for ambíguo, não escolhe)
export function acharResponsavel(linha, pessoas) {
  const t = norm(linha);
  const preferido = t.match(/(?:respons[aá]vel|resp\.?)\s*[:\-]\s*([a-z]+)/);
  const candidatos = [];
  for (const p of pessoas) {
    const pn = primeiroNome(p.nome); if (pn.length < 3) continue;
    const m = t.match(new RegExp(`(?:^|[^a-z])${pn}(?![a-z])`)); if (m) candidatos.push({ p, pos: m.index, pn });
  }
  if (!candidatos.length) return null;
  const nomes = new Map(); for (const c of candidatos) { if (!nomes.has(c.pn)) nomes.set(c.pn, []); nomes.get(c.pn).push(c); }
  let escolhido = null;
  if (preferido) escolhido = [...nomes.keys()].find((n) => n === preferido[1]);
  if (!escolhido) escolhido = [...nomes.values()].sort((a, b) => a[0].pos - b[0].pos)[0][0].pn;
  const lista = nomes.get(escolhido);
  return lista.length === 1 ? lista[0].p : { ambiguo: true, nome: escolhido };
}

function limpar(linha, resp) {
  let t = linha.replace(RE_MARCADOR, '').trim();
  t = t.replace(/\b(?:respons[aá]vel|resp\.?)\s*[:\-]\s*[^,;.\n()]+/iu, '').replace(/\bprazo\s*[:\-]\s*[^,;.\n()]+/iu, '');
  t = t.replace(/\baté\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/iu, '').replace(/\s*\(\s*\)/g, '');
  if (resp && !resp.ambiguo) { const pn = primeiroNome(resp.nome); t = t.replace(new RegExp(`^${pn}[\\p{L}.]*\\s*[:\\-–—]\\s*`, 'iu'), ''); }
  return t.replace(/\s{2,}/g, ' ').replace(/[\s,;:–—-]+$/u, '').trim();
}

// ---------------------------------------------------------------- participantes e papéis
// participante sem o nome inteiro: só o primeiro nome (Ana Clara, Maria Eduarda… ficam com os dois) e o papel curto (Sólida, Cliente, Arquitetura)
const PRIMEIROS_COMPOSTOS = new Set(['ana', 'maria', 'joao', 'jose', 'luiz', 'luis']);
export function nomeCurto(nome) {
  const t = String(nome || '').trim().split(/\s+/).filter(Boolean); if (t.length <= 1) return t[0] || '';
  const composto = t.length > 2 && PRIMEIROS_COMPOSTOS.has(norm(t[0])) && !/^(de|da|do|dos|das|e)$/i.test(t[1]);
  return composto ? t[0] + ' ' + t[1] : t[0];
}
export const papelCurto = (txt) => { const t = norm(txt); return /solida/.test(t) ? 'Sólida' : /cliente/.test(t) ? 'Cliente' : /arquitet/.test(t) ? 'Arquitetura' : String(txt || '').trim(); };
const papelDe = (txt) => { const t = norm(txt); return /solida/.test(t) ? 'solida' : /cliente/.test(t) ? 'cliente' : /arq/.test(t) ? 'arquitetura' : 'terceirizado'; };
// "Fernanda (Arquitetura), Marcos (Sólida) e Julio (Cliente)" → [{ nome, papel, texto }]
function lerParticipantes(texto) {
  const lista = [];
  for (const pedaco of texto.split(/,|;|\se\s(?=[\p{Lu}])/u).map((s) => s.trim()).filter(Boolean)) {
    const m = pedaco.replace(/[.\s]+$/u, '').match(/^(.+?)\s*\(([^)]*)\)\s*$/u);
    if (m) lista.push({ nome: m[1].trim(), papel: papelDe(m[2]), texto: `${nomeCurto(m[1].trim())} (${papelCurto(m[2])})` });
    else lista.push({ nome: pedaco, papel: '', texto: nomeCurto(pedaco) });
  }
  return lista;
}
// ata em texto corrido: "Marcos Construtora Sólida", "Júlio Cliente", "Bárbara Arquitetura"
function participantesEmTabela(linhas) {
  const lista = [];
  for (const l of linhas) {
    // nome: palavras com inicial maiúscula (e "de", "da", "do"…); uma frase como "Reunião online entre a Construtora Sólida…" não é participante
    const m = l.trim().match(/^(\p{Lu}[\p{L}]+(?:\s(?:de|da|do|dos|das|\p{Lu}[\p{L}]+)){0,5}?)\s+(Construtora S[óo]lida|S[óo]lida|Cliente|Arquitetura)(?![\p{L}])/u);
    if (m && !/^nome$/i.test(m[1].trim())) lista.push({ nome: m[1], papel: papelDe(m[2]), texto: `${nomeCurto(m[1])} (${papelCurto(m[2])})` });
  }
  return lista;
}

// quem é o responsável: pessoa da Sólida com login, participante de fora (cliente, arquitetura…) ou nome solto
function resolverResponsavel(texto, participantes, pessoas) {
  const partes = String(texto || '').split(/,|\se\s|\/|\+/i).map((s) => s.trim()).filter(Boolean);
  if (!partes.length) return { responsavel: '', externoNome: '', externoTipo: '', extras: [] };
  const un = (nome) => pessoas.filter((p) => primeiroNome(p.nome) === primeiroNome(nome));
  const um = (parte) => {
    const nt = norm(parte).replace(/[.]/g, '').trim();
    if (/^a definir|^sem responsavel|^-+$/.test(nt)) return {};   // "A definir" não é uma pessoa
    if (/^(encarregad[oa]s?|mestre de obras?|gestor(a)?|equipe)$/.test(nt)) return {};   // cargo, não uma pessoa: quem confere escolhe
    // só o lado ("Arquitetura", "Cliente", "Sólida"), sem o nome da pessoa: o tipo vem preenchido; o nome só se houver UM participante daquele lado
    // (ex.: Ana Clara, a única da arquitetura); senão fica em branco para quem confere escrever
    const doLado = (lado) => { const ps = participantes.filter((p) => p.papel === lado); return { externoNome: lado !== 'solida' && ps.length === 1 ? nomeCurto(ps[0].nome) : '', externoTipo: lado }; };
    if (nt === 'arquitetura' || nt === 'arquiteta' || nt === 'arquiteto') return doLado('arquitetura');
    if (nt === 'cliente') return doLado('cliente');
    if (nt === 'solida') return doLado('solida');
    const pn = primeiroNome(parte);
    const part = participantes.find((p) => primeiroNome(p.nome) === pn && pn.length >= 3);
    if (part && part.papel && part.papel !== 'solida') return part.papel === 'arquitetura' ? { externoNome: part.nome, externoTipo: 'terceirizado', externoCategoria: 'Arquitetura' } : { externoNome: part.nome, externoTipo: part.papel };
    const achados = un(parte);
    if (achados.length === 1) return { responsavel: achados[0].id };
    if (achados.length > 1) return { ambiguo: pn };
    if (part) return { externoNome: nomeCurto(part.nome), externoTipo: 'solida' };      // da Sólida, mas sem login no sistema
    return { externoNome: capitalizar(parte), externoTipo: 'terceirizado' };
  };
  const r = um(partes[0]);
  return { responsavel: r.responsavel || '', externoNome: r.externoNome || '', externoTipo: r.externoTipo || '', externoCategoria: r.externoCategoria || '', ambiguo: r.ambiguo || '', extras: partes.slice(1) };
}

// ---------------------------------------------------------------- tabela do PDF (padrão de ata da Sólida)
const RE_TIPO = /^(PEND[ÊE]NCIAS?|INFORMATIVOS?|DECIS[ÃA]O|DECIS[ÕO]ES|A[ÇC][ÃA]O|PROVID[ÊE]NCIAS?)$/iu;
// cada item do padrão da Sólida abre com o assunto em maiúsculas e dois-pontos: "ESCADA:", "DESNÍVEL / ENCHIMENTO:"
const RE_ASSUNTO_ABRE = /^[A-ZÀ-ÚÇ0-9][A-ZÀ-ÚÇ0-9 ,/.\-–()]*:$/u;

// junta pedaços da mesma linha: o PDF parte palavras e números ("Pé" "-" "direito", "0" "9" "/11"); pedaço que encosta no anterior não leva espaço
function juntarFragmentos(itens) {
  let s = '';
  itens.forEach((it, k) => {
    if (!k) { s = it.str; return; }
    const prev = itens[k - 1]; const gap = it.x - (prev.x + (prev.w || 0));
    s += (prev.w != null && gap < 1.2 ? '' : ' ') + it.str;
  });
  return s;
}

function agruparLinhas(itens) {
  const ord = [...itens].sort((a, b) => b.y - a.y || a.x - b.x); const linhas = [];
  for (const it of ord) { const l = linhas.find((x) => Math.abs(x.y - it.y) <= 2.5); if (l) l.itens.push(it); else linhas.push({ y: it.y, itens: [it] }); }
  linhas.forEach((l) => l.itens.sort((a, b) => a.x - b.x));
  return linhas.sort((a, b) => b.y - a.y);
}
const textoDaLinha = (l) => juntarFragmentos(l.itens);

function lerTabela(paginas) {
  const todas = paginas.map((p) => agruparLinhas(p));
  let xItem = null; let xTipo = null; let xDesc = null; let xResp = null; let xData = null; let achouCab = false;
  for (const ls of todas) {
    for (const l of ls) {
      const t = textoDaLinha(l);
      if (/\bITEM\b/i.test(t) && /\bTIPO\b/i.test(t) && /RESPONS/i.test(t)) {
        const it = (re) => l.itens.find((i) => re.test(i.str));
        const separados = l.itens.length >= 4;
        if (separados) { xItem = (it(/^ITEM/i) || {}).x; xTipo = (it(/^TIPO/i) || {}).x; xDesc = (it(/^DESCRI/i) || {}).x; xResp = (it(/RESPONS/i) || {}).x; xData = (it(/^DATA/i) || {}).x; }
        achouCab = true; break;
      }
    }
    if (achouCab) break;
  }
  if (!achouCab || xResp == null || xTipo == null) return null;
  const fimTipo = xDesc != null ? xTipo + 0.3 * (xDesc - xTipo) : xTipo + 40;   // onde acaba a coluna ITEM/TIPO
  const marcadores = []; const soltas = []; const descSeq = [];
  let terminou = false;
  todas.forEach((ls, pi) => {
    if (terminou) return;
    let comecou = false; const temCab = ls.some((l) => { const t = textoDaLinha(l); return /\bITEM\b/i.test(t) && /RESPONS/i.test(t); });
    for (const l of ls) {
      const t = textoDaLinha(l);
      if (!comecou) { if (temCab) { if (/\bITEM\b/i.test(t) && /RESPONS/i.test(t)) comecou = true; continue; } comecou = true; }
      // a tabela acaba no próximo título de seção, na margem esquerda ("ESCOPO DE SERVIÇOS"): o que vem depois não é item
      const primeiro = l.itens[0];
      if (xItem != null && primeiro && primeiro.x < xItem - 3 && /^[A-ZÀ-ÚÇ][A-ZÀ-ÚÇ0-9 /.,\-–]{5,}$/u.test(t.trim())) { terminou = true; break; }
      const [a, b] = l.itens;
      let n = null; let resto = l.itens;
      const junto = a && a.str.trim().match(/^(\d{1,3})\s+(\S+)$/u);
      if (a && /^\d{1,3}$/.test(a.str.trim()) && a.x < xTipo + 4 && b && RE_TIPO.test(b.str.trim())) { n = { n: Number(a.str.trim()), tipo: b.str.trim() }; resto = l.itens.slice(2); }
      else if (junto && RE_TIPO.test(junto[2]) && a.x < xTipo + 4) { n = { n: Number(junto[1]), tipo: junto[2] }; resto = l.itens.slice(1); }
      const col = (i) => (xData != null && i.x >= xData - 6 ? 'prazo' : i.x >= xResp - 6 ? 'resp' : 'desc');
      const m = { pagina: pi, y: l.y, desc: [], resp: [], prazo: [] };
      for (const i of resto) { if (i.x < fimTipo) continue; m[col(i)].push({ y: l.y, x: i.x, w: i.w, s: i.str.trim() }); }
      if (m.desc.length) descSeq.push({ pagina: pi, y: l.y, frags: m.desc });
      if (n) marcadores.push({ ...m, ...n }); else soltas.push(m);
    }
  });
  if (!marcadores.length) return null;
  // 1) padrão da Sólida: cada descrição abre com "ASSUNTO:"; o k-ésimo bloco é do k-ésimo item (a coluna da esquerda fica no meio
  //    da linha e a descrição no alto, então a posição vertical não serve para casar os dois)
  const blocos = [];
  for (const dl of descSeq) {
    const abre = RE_ASSUNTO_ABRE.test((dl.frags[0] || {}).s || '');
    if (abre || !blocos.length) blocos.push([dl]); else blocos[blocos.length - 1].push(dl);
  }
  const porBloco = blocos.length === marcadores.length && blocos.every((b) => RE_ASSUNTO_ABRE.test((b[0].frags[0] || {}).s || ''));
  const junta = (xs) => {
    const ord = [...xs].sort((p, q) => (p.pagina ?? 0) - (q.pagina ?? 0) || q.y - p.y || p.x - q.x);
    let s = ''; let prev = null;
    for (const x of ord) {
      if (prev) {
        const mesmaLinha = prev.pagina === x.pagina && Math.abs(prev.y - x.y) <= 2.5;
        const encosta = mesmaLinha && prev.w != null && (x.x - (prev.x + prev.w)) < 1.2;
        const hifenNoFim = !mesmaLinha && /[\p{L}]-$/u.test(s);   // "guarda-" no fim da linha e "corpo" na seguinte: uma palavra só
        s += encosta || hifenNoFim ? '' : ' ';
      }
      s += x.s; prev = x;
    }
    return s.replace(/\s+/g, ' ').trim();
  };
  if (porBloco) {
    marcadores.forEach((mk, k) => { mk.descFinal = junta(blocos[k].flatMap((dl) => dl.frags.map((f) => ({ ...f, pagina: dl.pagina })))); });
  }
  // resp e data limite ficam centralizados na linha do item: vão para o item mais perto, na mesma página
  for (const s of soltas) {
    let melhor = null; let dist = Infinity;
    for (const mk of marcadores.filter((x) => x.pagina === s.pagina)) { const d = Math.abs(mk.y - s.y); if (d < dist) { dist = d; melhor = mk; } }
    if (porBloco) { if (melhor && dist <= 48) { melhor.resp.push(...s.resp); melhor.prazo.push(...s.prazo); } continue; }
    const doAnterior = !melhor || (marcadores.filter((x) => x.pagina === s.pagina).every((x) => x.y < s.y) && s.pagina > 0);
    if (doAnterior) { const ant = [...marcadores].reverse().find((x) => x.pagina < s.pagina); if (ant) melhor = ant; }
    if (!melhor || (dist > 48 && !doAnterior)) continue;
    melhor.desc.push(...s.desc); melhor.resp.push(...s.resp); melhor.prazo.push(...s.prazo);
  }
  const comPagina = (mk, campo) => mk[campo].map((f) => ({ ...f, pagina: mk.pagina }));
  return marcadores.map((m) => ({ n: m.n, tipo: m.tipo, descricao: porBloco ? m.descFinal : junta(comPagina(m, 'desc')), responsavel: junta(comPagina(m, 'resp')), prazo: junta(comPagina(m, 'prazo')) }));
}

// "ESCADA: Definir o tipo" → "ESCADA, Definir o tipo" (a primeira caixinha do formulário é o assunto, a segunda o descritivo); vírgula dentro do assunto vira " /"
function assuntoEDescritivo(desc) {
  const t = String(desc || '').trim();
  const m = t.match(/^([A-ZÀ-ÚÇ0-9][A-ZÀ-ÚÇ0-9 ,/.\-–()]*?):\s+(\S[\s\S]*)$/u);
  if (!m) return t.charAt(0).toUpperCase() + t.slice(1);
  const assunto = m[1].replace(/\s*,\s*/g, ' / ').replace(/\s+/g, ' ').trim(); const resto = m[2].trim();
  return assunto + ', ' + resto.charAt(0).toUpperCase() + resto.slice(1);
}

// ---------------------------------------------------------------- ata de VISTORIA (Checklist de Verificação em Obra)
// Cabeçalho (Obra, Data, Gestor, Vistoria por, Referência), RESULTADO DA VISTORIA (conforme / não conforme por seção, itens conformes, observação) e a tabela
// OBSERVAÇÕES E PENDÊNCIAS: Tema · Pendência · Responsável · Prazo. O resultado vira o texto da ata (resumo); cada linha da tabela vira uma pendência
// (assunto = tema). Prazo "[A DEFINIR]" fica em branco para quem confere. Lê as colunas pela posição no PDF.
export const ehAtaDeVistoria = (texto) => /ATA\s+DE\s+VISTORIA/i.test(String(texto || ''));
function tabelaVistoria(paginas) {
  const linhasDe = (area, de, ate) => agruparLinhas(area.filter((it) => it.x >= de && it.x < ate)).map((l) => ({ y: l.y, txt: textoDaLinha(l) }));
  const itens = [];
  for (const pag of paginas) {
    const cab = (nome) => pag.find((it) => norm(it.str.trim()) === nome);
    const hTema = cab('tema'); const hPend = cab('pendencia'); const hResp = cab('responsavel'); const hPrazo = cab('prazo');
    if (!hTema || !hPend || !hResp || !hPrazo) continue;
    const area = pag.filter((it) => it.y < hTema.y - 3);
    const b1 = hPend.x - 6; const b2 = hResp.x - 6; const b3 = hPrazo.x - 6;
    const prazos = linhasDe(area, b3, 1e9); if (!prazos.length) continue;
    const ys = prazos.map((p) => p.y);
    const pendL = repartir(linhasDe(area, b1, b2), ys);
    const perto = (linhas, y) => linhas.filter((l) => Math.abs(l.y - y) <= 14).sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0];
    const temaL = linhasDe(area, hTema.x - 6, b1); const respL = linhasDe(area, b2, b3);
    prazos.forEach((p, i) => {
      itens.push({ tema: (perto(temaL, p.y) || {}).txt || '', pendencia: emendar(pendL[i].map((l) => l.txt)), responsavel: (perto(respL, p.y) || {}).txt || '', prazo: p.txt });
    });
  }
  return itens.filter((x) => x.pendencia);
}
// texto da ata: tudo o que vem no PDF antes da tabela de pendências (vistoria por, referência, resultado por seção, itens conformes, observação)
function resumoVistoria(texto) {
  const linhas = String(texto || '').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const ini = linhas.findIndex((l) => /^INFORMA[ÇC][ÕO]ES DA VISTORIA/i.test(l)); const fim = linhas.findIndex((l) => /^OBSERVA[ÇC][ÕO]ES E PEND[ÊE]NCIAS/i.test(l));
  const corpo = linhas.slice(ini >= 0 ? ini + 1 : 0, fim >= 0 ? fim : linhas.length);
  const out = []; let secoes = false; let ultimo = -1;
  for (const l of corpo) {
    if (/^RESULTADO DA VISTORIA/i.test(l)) { out.push('', 'Resultado da vistoria:'); secoes = true; continue; }
    if (/^Se[çc][ãa]o\s+Conforme\s+N[ãa]o conforme/i.test(l)) continue;
    let m = secoes && l.match(/^(.+?)\s+(\d+)\s+(\d+)$/);
    if (m) { out.push(`${m[1]}: ${m[2]} ${Number(m[2]) === 1 ? 'conforme' : 'conformes'}, ${m[3]} ${Number(m[3]) === 1 ? 'não conforme' : 'não conformes'}`); ultimo = -1; continue; }
    if (/^(Obra|Data|Gestor)/i.test(l)) continue;   // já vão para os campos da ata
    if (/^(Itens conformes|Observa[çc][ãa]o)\s*:/i.test(l)) { out.push(l); ultimo = out.length - 1; continue; }
    if (/^(Vistoria por|Refer[êe]ncia)\s*:/i.test(l)) { out.push(l); ultimo = out.length - 1; continue; }
    if (ultimo >= 0) out[ultimo] += ` ${l}`; else out.push(l);   // linha que continua a anterior (texto quebrado)
  }
  // "Vistoria por" e "Referência" primeiro, depois o resultado
  const cab = out.filter((l) => /^(Vistoria por|Refer[êe]ncia)\s*:/i.test(l)); const resto = out.filter((l) => !/^(Vistoria por|Refer[êe]ncia)\s*:/i.test(l));
  return [...cab, ...resto].join('\n').replace(/^\n+/, '').trim();
}

// ---------------------------------------------------------------- análise
export function analisarAta(texto, { pessoas = [], obras = [], setores = [], hoje, nomeArquivo = '', paginas = null } = {}) {
  const linhas = String(texto || '').replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/, ''));
  const naoVazias = linhas.filter((l) => l.trim());
  // data: "10.07.2026", "10/07/2026" ou "01 de outubro de 2026" nas primeiras linhas
  let data = hoje;
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  for (const l of naoVazias.slice(0, 14)) {
    let m = l.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
    if (m) { const d = dataBR([m[0], m[1], m[2], m[3]], hoje); if (d) { data = d; break; } }
    m = norm(l).match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
    if (m) { const mi = MESES.findIndex((x) => norm(x) === m[2]); if (mi >= 0) { data = `${m[3]}-${String(mi + 1).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`; break; } }
  }
  // título
  let titulo = (naoVazias.find((l) => !RE_MARCADOR.test(l) && l.trim().length >= 4 && l.trim().length <= 110) || nomeArquivo || 'Ata importada').trim().replace(/^ata\s*[:\-–]\s*/i, '').replace(/\s+R\d{2}\s*$/, '');
  if (!titulo) titulo = nomeArquivo || 'Ata importada';
  const iAta = naoVazias.findIndex((l) => /^ata de reuni[ãa]o$/i.test(l.trim()));   // padrão da Sólida: o subtítulo vem logo depois de "ATA DE REUNIÃO"
  if (iAta >= 0 && naoVazias[iAta + 1]) titulo = naoVazias[iAta + 1].trim();
  // obra mais citada (as que estão na lista; senão a primeira citada, mesmo encerrada)
  const cont = new Map();
  for (const m of String(texto).matchAll(/\bMo\s?(\d{3}[A-Za-z]?)\b/gi)) { const o = `Mo${m[1]}`; cont.set(o, (cont.get(o) || 0) + 1); }
  const ordenadas = [...cont.entries()].sort((a, b) => b[1] - a[1]).map(([o]) => o);
  const daLista = ordenadas.map((o) => obras.find((x) => x.toLowerCase() === o.toLowerCase())).filter(Boolean)[0];
  const obra = daLista || ordenadas[0] || '';
  let setor = '';
  // setor: só quando o texto cita UM setor; se cita mais de um ("Setor de Projetos e Orçamento"), fica em branco para quem confere escolher
  let setorAmbiguo = false;
  if (!obra) {
    const cab = norm(naoVazias.slice(0, 15).join(' '));
    const achadosCab = setores.filter((s) => cab.includes(norm(s)));
    if (achadosCab.length === 1) setor = achadosCab[0]; else if (achadosCab.length > 1) setorAmbiguo = true;
  }
  if (!setor && !setorAmbiguo) {   // "Construtora Sólida – Setor de Projetos": o setor citado depois de "setor de"
    const mset = norm(naoVazias.slice(0, 30).join(' ')).match(/setor de ([a-z ]{3,60})/);
    if (mset) {
      const achados = setores.filter((s) => { const raiz = norm(s).split(/[ /]/)[0].replace(/s$/, ''); return raiz.length >= 5 && mset[1].includes(raiz); });
      if (achados.length === 1) setor = achados[0];
    }
  }
  // participantes
  let parts = [];
  const iPart = linhas.findIndex((l) => /^\s*participantes\s*:?/iu.test(l));
  if (iPart >= 0) {
    const bloco = [linhas[iPart].replace(/^\s*participantes\s*:?\s*/iu, '')];
    for (let k = iPart + 1; k < Math.min(linhas.length, iPart + 4); k++) { const l = linhas[k].trim(); if (!l || /\bITEM\b.*\bTIPO\b/i.test(l) || !/[(,]/.test(l)) break; bloco.push(l); }
    parts = lerParticipantes(bloco.join(' ').replace(/\s+/g, ' ').trim());
    if (!parts.some((p) => p.papel)) { const t = participantesEmTabela(linhas.slice(iPart, iPart + 14)); if (t.length) parts = t; }
  }
  if (!parts.length) parts = participantesEmTabela(linhas);
  const participantes = parts.map((p) => p.texto);
  // local e horário ("LOCAL: online - 11H00", "Horário: 10h"); tipo da reunião pelos papéis dos participantes
  const lLocal = linhas.find((l) => /^\s*local\s*:/iu.test(l)) || '';
  const lHora = linhas.find((l) => /^\s*hor[áa]rio\s*:/iu.test(l)) || '';
  const hm = (lHora || lLocal).match(/(\d{1,2})\s*(?:h|:)\s*(\d{2})?/i);
  const horario = hm ? `${Number(hm[1])}h${hm[2] || '00'}` : '';
  const local = lLocal.replace(/^\s*local\s*:\s*/iu, '').replace(/\s*[-–]\s*\d{1,2}\s*(?:h|:)\s*\d{0,2}.*$/i, '').trim();
  const papeis = new Set(parts.map((p) => p.papel));
  const tipoReuniao = papeis.has('cliente') && papeis.has('arquitetura') ? 'ARQUITETURA-CLIENTE' : papeis.has('cliente') ? 'CLIENTE' : papeis.has('arquitetura') ? 'ARQUITETURA' : 'REUNIÃO';

  // 0) ata de vistoria (Checklist de Verificação em Obra)
  if (paginas && ehAtaDeVistoria(texto)) {
    const gm = String(texto).match(/Gestor\(a\)\s*:\s*([^\n]+?)(?:\s{2,}|\n|$)/i); const gestor = gm ? gm[1].trim() : '';
    const gp = gestor ? lerParticipantes(`${gestor} (Sólida)`) : [];
    const tab = tabelaVistoria(paginas);
    // o resto da vistoria (vistoria por, referência, resultado por seção, itens conformes, observação) entra DENTRO da ata, como informativos
    const infosV = resumoVistoria(texto).split('\n').map((l) => l.trim()).filter((l) => l && !/^Resultado da vistoria:?$/i.test(l)).map((l, i) => ({ kind: 'informativo', descricao: `${/^(Vistoria por|Refer[êe]ncia|Itens conformes|Observa[çc][ãa]o)/i.test(l) ? 'VISTORIA' : 'RESULTADO'}, ${l}`, item: i + 1, responsavel: '', externoNome: '', externoTipo: 'solida', externoCategoria: '' }));
    const pendV = tab.map((x, i) => {
      const r = resolverResponsavel(x.responsavel, [...parts, ...gp], pessoas);
      const prazoOk = /\d{1,2}\/\d{1,2}/.test(x.prazo) ? acharPrazo(x.prazo, hoje, data) : '';
      const tema = String(x.tema || '').trim().toLocaleUpperCase('pt-BR');
      const texto1 = x.pendencia.charAt(0).toUpperCase() + x.pendencia.slice(1);
      return { kind: 'pendencia', descricao: tema ? `${tema}, ${texto1}` : texto1, responsavel: r.responsavel, responsavelAmbiguo: r.ambiguo, externoNome: r.externoNome, externoTipo: r.externoTipo, externoCategoria: r.externoCategoria, prazo: prazoOk, item: infosV.length + i + 1 };
    });
    if (pendV.length) {
      const tit = naoVazias.find((l) => /^ATA DE VISTORIA/i.test(l.trim())) || 'Ata de vistoria';
      return { titulo: tit.trim(), data, obra, obraForaDaLista: !!obra && !obras.some((o) => o.toLowerCase() === obra.toLowerCase()), setor, participantes: gp.map((p) => p.texto), resumo: '', pendencias: pendV, informativosLista: infosV, lidoDaTabela: true, informativos: 0, local: obra ? `Obra ${obra}` : '', horario: '', tipoReuniao: 'REUNIÃO' };
    }
  }
  // 1) tabela do padrão da Sólida
  const tabela = paginas ? lerTabela(paginas) : null;
  if (tabela && tabela.some((x) => /^PEND|^A[ÇC]|^PROVID/iu.test(x.tipo))) {
    const infos = tabela.filter((x) => /^INFORM|^DECIS/iu.test(x.tipo));
    const pend = tabela.filter((x) => /^PEND|^A[ÇC]|^PROVID/iu.test(x.tipo) && x.descricao);
    const pendencias = pend.map((x) => {
      const r = resolverResponsavel(x.responsavel, parts, pessoas);
      let descricao = assuntoEDescritivo(x.descricao);
      if (r.extras.length) descricao += ` (também: ${r.extras.map(capitalizar).join(', ')})`;
      return { descricao, responsavel: r.responsavel, responsavelAmbiguo: r.ambiguo, externoNome: r.externoNome, externoTipo: r.externoTipo, externoCategoria: r.externoCategoria, prazo: x.prazo ? acharPrazo(x.prazo, hoje, data) : '', item: x.n };
    });
    const informativosLista = infos.filter((x) => x.descricao).map((x) => {
      const r = x.responsavel ? resolverResponsavel(x.responsavel, parts, pessoas) : null;
      return { kind: 'informativo', descricao: assuntoEDescritivo(x.descricao), item: x.n, ...(r ? { responsavel: r.responsavel, responsavelAmbiguo: r.ambiguo, externoNome: r.externoNome, externoTipo: r.externoTipo, externoCategoria: r.externoCategoria } : {}) };
    });
    pendencias.forEach((p) => { p.kind = 'pendencia'; });
    return { titulo, data, obra, obraForaDaLista: !!obra && !obras.some((o) => o.toLowerCase() === obra.toLowerCase()), setor, participantes, resumo: '', pendencias, informativosLista, lidoDaTabela: true, informativos: infos.length, local, horario, tipoReuniao };
  }

  // 2) texto corrido: acha as linhas que parecem ação
  const pendencias = []; const vistas = new Set();
  let dentroDeAcoes = false;
  for (const bruta of linhas) {
    const l = bruta.trim();
    if (!l) continue;
    if (RE_SECAO_ACOES.test(l) && !RE_MARCADOR.test(bruta)) { dentroDeAcoes = true; continue; }
    if (RE_SECAO_OUTRA.test(l) && !RE_MARCADOR.test(bruta)) { dentroDeAcoes = false; continue; }
    const semMarca = l.replace(RE_MARCADOR, '').trim();
    if (semMarca.length < 8 || semMarca.length > 320) continue;
    const comMarcador = RE_MARCADOR.test(bruta);
    const pareceAcao = RE_VERBO.test(semMarca) || /\b(?:respons[aá]vel|resp\.)\s*[:\-]/iu.test(semMarca) || /\bprazo\s*[:\-]/iu.test(semMarca);
    if (!(dentroDeAcoes ? (comMarcador || pareceAcao) : (comMarcador && pareceAcao))) continue;
    const resp = acharResponsavel(semMarca, pessoas);
    const prazo = acharPrazo(semMarca, hoje, data);
    const descricao = limpar(semMarca, resp);
    const chave = norm(descricao);
    if (descricao.length < 6 || vistas.has(chave)) continue;
    vistas.add(chave);
    pendencias.push({ descricao: assuntoEDescritivo(descricao), responsavel: resp && !resp.ambiguo ? resp.id : '', responsavelAmbiguo: resp && resp.ambiguo ? resp.nome : '', externoNome: '', externoTipo: '', externoCategoria: '', prazo });
  }
  return { titulo, data, obra, obraForaDaLista: !!obra && !obras.some((o) => o.toLowerCase() === obra.toLowerCase()), setor, participantes, resumo: String(texto || '').trim(), pendencias, lidoDaTabela: false, informativos: 0, local, horario, tipoReuniao };
}

// ---------------------------------------------------------------- arquivos
// pdf.js (carregado só quando alguém importa um PDF)
let pdfjs = null;
async function carregarPdfJs() {
  if (pdfjs) return pdfjs;
  await new Promise((ok, erro) => {
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; s.onload = ok; s.onerror = () => erro(new Error('Não consegui carregar o leitor de PDF (sem internet?).')); document.head.appendChild(s);
  });
  pdfjs = window.pdfjsLib; pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return pdfjs;
}
async function lerPdf(buffer) {
  const lib = await carregarPdfJs();
  const pdf = await lib.getDocument({ data: buffer }).promise;
  const paginas = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const tc = await (await pdf.getPage(n)).getTextContent();
    paginas.push(tc.items.filter((it) => it.str && it.str.trim()).map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height })));
  }
  const texto = paginas.map((p) => agruparLinhas(p).map((l) => textoDaLinha(l)).join('\n')).join('\n\n');
  return { texto, paginas };
}

// lê um arquivo enviado: PDF, texto (.txt, .md, .csv…); outros formatos pedem para colar o texto. → { texto, paginas|null }
export async function lerArquivoAta(arquivo) {
  const nome = String(arquivo.name || ''); const ext = (nome.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf' || arquivo.type === 'application/pdf') {
    const r = await lerPdf(await arquivo.arrayBuffer());
    if (r.texto.replace(/\s/g, '').length < 20) throw new Error('Este PDF não tem texto que eu consiga ler (parece uma foto ou digitalização). Cole o texto da ata ou me mande o arquivo.');
    return r;
  }
  if (['txt', 'md', 'text', 'csv', 'log', 'rtf'].includes(ext) || (arquivo.type || '').startsWith('text/')) return { texto: await arquivo.text(), paginas: null };
  throw new Error(`Não sei ler arquivo .${ext || 'desse tipo'} aqui. Use PDF ou texto, ou copie o conteúdo e cole na caixa.`);
}
export const textoDoArquivo = async (arquivo) => (await lerArquivoAta(arquivo)).texto;

// ---------------------------------------------------------------- "ATA DE PENDÊNCIAS" (quadro de metas do dia exportado em PDF)
// Tabela Nº · OBRA · DESCRIÇÃO · RESPONSÁVEL · URGÊNCIA · DESDE · PREVISTO. Cada linha vira uma TAREFA (não uma ata): a obra e o responsável
// são de cada linha. Lê pela posição das colunas no PDF (como a tabela das atas da Sólida). Dentro da célula, a letra menor é o detalhe da obra (coluna OBRA)
// ou uma observação (coluna DESCRIÇÃO); linha de descrição quebrada (com hífen no fim) é emendada.
export function ehAtaDePendencias(texto, paginas) {
  if (!/ATA\s+DE\s+PEND[ÊE]NCIAS/i.test(String(texto || ''))) return false;
  return !!paginas && paginas.some((p) => p.some((it) => /^DESCRI[ÇC][ÃA]O$/i.test(it.str.trim())) && p.some((it) => /^PREVISTO$/i.test(it.str.trim())));
}
const MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
const emendar = (linhas) => linhas.reduce((t, l) => (!t ? l : /[-‐‑]$/.test(t) ? `${t}${l}` : `${t} ${l}`), '').replace(/\s+/g, ' ').trim();

// distribui as linhas de uma coluna entre as linhas da tabela: cada linha da tabela fica no centro do que escreveu (programação dinâmica, custo = desvio do centro)
function repartir(linhas, centros) {
  const n = linhas.length; const m = centros.length; const INF = 1e9;
  const custo = (j, k, i) => { if (k === 0) return 25; const ys = linhas.slice(j, j + k).map((l) => l.y); return Math.abs((Math.max(...ys) + Math.min(...ys)) / 2 - centros[i]); };
  const f = Array.from({ length: m + 1 }, () => Array(n + 1).fill(INF)); const vem = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  f[0][0] = 0;
  for (let i = 1; i <= m; i++) for (let j = 0; j <= n; j++) for (let k = 0; k <= Math.min(j, 14); k++) {
    if (f[i - 1][j - k] >= INF) continue;
    const c = f[i - 1][j - k] + custo(j - k, k, i - 1);
    if (c < f[i][j]) { f[i][j] = c; vem[i][j] = k; }
  }
  const out = Array.from({ length: m }, () => []); let j = n;
  for (let i = m; i >= 1; i--) { const k = vem[i][j]; out[i - 1] = linhas.slice(j - k, j); j -= k; }
  return out;
}

export function lerAtaDePendencias(paginas, texto, { pessoas = [], hoje = '' } = {}) {
  const dm = /Data:\s*(\d{1,2})\s+de\s+([A-Za-zçÇãÃ]+)\s+de\s+(\d{4})/i.exec(String(texto || '').replace(/\n/g, ' '));
  const data = dm && MESES[norm(dm[2])] ? `${dm[3]}-${String(MESES[norm(dm[2])]).padStart(2, '0')}-${dm[1].padStart(2, '0')}` : (hoje || '');
  const tm = /Metas do dia[^\n]*/i.exec(String(texto || '')); const titulo = tm ? tm[0].trim() : 'Ata de pendências';
  const itens = [];
  for (const pag of paginas) {
    const cab = (nome) => pag.find((it) => norm(it.str.trim()) === nome);
    const hNum = cab('n\u00ba') || pag.find((it) => /^N[º°o]$/i.test(it.str.trim())); const hDesc = cab('descricao'); const hResp = cab('responsavel'); const hUrg = cab('urgencia'); const hDesde = cab('desde'); const hPrev = cab('previsto');
    if (!hNum || !hDesc || !hResp || !hUrg || !hDesde || !hPrev) continue;
    const b0 = hNum.x + 14; const b1 = hDesc.x - 54; const b2 = hResp.x - 9; const b3 = hUrg.x - 5; const b4 = hDesde.x - 4; const b5 = (hDesde.x + hPrev.x) / 2;
    const corpo = pag.filter((it) => it.y < hNum.y - 3);
    const fim = corpo.find((it) => /^OBSERVA[ÇC][ÕO]ES/i.test(it.str.trim())); const area = fim ? corpo.filter((it) => it.y > fim.y + 2) : corpo;
    const nums = area.filter((it) => it.x < b0 && /^\d{1,3}$/.test(it.str.trim())).sort((a, b) => b.y - a.y);
    if (!nums.length) continue;
    const colunaLinhas = (de, ate) => agruparLinhas(area.filter((it) => it.x >= de && it.x < ate)).map((l) => ({ y: l.y, h: Math.max(...l.itens.map((i) => i.h || 0)), txt: textoDaLinha(l) }));
    const ys = nums.map((n) => n.y);
    const obraL = repartir(colunaLinhas(b0, b1), ys); const descL = repartir(colunaLinhas(b1, b2), ys);
    const simples = (de, ate, i) => area.filter((it) => it.x >= de && it.x < ate && Math.abs(it.y - ys[i]) <= 4).sort((a, b) => a.x - b.x).map((it) => it.str.trim()).join(' ').trim();
    nums.forEach((n, i) => {
      const separa = (ls) => { const mx = Math.max(0, ...ls.map((l) => l.h)); return { principal: ls.filter((l) => l.h >= mx - 0.4).map((l) => l.txt), pequeno: ls.filter((l) => l.h < mx - 0.4).map((l) => l.txt) }; };
      const o = separa(obraL[i]); const d = separa(descL[i]);
      const respTxt = simples(b2, b3, i); const urgTxt = simples(b3, b4, i); const desdeTxt = simples(b4, b5, i); const prevTxt = simples(b5, 1e9, i);
      const pr = /(\d{1,2})\/(\d{1,2})/.exec(prevTxt); const ds = /(\d{1,2})\/(\d{1,2})/.exec(desdeTxt);
      itens.push({
        n: Number(n.str), obraTxt: emendar(o.principal), obraDetalhe: emendar(o.pequeno), titulo: emendar(d.principal), nota: emendar(d.pequeno),
        responsaveisTxt: respTxt, responsaveis: respTxt.split(/\s+e\s+|,|\//i).map((x) => x.trim()).filter(Boolean),
        urgencia: ({ alta: 'alta', media: 'media', baixa: 'baixa' })[norm(urgTxt)] || '',
        prazo: pr ? dataBR([null, pr[1], pr[2]], data || hoje) : '', desde: ds ? dataBR([null, ds[1], ds[2]], data || hoje) : '',
      });
    });
  }
  itens.sort((a, b) => a.n - b.n);
  return { tipo: 'pendencias', titulo, data, itens, total: (/Total de pend[êe]ncias:\s*(\d+)/i.exec(String(texto || '')) || [])[1] ? Number(/Total de pend[êe]ncias:\s*(\d+)/i.exec(String(texto))[1]) : itens.length };
}

// ---------------------------------------------------------------- "Ata de pendências — Nome" (lista de UMA pessoa)
// Tabela Obra · Pendência · Urgência · Pendente desde · Observação, de uma pessoa só (o nome vem no título). A célula é alinhada em cima: cada linha começa
// na célula da coluna Obra, e o que está embaixo dela até a próxima linha (descrição e observação quebradas) é da mesma pendência.
// Da observação saem: "prazo era dd/mm" ou "Marcada para dd/mm" (prazo), "às 9h" (horário) e "Com a Julia" (quem divide a tarefa).
export function formatoListaPendencias(texto, paginas) {
  if (ehAtaDePendencias(texto, paginas)) return 'quadro';
  const t = String(texto || '');
  if (!/Ata\s+de\s+pend[êe]ncias/i.test(t) || !paginas) return '';
  const temCab = (p) => ['obra', 'pendencia', 'urgencia', 'observacao'].every((n) => p.some((it) => norm(it.str.trim()) === n));
  return paginas.some(temCab) ? 'pessoa' : '';
}
const MES_EN = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export function lerListaPorPessoa(paginas, texto, { hoje = '' } = {}) {
  const t = String(texto || '');
  const pn = /Ata\s+de\s+pend[êe]ncias\s*[—–-]\s*([^\n]+)/i.exec(t); const pessoaNome = pn ? pn[1].trim() : '';
  const dm = /([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s+(\d{4})/.exec(t);
  const data = dm && MES_EN[dm[1].toLowerCase()] ? `${dm[3]}-${String(MES_EN[dm[1].toLowerCase()]).padStart(2, '0')}-${dm[2].padStart(2, '0')}` : (hoje || '');
  const itens = []; let n = 0;
  for (const pag of paginas) {
    const cab = (nome) => pag.find((it) => norm(it.str.trim()) === nome);
    const hObra = cab('obra'); const hPend = cab('pendencia'); const hUrg = cab('urgencia'); const hDesde = cab('pendente'); const hObs = cab('observacao');
    if (!hObra || !hPend || !hUrg || !hDesde || !hObs) continue;
    const b1 = hPend.x - 6; const b2 = hUrg.x - 6; const b3 = hDesde.x - 6; const b4 = hObs.x - 6;
    const fim = pag.find((it) => /^Pr[óo]ximos dias/i.test(it.str.trim()) && it.y < hObra.y);
    const area = pag.filter((it) => it.y < hObra.y - 3 && (!fim || it.y > fim.y + 2) && !/^Page\s+\d+\s+of\s+\d+/i.test(it.str.trim()));   // sem o rodapé "Page 1 of 3"
    const ancoras = area.filter((it) => Math.abs(it.x - hObra.x) <= 4 && it.str.trim()).sort((a, b) => b.y - a.y);
    const colunaDa = (linhasY, de, ate) => agruparLinhas(area.filter((it) => it.x >= de && it.x < ate && linhasY(it))).map((l) => textoDaLinha(l));
    ancoras.forEach((a, i) => {
      const prox = ancoras[i + 1];
      const nela = (it) => it.y <= a.y + 3 && (!prox || it.y > prox.y + 3);
      const col = (de, ate) => emendar(colunaDa(nela, de, ate));
      const obs = col(b4, 1e9); const pend = col(b1, b2); const urg = col(b2, b3); const desde = col(b3, b4);
      const dBR = (m) => (m ? dataBR([null, m[1], m[2]], data || hoje) : '');
      const prazoQuando = /prazo era\s+(\d{1,2})\/(\d{1,2})/i.exec(obs) || /marcada para\s+(\d{1,2})\/(\d{1,2})/i.exec(obs);
      const hr = /[àa]s\s*(\d{1,2})h(?:\s*(\d{2}))?/i.exec(`${pend} ${obs}`);
      const com = [...obs.matchAll(/(?<!reuni[ãa]o\s)\b[Cc]om\s+(?:a\s+|o\s+|os\s+|as\s+)?([A-ZÀ-Ú][\wÀ-ÿ]+)/g)].map((m) => m[1]);
      const ds = /(\d{1,2})\/(\d{1,2})/.exec(desde);
      n += 1;
      itens.push({ n, obraTxt: col(hObra.x - 4, b1), titulo: pend, urgencia: ({ alta: 'alta', media: 'media', baixa: 'baixa' })[norm(urg)] || '', desde: ds ? dBR(ds) : '', obs,
        prazo: dBR(prazoQuando) || data || hoje, hora: hr ? `${hr[1].padStart(2, '0')}:${hr[2] || '00'}` : '', comPessoas: com });
    });
  }
  return { tipo: 'pessoa', titulo: `Ata de pendências — ${pessoaNome}`, data, pessoaNome, itens, total: itens.length };
}
