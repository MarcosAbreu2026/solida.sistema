// Acompanhamento dos terceirizados (cinza e laranja) por obra: reproduz a planilha <obra>_TERCERIZADOS_R<nn>.xlsx (pedido do Marcos, 20/11/2026).
// Base: a planilha lida do Drive (projetos.json › obras[].terceirizados) + escopo e cronograma da obra. Por cima, o que o sistema preenche (tabela
// terc_itens, supabase/41): loja cotando, prazo do fornecedor, data limite para fechar, loja fechada, contrato e situação. Valores (orçado, fechado,
// diferença, forma de pagamento) só para quem lida com custo; todos os gestores e estagiários de obra veem a situação dos itens das suas obras.
import { html } from './formato.js';
import * as pd from './telas/painel-dep.js';
import { somarDias } from './datas.js';
import { NA_NUVEM, listarTercItens, listarTercValores, gravarTercItem, apagarTercItem } from './nuvem.js';
import { normTxt, bate } from './escopo-cor.js';

export const SITUACOES = [
  { id: 'especificar', nome: 'Especificar e orçar', cor: 'ECECEC', nivel: '' },
  { id: 'arquitetura', nome: 'Aguardando arquitetura', cor: 'D5C7F9', nivel: 'atencao' },
  { id: 'cotacao', nome: 'Em orçamento no fornecedor', cor: 'FEF2CB', nivel: 'atencao' },
  { id: 'diretoria', nome: 'Aguardando arq/diretoria', cor: 'FFDDEC', nivel: 'atencao' },
  { id: 'urgente', nome: 'Fechar urgente', cor: 'F7CAAC', nivel: 'critico' },
  { id: 'fechado', nome: 'Fechado, aguardando entrega/finalização', cor: 'C1E4F5', nivel: 'ok' },
  { id: 'concluido', nome: 'Concluído', cor: 'D9F2D0', nivel: 'ok' },
];
const porSit = Object.fromEntries(SITUACOES.map((s) => [s.id, s]));
export const CONTRATOS = [['nao', 'Sem contrato'], ['elaborando', 'Contrato em elaboração'], ['enviado', 'Contrato enviado'], ['assinado', 'Contrato assinado']];
const CHAVE = 'solida.tercItens';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || { itens: [], valores: [] }; } catch { return { itens: [], valores: [] }; } };
const gravarLocal = (d) => { try { localStorage.setItem(CHAVE, JSON.stringify(d)); } catch { /* sem armazenamento */ } };

export let itensDb = [];
export let valoresDb = [];
export let erro = '';
export async function carregar() {
  try {
    if (NA_NUVEM) { itensDb = await listarTercItens(); valoresDb = await listarTercValores(); } else { const l = lerLocal(); itensDb = l.itens; valoresDb = l.valores; }
    erro = '';
  } catch (e) { erro = String(e.message || e); }
  return itensDb;
}

