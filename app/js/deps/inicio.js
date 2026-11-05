// Início · visão do CEO (desenho do Marcos, página 3). Contrato e ctx: ver comum.js.
//   1 · Cumprimento da semana (cronogramas, efetivo, diário, setores) · 2 · Planejado × executado por obra
//   3 · Meta × executado da semana · 4 · Quem precisa agir (geral + todas as áreas) · Orçamento e Financeiro (valores só para sócios)
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { avisoLeitura } from './comum.js';
import * as oc from './obras-comum.js';
import { resumoMetasSemana, resumoMetasItens, obrasEncerradas } from '../telas/produtividade.js';
import { barrasEmpilhadas } from '../graficos.js';
import { somarDias, hojeISO } from '../datas.js';

// ---- Meta × executado da semana: metas da programação que bateram, ficaram abaixo ou sem registro + dias em que a
// obra não mandou a produtividade no grupo do WhatsApp. Dia não lido no grupo nunca aparece como "enviada".
const DIA_CEL = {
  enviada: ['enviada', '✓ Enviada'], nao: ['nao', '✕ Não enviou'], naolido: ['naolido', '? Não lido'],
  hoje: ['hoje', '… Aguardando'], futuro: ['futuro', '·'], feriado: ['feriado', 'Feriado'],
};
function metaExecutadoDia(ctx, CFG) {
  const m = resumoMetasSemana(CFG, ctx.visiveis || null);
  const t = m.totais;
  const fim = somarDias(m.ini, 4);
  const cartoes = pd.cartoes([
    { rotulo: 'Metas conferidas', valor: t.total, sub: `${m.linhas.length} ${m.linhas.length === 1 ? 'obra' : 'obras'} · semana de ${pd.dm(m.ini)} a ${pd.dm(fim)}` },
    { rotulo: 'Bateram a meta', valor: t.atingiu, sub: `${pd.pct(t.pct)} das metas conferidas`, nivel: t.total ? (t.pct >= 0.95 ? 'ok' : t.pct >= 0.7 ? 'atencao' : 'critico') : '' },
    { rotulo: 'Abaixo da meta', valor: t.abaixo, sub: 'feito, mas menos que a meta do dia', nivel: t.abaixo ? 'atencao' : '' },
    { rotulo: 'Sem registro', valor: t.sem, sub: 'meta do dia sem produtividade enviada', nivel: t.sem ? 'critico' : '' },
    { rotulo: 'Dias sem produtividade', valor: t.diasSem, sub: t.diasNaoLidos ? `não enviou (confirmado) · mais ${t.diasNaoLidos} ainda sem leitura do grupo` : 'obra × dia útil em que não enviou (confirmado)', nivel: t.diasSem ? 'critico' : t.diasNaoLidos ? 'atencao' : '' },
  ], { colunas: 5 });

  const grafico = m.linhas.length ? barrasEmpilhadas(m.linhas.map((l) => ({
    rotulo: l.obra,
    sub: `${l.total} ${l.total === 1 ? 'meta' : 'metas'}`,
    segs: [{ valor: l.atingiu, cls: 'ok' }, { valor: l.abaixo, cls: 'abaixo' }, { valor: l.sem, cls: 'sem' }],
    fim: l.pct == null ? '—' : pd.pct(l.pct),
    dica: `${l.obra}: ${l.atingiu} bateram a meta · ${l.abaixo} abaixo · ${l.sem} sem registro`,
  })), { vazio: 'sem metas conferidas ainda' }) : '';
  const caixaGrafico = m.linhas.length ? html`<div class="pd-caixa"><div class="pd-caixa-h"><h3>Metas da semana por obra</h3><span class="pd-fonte">% à direita = metas que bateram</span></div>
    <div class="pd-emp">${html.seguro(grafico)}</div>
    <p class="pd-legenda"><span class="pd-lg pd-lg-ok"></span> bateu a meta <span class="pd-lg pd-lg-abaixo"></span> abaixo da meta <span class="pd-lg pd-lg-sem"></span> sem registro</p></div>` : '';

  const nomes = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  const linhas = m.linhas.map((l) => [
    pd.obraCel(l.obra, '', `#/obra/${encodeURIComponent(l.obra)}`),
    ...l.dias.map((d) => { const c = DIA_CEL[d.estado] || DIA_CEL.futuro; return html`<span class="pd-dia pd-dia-${c[0]}" title="${d.titulo || ''}">${c[1]}</span>`; }),
  ]);
  const tabela = pd.tabela(['Obra', ...m.dias.map((d, i) => `${nomes[i]} ${pd.dm(d)}`)], linhas, { vazio: 'Nenhuma obra com programação na semana.' });
  const naoLidos = t.diasNaoLidos;
  const aviso = naoLidos ? pd.aviso(`${naoLidos} ${naoLidos === 1 ? 'dia ainda não foi verificado' : 'dias ainda não foram verificados'} nos grupos de WhatsApp: a produtividade só aparece depois que o agente lê o grupo. "Não lido" não quer dizer que a obra deixou de enviar.`, 'atencao') : '';
  const legenda = html`<p class="pd-legenda"><span class="pd-dia pd-dia-enviada">✓ Enviada</span> a obra postou a produtividade do dia no grupo <span class="pd-dia pd-dia-nao">✕ Não enviou</span> o agente leu o grupo e não havia <span class="pd-dia pd-dia-naolido">? Não lido</span> ainda sem leitura do grupo <span class="pd-dia pd-dia-hoje">… Aguardando</span> hoje, prazo 12h</p>`;
  const completo = html`${cartoes}${caixaGrafico}${aviso}<h3 class="pd-sub-h">Envio da produtividade nos grupos</h3>${tabela}${legenda}`;
  completo.tabelaEnvio = tabela; completo.legenda = legenda;
  return completo;
}


