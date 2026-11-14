// Planejamento › Dimensionamento da equipe: a programação semanal (ou, sem ela, a meta da semana) × a produtividade média da EQUIPE por serviço
// (planilha MO602_Produtividade_Equipes, lida para projetos.json › rendimentos) = homens-dia de cada profissional que a semana exige,
// comparado com o que a distribuição de funcionários aloca na obra. A média é da EQUIPE por dia de 8 h (ex.: 10 m²/dia = 1 pedreiro + 1 ajudante),
// não por pessoa. Serviço sem média na planilha aparece como "sem média": o número não é inventado, a planilha é que precisa ganhar a linha.
import { html } from '../formato.js';
import * as pd from './painel-dep.js';
import { somarDias, inicioDaSemana, hojeISO } from '../datas.js';
import { alocacaoPorObra } from './func-obras.js';
import { programacaoDaObra } from './prog-obra.js';
import { obrasComProjeto } from './projetos.js';
import { cronogramaDa } from './operacao.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/²/g, '2').replace(/\s+/g, ' ').trim();
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const n1 = (n) => (Math.round(n * 10) / 10).toLocaleString('pt-BR');
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'para', 'com', 'nas', 'nos', 'ate', 'acima', 'sem', 'por', 'dem', 'demaos', 'demao']);
const radical = (w) => w.replace(/s$/, '');
const tokens = (s) => [...new Set(norm(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((w) => w.length > 2 && !STOP.has(w)).map(radical))];
const unid = (u) => norm(u).replace(/[^a-z0-9]/g, '');
const SEM_MEDIDA = new Set(['verb', 'vb', 'serv', 'comp', 'dia', 'mes']);   // verba, serviço, compartimento: não dá para dividir por média por m²/ml/pt

// profissional da planilha de produtividade → nome curto (igual ao da distribuição)
const PROF = [[/pedreiro/, 'pedreiro', 'pedreiro'], [/ajudante/, 'ajudante', 'ajudante'], [/eletricista/, 'eletricista', 'eletricista'], [/bombeiro/, 'bombeiro', 'bombeiro hidráulico'],
  [/pintor/, 'pintor', 'pintor'], [/montador|gesseiro/, 'gesseiro', 'montador de drywall / gesseiro'], [/carpinteiro/, 'carpinteiro', 'carpinteiro']];
const canon = (n) => (PROF.find(([re]) => re.test(norm(n))) || [null, norm(n), n])[1];
export const rotuloProf = (c) => (PROF.find((p) => p[1] === c) || [null, c, c])[2];
const ORDEM_PROF = PROF.map((p) => p[1]);

// cor de fundo da fase na programação: cinza (neutro) = equipe Sólida; qualquer outra cor (laranja, verde…) = terceiro/fornecedor
const ehTerceiro = (cor) => {
  const h = String(cor || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(h)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return Math.max(r, g, b) - Math.min(r, g, b) > 14;
};
// ---- casar uma tarefa com uma média: mesmo código e nome parecido, ou nome muito parecido (e unidade igual quando as duas existem)
export function casar(l, itens) {
  const cod = norm(l.cod).replace(/\s/g, '');
  const t = tokens(l.tarefa);
  let melhor = null; let nota = 0;
  for (const r of itens) {
    const rt = tokens(r.servico);
    const score = t.length && rt.length ? t.filter((x) => rt.includes(x)).length / Math.min(t.length, rt.length) : 0;
    const mesmoCod = !!cod && norm(r.cod).replace(/\s/g, '') === cod;
    const unidOk = !l.un || !r.unid || unid(l.un) === unid(r.unid);
    const s = score + (mesmoCod ? 0.5 : 0) - (unidOk ? 0 : 0.4);
    if (s > nota) { nota = s; melhor = { r, como: mesmoCod ? 'código' : 'nome', score }; }
  }
  if (!melhor) return null;
  const ok = melhor.como === 'código' ? melhor.score >= 0.34 && nota >= 0.8 : melhor.score >= 0.75 && nota >= 0.75;
  return ok ? melhor : null;
}

// ---- dimensionar uma lista de tarefas { data?, tarefa, cod, qtd, un }
export function dimensionar(linhas, rend) {
  const itensRend = ((rend && rend.itens) || []).filter((r) => r.total > 0 && r.media > 0);
  const hd = {}; const porDia = new Map(); const semMedia = []; const acima = []; const cobertas = []; const terceiros = [];
  for (const l of linhas) {
    if (ehTerceiro(l.cor)) { terceiros.push(l); continue; }   // fase em laranja/verde na programação = fornecedor: não é a equipe Sólida
    if (typeof l.qtd !== 'number' || l.qtd <= 0 || SEM_MEDIDA.has(unid(l.un))) { semMedia.push({ ...l, motivo: 'sem quantidade medida (verba ou serviço)' }); continue; }
    const m = casar(l, itensRend);
    if (!m) { semMedia.push({ ...l, motivo: 'sem média na planilha' }); continue; }
    const dias = l.qtd / m.r.media;
    const eq = {};
    for (const [nome, qt] of Object.entries(m.r.equipe || {})) eq[canon(nome)] = (eq[canon(nome)] || 0) + qt;
    for (const [p, qt] of Object.entries(eq)) hd[p] = (hd[p] || 0) + dias * qt;
    const dia = l.data || 'semana';
    const d = porDia.get(dia) || {}; for (const [p, qt] of Object.entries(eq)) d[p] = (d[p] || 0) + dias * qt; porDia.set(dia, d);
    cobertas.push({ ...l, media: m.r.media, unidMedia: m.r.unid, dias, equipe: eq, como: m.como, status: m.r.status, servicoMedia: m.r.servico });
    if (l.data && dias > 1.05) acima.push({ ...l, media: m.r.media, dias, equipe: eq, servicoMedia: m.r.servico, como: m.como });
  }
  const pico = {};
  for (const d of porDia.values()) for (const [p, v] of Object.entries(d)) pico[p] = Math.max(pico[p] || 0, Math.ceil(v - 1e-9));
  return { hd, pico, porDia, semMedia, acima, cobertas, terceiros };
}

// obra → tarefas da semana: programação (planilha) da semana; sem ela, os itens com quantidade da meta semanal (pré-programação, sem dia)
function tarefasDaObra(CFG, p, cod, ini, hoje) {
  const pr = programacaoDaObra(p, hoje);
  const linhas = ((p && p.programacao && p.programacao.planilha && p.programacao.planilha.linhas) || []).filter((l) => l.data && l.data >= ini && l.data <= somarDias(ini, 6));
  if (linhas.length) return { fonte: 'programação', rotulo: `Programação ${pr.semana || ''}`.trim(), arquivo: pr.arquivo, linhas };
  const sem = (((CFG && CFG.metasSemanais) || {}).semanas || []).find((s) => s.ini === ini);
  const o = sem && (sem.obras || []).find((x) => x.obra === cod);
  const itens = ((o && o.itens) || []).filter((i) => typeof i.meta === 'number' && i.meta > 0).map((i) => ({ data: null, tarefa: i.item, cod: '', qtd: i.meta, un: i.un || i.unidade || '' }));
  if (itens.length) return { fonte: 'meta', rotulo: 'Pré-programação pela meta semanal', arquivo: sem.fonte || '', linhas: itens };
  return { fonte: null, linhas: [] };
}


// ---- escopo × prazo (obra inteira): homens-dia do ESCOPO (itens com média) → o que falta, pelo avanço do cronograma → efetivo médio necessário até o fim previsto
const diasUteis = (de, ate) => { let n = 0; for (let d = de; d <= ate; d = somarDias(d, 1)) { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); if (w !== 0 && w !== 6) n++; } return n; };
const NAO_MEDIVEL = /^(COP|DOC|MAQ|FER|CON)/i;   // custo operacional, documentos, máquinas, ferramentas, consumíveis: não têm produtividade
function escopoDaObra(CFG, drive, cod, p, hoje, rend, alocSemana) {
  const itens = ((p && p.escopo && p.escopo.grupos) || []).flatMap((g) => (g.itens || []).map((i) => ({ cod: i.cod, tarefa: i.desc, qtd: i.quant, un: i.unid })));
  if (!itens.length) return html`<p class="pd-vazio">Sem escopo lido na pasta da obra (GERENCIAMENTO › DOC › ESCOPO).</p>`;
  const cr = cronogramaDa(drive && drive.projetos, cod);
  if (cr.erro) return html`<p class="pd-vazio">Sem cronograma lido: ${cr.erro}.</p>`;
  const medivel = itens.filter((i) => typeof i.qtd === 'number' && i.qtd > 0 && !NAO_MEDIVEL.test(String(i.cod || '')) && !SEM_MEDIDA.has(unid(i.un)));
  const d = dimensionar(medivel, rend);
  const total = Object.values(d.hd).reduce((s, v) => s + v, 0);
  const cobertura = medivel.length ? d.cobertas.length / medivel.length : 0;
  const exe = Math.max(0, Math.min(1, cr.exe || 0));
  const inicio = cr.inicioObra > hoje ? cr.inicioObra : hoje;
  const diasRest = cr.fimObra && cr.fimObra >= inicio ? diasUteis(inicio, cr.fimObra) : 0;
  const vencido = !!cr.fimObra && cr.fimObra < hoje;
  const profs = Object.keys(d.hd).sort((a, b) => ORDEM_PROF.indexOf(a) - ORDEM_PROF.indexOf(b));
  const linhas = profs.map((p2) => {
    const restante = d.hd[p2] * (1 - exe);
    const nec = diasRest ? restante / diasRest : null;
    const aloc = ((alocSemana || {})[p2] && alocSemana[p2].hd) ? alocSemana[p2].hd / 5 : 0;
    let sit = pd.selo('', 'sem distribuição');
    if (alocSemana) {
      if (nec == null) sit = pd.selo('atencao', 'prazo vencido');
      else if (nec > aloc * 1.15 + 0.3) sit = pd.selo('critico', `efetivo abaixo: faltam ~${n1(nec - aloc)} pessoa(s)`);
      else sit = pd.selo('ok', 'efetivo dá conta');
    }
    return [html`<b>${rotuloProf(p2)}</b>`, n1(d.hd[p2]), n1(restante), nec == null ? '—' : n1(nec), alocSemana ? n1(aloc) : '—', sit];
  });
  const avisos = [
    cobertura < 0.5 ? html`<div class="pd-aviso pd-av-atencao"><i aria-hidden="true">⚠</i><span><b>Cobertura baixa:</b> só ${d.cobertas.length} de ${medivel.length} itens do escopo têm média na planilha, então o total está subestimado.</span></div>` : '',
    vencido ? html`<div class="pd-aviso pd-av-atencao"><i aria-hidden="true">⚠</i><span>O fim previsto do cronograma (${dm(cr.fimObra)}) já passou: revisar o cronograma antes de usar o efetivo necessário.</span></div>` : '',
  ];
  return html`<p class="pequeno">${d.cobertas.length} de ${medivel.length} itens do escopo com média (${Math.round(cobertura * 100)}%) · ${d.semMedia.length} sem média · avanço médio do cronograma ${Math.round(exe * 100)}% · ${diasRest} dias úteis até o fim previsto${cr.fimObra ? ` (${dm(cr.fimObra)})` : ''}.</p>${avisos}
    ${pd.tabela(['Profissional', 'Escopo todo (homens-dia)', 'Falta fazer (estimado)', 'Efetivo médio necessário até o fim (pessoas)', 'Alocado na semana (pessoas)', 'Situação'], linhas, { vazio: 'Nenhum item do escopo com média na planilha.' })}
    <p class="pequeno" style="margin-top:6px">Total do escopo: ${n1(total)} homens-dia. "Falta fazer" = escopo × (1 − avanço médio das atividades do cronograma): é uma estimativa, não o medido.</p>`;
}
const STATUS_FRACO = /^(novo|revisado)/i;   // média ainda estimada/revisada: validar medindo na obra

export function render({ CFG, drive, eqp, obrasCad, params, hoje = hojeISO() }) {
  const proj = drive && drive.projetos;
  const rend = proj && proj.rendimentos;
  if (!rend || rend.erro || !(rend.itens || []).length) {
    return html`${pd.pergunta('A equipe alocada dá conta da programação da semana?', 'Pergunta da aba')}${pd.aviso(rend && rend.erro ? `Não consegui ler a planilha de produtividade: ${rend.erro}` : 'A planilha de produtividade (OPERACOES › GERENCIAMENTO OBRAS › …Produtividade_Equipes…xlsx) ainda não chegou do computador do escritório.', 'atencao')}`;
  }
  const ini = inicioDaSemana((params && params.get('s')) || hoje);
  const obras = obrasComProjeto({ areas: (CFG && CFG.areas) || [], obrasCad }, proj, null).filter((o) => !o.pausada);
  const aloc = alocacaoPorObra(eqp, ini);
  const blocos = []; let semDados = []; let totalFalta = 0; let totalSemMedia = 0;
  for (const o of obras) {
    const t = tarefasDaObra(CFG, o, o.obra, ini, hoje);
    if (!t.fonte) { semDados.push(o.obra); continue; }
    const d = dimensionar(t.linhas, rend);
    const al = (aloc.obras.get(o.obra) || { prof: {} }).prof;
    const profs = [...new Set([...Object.keys(d.hd), ...Object.keys(al)])].sort((a, b) => ORDEM_PROF.indexOf(a) - ORDEM_PROF.indexOf(b));
    const dias = t.fonte === 'programação' ? null : 5;
    const linhasProf = profs.map((p) => {
      const nec = d.hd[p] || 0; const tem = (al[p] && al[p].hd) || 0;
      const saldo = tem - nec;
      let sit;
      if (!aloc.cobre) sit = pd.selo('', 'sem distribuição');
      else if (nec === 0 && tem > 0) sit = pd.selo('atencao', 'alocado sem serviço medido');
      else if (saldo < -0.5) { sit = pd.selo('critico', `falta ${n1(-saldo)} homem-dia`); totalFalta++; }
      else if (saldo > 1.5 && saldo > nec * 0.3) sit = pd.selo('atencao', `sobra ${n1(saldo)} homem-dia`);
      else sit = pd.selo('ok', 'ok');
      const pico = dias ? Math.ceil(nec / dias - 1e-9) : d.pico[p] || 0;
      return [html`<b>${rotuloProf(p)}</b>`, nec ? n1(nec) : '—', pico ? `${pico}${dias ? ' por dia (média)' : ' no pico'}` : '—', aloc.cobre ? (tem ? html`${n1(tem)}<span class="pd-obra-sub" title="${(al[p].pessoas || []).join(', ')}">${(al[p].pessoas || []).length} ${(al[p].pessoas || []).length === 1 ? 'pessoa' : 'pessoas'}</span>` : '0') : '—', sit];
    });
    totalSemMedia += d.semMedia.filter((x) => x.motivo === 'sem média na planilha').length;
    const fracas = d.cobertas.filter((c) => STATUS_FRACO.test(c.status || '')).length;
    const proprias = t.linhas.length - d.terceiros.length;
    const cobertura = proprias ? d.cobertas.length / proprias : 1;
    const resumo = html`<p class="pequeno">${d.cobertas.length} de ${proprias} tarefas da equipe Sólida com média${fracas ? ` (${fracas} com média ainda estimada: validar medindo na obra)` : ''}${d.semMedia.length ? ` · ${d.semMedia.length} sem média` : ''}${d.terceiros.length ? ` · ${d.terceiros.length} de terceiros (fora da conta)` : ''}.${t.fonte === 'meta' ? ' Sem programação diária: o total da semana é a pré-programação pela meta, sem dividir por dia.' : ''}</p>
      ${cobertura < 0.5 ? html`<div class="pd-aviso pd-av-atencao"><i aria-hidden="true">⚠</i><span><b>Cobertura baixa:</b> menos da metade das tarefas tem média, então o "necessário" está subestimado. Não conclua que sobra ou falta gente antes de completar a planilha.</span></div>` : ''}`;
    // programado acima do que uma equipe faz em 1 dia: uma linha por tarefa (os dias juntos), dizendo com qual média casou
    const agrupa = new Map();
    for (const a of d.acima) { const k = `${norm(a.tarefa)}|${a.qtd}`; const g = agrupa.get(k) || { ...a, datas: [] }; g.datas.push(a.data); agrupa.set(k, g); }
    const acimaTxt = agrupa.size ? html`<div class="pd-aviso pd-av-atencao"><i aria-hidden="true">⚠</i><span><b>Programado acima do que uma equipe faz em 1 dia:</b><ul>${[...agrupa.values()].map((a) => html`<li>${a.tarefa.toLowerCase()}: ${a.qtd} ${a.un || ''} em ${[...new Set(a.datas)].sort().map((x) => pd.dm(x)).join(', ')} · a equipe faz ${a.media}/dia (média de "${a.servicoMedia}", casada por ${a.como}) = ${n1(a.dias)} equipes por dia</li>`)}</ul></span></div>` : '';
    const semMediaTxt = d.semMedia.length ? html`<details class="caixa"><summary><span class="caixa-tit">Tarefas sem média (${d.semMedia.length})</span><span class="pequeno">acrescentar na planilha de produtividade</span></summary><div style="padding:6px 18px 14px">${pd.itens([...new Map(d.semMedia.map((x) => [`${x.cod}|${norm(x.tarefa)}`, x])).values()].map((x) => `${x.cod ? `${x.cod} · ` : ''}${x.tarefa}${typeof x.qtd === 'number' ? ` (${x.qtd} ${x.un || ''})` : ''}: ${x.motivo}`))}</div></details>` : '';
    blocos.push(pd.secao(`${o.obra} · ${t.rotulo}`, t.arquivo ? `${t.arquivo}` : '', html`${resumo}${pd.tabela(['Profissional', 'Necessário (homens-dia)', 'Pessoas', 'Alocado na distribuição (homens-dia)', 'Situação'], linhasProf, { vazio: 'Nenhuma tarefa com média nesta semana.' })}${acimaTxt}${semMediaTxt}`));
  }
  // escopo × prazo: uma tabela por obra em andamento (não pausada, não em fase de pendências); a alocação é a da semana de hoje
  const alocHoje = alocacaoPorObra(eqp, inicioDaSemana(hoje));
  const ultimaMeta = ((((CFG && CFG.metasSemanais) || {}).semanas) || []).slice(-1)[0];
  const emPendencias = (cod, p) => (p && p.programacao && p.programacao.tipo === 'pendencias') || (!!ultimaMeta && (ultimaMeta.obras || []).some((x) => x.obra === cod && x.tipo === 'pendencias'));
  const escopoBlocos = obras.filter((o) => !emPendencias(o.obra, o)).map((o) => pd.secao(`${o.obra} · escopo × prazo`, 'obra inteira · escopo da pasta × produtividade média × cronograma', escopoDaObra(CFG, drive, o.obra, o, hoje, rend, alocHoje.cobre ? (alocHoje.obras.get(o.obra) || { prof: {} }).prof : null)));
  const nav = html`<div class="fo-nav"><a class="botao" href="#/planejamento/dimensionamento?s=${somarDias(ini, -7)}">← Semana anterior</a>
    <b>Semana de ${dm(ini)} a ${dm(somarDias(ini, 4))}</b>
    ${ini !== inicioDaSemana(hoje) ? html`<a class="botao" href="#/planejamento/dimensionamento">Esta semana</a>` : ''}
    <a class="botao" href="#/planejamento/dimensionamento?s=${somarDias(ini, 7)}">Próxima semana →</a></div>`;
  const avisos = [
    !aloc.cobre ? `A distribuição de funcionários não cobre a semana de ${dm(ini)}: sem ela só dá para ver o necessário.` : '',
    semDados.length ? `Sem programação semanal nem meta com quantidade nesta semana: ${semDados.join(', ')}.` : '',
    totalSemMedia ? `${totalSemMedia} tarefas não casaram com nenhuma média da planilha (listadas em cada obra). Quanto mais serviços a planilha tiver, mais completo o dimensionamento.` : '',
    `Médias: ${rend.arquivo}${rend.modificado ? `, salva em ${new Date(rend.modificado).toLocaleDateString('pt-BR')}` : ''}. Produção por dia de 8 h da equipe indicada (não por pessoa); tarefa em verba ou sem quantidade não entra. Encarregado e pós-obra não entram na conta.`,
    'Alocado = homens-dia da distribuição de funcionários naquela obra (ladrilheiro conta como pedreiro). Um profissional pode estar em duas obras no mesmo dia: confira na aba Funcionários por obra.',
  ].filter(Boolean);
  return html`${pd.pergunta('A equipe alocada dá conta da programação da semana?', 'Pergunta da aba')}
    ${nav}
    ${pd.caixa('Atenção', pd.itens(avisos))}
    ${blocos.length ? blocos : html`<p class="pd-vazio">Nenhuma obra com programação ou meta com quantidade nesta semana.</p>`}
    ${escopoBlocos}`;
}
