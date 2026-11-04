// Página de uma obra (Operações › Mo531, desenho do Marcos, página 5): Resumo + abas. Contrato e ctx: ver comum.js.
// As abas Cronograma, Programação semanal, Medições e Escopo e aditivos vêm de telas/operacao.js (main.js);
// as novas (Efetivo e produtividade, Diário de obra, Compras, Pendências) estão aqui.
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import * as oc from './obras-comum.js';
import { somarDias } from '../datas.js';

export const ABAS = [
  { id: '', nome: 'Resumo' }, { id: 'cronograma', nome: 'Cronograma' }, { id: 'programacao', nome: 'Programação semanal' },
  { id: 'medicoes', nome: 'Medições' }, { id: 'efetivo', nome: 'Efetivo e produtividade' }, { id: 'diario', nome: 'Diário de obra' },
  { id: 'compras', nome: 'Compras' }, { id: 'escopo', nome: 'Escopo e aditivos' }, { id: 'pendencias', nome: 'Pendências' },
];

const brl = (v) => (typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—');
const qtd = (n) => (typeof n === 'number' ? n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '');

// topo: "Operações · obras em andamento", endereço e equipe; à direita início e previsão atual do cronograma
export function cabecalho(ctx, cod) {
  const eq = oc.equipeDa(ctx, cod); const cr = oc.cronograma(ctx, cod);
  const partes = ['Coordenadora: Simone', eq.gestor.length ? `Gestor: ${eq.gestor.join(', ')}` : '', eq.estagiario.length ? `Estagiário: ${eq.estagiario.join(', ')}` : '', eq.encarregado.length ? `Encarregado: ${eq.encarregado.join(', ')}` : ''].filter(Boolean);
  const end = oc.endereco(ctx, cod);
  const direita = cr.erro ? '' : html`<div><span>Início</span><b>${pd.dma(cr.inicioObra)}</b></div><div><span>Previsão atual</span><b>${pd.dma(cr.fimObra)}</b></div>`;
  return pd.cabecalho({ rotulo: 'Operações · obras em andamento', resp: html`${end ? html`<b>${end}</b><br>` : ''}${partes.join(' · ')}`, direita });
}

// lista de itens de um dia ("serviço: quantidade unidade")
const itemTxt = (i) => `${i.item}${i.meta != null ? `: ${qtd(i.meta)} ${i.unidade}` : ''}`;

export function resumo(ctx, cod) {
  const cr = oc.cronograma(ctx, cod);
  const ontem = oc.diaUtil(ctx.hoje, -1); const amanha = oc.diaUtil(ctx.hoje, 1);
  const dOntem = oc.itensDoDia(ctx, cod, ontem); const dHoje = oc.itensDoDia(ctx, cod, ctx.hoje); const dAmanha = oc.itensDoDia(ctx, cod, amanha);

  // ---- meta do dia
  const nao = dOntem.itens.filter((i) => i.sit === 'nao'); const av = dOntem.itens.filter((i) => i.sit === 'avancou'); const feitos = dOntem.itens.filter((i) => i.sit === 'feito');
  const semRes = dOntem.itens.filter((i) => !i.sit);
  const resOntem = pd.caixa('Resultado de ontem', dOntem.itens.length ? html`
      <div>${pd.selo('ok', `${feitos.length} feitos`)} ${pd.selo('atencao', `${av.length} avançaram`)} ${pd.selo('critico', `${nao.length} não feitos`)}</div>
      ${nao.length ? html`<div class="pd-aviso"><span><b>NÃO FEITO</b>${pd.itens(nao.map((i) => `${itemTxt(i)}${i.motivo ? ` (${i.motivo})` : ''}`))}</span></div>` : ''}
      ${av.length ? html`<span class="pd-c-rot">Avançou</span>${pd.itens(av.map((i) => `${i.item}: ${qtd(i.feito)} de ${qtd(i.meta)} ${i.unidade}`))}` : ''}
      ${feitos.length ? html`<span class="pd-c-rot">Feito</span>${pd.itens(feitos.map(itemTxt))}` : ''}
      ${semRes.length ? html`<span class="pd-c-rot">Sem resultado relatado</span>${pd.itens(semRes.map(itemTxt))}` : ''}`
    : html`<p class="pd-vazio">${pd.dm(ontem)}: sem meta do dia na programação${dOntem.relatou ? '' : ' e sem relatório no grupo'}.</p>`, { direita: pd.dm(ontem) });
  const metaHoje = pd.caixa('Meta de hoje', dHoje.itens.length ? pd.itens(dHoje.itens.map(itemTxt)) : html`<p class="pd-vazio">Sem meta do dia: vem da programação semanal do gestor (por profissional e quantidade).</p>`, { direita: pd.dm(ctx.hoje) });
  const metaAm = pd.caixa('Meta de amanhã', dAmanha.itens.length ? pd.itens(dAmanha.itens.map(itemTxt)) : html`<p class="pd-vazio">A equipe já sai sabendo o que fazer no dia seguinte: ainda sem programação para ${pd.dm(amanha)}.</p>`, { direita: pd.dm(amanha) });

  // ---- como a meta chega ao canteiro
  const como = pd.caixa('Como a meta chega ao canteiro', html`<div class="pd-grade3">
      <div><span class="pd-c-rot">1 · Planejamento</span><p class="pd-c-sub">Define a meta da semana da obra. Ex.: quantos m² de contrapiso na semana.</p></div>
      <div><span class="pd-c-rot">2 · Gestor de obra</span><p class="pd-c-sub">Divide por dia na programação semanal: quinta, fim do dia, ou sexta de manhã.</p></div>
      <div><span class="pd-c-rot">3 · Encarregado e estagiário</span><p class="pd-c-sub">Registram o executado no celular da obra, no fim do dia.</p></div></div>`);

  // ---- planejado × executado
  const plan = cr.erro ? pd.caixa('Planejado × executado', html`<p class="pd-vazio">${cr.erro}.</p>`)
    : pd.caixa('Planejado × executado', html`${pd.cartoes([
        { rotulo: `Prazo decorrido (${pd.dm(cr.inicioObra)} a ${pd.dm(cr.fimObra)})`, valor: cr.tempo == null ? '—' : pd.pct(cr.tempo), barra: cr.tempo ?? undefined },
        { rotulo: 'Avanço médio da obra', valor: pd.pct(cr.exe), barra: cr.exe, nivel: cr.tempo != null && cr.exe + 0.1 < cr.tempo ? 'critico' : 'ok' },
      ], { colunas: 2 })}`, { direita: `Avanço: cronograma ${oc.revisao(cr.arquivo)}${cr.modificado ? ` (${pd.dm(String(cr.modificado).slice(0, 10))})` : ''} · prazo até a previsão atual` });

  // ---- os 3 blocos
  const ad = oc.aderenciaSemana(ctx, cod);
  const atrasadas = cr.erro ? null : cr.ativ.filter((a) => a.atrasada).length;
  const pend = oc.pendenciasDaObra(ctx, cod).filter((p) => p.status === 'aberta');
  const pendAtr = pend.filter((p) => p.prazo && p.prazo < ctx.hoje).length;
  const linhaB = (rot, valor, fonte) => html`<div class="pd-bloco-l"><div><span class="pd-c-rot">${rot}</span><span class="pd-c-sub">${fonte}</span></div><div>${valor}</div></div>`;
  const e = oc.efetivo(ctx, ctx.hoje, cod); const eOntem = oc.efetivo(ctx, ontem, cod);
  const efUsado = e.enviado ? e : eOntem;
  const celHoje = oc.lista(ctx.celular).filter((r) => r.tipo === 'executado' && r.data === ctx.hoje && oc.mesmaObra(r.obra, cod)).length;
  const matProj = oc.alertasDaObra(ctx, cod, { areas: ['suprimentos', 'projetos', 'planejamento'] }).slice(0, 4);
  const blocos = html`<div class="pd-grade3">
    ${pd.caixa('1 · Obra no prazo', html`<p class="pd-c-sub">O serviço está andando conforme o cronograma?</p>
      ${linhaB('Aderência à meta da semana', ad ? pd.selo(ad.valor >= 0.9 ? 'ok' : 'critico', `${pd.pct(ad.valor)} (${ad.ok} de ${ad.tot})`) : pd.traco(), 'Produtividade relatada')}
      ${linhaB('Atividades com fim previsto vencido', atrasadas == null ? pd.traco() : pd.selo(atrasadas ? 'atencao' : 'ok', String(atrasadas)), `Cronograma ${cr.erro ? '' : oc.revisao(cr.arquivo)}`)}
      ${linhaB('Fim previsto', cr.erro ? pd.traco() : pd.selo(cr.fimObra < ctx.hoje ? 'critico' : 'ok', pd.dm(cr.fimObra)), 'Previsão atual do cronograma')}
      ${linhaB('Pendências abertas', pend.length ? pd.selo(pendAtr ? 'atencao' : 'ok', `${pend.length} em aberto${pendAtr ? `, ${pendAtr} atrasadas` : ''}`) : pd.selo('ok', 'nenhuma'), 'Atas e pendências')}`)}
    ${pd.caixa('2 · Mão de obra produtiva', html`<p class="pd-c-sub">Tem gente certa no canteiro, produzindo a meta?</p>
      ${linhaB(`Efetivo ${efUsado === e ? 'de hoje' : pd.dm(ontem)}`, efUsado.enviado ? pd.selo('ok', `${efUsado.solida} Sólida + ${efUsado.terceiros} terc.`) : pd.traco(), 'Grupo da obra (WhatsApp)')}
      ${linhaB('Metas diárias registradas hoje', celHoje ? pd.selo('ok', String(celHoje)) : pd.traco(), 'Celular da obra')}
      ${linhaB('Relatório diário de ontem', dOntem.relatou ? pd.selo('ok', 'enviado') : dOntem.temProg ? pd.selo('critico', 'não enviado') : pd.traco(), 'Grupo da obra')}`)}
    ${pd.caixa('3 · Material e projeto na hora', html`<p class="pd-c-sub">O que o serviço precisa já chegou?</p>
      ${matProj.length ? pd.itens(matProj.map((a) => a.texto)) : html`<p class="pd-vazio">Nenhum alerta de compra, projeto ou planejamento citando a obra.</p>`}`)}
  </div>`;

  // ---- quem precisa agir nesta obra
  const agir = oc.alertasDaObra(ctx, cod).slice(0, 8);
  if (atrasadas >= 5) agir.push({ nivel: 'atencao', obra: cod, texto: `${atrasadas} atividades com fim vencido no cronograma ${oc.revisao(cr.arquivo)}.` });

  // ---- escopo e aditivos
  const p = oc.projetoDa(ctx, cod); const es = p && p.escopo;
  const ads = oc.lista(es && es.aditivos);
  const aprov = ads.filter((a) => a.situacao === 'aprovado');
  const itensEscopo = es ? oc.lista(es.grupos).reduce((s, g) => s + oc.lista(g && g.itens).length, 0) : 0;
  const escopo = es && !es.erro ? pd.cartoes([
    { rotulo: 'Itens do escopo', valor: itensEscopo ? String(itensEscopo) : '—', sub: `${oc.lista(es.grupos).length} grupos`, href: `#/obra/${encodeURIComponent(cod)}/escopo` },
    { rotulo: 'Aditivos', valor: String(ads.length), sub: `${aprov.length} aprovados · ${ads.filter((a) => a.situacao === 'sem').length} sem indicação`, href: `#/obra/${encodeURIComponent(cod)}/escopo` },
    ...(ctx.veValores ? [{ rotulo: 'Aprovados', valor: aprov.length ? brl(aprov.reduce((s, a) => s + (typeof a.total === 'number' ? a.total : 0), 0)) : '—', sub: 'soma dos aditivos aprovados' }] : []),
  ], { colunas: 3 }) : html`<p class="pd-vazio">Nenhuma planilha de escopo na pasta da obra (GERENCIAMENTO › DOC › ESCOPO).</p>`;

  return html`<div class="pd-sec-h"><h2>Meta do dia</h2><a class="pd-bt pd-bt-cheio" href="#/celular/${encodeURIComponent(cod)}">Abrir celular da obra</a></div>
    <div class="pd-grade3">${resOntem}${metaHoje}${metaAm}</div>
    ${como}
    ${plan}
    ${blocos}
    ${pd.secao('Quem precisa agir nesta obra', 'Alertas dos agentes que citam a obra · alerta vira tarefa com data-limite', pd.quemAgir(agir, { obra: cod, setor: 'Operação' }))}
    ${pd.secao('Escopo e aditivos', es && es.arquivo ? `Drive · ${es.arquivo}${ctx.veValores ? '' : ' · valores só para sócios'}` : '', escopo)}`;
}

// ---------------------------------------------------------------- abas novas
export function aba(ctx, cod, abaId) {
  if (abaId === 'efetivo') return abaEfetivo(ctx, cod);
  if (abaId === 'diario') return abaDiario(ctx, cod);
  if (abaId === 'compras') return abaCompras(ctx, cod);
  if (abaId === 'pendencias') return abaPendencias(ctx, cod);
  return html`<p class="pd-vazio">Aba não encontrada.</p>`;
}

// efetivo dia a dia (últimos 10 dias úteis) + produtividade relatada
function abaEfetivo(ctx, cod) {
  const dias = []; let d = ctx.hoje;
  for (let i = 0; i < 10; i++) { dias.push(d); d = oc.diaUtil(d, -1); }
  const linhas = dias.map((dia) => {
    const e = oc.efetivo(ctx, dia, cod); const it = oc.itensDoDia(ctx, cod, dia);
    const ok = it.itens.filter((x) => x.sit === 'feito').length; const com = it.itens.filter((x) => x.sit).length;
    return [html`<b class="pd-obra">${pd.dm(dia)}</b>`,
      e.enviado ? html`${e.solida}${e.nomes.length ? html`<span class="pd-obra-sub">${e.nomes.join(', ')}</span>` : ''}` : pd.selo('', dia === ctx.hoje && !oc.efetivoLidoHoje(ctx, cod) ? 'grupo não lido' : 'não enviado'),
      e.enviado ? html`${e.terceiros}${e.empresas.length ? html`<span class="pd-obra-sub">${e.empresas.join(', ')}</span>` : ''}` : '',
      e.hora || '',
      com ? pd.selo(ok === com ? 'ok' : 'atencao', `${ok} de ${com} metas`) : it.relatou ? pd.selo('ok', 'relatório enviado') : it.temProg ? pd.selo('critico', 'sem relatório') : ''];
  });
  return html`${pd.secao('Efetivo e produtividade', 'Efetivo: grupo da obra (até 12h) · produtividade: relatório diário e celular da obra',
    pd.tabela(['Dia', 'Equipe Sólida', 'Terceirizados', 'Hora do envio', 'Produtividade'], linhas))}`;
}

// diário de obra: o que o agente leu no Mais Controle + os diários lançados no celular da obra
function abaDiario(ctx, cod) {
  const i = oc.diario(ctx, cod);
  const regs = oc.lista(ctx.celular).filter((r) => r.tipo === 'diario' && oc.mesmaObra(r.obra, cod)).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return html`${pd.caixa('Diário de obra no Mais Controle', html`<div>${pd.selo(i.status === 'ok' ? 'ok' : i.status === 'nao' ? 'critico' : '', i.status === 'ok' ? 'Em dia' : i.status === 'nao' ? 'Pendente' : 'Sem informação')}</div><p class="pd-c-sub">${i.texto}</p>`, { direita: 'Agente de Operação · POP 1.8 · meta: diário em dia em ≥ 95% das obras' })}
    ${pd.secao('Diários lançados no celular da obra', '', pd.tabela(['Dia', 'Registro', 'Quem'], regs.map((r) => [html`<b class="pd-obra">${pd.dm(r.data)}</b>`, r.texto || (r.dados && r.dados.texto) || '', r.responsavel || '']),
      { vazio: 'Nenhum diário lançado pelo celular da obra ainda.' }))}
    <a class="pd-bt" href="#/celular/${encodeURIComponent(cod)}">Registrar diário de hoje</a>`;
}

// compras: alertas de suprimentos (Mais Controle) que citam a obra
function abaCompras(ctx, cod) {
  const al = oc.alertasDaObra(ctx, cod, { areas: ['suprimentos', 'financeiro'] });
  const sup = (ctx.CFG.areas.find((a) => a.id === 'suprimentos')) || null;
  const k = (re) => pd.kpiDoAgente(sup, re);
  return html`${pd.secao('Compras da empresa (todas as obras)', 'Mais Controle · agente de Suprimentos', pd.cartoes([
      { rotulo: 'Solicitações paradas há mais de 3 dias', valor: (k(/paradas/i) || {}).valor, meta: 'Meta 0' },
      { rotulo: 'Em aprovação', valor: (k(/aprova/i) || {}).valor }, { rotulo: 'A atender', valor: (k(/atender/i) || {}).valor }, { rotulo: 'Cotações em aberto', valor: (k(/cota/i) || {}).valor },
    ]))}
    ${pd.secao(`Compras que citam a ${cod}`, 'Alerta vira tarefa', pd.quemAgir(al, { obra: cod, setor: 'Suprimentos e compras' }, { vazio: 'Nenhum alerta de compra citando esta obra.' }))}
    <p class="pd-c-sub">O agente ainda não manda as solicitações da obra uma a uma; quando mandar, a lista aparece aqui.</p>`;
}

// pendências (atas e avulsas) da obra, abertas primeiro
function abaPendencias(ctx, cod) {
  const l = oc.pendenciasDaObra(ctx, cod);
  const linhas = l.map((p) => [p.descricao, p.responsavel_nome || '', p.gestores_nome || '',
    p.prazo ? (p.status === 'aberta' && p.prazo < ctx.hoje ? pd.selo('critico', pd.dm(p.prazo)) : pd.dm(p.prazo)) : '',
    p.status === 'feita' ? pd.selo('ok', 'Concluída') : p.prazo && p.prazo < ctx.hoje ? pd.selo('critico', 'Atrasada') : pd.selo('atencao', 'Aberta')]);
  return html`${pd.secao(`Pendências da ${cod}`, `${l.filter((p) => p.status === 'aberta').length} em aberto · atas e pendências avulsas`,
    pd.tabela(['Pendência', 'Responsável', 'Gestor', 'Prazo', 'Situação'], linhas, { vazio: 'Nenhuma pendência desta obra.' }))}
    <a class="pd-bt" href="#/atas?obra=${encodeURIComponent(cod)}">Abrir em Tarefas</a>`;
}

