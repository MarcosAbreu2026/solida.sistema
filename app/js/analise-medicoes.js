// Análise das medições de obra (pedido do Felipe, 03/11/2026), do agente de Operação.
// Cruza, para cada obra e cada semana (segunda a sexta):
//   programação semanal e metas  (agente de Planejamento / WhatsApp: programacao.js)
//   produtividade enviada        (relatório diário no grupo da obra: CFG.whats[].itens[].feito)
//   efetivo enviado              (mensagem de efetivo no grupo: estado.efetivo.dias[dia][obra])
//   medição no Mais Controle     (lida pelo agente de Operação: dados/json/medicoes-mc.json, ver docs/contrato-agentes.md)
// A comparação é ITEM A ITEM: a quantidade medida de cada serviço tem que bater com a quantidade produzida do mesmo serviço.
// Cinza (equipe Sólida, POP 1.1 e 1.3): medido × produzido. Laranja (terceirizados, POP 1.4): não há produtividade diária,
// então a base é a programação da semana. Nada aqui usa valores em R$.

import { programacoes, feriado } from './programacao.js';
import { somarDias } from './datas.js';

export const TOLERANCIA = 0.10;   // diferença aceita entre medido e produzido (10%)
export const MIN_QTD = 0.5;       // diferenças menores que isto (na unidade do item) são ruído
export const RESPONSAVEL = { cinza: '1.1 · SIMONE e 1.3 · LARISSA', laranja: '1.4 · MARIANA' };

// ---------------------------------------------------------------- textos e quantidades
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
export const norm = (s) => semAcento(s).toLowerCase().replace(/[^a-z0-9²³ ]+/g, ' ').replace(/\s+/g, ' ').trim();
const PARADAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'em', 'na', 'no', 'a', 'o', 'as', 'os']);
const tokens = (s) => norm(s).split(' ').filter((t) => t.length > 1 && !PARADAS.has(t));

export function unidade(u) {
  const t = semAcento(u).toLowerCase().replace(/[\s.]/g, '');
  if (t === 'm2' || t === 'm²') return 'm²';
  if (t === 'm3' || t === 'm³') return 'm³';
  if (/^(un|und|unid|unidade|unidades|pc|pcs|peca|pecas|ponto|pontos)$/.test(t)) return 'un';
  return t;
}

// semelhança entre dois nomes de serviço: 1 = igual; 0,6 a 0,99 = provável (conferir)
export function parecido(a, b) {
  const x = norm(a); const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const ta = new Set(tokens(a)); const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const jac = inter / (ta.size + tb.size - inter);
  const contem = x.includes(y) || y.includes(x) ? 0.8 : 0;
  return Math.max(jac, contem);
}
const LIMIAR = 0.6;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// ---------------------------------------------------------------- efetivo do dia
export function efetivoDoDia(ef, dia, obra) {
  const e = ef && ef.dias && ef.dias[dia] && ef.dias[dia][obra];
  if (!e) return { enviado: false, solida: 0, terceiros: 0, total: 0 };
  const solida = (e.solida && num(e.solida.qtd)) || 0;
  const terceiros = (Array.isArray(e.terceiros) ? e.terceiros : []).reduce((s, t) => s + (num(t.qtd) || 0), 0);
  return { enviado: true, solida, terceiros, total: num(e.total) != null ? e.total : solida + terceiros, empresas: (Array.isArray(e.terceiros) ? e.terceiros : []).map((t) => t.empresa).filter(Boolean) };
}