const chaveDe = (cod, item) => normTxt(`${cod || ''} ${item || ''}`).replace(/ /g, '');
const dBR = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const iso = (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(String(v)) ? String(v).slice(0, 10) : '');
const reais = (n) => (typeof n === 'number' ? `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '');
const qtdTxt = (n) => (typeof n === 'number' ? n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '');
const diasDe = (txt) => { const t = String(txt || '').toLowerCase(); const m = /(\d+)\s*(semana|sem|dia|d\b|du|d u)/.exec(t); if (!m) return null; return Number(m[1]) * (/^sem/.test(m[2]) ? 7 : 1); };
const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const unico = (l) => [...new Set(l.filter(Boolean))];
const primeiraLinha = (s) => String(s || '').split('\n')[0].trim();

// ---- situação pela cor da linha na planilha (a LEGENDA da planilha dá a cor de cada situação)
function sitPelaCor(cor, legenda) {
  if (!cor) return null;
  const l = arr(legenda).find((x) => String(x.cor || '').toUpperCase() === String(cor).toUpperCase());
  const t = normTxt(l ? l.texto : '');
  if (t) { if (/conclu/.test(t)) return 'concluido'; if (/fechado/.test(t)) return 'fechado'; if (/urgente/.test(t)) return 'urgente'; if (/arq.*diretoria|diretoria/.test(t)) return 'diretoria'; if (/arquitetura/.test(t)) return 'arquitetura'; if (/orcamento no fornecedor/.test(t)) return 'cotacao'; if (/especificar/.test(t)) return 'especificar'; }
  const s = SITUACOES.find((x) => x.cor === String(cor).toUpperCase()); return s ? s.id : null;
}

// ---- as linhas de uma obra: planilha + escopo + cronograma, com o que o sistema preencheu por cima
export function linhasDaObra(projetos, obra, hoje) {
  const p = (((projetos || {}).obras) || []).find((o) => o.obra === obra) || null;
  const t = p && p.terceirizados && !p.terceirizados.erro ? p.terceirizados : null;
  const escopoItens = arr(p && p.escopo && p.escopo.grupos).flatMap((g) => arr(g.itens));
  const cr = p && p.cronograma && !p.cronograma.erro ? p.cronograma : null;
  const out = new Map();
  const achaEscopo = (cod, nome) => escopoItens.find((i) => cod && normTxt(i.cod).replace(/ /g, '') === normTxt(cod).replace(/ /g, '')) || escopoItens.find((i) => bate(nome, i.desc)) || null;
  const achaAtiv = (cod, nome) => arr(cr && cr.atividades).find((a) => cod && normTxt(a.cod).replace(/ /g, '') === normTxt(cod).replace(/ /g, '') && a.inicio) || arr(cr && cr.atividades).find((a) => a.inicio && bate(nome, a.nome)) || null;
  const monta = (escopo, it) => {
    const e = achaEscopo(it.cod, it.item);
    const a = achaAtiv(it.cod, it.item);
    const inicio = (a && a.inicio) || iso(it.inicio) || (cr && cr.inicioObra) || '';
    const origemInicio = a ? 'cronograma (atividade)' : iso(it.inicio) ? 'planilha' : cr && cr.inicioObra ? 'cronograma (início da obra)' : '';
    const dias = diasDe(it.prazo);
    return { escopo, chave: chaveDe(it.cod, it.item), cod: it.cod || '', item: it.item, quantidade: e && typeof e.quant === 'number' ? e.quant : null, unidade: (e && e.unid) || '',
      noOrcamento: typeof it.estimado === 'number' ? (it.estimado > 0 && !/^AD/i.test(String(it.cod || '')) && !/n[ãa]o consta/i.test(String(it.obs || ''))) : null,
      valorOrcado: typeof it.estimado === 'number' ? it.estimado : null, prazoPadrao: inicio, origemPrazo: origemInicio,
      prazoFornecedor: iso(it.prazo) ? dBR(iso(it.prazo)) : String(it.prazo || ''), diasEntrega: dias,
      dataLimite: iso(it.limite), limiteSugerido: inicio && dias != null ? somarDias(inicio, -(dias + 7)) : '',
      lojaCotando: primeiraLinha(it.loja), lojas: String(it.loja || '').split('\n').map((x) => x.trim()).filter(Boolean), vendedor: '', contato: it.contato || '',
      lojaFechada: '', valorFechado: typeof it.fechado === 'number' ? it.fechado : null, diferenca: typeof it.diferenca === 'number' ? it.diferenca : (typeof it.estimado === 'number' && typeof it.fechado === 'number' ? it.estimado - it.fechado : null), pagamento: it.pagamento || '',
      contrato: 'nao', situacao: sitPelaCor(it.cor, t && t.legenda), obs: it.obs || '', fonte: 'planilha' };
  };
  if (t) for (const [escopo, lista] of [['cinza', t.cinza], ['laranja', t.laranja]]) for (const it of arr(lista)) { const l = monta(escopo, it); if (!out.has(`${escopo}|${l.chave}`)) out.set(`${escopo}|${l.chave}`, l); }
  // o que o sistema preencheu por cima (ou itens que só existem no sistema)
  for (const d of itensDb.filter((x) => x.obra === obra)) {
    const k = `${d.escopo}|${d.chave}`; const v = valoresDb.find((x) => x.obra === obra && x.escopo === d.escopo && x.chave === d.chave);
    const base = out.get(k) || { escopo: d.escopo, chave: d.chave, cod: d.cod || '', item: d.item, quantidade: null, unidade: '', noOrcamento: null, valorOrcado: null, prazoPadrao: (cr && cr.inicioObra) || '', origemPrazo: cr ? 'cronograma (início da obra)' : '', prazoFornecedor: '', diasEntrega: null, dataLimite: '', limiteSugerido: '', lojaCotando: '', lojas: [], vendedor: '', contato: '', lojaFechada: '', valorFechado: null, diferenca: null, pagamento: '', contrato: 'nao', situacao: null, obs: '', fonte: 'sistema' };
    const sobre = { ...base, fonte: base.fonte === 'planilha' ? 'ambos' : 'sistema', noSistema: true };
    if (d.quantidade != null) sobre.quantidade = Number(d.quantidade);
    if (d.unidade) sobre.unidade = d.unidade;
    if (d.no_orcamento != null) sobre.noOrcamento = d.no_orcamento;
    if (d.prazo_padrao) sobre.prazoPadrao = iso(d.prazo_padrao);
    if (d.prazo_fornecedor) sobre.prazoFornecedor = d.prazo_fornecedor;
    if (d.data_limite) sobre.dataLimite = iso(d.data_limite);
    if (d.loja_cotando) sobre.lojaCotando = d.loja_cotando;
    if (d.vendedor) sobre.vendedor = d.vendedor;
    if (d.loja_fechada) sobre.lojaFechada = d.loja_fechada;
    if (d.situacao) sobre.situacao = d.situacao;
    if (d.contrato) sobre.contrato = d.contrato;
    if (d.obs) sobre.obs = d.obs;
    if (v) { if (v.valor_orcado != null) sobre.valorOrcado = Number(v.valor_orcado); if (v.valor_fechado != null) sobre.valorFechado = Number(v.valor_fechado); if (v.forma_pagamento) sobre.pagamento = v.forma_pagamento; if (sobre.valorOrcado != null && sobre.valorFechado != null) sobre.diferenca = sobre.valorOrcado - sobre.valorFechado; }
    out.set(k, sobre);
  }
  const lista = [...out.values()].map((l) => {
    const sit = l.situacao || (l.lojaFechada || l.valorFechado != null ? 'fechado' : l.lojaCotando ? 'cotacao' : 'especificar');
    const limite = l.dataLimite || l.limiteSugerido;
    const aberto = !['fechado', 'concluido'].includes(sit);
    return { ...l, situacao: sit, vencido: !!(aberto && l.dataLimite && l.dataLimite < hoje), limiteEfetivo: limite, atencao: !!(aberto && !l.dataLimite && l.limiteSugerido && l.limiteSugerido < hoje) };
  });
  return { p, planilha: t, linhas: lista.sort((a, b) => a.escopo.localeCompare(b.escopo) || String(a.cod).localeCompare(String(b.cod), 'pt-BR', { numeric: true }) || a.item.localeCompare(b.item, 'pt-BR')), cronograma: cr };
}

const contagem = (linhas) => ({ total: linhas.length, fechados: linhas.filter((l) => ['fechado', 'concluido'].includes(l.situacao)).length, semCotacao: linhas.filter((l) => l.situacao === 'especificar').length, vencidos: linhas.filter((l) => l.vencido).length, urgentes: linhas.filter((l) => l.situacao === 'urgente').length });

// ---------------------------------------------------------------- telas
export function render({ projetos, hoje, obras, params, podeEditar, veValores }) {
  const sel = params.get('tobra') && obras.includes(params.get('tobra')) ? params.get('tobra') : '';
  const esc = params.get('tesc') === 'cinza' ? 'cinza' : params.get('tesc') === 'laranja' ? 'laranja' : '';
  const resumoObras = obras.map((o) => { const d = linhasDaObra(projetos, o, hoje); const c = contagem(d.linhas.filter((l) => l.escopo === 'cinza')); const lj = contagem(d.linhas.filter((l) => l.escopo === 'laranja'));
    const prox = d.linhas.filter((l) => !['fechado', 'concluido'].includes(l.situacao) && l.limiteEfetivo).map((l) => l.limiteEfetivo).sort()[0] || '';
    const cel = (x) => (x.total ? html`${pd.selo(x.vencidos || x.urgentes ? 'critico' : x.fechados === x.total ? 'ok' : 'atencao', `${x.fechados} de ${x.total} fechados`)}<span class="pd-obra-sub">${x.semCotacao ? `${x.semCotacao} sem cotação` : 'todos cotados'}${x.vencidos ? ` · ${x.vencidos} com limite vencido` : ''}</span>` : html`<span class="pd-def">sem itens</span>`);
    return [html`<a href="#/orc-terceirizado?tobra=${encodeURIComponent(o)}">${pd.obraCel(o)}</a>`, cel(c), cel(lj), prox ? (prox < hoje ? pd.selo('critico', dBR(prox)) : dBR(prox)) : '—', d.planilha ? html`<span class="pequeno">${d.planilha.arquivo}</span>` : html`<span class="pd-def">sem planilha na pasta</span>`]; });
  const visao = pd.tabela(['Obra', 'Cinza · Sólida contrata', 'Laranja · cliente', 'Próxima data limite', 'Planilha'], resumoObras, { vazio: 'Nenhuma obra.' });
  const filtro = html`<div class="fo-nav"><b>Obra:</b> <a class="botao${sel ? '' : ' on'}" href="#/orc-terceirizado">Todas</a>${obras.map((o) => html`<a class="botao${sel === o ? ' on' : ''}" href="#/orc-terceirizado?tobra=${encodeURIComponent(o)}">${o}</a>`)}</div>`;
  if (!sel) return html`${erro ? html`<p class="erro">${erro}</p>` : ''}${filtro}${visao}<p class="pequeno">Escolha uma obra para ver item por item: orçado × cotação × fechado, prazos e contrato. Base: planilha de terceirizados da pasta da obra (Drive); o que for preenchido aqui fica no sistema.</p>`;
  const d = linhasDaObra(projetos, sel, hoje);
  const doEsc = d.linhas.filter((l) => !esc || l.escopo === esc);
  const c = contagem(doEsc);
  const somaO = doEsc.reduce((s, l) => s + (l.valorOrcado || 0), 0); const somaF = doEsc.filter((l) => l.valorFechado != null).reduce((s, l) => s + l.valorFechado, 0);
  const somaOF = doEsc.filter((l) => l.valorFechado != null).reduce((s, l) => s + (l.valorOrcado || 0), 0);
  const cards = pd.cartoes([
    { rotulo: 'Itens', valor: String(c.total), sub: `${d.linhas.filter((l) => l.escopo === 'cinza').length} cinza · ${d.linhas.filter((l) => l.escopo === 'laranja').length} laranja` },
    { rotulo: 'Fechados', valor: `${c.fechados} de ${c.total}`, nivel: c.total && c.fechados === c.total ? 'ok' : 'atencao', sub: `${c.semCotacao} ainda sem cotação` },
    { rotulo: 'Data limite vencida', valor: String(c.vencidos), nivel: c.vencidos ? 'critico' : 'ok', sub: `${c.urgentes} marcado(s) para fechar urgente` },
    ...(veValores ? [{ rotulo: 'Orçado × fechado', valor: reais(somaO), sub: `fechado ${reais(somaF)} · diferença nos fechados ${reais(somaOF - somaF)}` }] : []),
  ], { colunas: veValores ? 4 : 3 });
  const abas = html`<div class="fo-nav"><b>Escopo:</b> <a class="botao${esc ? '' : ' on'}" href="#/orc-terceirizado?tobra=${encodeURIComponent(sel)}">Cinza e laranja</a><a class="botao${esc === 'cinza' ? ' on' : ''}" href="#/orc-terceirizado?tobra=${encodeURIComponent(sel)}&tesc=cinza">Cinza · Sólida</a><a class="botao${esc === 'laranja' ? ' on' : ''}" href="#/orc-terceirizado?tobra=${encodeURIComponent(sel)}&tesc=laranja">Laranja · cliente</a>${podeEditar ? html`<button type="button" class="botao" data-tca-novo="${sel}">+ Novo item</button>` : ''}</div>`;
  const cab = ['Cód.', 'Item', 'Qtd.', 'Escopo', ...(veValores ? ['Orçado'] : []), 'Prazo padrão (cronograma)', 'Prazo do fornecedor', 'Data limite para fechar', 'Cotando (loja / vendedor)', 'Loja fechada', ...(veValores ? ['Fechado', 'Diferença', 'Pagamento'] : []), 'Contrato', 'Situação'];
  const linhas = doEsc.map((l) => {
    const s = porSit[l.situacao] || porSit.especificar;
    const abrir = (x) => html`<a class="tca-lin" href="#" data-tca="${encodeURIComponent(`${sel}|${l.escopo}|${l.chave}`)}">${x}</a>`;
    return [l.cod, abrir(html`<b>${l.item}</b>${l.obs ? html`<span class="pd-obra-sub">${String(l.obs).split('\n')[0].slice(0, 110)}</span>` : ''}`), l.quantidade != null ? `${qtdTxt(l.quantidade)} ${l.unidade}` : '—',
      html`${l.escopo === 'laranja' ? pd.selo('atencao', 'Laranja') : pd.selo('', 'Cinza')} ${l.noOrcamento === true ? pd.selo('ok', 'No orçamento') : l.noOrcamento === false ? pd.selo('critico', 'Fora do orçamento') : ''}`,
      ...(veValores ? [l.valorOrcado != null ? reais(l.valorOrcado) : '—'] : []),
      l.prazoPadrao ? html`${dBR(l.prazoPadrao)}<span class="pd-obra-sub">${l.origemPrazo}</span>` : '—',
      l.prazoFornecedor || '—',
      l.dataLimite ? (l.vencido ? pd.selo('critico', dBR(l.dataLimite)) : dBR(l.dataLimite)) : (l.limiteSugerido ? html`<span class="${l.atencao ? 'pd-cr' : 'pd-def'}">sugerida ${dBR(l.limiteSugerido)}</span>` : '—'),
      html`${l.lojaCotando || '—'}${l.vendedor ? html`<span class="pd-obra-sub">${l.vendedor}</span>` : ''}${l.lojas.length > 1 ? html`<span class="pd-obra-sub">+ ${l.lojas.length - 1} cotando</span>` : ''}`,
      l.lojaFechada || '—',
      ...(veValores ? [l.valorFechado != null ? reais(l.valorFechado) : '—', l.diferenca != null ? html`<span class="${l.diferenca < 0 ? 'pd-cr' : ''}">${reais(l.diferenca)}</span>` : '—', l.pagamento ? String(l.pagamento).split('\n')[0].slice(0, 60) : '—'] : []),
      (CONTRATOS.find((x) => x[0] === l.contrato) || CONTRATOS[0])[1],
      pd.selo(s.nivel, s.nome)];
  });
  const aviso = !d.planilha ? pd.aviso(`${sel}: sem planilha de terceirizados na pasta TERCERIZADOS da obra no Drive. ${podeEditar ? 'Use "+ Novo item" para lançar os itens aqui.' : 'A equipe do orçamento terceirizado lança os itens.'}`, 'atencao') : '';
  const fonte = d.planilha ? html`<p class="pequeno">Planilha ${d.planilha.arquivo} · prazo padrão = início da atividade no cronograma${d.cronograma ? ` (${String(d.cronograma.arquivo).replace(/^.*[\/]/, '')})` : ' (obra sem cronograma lido)'} · data limite sugerida = prazo padrão − prazo de entrega − 7 dias · "fora do orçamento" = sem valor estimado, aditivo ou marcado "não consta no escopo". ${podeEditar ? 'Clique no item para preencher cotação, loja fechada, contrato e situação.' : 'Clique no item para ver os detalhes.'}</p>` : '';
  return html`${erro ? html`<p class="erro">${erro}</p>` : ''}${filtro}${aviso}${cards}${abas}${pd.tabela(cab, linhas, { vazio: 'Nenhum item.' })}${fonte}`;
}

const sel = (c) => (c ? html.seguro('selected') : '');
export function form({ projetos, hoje, obra, escopo, chave, podeEditar, veValores, novo = false }) {
  const l = novo ? { escopo: escopo || 'laranja', chave: '', cod: '', item: '', quantidade: null, unidade: '', noOrcamento: null, valorOrcado: null, prazoPadrao: '', prazoFornecedor: '', dataLimite: '', lojaCotando: '', vendedor: '', lojaFechada: '', valorFechado: null, pagamento: '', contrato: 'nao', situacao: 'especificar', obs: '', lojas: [] }
    : linhasDaObra(projetos, obra, hoje).linhas.find((x) => x.escopo === escopo && x.chave === chave);
  if (!l) return html`<div class="tf"><p class="erro">Não achei este item.</p><div class="at-av-botoes"><button type="button" class="botao" data-av-fechar>Fechar</button></div></div>`;
  const dis = podeEditar ? '' : html.seguro('disabled');
  return html`<div class="tf"><div class="tf-cab"><h3>${novo ? 'Novo item' : `${l.cod ? `${l.cod} · ` : ''}${l.item}`}</h3><span class="osq-st" style="background:#${(porSit[l.situacao] || porSit.especificar).cor};color:#222">${(porSit[l.situacao] || porSit.especificar).nome}</span></div>
    <form id="tca-form" data-obra="${obra}" data-chave="${l.chave}" data-novo="${novo ? '1' : ''}" autocomplete="off"><div class="tf-grade osq-grade">
      ${novo ? '' : html`<input type="hidden" name="escopo" value="${l.escopo}"><input type="hidden" name="cod_orig" value="${l.cod || ''}"><input type="hidden" name="item_orig" value="${l.item}">`}
      ${novo ? html`<label>Escopo<select name="escopo" ${dis}><option value="laranja" ${sel(l.escopo === 'laranja')}>Laranja · cliente</option><option value="cinza" ${sel(l.escopo === 'cinza')}>Cinza · Sólida</option></select></label><label>Cód.<input name="cod" ${dis}></label><label class="osq-largo">Item<input name="item" required ${dis}></label>` : ''}
      <label>Quantidade<input name="quantidade" type="number" step="any" value="${l.quantidade ?? ''}" ${dis}></label><label>Unidade<input name="unidade" value="${l.unidade || ''}" ${dis}></label>
      <label>No orçamento da obra?<select name="no_orcamento" ${dis}><option value="" ${sel(l.noOrcamento == null)}>—</option><option value="1" ${sel(l.noOrcamento === true)}>Tem no orçamento</option><option value="0" ${sel(l.noOrcamento === false)}>Não tem no orçamento</option></select></label>
      <label>Prazo padrão (cronograma)<input name="prazo_padrao" type="date" value="${iso(l.prazoPadrao)}" ${dis}></label>
      <label>Prazo do fornecedor<input name="prazo_fornecedor" value="${l.prazoFornecedor || ''}" placeholder="ex.: 20 dias" ${dis}></label>
      <label>Data limite para fechar<input name="data_limite" type="date" value="${iso(l.dataLimite) || iso(l.limiteSugerido)}" ${dis}></label>
      <label>Loja cotando<input name="loja_cotando" value="${l.lojaCotando || ''}" ${dis}></label><label>Vendedor<input name="vendedor" value="${l.vendedor || ''}" ${dis}></label>
      <label>Loja fechada<input name="loja_fechada" value="${l.lojaFechada || ''}" ${dis}></label>
      ${veValores ? html`<label>Valor orçado (R$)<input name="valor_orcado" type="number" step="0.01" value="${l.valorOrcado ?? ''}" ${dis}></label><label>Valor fechado (R$)<input name="valor_fechado" type="number" step="0.01" value="${l.valorFechado ?? ''}" ${dis}></label><label class="osq-largo">Forma de pagamento<input name="forma_pagamento" value="${String(l.pagamento || '').split('\n')[0]}" ${dis}></label>` : ''}
      <label>Seguir para contrato<select name="contrato" ${dis}>${CONTRATOS.map(([id, n]) => html`<option value="${id}" ${sel(id === l.contrato)}>${n}</option>`)}</select></label>
      <label>Situação<select name="situacao" ${dis}>${SITUACOES.map((s) => html`<option value="${s.id}" ${sel(s.id === l.situacao)}>${s.nome}</option>`)}</select></label>
      <label class="osq-largo">Andamento / observações<textarea name="obs" rows="4" ${dis}>${l.obs || ''}</textarea></label></div>
      ${l.lojas && l.lojas.length > 1 ? html`<p class="pequeno">Cotando na planilha: ${l.lojas.join(' · ')}</p>` : ''}${l.contato ? html`<p class="pequeno">Contato: ${String(l.contato).replace(/\n/g, ' · ')}</p>` : ''}
      <div class="tf-botoes">${podeEditar ? html`<button type="submit" class="botao on">Salvar</button>${l.noSistema || novo ? '' : ''}${l.fonte === 'sistema' && !novo ? html`<button type="button" class="botao ac-excluir" data-tca-del="${obra}|${l.escopo}|${l.chave}">Excluir item</button>` : ''}` : ''}<button type="button" class="botao" data-av-fechar>Fechar</button></div></form></div>`;
}

// grava o formulário (item existente da planilha ou novo item); devolve a linha salva
export async function salvarForm(fd, obra, chave, novo) {
  const n = (k) => { const v = fd.get(k); return v === null || v === '' ? null : Number(v); };
  const t = (k) => { const v = String(fd.get(k) || '').trim(); return v || null; };
  const cod = t('cod'); const item = t('item');
  const ch = novo ? chaveDe(cod, item) : chave;
  const orig = itensDb.find((x) => x.obra === obra && x.chave === ch);
  const linha = { obra, escopo: fd.get('escopo') || (orig ? orig.escopo : 'laranja'), chave: ch, cod: novo ? cod : (orig && orig.cod) || fd.get('cod_orig') || null, item: novo ? item : (orig && orig.item) || fd.get('item_orig') || '',
    quantidade: n('quantidade'), unidade: t('unidade'), no_orcamento: fd.get('no_orcamento') === '' ? null : fd.get('no_orcamento') === '1', prazo_padrao: t('prazo_padrao'), prazo_fornecedor: t('prazo_fornecedor'), data_limite: t('data_limite'),
    loja_cotando: t('loja_cotando'), vendedor: t('vendedor'), loja_fechada: t('loja_fechada'), situacao: t('situacao'), contrato: t('contrato') || 'nao', obs: t('obs') };
  const valores = fd.has('valor_orcado') ? { valor_orcado: n('valor_orcado'), valor_fechado: n('valor_fechado'), forma_pagamento: t('forma_pagamento') } : null;
  return { linha, valores };
}
export async function gravar(linha, valores) {
  if (NA_NUVEM) { const r = await gravarTercItem(linha, valores); await carregar(); return r; }
  const l = lerLocal(); const i = l.itens.findIndex((x) => x.obra === linha.obra && x.escopo === linha.escopo && x.chave === linha.chave);
  if (i >= 0) l.itens[i] = { ...l.itens[i], ...linha }; else l.itens.push({ id: l.itens.length + 1, ...linha });
  if (valores) { const j = l.valores.findIndex((x) => x.obra === linha.obra && x.escopo === linha.escopo && x.chave === linha.chave); const v = { obra: linha.obra, escopo: linha.escopo, chave: linha.chave, ...valores }; if (j >= 0) l.valores[j] = v; else l.valores.push(v); }
  gravarLocal(l); itensDb = l.itens; valoresDb = l.valores; return linha;
}
export async function apagar(obra, escopo, chave) {
  if (NA_NUVEM) { await apagarTercItem(obra, escopo, chave); await carregar(); return; }
  const l = lerLocal(); l.itens = l.itens.filter((x) => !(x.obra === obra && x.escopo === escopo && x.chave === chave)); l.valores = l.valores.filter((x) => !(x.obra === obra && x.escopo === escopo && x.chave === chave)); gravarLocal(l); itensDb = l.itens; valoresDb = l.valores;
}