// ---- Meta SEMANAL × executado, por item: a meta vem do PDF de metas semanais (Drive, postado na semana anterior) e o executado dos
// relatórios diários dos grupos. Na última coluna do gráfico, uma bolinha por dia útil (S T Q Q S): enviou ou não a produtividade no grupo.
// "Não lido" não existe: dia passado sem relatório no grupo conta como "não enviou".
const BOLA = { enviada: ['enviada', 'enviou a produtividade no grupo'], nao: ['nao', 'não enviou a produtividade no grupo'], naolido: ['nao', 'não enviou: nenhum relatório encontrado no grupo'],
  hoje: ['hoje', 'aguardando (prazo até o fim do dia)'], futuro: ['futuro', 'dia ainda não chegou'], feriado: ['feriado', 'feriado'] };
const INICIAL = ['S', 'T', 'Q', 'Q', 'S'];
function bolinhas(l, dias) {
  if (!l) return html.seguro('<span class="pd-bols"></span>');
  const bs = l.dias.map((d, i) => { const c = BOLA[d.estado] || BOLA.futuro; const t = `${['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'][i]} ${pd.dm(d.data)}: ${d.titulo || c[1]}`; return `<span class="pd-bol pd-bol-${c[0]}" title="${t}">${INICIAL[i]}</span>`; }).join('');
  return html.seguro(`<span class="pd-bols">${bs}</span>`);
}
function bolinhasProprias(l) {
  const hoje = hojeISO(); const ds = [];
  for (let d = l.ini, i = 0; ds.length < 5 && i < 12; d = somarDias(d, 1), i++) { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); if (w !== 0 && w !== 6) ds.push({ data: d, w }); }
  const nomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const bs = ds.map((x) => { const c = BOLA[x.data === hoje ? 'hoje' : x.data > hoje ? 'futuro' : 'naolido']; return `<span class="pd-bol pd-bol-${c[0]}" title="${nomes[x.w]} ${pd.dm(x.data)}: ${c[1]}">${INICIAL[x.w - 1] || 'S'}</span>`; }).join('');
  return html.seguro(`<span class="pd-bols">${bs}</span>`);
}
function metaExecutado(ctx, CFG) {
  const mi = resumoMetasItens(CFG, ctx.visiveis || null);
  if (!mi || !mi.linhas.length) return metaExecutadoDia(ctx, CFG);
  const t = mi.totais;
  const lidoAte = mi.linhas.map((l) => l.lidoAte).filter(Boolean).sort().pop();
  const nObras = mi.linhas.filter((l) => l.total && !l.semLeitura && !l.encerrada).length;
  const cartoes = pd.cartoes([
    { rotulo: 'Itens com meta na semana', valor: t.total, sub: `${nObras} obras · semana de ${pd.dm(mi.ini)} a ${pd.dm(mi.fim)}${lidoAte ? ` · executado lido até ${pd.dm(lidoAte)}` : ''}` },
    { rotulo: 'Cumprimento da meta', valor: pd.pct(t.pct), sub: 'média dos itens (parcial conta a fração feita)', nivel: t.pct == null ? '' : t.pct >= 0.95 ? 'ok' : t.pct >= 0.7 ? 'atencao' : 'critico' },
    { rotulo: 'Concluídos', valor: t.ok, sub: 'feito ≥ meta da semana', nivel: t.ok ? 'ok' : '' },
    { rotulo: 'Em andamento', valor: t.parcial, sub: 'parte da meta feita', nivel: t.parcial ? 'atencao' : '' },
    { rotulo: 'Sem execução registrada', valor: t.nao, sub: 'nenhum relatório traz o item', nivel: t.nao ? 'critico' : '' },
  ], { colunas: 5 });
  const grafico = barrasEmpilhadas(mi.linhas.map((l) => ({
    rotulo: l.obra,
    sub: l.encerrada ? l.encerrada : l.semLeitura ? `${l.total} itens · ${pd.dm(l.ini)} a ${pd.dm(l.fim)}` : l.tipo === 'pendencias' ? `${l.previstos} pendências previstas` : l.total ? `${l.total} ${l.total === 1 ? 'item' : 'itens'}` : 'sem meta',
    segs: [{ valor: l.ok, cls: 'ok' }, { valor: l.parcial, cls: 'abaixo' }, { valor: l.nao, cls: 'sem' }],
    fim: l.pct == null ? '—' : pd.pct(l.pct),
    vazio: l.encerrada ? `obra ${l.encerrada.toLowerCase()}` : l.semLeitura ? 'aguardando os relatórios da semana' : '',
    dica: `${l.obra}: ${l.ok} concluídos · ${l.parcial} em andamento · ${l.nao} sem execução`,
  })), { vazio: 'sem meta semanal conferida' });
  const caixaGrafico = html`<div class="pd-caixa"><div class="pd-caixa-h"><h3>Meta da semana × executado, por obra</h3><span class="pd-fonte">% à direita = cumprimento da meta até agora</span></div>
    <div class="pd-emp">${html.seguro(grafico)}</div>
    <p class="pd-legenda"><span class="pd-lg pd-lg-ok"></span> concluído <span class="pd-lg pd-lg-abaixo"></span> em andamento <span class="pd-lg pd-lg-sem"></span> sem execução registrada</p></div>`;
  const avisos = mi.linhas.flatMap((l) => l.lacunas.map((x) => `${l.obra}: ${x}`));
  const aviso = avisos.length ? pd.aviso(avisos.join(' · '), 'atencao') : '';
  return html`${cartoes}${caixaGrafico}${aviso}`;
}

