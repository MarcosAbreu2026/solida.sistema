// Início · visão do CEO (desenho do Marcos, página 3). Contrato e ctx: ver comum.js.
//   1 · Cumprimento da semana (cronogramas, efetivo, diário, setores) · 2 · Planejado × executado por obra
//   3 · Quem precisa agir (geral + todas as áreas) · Orçamento e Financeiro (valores só para sócios)
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { avisoLeitura } from './comum.js';
import * as oc from './obras-comum.js';

const st = (ok) => (ok === true ? 'ok' : ok === false ? 'critico' : '');
const MED = { ok: ['ok', 'Em dia'], nao: ['critico', 'Pendente'], q: ['', 'Sem informação'] };
const pctN = (n, d) => (d ? n / d : null);

export function painel(ctx) {
  const CFG = ctx.CFG || { areas: [], geral: {} };
  const obras = oc.obrasDoPainel(ctx);
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
    const atrasadas = cr.erro ? null : cr.ativ.filter((a) => a.atrasada).length;
    return [
      pd.obraCel(o.obra, oc.endereco(ctx, o.obra), `#/obra/${encodeURIComponent(o.obra)}`),
      cr.erro ? pd.traco() : pd.barraCel(cr.exe),
      atrasadas == null ? pd.traco() : html`<b class="pd-obra">${atrasadas}</b>`,
      html`${pd.selo(st(cron.ok), cron.ok === true ? 'Em dia' : cron.ok === false ? 'Pendências' : 'Sem informação')}${oc.revisao(cr.arquivo) ? html`<span class="pd-obra-sub">${oc.revisao(cr.arquivo)}</span>` : ''}`,
      pd.selo(st(prog.ok), prog.ok === true ? 'Em dia' : prog.ok === false ? 'Pendências' : 'Sem informação'),
      p && p.faseFinal ? pd.selo('atencao', 'Pendências') : pd.selo(metasFeitas ? 'ok' : 'critico', metasFeitas ? 'Feito' : 'Não feito'),
      pd.selo(med[0], med[1]),
      html`<a class="pd-bt" href="#/obra/${encodeURIComponent(o.obra)}">Abrir obra</a>`,
    ];
  });

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
    ${pd.secao('2 · Planejado × executado, por obra', 'Fonte: Drive (GERENCIAMENTO de cada obra) e agentes', pd.tabela(['Obra', 'Avanço', 'Ativ. atrasadas', 'Cronograma', 'Programação semanal', 'Metas diárias', 'Medições', ''], linhas, { vazio: 'Nenhuma obra em curso no planejamento.' }))}
    ${pd.secao('3 · Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir(agir))}
    <div class="${finCaixa ? 'pd-grade2' : ''}">${orc}${finCaixa}</div>`;
}

const SETOR_DA_AREA = { operacao: 'Operação', posobra: 'Pós-obra', transporte: 'Transporte e logística', suprimentos: 'Suprimentos e compras', planejamento: 'Planejamento', projetos: 'Projetos', comercial: 'Comercial', orcamentos: 'Orçamentos', financeiro: 'Financeiro', rh: 'RH' };
const setorDaArea = (id) => SETOR_DA_AREA[id] || '';