// ---------------------------------------------------------------- uma obra, uma semana
function itensDaSemana(p, dias, hoje) {
  const mapa = new Map();
  const porDia = [];
  for (const d of dias) {
    const feriadoDia = !!feriado(d);
    const prog = (p.dias || []).find((x) => x.data === d);
    const reg = (p.registros || []).find((r) => r.data === d);
    const passou = d < hoje;
    const itensReg = (reg && reg.itens) || [];
    const relatou = !!reg && !reg.semRelatorio && (!!reg.relatorio || itensReg.some((i) => i.feito !== undefined && i.feito !== null));
    const dia = { data: d, feriado: feriadoDia, passou, relatou, semRelatorio: !!(reg && reg.semRelatorio), itens: [] };
    if (!feriadoDia) {
      const doDia = new Map();
      for (const it of (prog && prog.itens) || []) if (it.tipo !== 'laranja') doDia.set(norm(it.item), { item: it.item, unidade: it.unidade || '', meta: num(it.meta), feito: undefined, motivo: '' });
      for (const it of itensReg) {
        const k = norm(it.item); const ant = doDia.get(k) || { item: it.item, unidade: it.unidade || '', meta: null };
        doDia.set(k, { ...ant, unidade: ant.unidade || it.unidade || '', meta: num(it.meta) ?? ant.meta ?? null, feito: it.feito, motivo: it.motivo || '' });
      }
      for (const [k, v] of doDia) {
        dia.itens.push(v);
        const acc = mapa.get(k) || { item: v.item, unidade: v.unidade, meta: 0, temMeta: false, feito: 0, temFeito: false, feitoBool: null, diasAbaixo: 0, semMotivo: 0 };
        if (v.meta != null) { acc.meta += v.meta; acc.temMeta = true; }
        if (num(v.feito) != null) { acc.feito += v.feito; acc.temFeito = true; }
        else if (typeof v.feito === 'boolean') acc.feitoBool = (acc.feitoBool || false) || v.feito;
        if (passou && v.meta != null && num(v.feito) != null && v.feito < v.meta * 0.999) { acc.diasAbaixo++; if (!v.motivo) acc.semMotivo++; }
        if (!acc.unidade && v.unidade) acc.unidade = v.unidade;
        mapa.set(k, acc);
      }
    }
    porDia.push(dia);
  }
  return { itens: [...mapa.values()], porDia };
}

function compararItem(prod, mc) {
  // prod: item agregado da semana; mc: item medido (ou null)
  const feito = prod.temFeito ? prod.feito : null;
  const medido = mc ? num(mc.medido) : null;
  const base = { item: prod.item, unidade: prod.unidade || (mc && mc.unidade) || '', meta: prod.temMeta ? prod.meta : null, produzido: feito, medido, aproximado: !!(mc && mc.aproximado), contrato: (mc && mc.contrato) || '' };
  if (mc && prod.unidade && mc.unidade && unidade(prod.unidade) !== unidade(mc.unidade)) return { ...base, situacao: 'unidade', texto: `unidade diferente (produzido em ${prod.unidade}, medido em ${mc.unidade})` };
  if (feito == null && prod.feitoBool != null) {
    if (prod.feitoBool && !mc) return { ...base, situacao: 'nao_medido', texto: 'feito, mas sem medição no Mais Controle' };
    if (!prod.feitoBool && mc && (medido || mc.pct)) return { ...base, situacao: 'a_mais', texto: 'medido, mas o grupo relatou como não feito' };
    return { ...base, situacao: 'ok', texto: 'feito e medido' };
  }
  if (feito == null) {
    if (medido) return { ...base, situacao: 'a_mais', texto: 'medido, mas sem produtividade enviada' };
    return { ...base, situacao: 'sem_produtividade', texto: 'programado, sem produtividade enviada' };
  }
  if (!mc) return feito > MIN_QTD ? { ...base, situacao: 'nao_medido', texto: 'produzido, sem medição no Mais Controle' } : { ...base, situacao: 'ok', texto: 'sem produção e sem medição' };
  if (medido == null) return { ...base, situacao: 'so_percentual', texto: `medição só em % (${mc.pct}%): conferir a quantidade` };
  const dif = medido - feito;
  if (dif > MIN_QTD && dif > feito * TOLERANCIA) return { ...base, situacao: 'a_mais', dif, texto: `medido ${Math.round(dif * 10) / 10} ${base.unidade} a mais que o produzido` };
  if (-dif > MIN_QTD && -dif > feito * TOLERANCIA) return { ...base, situacao: 'a_menos', dif, texto: `medido ${Math.round(-dif * 10) / 10} ${base.unidade} a menos que o produzido` };
  return { ...base, situacao: 'ok', dif, texto: 'medição bate com a produtividade' };
}

const NIVEL_DE = { ok: 0, sem_produtividade: 1, so_percentual: 1, unidade: 1, nao_medido: 1, a_menos: 1, a_mais: 2 };