const st = (ok) => (ok === true ? 'ok' : ok === false ? 'critico' : '');
const MED = { ok: ['ok', 'Em dia'], nao: ['critico', 'Pendente'], q: ['', 'Sem informação'] };
const pctN = (n, d) => (d ? n / d : null);

export function painel(ctx) {
  const CFG = ctx.CFG || { areas: [], geral: {} };
  const obras = oc.obrasDoPainel(ctx);
  const enc = obrasEncerradas(CFG);
  const prodDia = resumoMetasSemana(CFG, ctx.visiveis || null);
  const miProd = resumoMetasItens(CFG, ctx.visiveis || null);
  const bolsDe = (cod) => { const l = miProd && miProd.linhas.find((x) => x.obra === cod); return l && l.semLeitura && l.ini ? bolinhasProprias(l) : bolinhas(prodDia.linhas.find((x) => x.obra === cod)); };
  const metasPdf = new Set((((CFG.metasSemanais || {}).semanas || []).slice(-1)[0] || { obras: [] }).obras.filter((o) => o.tipo !== 'sem-meta' && (o.itens || []).length).map((o) => o.obra));
  const leitura = CFG.atualizadoEm ? pd.dm(String(CFG.atualizadoEm).slice(0, 10)) : '—';

  // ---- 1 · cumprimento da semana
  const cronOk = obras.filter((o) => (o.cronograma || {}).ok === true).length;
  const diaEf = ctx.efetivo && ctx.efetivo.dias && ctx.efetivo.dias[ctx.hoje] ? ctx.hoje : oc.diaUtil(ctx.hoje, -1);
  const comEf = obras.filter((o) => oc.efetivo(ctx, diaEf, o.obra).enviado).length;
  const temEf = !!(ctx.efetivo && ctx.efetivo.dias && Object.keys(ctx.efetivo.dias).length);
  const diarioK = pd.kpiDoAgente(CFG.areas.find((a) => a.id === 'operacao'), /di[áa]rio/i);
  const diarioN = diarioK && String(diarioK.valor).match(/(\d+)\s*de\s*(\d+)/);
  const areas = CFG.areas.filter((a) => a.status);
  const setoresOk = areas.filter((a) => a.status === 'ok').length;
  const nivel = (v, meta) => (v == null ? '' : v >= meta ? 'ok' : v >= meta * 0.7 ? 'atencao' : 'critico');
  const vCron = pctN(cronOk, obras.length); const vEf = temEf ? pctN(comEf, obras.length) : null;
  const vDia = diarioN ? pctN(Number(diarioN[1]), Number(diarioN[2])) : null; const vSet = pctN(setoresOk, areas.length);
  const cumprimento = pd.cartoes([
    { rotulo: 'Cronogramas em dia', valor: pd.pct(vCron), barra: vCron ?? undefined, sub: `${cronOk} de ${obras.length} obras · leitura ${leitura}`, meta: 'Meta ≥ 95%', nivel: nivel(vCron, 0.95) },
    { rotulo: 'Efetivo enviado', valor: pd.pct(vEf), barra: vEf ?? undefined, sub: temEf ? `${comEf} de ${obras.length} obras · ${pd.dm(diaEf)}` : 'Efetivo dos grupos ainda não lido', meta: 'Prazo: 12h do dia', nivel: nivel(vEf, 0.95) },
    { rotulo: 'Diário de obra em dia', valor: pd.pct(vDia), barra: vDia ?? undefined, sub: diarioN ? `${diarioN[1]} de ${diarioN[2]} obras · leitura ${leitura}` : 'Sem leitura do Mais Controle', meta: 'Meta ≥ 95%', nivel: nivel(vDia, 0.95) },
    { rotulo: 'Setores em dia', valor: pd.pct(vSet), barra: vSet ?? undefined, sub: `${setoresOk} de ${areas.length} avaliados`, meta: 'Meta a definir', nivel: vSet == null ? '' : vSet >= 0.95 ? 'ok' : 'critico' },
  ]);

  // ---- 2 · planejado × executado, por obra
  const linhas = obras.map((o) => {
    const cr = oc.cronograma(ctx, o.obra);
    const cron = o.cronograma || {}; const prog = o.programacao || {};
    const p = oc.progDa(ctx, o.obra);
    const ini = ctx.hoje; const semana = p ? (p.dias || []).filter((d) => d.data >= oc.diaUtil(ini, -5) && d.data <= ini) : [];
    const metasFeitas = semana.some((d) => d.fonte === 'whatsapp') || oc.lista(ctx.celular).some((r) => r.tipo === 'executado' && oc.mesmaObra(r.obra, o.obra) && r.data >= oc.diaUtil(ini, -5));
    const med = MED[oc.medicao(ctx, o.obra).status] || MED.q;
    const situ = enc[o.obra];
    if (situ) return [pd.obraCel(o.obra, oc.endereco(ctx, o.obra), `#/obra/${encodeURIComponent(o.obra)}`), cr.erro ? pd.traco() : pd.barraCel(cr.exe), pd.traco(), pd.selo('', situ), pd.selo('', situ), pd.selo('', situ), pd.selo('', situ), pd.selo('', situ), pd.selo(med[0], med[1]), html`<a class="pd-bt" href="#/obra/${encodeURIComponent(o.obra)}">Abrir obra</a>`];
    const atrasadas = cr.erro ? null : cr.ativ.filter((a) => a.atrasada).length;
    return [
      pd.obraCel(o.obra, oc.endereco(ctx, o.obra), `#/obra/${encodeURIComponent(o.obra)}`),
      cr.erro ? pd.traco() : pd.barraCel(cr.exe),
      atrasadas == null ? pd.traco() : html`<b class="pd-obra">${atrasadas}</b>`,
      html`${pd.selo(st(cron.ok), cron.ok === true ? 'Em dia' : cron.ok === false ? 'Pendências' : 'Sem informação')}${oc.revisao(cr.arquivo) ? html`<span class="pd-obra-sub">${oc.revisao(cr.arquivo)}</span>` : ''}`,
      pd.selo(st(prog.ok), prog.ok === true ? 'Em dia' : prog.ok === false ? 'Pendências' : 'Sem informação'),
      pd.selo(metasPdf.has(o.obra) ? 'ok' : 'critico', metasPdf.has(o.obra) ? 'Feito' : 'Não feito'),
      p && p.faseFinal ? pd.selo('atencao', 'Pendências') : pd.selo(metasFeitas ? 'ok' : 'critico', metasFeitas ? 'Feito' : 'Não feito'),
      bolsDe(o.obra),
      pd.selo(med[0], med[1]),
      html`<a class="pd-bt" href="#/obra/${encodeURIComponent(o.obra)}">Abrir obra</a>`,
    ];
  });

  const legendaProd = html`<p class="pd-legenda">Produtividade enviada no grupo, por dia útil (S T Q Q S): <span class="pd-bol pd-bol-enviada">S</span> enviou <span class="pd-bol pd-bol-nao">S</span> não enviou <span class="pd-bol pd-bol-hoje">S</span> aguardando (hoje) <span class="pd-bol pd-bol-futuro">S</span> ainda não chegou <span class="pd-bol pd-bol-feriado">S</span> feriado</p>`;

  // ---- 3 · quem precisa agir: geral + áreas, críticos primeiro
  const alertas = [pd.alertasDoAgente(CFG.geral, { veValores: ctx.veValores, obras: ctx.visiveis, limite: 20 }),
    ...CFG.areas.map((a) => pd.alertasDoAgente(a, { veValores: ctx.veValores, obras: ctx.visiveis, limite: 20 }).map((x) => ({ ...x, setor: setorDaArea(a.id) })))].flat();
  const vistos = new Set();
  const agir = alertas.filter((a) => (vistos.has(a.texto) ? false : vistos.add(a.texto))).sort((x, y) => (x.nivel === y.nivel ? 0 : x.nivel === 'critico' ? -1 : 1)).slice(0, 8);

  // ---- caixas Orçamento e Financeiro
  const com = CFG.areas.find((a) => a.id === 'comercial');
  const k = (re, area = com) => pd.kpiDoAgente(area, re);
  const conv = k(/convers/i); const valorAberto = k(/valor/i);
  const orc = pd.caixa('Orçamento', pd.cartoes([
    { rotulo: 'Em andamento', valor: (k(/andamento/i) || {}).valor },
    { rotulo: 'Conversão no ano', valor: (conv || {}).valor, meta: 'Meta ≥ 25%', nivel: conv && parseFloat(conv.valor) < 25 ? 'critico' : '' },
    { rotulo: 'Fechados no ano', valor: (k(/fechados/i) || {}).valor },
    ...(ctx.veValores ? [{ rotulo: 'Valor em aberto', valor: (valorAberto || {}).valor, sub: 'visível só para sócios' }] : []),
  ], { colunas: 2 }), { direita: `Agente comercial · leitura ${leitura}` });
  const fin = CFG.areas.find((a) => a.id === 'financeiro');
  const fat = pd.kpiDoAgente(CFG.geral, /fatura/i); const marg = k(/margem/i, fin); const rec = k(/receb|receber/i, fin);
  const finCaixa = ctx.veValores ? pd.caixa('Financeiro', html`${pd.cartoes([
    { rotulo: 'Faturamento', valor: (fat || {}).valor }, { rotulo: 'Lucro', valor: '—' },
    { rotulo: 'Margem de lucro', valor: (marg || {}).valor }, { rotulo: 'A receber', valor: (rec || {}).valor },
  ], { colunas: 2 })}<p class="pd-c-sub">Lucro e a receber: aguardando a leitura do Conta Azul pelo agente financeiro.</p>`, { direita: 'Conta Azul · só sócios' }) : '';

  return html`${pd.pergunta('O que está acontecendo hoje no canteiro? Está de acordo com o planejado? Se não, quem precisa agir?', 'Pergunta do dia')}
    ${avisoLeitura(ctx)}
    ${pd.secao('1 · Cumprimento da semana', `Fonte: Drive (cronograma), WhatsApp (efetivo e diário) · leitura ${leitura}`, cumprimento)}
    ${pd.secao('2 · Planejado × executado, por obra', 'Fonte: Drive (GERENCIAMENTO de cada obra) e agentes', html`${pd.tabela(['Obra', 'Avanço', 'Ativ. atrasadas', 'Cronograma', 'Programação semanal', 'Metas semanais', 'Metas diárias', 'Produtividade', 'Medições', ''], linhas, { vazio: 'Nenhuma obra em curso no planejamento.' })}${legendaProd}`)}
    ${pd.secao('3 · Meta × executado da semana', 'Fonte: programação semanal e metas (Drive/WhatsApp) · produtividade enviada nos grupos', metaExecutado(ctx, CFG))}
    ${pd.secao('4 · Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir(agir))}
    <div class="${finCaixa ? 'pd-grade2' : ''}">${orc}${finCaixa}</div>`;
}

const SETOR_DA_AREA = { operacao: 'Operação', posobra: 'Pós-obra', transporte: 'Transporte e logística', suprimentos: 'Suprimentos e compras', planejamento: 'Planejamento', projetos: 'Projetos', comercial: 'Comercial', orcamentos: 'Orçamentos', financeiro: 'Financeiro', rh: 'RH' };
const setorDaArea = (id) => SETOR_DA_AREA[id] || '';
