// Planejamento › Funcionários por obra: quem está em cada obra nas próximas 4 semanas, a partir da distribuição de funcionários
// (RH GERAL > 01.01 - DISTRIBUIÇÃO FUNCIONARIOS OBRA > SL_FUNC_OBRAS, lida para dados/json/equipe-programada.json).
// O texto da planilha é livre ("Mo358 -10 / Mo565C - 09", "PO", "FÉRIAS"); a leitura dia a dia é a mesma do RH (equipe-prog.js › lerProgramacao).
// Dois quadros: por obra (quantos de cada função e quem) e por funcionário (onde cada um está), mais quem está livre.
import { html } from '../formato.js';
import * as pd from './painel-dep.js';
import { somarDias, inicioDaSemana, hojeISO } from '../datas.js';
import { lerProgramacao } from '../equipe-prog.js';

const N_SEMANAS = 4;
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cap = (s) => String(s || '').toLowerCase().replace(/(^|[\s(-])\S/g, (c) => c.toUpperCase());
const primeiroNome = (nome) => cap(String(nome || '').replace(/\([^)]*\)/g, ' ').trim().split(/[\s-]+/)[0]);

// função da planilha → rótulo curto (singular, plural)
const FUNCOES = [
  [/encarregado/, 'encarregado', 'encarregados'], [/pedreiro/, 'pedreiro', 'pedreiros'], [/ajudante/, 'ajudante', 'ajudantes'],
  [/pintor/, 'pintor', 'pintores'], [/eletricista/, 'eletricista', 'eletricistas'], [/bombeiro/, 'bombeiro hidráulico', 'bombeiros hidráulicos'],
  [/carpinteiro/, 'carpinteiro', 'carpinteiros'], [/ladrilheiro|ladrilhista/, 'ladrilheiro', 'ladrilheiros'], [/1\/2 oficial/, 'meio oficial', 'meio oficiais'],
  [/pos obra/, 'pós-obra', 'pós-obra'],
];
const rotuloFuncao = (f, n = 1) => { const t = sem(f); const m = FUNCOES.find(([re]) => re.test(t)); return m ? (n === 1 ? m[1] : m[2]) : (sem(f).trim() || 'sem função'); };
const ordemFuncao = (f) => { const t = sem(f); const i = FUNCOES.findIndex(([re]) => re.test(t)); return i < 0 ? 99 : i; };

const obraBase = (cod) => { const m = /(\d{3})/.exec(cod || ''); return m ? m[1] : ''; };

// o que a planilha diz de uma pessoa numa semana
function semanaDaPessoa(p, segunda, cobre, norm = (c) => c) {
  const texto = String((p.semanas || {})[segunda] || '').trim();
  const r = { texto, obras: new Map(), po: 0, afast: [], livre: false, semDado: !cobre };
  if (!cobre) return r;
  if (!texto) { r.livre = true; return r; }
  const prog = lerProgramacao(texto, segunda);
  prog.dias.forEach((itens) => itens.forEach((it) => {
    if (it.tipo === 'obra') { const c = norm(it.rotulo); if (/^po/i.test(c)) r.po += 1; else r.obras.set(c, (r.obras.get(c) || 0) + 1); }
    else if (it.tipo === 'po') r.po += 1;
    else if (it.tipo === 'afast' && !r.afast.includes(it.rotulo)) r.afast.push(it.rotulo);
  }));
  // texto que o leitor não entendeu: mostra como veio, sem inventar obra
  if (!r.obras.size && !r.po && !r.afast.length) r.livre = !/\S/.test(texto);
  r.naoEntendi = !r.obras.size && !r.po && !r.afast.length && /\S/.test(texto);
  return r;
}

// situação da obra no cadastro (andamento · pausada · finalizada) pelo código; sem cadastro: ''
function situacaoCad(cad, cod) {
  if (!Array.isArray(cad)) return '';
  const c = String(cod).toUpperCase();
  const r = cad.find((x) => String(x.codigo).toUpperCase() === c) || cad.find((x) => obraBase(x.codigo) && obraBase(x.codigo) === obraBase(c) && /^mo/i.test(x.codigo));
  return r ? r.situacao : '';
}