// mc: { semana:{inicio}, verificadoEm, obras:[{ obra, tipo?, itens:[{ item, unidade, medido, pct?, tipo?, contrato?, status? }], obs? }] }
export function analisarObra(p, { mc, efetivo, ini, hoje }) {
  const dias = [0, 1, 2, 3, 4].map((i) => somarDias(ini, i));
  const { itens, porDia } = itensDaSemana(p, dias, hoje);
  const achados = [];
  const semanaFechada = somarDias(ini, 4) < hoje;

  // efetivo × produtividade, dia a dia
  let pessoasDia = 0; let diasSemEfetivo = 0; let diasSemProd = 0; let diasProdSemEf = 0;
  for (const d of porDia) {
    d.ef = efetivoDoDia(efetivo, d.data, p.obra);
    if (d.feriado || !d.passou) continue;
    pessoasDia += d.ef.total;
    const produziu = d.itens.some((i) => (num(i.feito) != null && i.feito > 0) || i.feito === true);
    if (!d.ef.enviado) diasSemEfetivo++;
    if (produziu && (!d.ef.enviado || d.ef.total === 0)) { diasProdSemEf++; d.flag = 'produtividade sem efetivo'; }
    if (d.ef.total > 0 && !d.relatou) { diasSemProd++; d.flag = d.flag || 'equipe na obra, sem produtividade'; }
  }
  if (diasProdSemEf) achados.push({ nivel: 'atencao', texto: `${diasProdSemEf} ${diasProdSemEf === 1 ? 'dia' : 'dias'} com produtividade enviada e sem efetivo no grupo (não dá para saber quem produziu).` });
  if (diasSemProd) achados.push({ nivel: 'atencao', texto: `${diasSemProd} ${diasSemProd === 1 ? 'dia' : 'dias'} com equipe na obra e sem produtividade enviada.` });
  const diasUteisPassados = porDia.filter((d) => !d.feriado && d.passou).length;
  const diasRelatados = porDia.filter((d) => !d.feriado && d.passou && d.relatou).length;
  if (diasUteisPassados && !diasRelatados) achados.push({ nivel: 'atencao', texto: 'Nenhuma produtividade enviada no grupo na semana.' });

  // medição no Mais Controle × produtividade
  const mcSemana = mc && mc.semana && mc.semana.inicio === ini;
  const mcObra = mcSemana ? (mc.obras || []).find((o) => o.obra === p.obra) : null;
  const medicao = { lida: !!mcObra, semanaDoArquivo: (mc && mc.semana && mc.semana.inicio) || null, verificadoEm: (mc && mc.verificadoEm) || null, obs: (mcObra && mcObra.obs) || '', itens: [], laranja: [], semProdutividade: [] };
  if (mcObra) {
    const cinza = (mcObra.itens || []).filter((i) => (i.tipo || mcObra.tipo || 'cinza') !== 'laranja');
    const laranja = (mcObra.itens || []).filter((i) => (i.tipo || mcObra.tipo) === 'laranja');
    const usados = new Set();
    for (const prod of itens) {
      // melhor correspondência ainda não usada
      let melhor = -1; let sim = 0;
      cinza.forEach((m, i) => { if (usados.has(i)) return; const s = parecido(prod.item, m.item); if (s > sim) { sim = s; melhor = i; } });
      const mi = melhor >= 0 && sim >= LIMIAR ? cinza[melhor] : null;
      if (mi) usados.add(melhor);
      // mesmo serviço medido em mais de um contrato: soma
      let juntado = mi;
      if (mi) cinza.forEach((m, i) => { if (!usados.has(i) && i !== melhor && parecido(prod.item, m.item) >= 1 && num(m.medido) != null) { usados.add(i); juntado = { ...juntado, medido: (num(juntado.medido) || 0) + m.medido }; } });
      if (!prod.temMeta && !prod.temFeito && prod.feitoBool == null && !juntado) continue;   // item sem nada na semana
      medicao.itens.push(compararItem(prod, juntado ? { ...juntado, aproximado: sim < 1 } : null));
    }
    cinza.forEach((m, i) => { if (!usados.has(i) && (num(m.medido) > 0 || m.pct > 0)) medicao.semProdutividade.push({ item: m.item, unidade: m.unidade || '', medido: num(m.medido), contrato: m.contrato || '', situacao: 'a_mais', texto: 'medido, mas não está na programação nem na produtividade da semana' }); });
    // laranja: sem produtividade diária; a base é o programado da semana
    const sem = (p.semanas || []).find((s) => ini >= s.inicio && ini <= somarDias(s.inicio, 6));
    const prog = ((sem && sem.naSemana) || []).filter((x) => x.tipo === 'laranja' && num(x.meta) != null);
    const usadosL = new Set();
    for (const x of prog) {
      let melhor = -1; let simL = 0;
      laranja.forEach((m, i) => { if (usadosL.has(i)) return; const s = parecido(x.item, m.item); if (s > simL) { simL = s; melhor = i; } });
      const m = melhor >= 0 && simL >= LIMIAR ? laranja[melhor] : null; if (m) usadosL.add(melhor);
      const r = compararItem({ item: x.item, unidade: x.unidade || '', meta: x.meta, temMeta: true, feito: x.meta, temFeito: true, feitoBool: null }, m ? { ...m, aproximado: simL < 1 } : null);
      medicao.laranja.push({ ...r, base: 'programação da semana', produzido: null, programado: x.meta });
    }
    laranja.forEach((m, i) => { if (!usadosL.has(i) && (num(m.medido) > 0 || m.pct > 0)) medicao.laranja.push({ item: m.item, unidade: m.unidade || '', medido: num(m.medido), programado: null, contrato: m.contrato || '', situacao: 'a_mais', base: 'programação da semana', texto: 'medido, mas não está na programação da semana' }); });
  }

  // achados da medição
  const todos = [...medicao.itens, ...medicao.semProdutividade, ...medicao.laranja];
  const quando = (r) => (r.produzido != null ? `produzido ${fmt(r.produzido)} ${r.unidade}` : r.programado != null ? `programado ${fmt(r.programado)} ${r.unidade}` : 'sem produção registrada');
  const diasSemProdutividade = diasUteisPassados - diasRelatados;
  for (const r of todos) {
    if (r.situacao === 'ok') continue;
    const laranja = medicao.laranja.includes(r);
    const nivel = r.situacao === 'a_mais' ? 'critico' : 'atencao';
    if (r.situacao === 'sem_produtividade' && !semanaFechada) continue;
    achados.push({ nivel, proc: laranja ? 'laranja' : 'cinza', texto: `${r.item}: ${r.texto}${r.medido != null ? ` (medido ${fmt(r.medido)} ${r.unidade}; ${quando(r)})` : ''}${r.aproximado ? ' [nome parecido, conferir o serviço]' : ''}.${r.situacao === 'a_mais' && r.produzido != null && diasSemProdutividade > 0 ? ` Atenção: ${diasSemProdutividade} ${diasSemProdutividade === 1 ? 'dia' : 'dias'} da semana sem produtividade enviada, o produzido pode estar subestimado.` : ''}` });
  }
  if (!mcObra && semanaFechada && itens.some((i) => i.temFeito)) achados.push({ nivel: 'atencao', proc: 'cinza', texto: mc && mc.semana ? `Medição da semana ainda não lida no Mais Controle (o último arquivo é da semana de ${mc.semana.inicio.split('-').reverse().join('/')}).` : 'Medição ainda não lida no Mais Controle.' });
  if (medicao.obs) achados.push({ nivel: 'info', texto: `Mais Controle: ${medicao.obs}` });

  let nivel = 0;
  for (const r of todos) nivel = Math.max(nivel, NIVEL_DE[r.situacao] ?? 1);
  for (const a of achados) nivel = Math.max(nivel, a.nivel === 'critico' ? 2 : a.nivel === 'atencao' ? 1 : 0);
  const sem = !itens.some((i) => i.temFeito || i.feitoBool != null) && !itens.some((i) => i.temMeta);
  const status = sem && !achados.length ? 'sem_dados' : nivel >= 2 ? 'critico' : nivel === 1 ? 'atencao' : 'ok';
  return { obra: p.obra, status, itens, medicao, dias: porDia, pessoasDia, diasSemEfetivo, achados, semProgramacao: sem };
}

const fmt = (v) => (Math.round(v * 10) / 10).toLocaleString('pt-BR');

// ---------------------------------------------------------------- todas as obras
export function analisarSemana({ CFG, mc, efetivo, ini, hoje, visiveis = null }) {
  const progs = CFG ? programacoes(CFG) : [];
  const obras = progs.filter((p) => !visiveis || visiveis.includes(p.obra)).map((p) => analisarObra(p, { mc, efetivo, ini, hoje }));
  const conta = (s) => obras.filter((o) => o.status === s).length;
  return {
    ini, fim: somarDias(ini, 4), obras,
    resumo: { obras: obras.length, ok: conta('ok'), atencao: conta('atencao'), critico: conta('critico'), semDados: conta('sem_dados'), medicaoLida: obras.filter((o) => o.medicao.lida).length },
    mcLidoEm: (mc && mc.verificadoEm) || null,
  };
}

// alertas para o painel (Operação): só obras com divergência de medição
export function alertas(analise) {
  const out = [];
  for (const o of analise.obras) {
    const graves = o.achados.filter((a) => a.nivel === 'critico' && a.proc);
    for (const a of graves) out.push({ nivel: 'critico', obra: o.obra, texto: `${RESPONSAVEL[a.proc] || RESPONSAVEL.cinza} — ${o.obra}: ${a.texto}` });
  }
  return out;
}