export function render({ eqp, obrasCad, params, hoje = hojeISO() }) {
  if (!eqp || !eqp.pessoas || !eqp.pessoas.length) {
    return html`<p class="pd-vazio">A distribuição de funcionários (SL_FUNC_OBRAS) ainda não chegou do computador do escritório${eqp && eqp.erro ? ` — ${eqp.erro}` : ''}.</p>`;
  }
  const ini = inicioDaSemana((params && params.get('s')) || hoje);
  const semanas = Array.from({ length: N_SEMANAS }, (_, i) => somarDias(ini, i * 7));
  const cobertas = new Set(eqp.semanas || []);
  const ultimaCoberta = [...cobertas].sort().slice(-1)[0];
  const cad = Array.isArray(obrasCad) ? obrasCad : null;
  // a planilha às vezes escreve Mo566 para o pós-obra Po566: se o código não existe como obra no cadastro mas existe como pós-obra, vale o pós-obra
  const normaliza = (cod) => {
    if (!cad) return cod;
    const up = cod.toUpperCase(); if (cad.some((c) => String(c.codigo).toUpperCase() === up)) return cod;
    const po = /^mo/i.test(cod) && cad.find((c) => /^po/i.test(c.codigo) && obraBase(c.codigo) === obraBase(cod));
    return po ? po.codigo : cod;
  };
  const pessoas = eqp.pessoas.map((p) => ({ ...p, sm: semanas.map((s) => semanaDaPessoa(p, s, cobertas.has(s), normaliza)) }));
  // dois com o mesmo primeiro nome (Jose, Jose…): acrescenta a inicial do sobrenome
  const repetido = new Map(); pessoas.forEach((p) => { const k = sem(primeiroNome(p.nome)); repetido.set(k, (repetido.get(k) || 0) + 1); });
  const curto = (p) => { const pn = primeiroNome(p.nome); if (repetido.get(sem(pn)) < 2) return pn; const resto = String(p.nome).replace(/\([^)]*\)/g, ' ').trim().split(/[\s-]+/).slice(1).find(Boolean); return resto ? `${pn} ${resto[0].toUpperCase()}.` : pn; };

  // ---- por obra: obra → semana → pessoas
  const porObra = new Map();   // rotulo → { cod, semanas: [ [pessoas] x4 ] }
  const livres = semanas.map(() => []); const afastados = semanas.map(() => []); const po = semanas.map(() => []);
  pessoas.forEach((p) => p.sm.forEach((w, i) => {
    for (const [cod, dias] of w.obras) {
      if (!porObra.has(cod)) porObra.set(cod, { cod, semanas: semanas.map(() => []) });
      porObra.get(cod).semanas[i].push({ p, dias });
    }
    if (w.po) po[i].push(p);
    if (w.afast.length) afastados[i].push({ p, motivo: w.afast.join(', ') });
    if (w.livre) livres[i].push(p);
  }));
  // obras do cadastro em andamento aparecem mesmo sem ninguém alocado (é o alerta)
  const emAndamento = cad ? cad.filter((c) => /^mo/i.test(c.codigo) && (c.tipo || 'obra') === 'obra' && c.situacao === 'andamento').map((c) => c.codigo) : [];
  for (const cod of emAndamento) { const ja = [...porObra.keys()].some((k) => k.toUpperCase() === cod.toUpperCase()); if (!ja) porObra.set(cod, { cod, semanas: semanas.map(() => []) }); }

  const linhasObra = [...porObra.values()].map((o) => ({ ...o, sit: situacaoCad(cad, o.cod) }));
  const peso = (o) => (o.sit === 'andamento' ? 0 : o.sit === 'pausada' ? 1 : o.sit === '' ? 2 : 3);
  linhasObra.sort((a, b) => peso(a) - peso(b) || obraBase(a.cod).localeCompare(obraBase(b.cod)) || a.cod.localeCompare(b.cod));

  const contagem = (lista) => {
    const m = new Map();
    for (const { p } of lista) { const k = rotuloFuncao(p.funcao); m.set(k, (m.get(k) || 0) + 1); }
    const plural = (k, n) => (n === 1 ? k : (FUNCOES.find((f) => f[1] === k) || [])[2] || k);
    return [...m].sort((a, b) => ordemFuncao(a[0]) - ordemFuncao(b[0])).map(([k, n]) => `${n} ${plural(k, n)}`).join(' · ');
  };
  const nomes = (lista) => lista.map(({ p, dias }) => `${curto(p)}${dias && dias < 5 ? ` (${dias}d)` : ''}`);
  const celObra = (o, i) => {
    const l = o.semanas[i];
    if (!cobertas.has(semanas[i])) return html`<span class="pd-def">sem dado na planilha</span>`;
    if (!l.length) return o.sit === 'andamento' ? html`<b class="pd-cr">ninguém alocado</b>` : html`<span class="pd-traco">—</span>`;
    const n = nomes(l);
    return html`<b>${l.length} ${l.length === 1 ? 'pessoa' : 'pessoas'}</b><span class="pd-obra-sub">${contagem(l)}</span><span class="pd-obra-sub" title="${n.join(', ')}">${n.slice(0, 6).join(', ')}${n.length > 6 ? ` +${n.length - 6}` : ''}</span>`;
  };
  const tabelaObras = pd.tabela(['Obra', ...semanas.map((s, i) => `${i === 0 && s === inicioDaSemana(hoje) ? 'Esta semana' : 'Semana'} ${dm(s)}`)], [
    ...linhasObra.map((o) => [
      pd.obraCel(o.cod, '', /^mo/i.test(o.cod) ? `#/obra/${encodeURIComponent(o.cod)}` : ''),
      ...semanas.map((_, i) => celObra(o, i)),
    ]),
    [html`<b>Pós-obra</b>`, ...semanas.map((s, i) => (!cobertas.has(s) ? html`<span class="pd-def">sem dado</span>` : po[i].length ? html`<b>${po[i].length}</b><span class="pd-obra-sub" title="${po[i].map((p) => curto(p)).join(', ')}">${po[i].map((p) => curto(p)).join(', ')}</span>` : html`<span class="pd-traco">—</span>`))],
    [html`<b>Livres</b><span class="pd-obra-sub">sem obra na planilha</span>`, ...semanas.map((s, i) => (!cobertas.has(s) ? html`<span class="pd-def">sem dado</span>` : livres[i].length ? html`<b>${livres[i].length}</b><span class="pd-obra-sub">${contagem(livres[i].map((p) => ({ p })))}</span><span class="pd-obra-sub" title="${livres[i].map((p) => curto(p)).join(', ')}">${livres[i].map((p) => curto(p)).join(', ')}</span>` : html`<span class="pd-traco">—</span>`))],
    [html`<b>Férias / afastados</b>`, ...semanas.map((s, i) => (!cobertas.has(s) ? html`<span class="pd-def">sem dado</span>` : afastados[i].length ? html`<b>${afastados[i].length}</b><span class="pd-obra-sub">${afastados[i].map(({ p, motivo }) => `${curto(p)} (${motivo.toLowerCase()})`).join(', ')}</span>` : html`<span class="pd-traco">—</span>`))],
  ], { vazio: 'Nenhuma obra na distribuição.' });

  // ---- por funcionário
  const celPessoa = (w) => {
    if (w.semDado) return html`<span class="pd-def">—</span>`;
    const partes = [...[...w.obras].map(([cod, d]) => html`<span class="fo-chip">${cod}${d < 5 ? ` · ${d}d` : ''}</span>`), ...(w.po ? [html`<span class="fo-chip fo-po">Pós-obra</span>`] : []), ...w.afast.map((a) => html`<span class="fo-chip fo-af">${a}</span>`)];
    if (w.naoEntendi) return html`<span class="fo-chip fo-af" title="O texto da planilha não foi entendido: confira">${w.texto}</span>`;
    return partes.length ? html`${partes}` : html`<span class="fo-livre">livre</span>`;
  };
  const ordenadas = [...pessoas].sort((a, b) => ordemFuncao(a.funcao) - ordemFuncao(b.funcao) || String(a.nome).localeCompare(String(b.nome)));
  const tabelaPessoas = pd.tabela(['Funcionário', 'Função', ...semanas.map((s) => `Semana ${dm(s)}`)], ordenadas.map((p) => [
    cap(String(p.nome).replace(/\s+/g, ' ')), cap(rotuloFuncao(p.funcao)), ...p.sm.map((w, i) => html`<span title="${w.texto || 'sem texto na planilha'}">${celPessoa(w)}</span>`),
  ]), { vazio: 'Nenhum funcionário na distribuição.' });

  // ---- resumo
  const i0 = semanas.findIndex((s) => cobertas.has(s));
  const semObra = i0 >= 0 ? linhasObra.filter((o) => o.sit === 'andamento' && !o.semanas[i0].length).map((o) => o.cod) : [];
  const finalComGente = i0 >= 0 ? linhasObra.filter((o) => o.sit === 'finalizada' && o.semanas.some((l) => l.length)).map((o) => o.cod) : [];
  const alocados = i0 >= 0 ? pessoas.filter((p) => p.sm[i0].obras.size || p.sm[i0].po).length : 0;
  const cartoes = pd.cartoes([
    { rotulo: 'Funcionários na distribuição', valor: String(pessoas.length), sub: `semana de ${dm(semanas[0])}` },
    { rotulo: 'Alocados na semana', valor: String(alocados), sub: 'em obra ou pós-obra' },
    { rotulo: 'Livres na semana', valor: String(i0 >= 0 ? livres[i0].length : 0), nivel: i0 >= 0 && livres[i0].length ? 'atencao' : 'ok', sub: 'sem obra na planilha' },
    { rotulo: 'Obras em andamento sem ninguém', valor: String(semObra.length), nivel: semObra.length ? 'critico' : 'ok', sub: semObra.join(', ') || 'todas com equipe' },
  ]);
  const avisos = [
    ultimaCoberta && semanas.some((s) => !cobertas.has(s)) ? `A planilha de distribuição vai até a semana de ${dm(ultimaCoberta)}; as semanas seguintes ficam sem dado até a planilha ser atualizada.` : '',
    finalComGente.length ? `A planilha ainda aloca gente em obra finalizada no Cadastros: ${finalComGente.join(', ')}. Confira se é erro da planilha.` : '',
    eqp.arquivo ? `Fonte: ${eqp.arquivo}${eqp.modificado ? `, salva em ${new Date(eqp.modificado).toLocaleDateString('pt-BR')}` : ''}. O texto da planilha é livre: passe o mouse sobre a célula para ver o original.` : '',
  ].filter(Boolean);

  const nav = html`<div class="fo-nav"><a class="botao" href="#/planejamento/funcionarios?s=${somarDias(ini, -7)}">← Semana anterior</a>
    <b>${dm(semanas[0])} a ${dm(somarDias(semanas[N_SEMANAS - 1], 6))}</b>
    ${ini !== inicioDaSemana(hoje) ? html`<a class="botao" href="#/planejamento/funcionarios">Esta semana</a>` : ''}
    <a class="botao" href="#/planejamento/funcionarios?s=${somarDias(ini, 7)}">Próxima semana →</a></div>`;

  return html`${pd.pergunta('Quem está em cada obra nas próximas 4 semanas, e quem está livre?', 'Pergunta da aba')}
    ${nav}${cartoes}
    ${avisos.length ? pd.caixa('Atenção', pd.itens(avisos)) : ''}
    ${pd.secao('Por obra', 'Quantos de cada função e quem está em cada obra, semana a semana', tabelaObras)}
    ${pd.secao('Por funcionário', 'Onde cada pessoa está em cada semana (chip = obra; "3d" = só 3 dias da semana)', tabelaPessoas)}`;
}
