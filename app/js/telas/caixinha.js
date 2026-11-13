// Caixinha BeeVale (POP ADM 11.11) — etapas 1 e 2: painel, importação do Excel do BeeVale, cartões e responsáveis, registro de ações.
// ADM: tudo. Sócio (CEO) e financeiro: só consulta. Os outros nem veem a aba. Regras e tabelas: supabase/29-caixinha.sql.
// Na nuvem grava no Supabase; no computador do escritório (modo teste) guarda só neste navegador.

import { html, reais, data as fData } from '../formato.js';
import * as pd from './painel-dep.js';
import { NA_NUVEM, sb, perfilAtual, listarPerfis } from '../nuvem.js';
import { sessao } from '../sessao.js';
import { FUNCOES } from '../funcoes.js';
import { lerXlsx } from '../xlsx-leitor.js';
import { carregarCaixinhaLeitura } from '../dados.js';
import { CAMPOS, MAPEAMENTO_PADRAO, acharCabecalho, adivinhar, analisar, comImpressao, hashDoArquivo, sugerirUsuario } from '../caixinha.js';

export const podeVer = (f) => !!f && ['socio', 'administrativo', 'financeiro'].includes(f.id);
export const podeEditar = (f) => !!f && f.id === 'administrativo';

const CHAVE_LOCAL = 'solida.caixinha';
let dados = { cartoes: [], gastos: [], importacoes: [], log: [], mapeamento: MAPEAMENTO_PADRAO, usuarios: [] };
let pronto = false; let erroBanco = '';
const imp = { arquivo: null, nome: '', hash: '', linhas: null, planilhas: [], plan: 0, cab: 0, mapa: null, cartao: '', novoId: '', novoNome: '', resultado: null, msg: '', erro: '', ocupado: false };
let aviso = ''; let avisoEm = 0; let erroGeral = '';
let leitura = null;   // saldos lidos no Bee Vale e no Mais Controle (dados/json/caixinha.json), só para consulta
const dizer = (t) => { aviso = t; avisoEm = Date.now(); };   // a mensagem de sucesso fica uns segundos (a tela se redesenha duas vezes ao mudar de aba)

export const carregado = () => pronto;
export const emImportacao = () => !!imp.arquivo;

// ---------------------------------------------------------------- armazenamento (nuvem ou este navegador)
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL)) || {}; } catch { return {}; } };
const gravarLocal = (v) => { try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
const proximo = (lista) => lista.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
const nomeLogado = () => sessao().nome || '';

export async function carregar() {
  erroBanco = '';
  if (!NA_NUVEM) {
    const l = lerLocal();
    dados = { cartoes: l.cartoes || [], gastos: l.gastos || [], importacoes: l.importacoes || [], log: l.log || [], mapeamento: l.mapeamento || MAPEAMENTO_PADRAO,
      usuarios: Object.values(FUNCOES).filter((x) => x.pop).map((x) => ({ id: `teste-${x.id}`, nome: x.pop.split(' · ')[0].toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) })) };
  } else {
    try {
      const um = async (q) => { const r = await q; if (r.error) throw new Error(r.error.message); return r.data || []; };
      const [cartoes, gastos, importacoes, log, cfg, perfis] = await Promise.all([
        um(sb.from('cx_cartoes').select('*').order('identificacao')),
        um(sb.from('cx_gastos').select('*').order('data', { ascending: false }).limit(2000)),
        um(sb.from('cx_importacoes').select('*').order('criado_em', { ascending: false })),
        um(sb.from('cx_log').select('*').order('em', { ascending: false }).limit(200)),
        um(sb.from('cx_config').select('*').eq('chave', 'mapeamento')),
        listarPerfis(),
      ]);
      dados = { cartoes, gastos, importacoes, log, mapeamento: (cfg[0] && cfg[0].valor) || MAPEAMENTO_PADRAO, usuarios: perfis.filter((p) => p.ativo !== false && p.funcao).map((p) => ({ id: p.id, nome: p.nome || p.email })) };
    } catch (e) { erroBanco = /cx_|relation|does not exist|schema cache/i.test(String(e.message)) ? 'As tabelas da Caixinha ainda não existem no banco. Rode o arquivo supabase/29-caixinha.sql no Supabase (SQL Editor).' : `Não foi possível ler a Caixinha (${e.message}).`; }
  }
  try { leitura = await carregarCaixinhaLeitura(); } catch { leitura = null; }
  pronto = true;
  return dados;
}

async function registrar(acao, detalhe = {}) {
  const linha = { usuario_nome: nomeLogado(), acao, detalhe, em: new Date().toISOString() };
  if (!NA_NUVEM) { const l = lerLocal(); l.log = [{ id: proximo(l.log || []), ...linha }, ...(l.log || [])].slice(0, 500); gravarLocal(l); return; }
  const { error } = await sb.from('cx_log').insert({ usuario: perfilAtual().id, usuario_nome: linha.usuario_nome, acao, detalhe });
  if (error) throw new Error(error.message);
}

async function criarCartao(identificacao, nomeBeevale) {
  const ident = String(identificacao || '').trim();
  if (!ident) throw new Error('Informe a identificação do cartão.');
  if (dados.cartoes.some((c) => c.identificacao.toLowerCase() === ident.toLowerCase())) throw new Error(`O cartão "${ident}" já está cadastrado.`);
  let novo;
  if (!NA_NUVEM) { const l = lerLocal(); novo = { id: proximo(l.cartoes || []), identificacao: ident, nome_beevale: String(nomeBeevale || '').trim(), usuario: null, vinculo_confirmado: false, saldo: null, saldo_em: null, ativo: true }; l.cartoes = [...(l.cartoes || []), novo]; gravarLocal(l); }
  else { const { data: d, error } = await sb.from('cx_cartoes').insert({ identificacao: ident, nome_beevale: String(nomeBeevale || '').trim() }).select().single(); if (error) throw new Error(error.message); novo = d; }
  await registrar('cartao_criado', { cartao: ident, nome_beevale: novo.nome_beevale });
  return novo;
}
async function mudarCartao(id, mud, acao, detalhe) {
  if (!NA_NUVEM) { const l = lerLocal(); l.cartoes = (l.cartoes || []).map((c) => (String(c.id) === String(id) ? { ...c, ...mud } : c)); gravarLocal(l); }
  else { const { error } = await sb.from('cx_cartoes').update(mud).eq('id', id); if (error) throw new Error(error.message); }
  await registrar(acao, detalhe);
}
async function gravarMapeamento(m) {
  if (!NA_NUVEM) { const l = lerLocal(); l.mapeamento = m; gravarLocal(l); }
  else { const { error } = await sb.from('cx_config').upsert({ chave: 'mapeamento', valor: m }); if (error) throw new Error(error.message); }
  await registrar('mapeamento_salvo', { colunas: m.colunas });
}

// grava a importação: bloqueia arquivo repetido e mesmo cartão + período; linhas já importadas (períodos que se cruzam) são ignoradas
async function gravarImportacao({ cartao, nomeArquivo, hash, analise }) {
  await carregar();
  const per = analise.periodo;
  if (dados.importacoes.some((i) => i.hash_arquivo === hash)) throw new Error('Este arquivo já foi importado antes.');
  if (dados.importacoes.some((i) => String(i.cartao) === String(cartao.id) && i.periodo_ini === per.ini && i.periodo_fim === per.fim)) throw new Error(`Já existe uma importação do cartão ${cartao.identificacao} para ${fData(per.ini)} a ${fData(per.fim)}.`);
  const gastos = await comImpressao(analise.gastos, cartao.id);
  let jaTem = new Set();
  if (!NA_NUVEM) jaTem = new Set((lerLocal().gastos || []).map((g) => g.linha_hash));
  else { const { data: d, error } = await sb.from('cx_gastos').select('linha_hash').eq('cartao', cartao.id).gte('data', per.ini).lte('data', per.fim); if (error) throw new Error(error.message); jaTem = new Set((d || []).map((g) => g.linha_hash)); }
  const novos = gastos.filter((g) => !jaTem.has(g.linha_hash));
  const ignorados = gastos.length - novos.length;
  const cabecalho = { cartao: cartao.id, periodo_ini: per.ini, periodo_fim: per.fim, arquivo: nomeArquivo, hash_arquivo: hash, qtd_gastos: novos.length, qtd_recargas: analise.recargas, qtd_transferencias: analise.transferencias };
  const saldo = analise.saldo ? { saldo: analise.saldo.valor, saldo_em: analise.saldo.data } : null;
  if (!NA_NUVEM) {
    const l = lerLocal(); const idImp = proximo(l.importacoes || []);
    l.importacoes = [{ id: idImp, ...cabecalho, criado_em: new Date().toISOString() }, ...(l.importacoes || [])];
    let id = proximo(l.gastos || []);
    l.gastos = [...novos.map((g) => ({ id: id++, cartao: cartao.id, importacao: idImp, data: g.data, valor: g.valor, estabelecimento: g.estabelecimento, linha_hash: g.linha_hash, linha_origem: g.linha, status: 'pendente' })), ...(l.gastos || [])];
    if (saldo) l.cartoes = (l.cartoes || []).map((c) => (c.id === cartao.id ? { ...c, ...saldo } : c));
    gravarLocal(l);
  } else {
    const { data: i, error } = await sb.from('cx_importacoes').insert(cabecalho).select().single();
    if (error) throw new Error(error.message);
    if (novos.length) {
      const { error: e2 } = await sb.from('cx_gastos').insert(novos.map((g) => ({ cartao: cartao.id, importacao: i.id, data: g.data, valor: g.valor, estabelecimento: g.estabelecimento, linha_hash: g.linha_hash, linha_origem: g.linha, status: 'pendente' })));
      if (e2) { await sb.from('cx_importacoes').delete().eq('id', i.id); throw new Error(e2.message); }   // nada fica pela metade
    }
    if (saldo) await sb.from('cx_cartoes').update(saldo).eq('id', cartao.id);
  }
  await registrar('importacao', { cartao: cartao.identificacao, arquivo: nomeArquivo, periodo: `${per.ini} a ${per.fim}`, gastos: novos.length, ignorados_repetidos: ignorados, recargas: analise.recargas, transferencias: analise.transferencias });
  return { novos: novos.length, ignorados };
}

// ---------------------------------------------------------------- importação: estado e passos
function zerarImportacao() { Object.assign(imp, { arquivo: null, nome: '', hash: '', linhas: null, planilhas: [], plan: 0, cab: 0, mapa: null, resultado: null, erro: '', ocupado: false }); }
function reanalisar() {
  if (!imp.linhas) return;
  imp.resultado = analisar(imp.linhas, imp.cab, imp.mapa);
}
async function abrirArquivo(arq, plan = 0) {
  imp.erro = ''; imp.msg = '';
  try {
    if (!/\.xlsx$/i.test(arq.name)) throw new Error('Envie o relatório em Excel (.xlsx). Outros formatos não são aceitos.');
    const [lido, hash] = await Promise.all([lerXlsx(arq, { planilha: plan }), hashDoArquivo(arq)]);
    imp.arquivo = arq; imp.nome = arq.name; imp.hash = hash; imp.linhas = lido.linhas; imp.planilhas = lido.planilhas; imp.plan = plan;
    imp.cab = acharCabecalho(lido.linhas);
    const salvo = (dados.mapeamento && dados.mapeamento.colunas) || {};
    imp.mapa = { ...MAPEAMENTO_PADRAO, ...dados.mapeamento, palavras: { ...MAPEAMENTO_PADRAO.palavras, ...(dados.mapeamento || {}).palavras }, colunas: adivinhar((lido.linhas[imp.cab] || []).map(String), salvo) };
    reanalisar();
  } catch (e) { zerarImportacao(); imp.erro = e.message || String(e); }
}

// ---------------------------------------------------------------- telas
const dm = (iso) => (iso ? fData(String(iso).slice(0, 10)) : '—');
const nomeUsuario = (id) => { const u = dados.usuarios.find((x) => String(x.id) === String(id)); return u ? u.nome : ''; };
const gastosDo = (id) => dados.gastos.filter((g) => String(g.cartao) === String(id));
const cartaoPorId = (id) => dados.cartoes.find((c) => String(c.id) === String(id));

function painel() {
  const ativos = dados.cartoes.filter((c) => c.ativo !== false);
  const total = dados.gastos.reduce((s, g) => s + Number(g.valor || 0), 0);
  const semVinculo = ativos.filter((c) => !c.vinculo_confirmado).length;
  const cards = pd.cartoes([
    { rotulo: 'Cartões', valor: ativos.length, sub: ativos.length ? '' : 'Cadastre na aba Cartões' },
    { rotulo: 'Gastos importados', valor: dados.gastos.length, sub: dados.importacoes.length ? `${dados.importacoes.length} importação(ões)` : 'Nenhuma importação ainda' },
    { rotulo: 'Total gasto', valor: reais(total), sub: 'só gastos (sem recargas e transferências)' },
    { rotulo: 'Responsável sem vínculo', valor: semVinculo, nivel: semVinculo ? 'atencao' : 'ok', sub: semVinculo ? 'a pendência cai no ADM' : 'todos vinculados', meta: '' },
  ]);
  const linhas = ativos.map((c) => {
    const g = gastosDo(c.id); const ult = g.reduce((m, x) => (x.data > m ? x.data : m), '');
    const sit = !g.length ? pd.selo('', 'sem dados') : !c.vinculo_confirmado ? pd.selo('atencao', 'responsável não vinculado') : pd.selo('atencao', 'a conferir (etapa seguinte)');
    return [c.identificacao, c.nome_beevale || '—', c.vinculo_confirmado ? nomeUsuario(c.usuario) : '—', c.saldo != null ? html`${reais(c.saldo)} <span class="pequeno">em ${dm(c.saldo_em)}</span>` : '—', g.length, dm(ult), sit];
  });
  const recentes = dados.gastos.slice(0, 30).map((g) => [dm(g.data), (cartaoPorId(g.cartao) || {}).identificacao || '—', g.estabelecimento || '—', reais(g.valor), pd.selo('atencao', g.status === 'pendente' ? 'a conferir' : g.status)]);
  return html`${pd.aviso('Etapas 1 e 2: importação do BeeVale e cartões. A conferência com o Mais Controle, as pendências por usuário e a solicitação de recarga entram nas próximas etapas.', 'atencao')}
    ${cards}
    ${pd.secao('Cartões', 'semáforo: verde = conferido · amarelo = a conferir · vermelho = bloqueado', pd.tabela(['Cartão', 'Responsável no BeeVale', 'Usuário no sistema', 'Saldo', 'Gastos', 'Último gasto', 'Situação'], linhas, { vazio: 'Nenhum cartão cadastrado ainda.' }))}
    ${pd.secao('Últimos gastos importados', 'só gastos', pd.tabela(['Data', 'Cartão', 'Estabelecimento', 'Valor', 'Conferência'], recentes, { vazio: 'Nenhum gasto importado ainda.' }))}`;
}

function cartoes(f) {
  const edita = podeEditar(f);
  const linhas = dados.cartoes.map((c) => {
    const sug = !c.vinculo_confirmado ? sugerirUsuario(c.nome_beevale, dados.usuarios) : null;
    const sel = html`<select data-cx-usuario="${c.id}" ${edita ? '' : 'disabled'}><option value="">— escolher usuário —</option>
      ${dados.usuarios.map((u) => html`<option value="${u.id}" ${String(c.usuario || (sug && sug.id) || '') === String(u.id) ? 'selected' : ''}>${u.nome}</option>`)}</select>`;
    const acao = edita ? html`<button type="button" class="botao${c.vinculo_confirmado ? '' : ' on'}" data-cx-vincular="${c.id}">${c.vinculo_confirmado ? 'Trocar vínculo' : 'Confirmar vínculo'}</button>` : '';
    const situ = c.vinculo_confirmado ? pd.selo('ok', 'vinculado') : html`${pd.selo('atencao', 'responsável não vinculado')}${sug ? html` <span class="pequeno">sugestão: ${sug.nome} (confirme)</span>` : ''}`;
    return [c.identificacao, c.nome_beevale || '—', html`${sel} ${acao}`, situ];
  });
  return html`${edita ? html`<form class="cx-form" id="cx-cartao-novo">
      <label>Identificação do cartão<input name="identificacao" placeholder="ex.: Cartão 1 · final 4821" required></label>
      <label>Nome do responsável no BeeVale<input name="nome" placeholder="como aparece no site do BeeVale"></label>
      <button type="submit" class="botao on">Cadastrar cartão</button></form>` : ''}
    ${pd.aviso('O vínculo nunca é feito sozinho: o sistema sugere o usuário mais provável e o ADM confirma. Sem vínculo, a pendência cai no ADM com o aviso "responsável não vinculado".', 'atencao')}
    ${pd.secao('Cartões e responsáveis', 'nome no BeeVale → usuário do sistema', pd.tabela(['Cartão', 'Nome no BeeVale', 'Usuário no sistema', 'Situação'], linhas, { vazio: 'Nenhum cartão cadastrado ainda.' }))}`;
}

function importacao(f) {
  if (!podeEditar(f)) return html`<p class="vazio">Só o Administrativo importa os relatórios.</p>`;
  const passos = html`<ol class="cx-passos"><li>No site do BeeVale, baixe o relatório do dia anterior de cada cartão em <b>Excel (.xlsx)</b>.</li>
    <li>Envie o arquivo aqui, escolha o cartão e confirme as colunas (só na primeira vez; o mapeamento fica salvo).</li>
    <li>Só os <b>gastos</b> entram; recargas e transferências são contadas e separadas.</li></ol>`;
  const msg = imp.msg ? html`<p class="msg ok">${imp.msg}</p>` : '';
  const erro = imp.erro ? html`<p class="msg err">${imp.erro}</p>` : '';
  if (!imp.arquivo) {
    return html`${msg}${erro}${passos}<form class="cx-form" id="cx-arquivo-form"><label>Relatório do BeeVale (.xlsx)<input type="file" name="arquivo" accept=".xlsx" required></label>
      <button type="submit" class="botao on">Ler arquivo</button></form>`;
  }
  const cab = (imp.linhas[imp.cab] || []).map(String);
  const opcoes = (atual) => html`<option value="">— não usar —</option>${cab.filter(Boolean).map((h) => html`<option value="${h}" ${h === atual ? 'selected' : ''}>${h}</option>`)}`;
  const r = imp.resultado || { gastos: [], erros: [], avisos: [], recargas: 0, transferencias: 0 };
  const cartao = cartaoPorId(imp.cartao);
  const mapa = html`<div class="cx-mapa">${CAMPOS.map((c) => html`<label>${c.rotulo}${c.obrigatorio ? ' *' : ''}<select data-cx-col="${c.id}">${opcoes(imp.mapa.colunas[c.id])}</select></label>`)}
      <label>Linha do cabeçalho<input type="number" min="1" value="${imp.cab + 1}" data-cx-cab style="width:80px"></label>
      ${imp.planilhas.length > 1 ? html`<label>Planilha<select data-cx-plan>${imp.planilhas.map((n, i) => html`<option value="${i}" ${i === imp.plan ? 'selected' : ''}>${n}</option>`)}</select></label>` : ''}
      ${imp.mapa.colunas.tipo ? html`<label>Palavras de gasto<input data-cx-palavras="gasto" value="${imp.mapa.palavras.gasto}"></label>
        <label>Palavras de recarga<input data-cx-palavras="recarga" value="${imp.mapa.palavras.recarga}"></label>
        <label>Palavras de transferência<input data-cx-palavras="transferencia" value="${imp.mapa.palavras.transferencia}"></label>`
        : html`<label>Sem coluna de tipo<select data-cx-semtipo><option value="negativo" ${imp.mapa.semTipo !== 'positivo' ? 'selected' : ''}>valor negativo = gasto</option><option value="positivo" ${imp.mapa.semTipo === 'positivo' ? 'selected' : ''}>valor positivo = gasto</option></select></label>`}
      <button type="button" class="botao" data-cx-salvar-mapa>Salvar mapeamento</button></div>`;
  const resumo = html`<div class="cx-resumo"><b>${r.gastos.length}</b> gasto(s) · <b>${r.recargas}</b> recarga(s) separada(s) · <b>${r.transferencias}</b> transferência(s) separada(s)
      ${r.periodo ? html` · período ${dm(r.periodo.ini)} a ${dm(r.periodo.fim)}` : ''}${r.gastos.length ? html` · total ${reais(r.gastos.reduce((s, g) => s + g.valor, 0))}` : ''}</div>`;
  const problemas = r.erros.length ? html`<div class="msg err"><b>Corrija o arquivo ou o mapeamento antes de importar:</b><ul>${r.erros.slice(0, 15).map((e) => html`<li>${e.msg}</li>`)}</ul>${r.erros.length > 15 ? html`<p>… e mais ${r.erros.length - 15}.</p>` : ''}</div>` : '';
  const avisos = r.avisos.length ? html`<ul class="cx-avisos">${r.avisos.map((a) => html`<li>${a}</li>`)}</ul>` : '';
  const nomes = (r.responsaveis || []).length ? html`<p class="pequeno">Responsável no arquivo: <b>${r.responsaveis.join(', ')}</b>${cartao && cartao.vinculo_confirmado ? '' : ' — ainda sem vínculo; confirme na aba Cartões depois de importar.'}</p>` : '';
  const previa = r.gastos.length ? pd.tabela(['Linha', 'Data', 'Estabelecimento', 'Valor'], r.gastos.slice(0, 10).map((g) => [g.linha, dm(g.data), g.estabelecimento || '—', reais(g.valor)])) : '';
  const escolha = html`<div class="cx-mapa"><label>Cartão deste arquivo<select data-cx-cartao><option value="">— escolher —</option>${dados.cartoes.map((c) => html`<option value="${c.id}" ${String(c.id) === String(imp.cartao) ? 'selected' : ''}>${c.identificacao}</option>`)}<option value="novo" ${imp.cartao === 'novo' ? 'selected' : ''}>+ novo cartão…</option></select></label>
      ${imp.cartao === 'novo' ? html`<label>Identificação<input data-cx-novo-id value="${imp.novoId}" placeholder="ex.: Cartão 1 · final 4821"></label><label>Nome no BeeVale<input data-cx-novo-nome value="${imp.novoNome}"></label>` : ''}</div>`;
  const pronto2 = !r.erros.length && r.gastos.length >= 0 && r.periodo && (imp.cartao && (imp.cartao !== 'novo' || imp.novoId.trim()));
  return html`${msg}${erro}
    <p><b>${imp.nome}</b> <button type="button" class="link" data-cx-cancelar>trocar arquivo</button></p>
    ${pd.secao('1 · Colunas do arquivo', 'o sistema sugere; confira', mapa)}
    ${pd.secao('2 · Conferência do arquivo', '', html`${resumo}${problemas}${avisos}${nomes}${previa}`)}
    ${pd.secao('3 · Cartão e importação', '', html`${escolha}<p><button type="button" class="botao on" data-cx-importar ${pronto2 && !imp.ocupado ? '' : 'disabled'}>${imp.ocupado ? 'Importando…' : 'Importar gastos'}</button></p>`)}`;
}

const ROTULO_ACAO = { importacao: 'Importação', cartao_criado: 'Cartão cadastrado', vinculo: 'Vínculo de responsável', mapeamento_salvo: 'Mapeamento salvo' };
function registro() {
  const resumo = (d) => (d ? Object.entries(d).filter(([, v]) => v !== '' && v != null && typeof v !== 'object').map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ') : '');
  return pd.secao('Registro de ações', 'quem, o quê e quando', pd.tabela(['Quando', 'Usuário', 'Ação', 'Detalhe'],
    dados.log.map((l) => [new Date(l.em).toLocaleString('pt-BR'), l.usuario_nome || '—', ROTULO_ACAO[l.acao] || l.acao, resumo(l.detalhe)]), { vazio: 'Nenhuma ação registrada ainda.' }));
}

// Conferência: saldo de cada cartão no Bee Vale × contas "Bee Vale" e "Caixinha (dinheiro)" no Mais Controle (leitura automática, só consulta)
function conferencia() {
  const mc = leitura && leitura.maisControle; const bv = leitura && leitura.beevale;
  if (!mc && !bv) return pd.aviso('Ainda sem leitura: a rotina lê o Bee Vale e o Mais Controle no Chrome do escritório e grava aqui.', 'info');
  const arred = (v) => Math.round(v * 100) / 100;
  const conta = (n) => ((mc && mc.contas) || []).find((c) => c.nome === n);
  const mcBee = conta('Bee Vale'); const mcCx = conta('Caixinha (dinheiro)');
  const cartoesBv = (bv && bv.cartoes) || [];
  const comSaldo = cartoesBv.filter((c) => c.saldo > 0).sort((a, b) => b.saldo - a.saldo);
  const totalBee = bv ? arred(cartoesBv.reduce((s, c) => s + (c.saldo || 0), 0) + (bv.saldoCorporativo || 0)) : null;
  const dif = bv && mcBee ? arred(totalBee - mcBee.saldo) : null;
  const quando = (x) => (x && x.lidoEm ? `${x.lidoEm.slice(8, 10)}/${x.lidoEm.slice(5, 7)} às ${x.lidoEm.slice(11, 16)}` : '—');
  const cards = pd.cartoes([
    { rotulo: 'Bee Vale: saldo nos cartões', valor: totalBee == null ? '—' : reais(totalBee), sub: `${comSaldo.length} de ${cartoesBv.length} cartões com saldo` },
    { rotulo: 'Mais Controle: conta Bee Vale', valor: mcBee ? reais(mcBee.saldo) : '—', sub: 'valor atual da conta', nivel: mcBee && mcBee.saldo < 0 ? 'atencao' : '' },
    { rotulo: 'Diferença a conferir', valor: dif == null ? '—' : reais(dif), sub: 'Bee Vale menos Mais Controle', nivel: dif ? 'atencao' : 'ok' },
    { rotulo: 'Mais Controle: Caixinha (dinheiro)', valor: mcCx ? reais(mcCx.saldo) : '—', sub: 'valor atual da conta', nivel: mcCx && mcCx.saldo < 0 ? 'atencao' : '' },
  ], { colunas: 4 });
  return html`${pd.secao('Conferência Bee Vale × Mais Controle', `Bee Vale lido em ${quando(bv)} · Mais Controle lido em ${quando(mc)} · só consulta`, cards)}
    ${pd.secao('Cartões Bee Vale com saldo', `${cartoesBv.length} cartões, ${cartoesBv.length - comSaldo.length} zerados`, pd.tabela(['Cartão', 'Saldo no Bee Vale'], comSaldo.map((c) => [c.nome, reais(c.saldo)]), { vazio: 'Nenhum cartão com saldo.' }))}
    ${pd.aviso('A diferença pode ser recarga ou gasto ainda sem lançamento no Mais Controle: conferir antes de ajustar. Nada é alterado nos dois sites.', 'info')}`;
}

export function render({ f, sub = '' }) {
  if (!pronto) return String(html`<div class="carregando">Carregando a Caixinha…</div>`);
  const edita = podeEditar(f);
  const abas = [{ id: '', nome: 'Painel' }, edita && { id: 'importar', nome: 'Importação' }, { id: 'cartoes', nome: 'Cartões e responsáveis' }, { id: 'conferencia', nome: 'Conferência' }, { id: 'log', nome: 'Registro de ações' }].filter(Boolean).map((a) => ({ ...a, href: `#/caixinha${a.id ? `/${a.id}` : ''}` }));
  const ativa = abas.some((a) => a.id === sub) ? sub : '';
  const corpo = { importar: () => importacao(f), cartoes: () => cartoes(f), conferencia, log: registro }[ativa] || painel;
  const msg = html`${aviso && Date.now() - avisoEm < 10000 ? html`<p class="msg ok">${aviso}</p>` : ''}${erroGeral ? html`<p class="msg err">${erroGeral}</p>` : ''}`;
  erroGeral = '';
  return String(html`<div class="pd">${pd.cabecalho({ rotulo: 'Administrativo · Caixinha BeeVale', resp: 'POP ADM 11.11 · o sistema prepara e confere; a aprovação da recarga continua humana' })}${pd.abas(abas, ativa)}
    <div class="pd-corpo">${erroBanco ? html`<p class="msg err">${erroBanco}</p>` : ''}${msg}${corpo()}</div></div>`);
}

// ---------------------------------------------------------------- cliques e envios (uma vez só)
let ligado = false;
export function ligar(redesenhar) {
  if (ligado) return; ligado = true;
  const rodar = async (fn) => { try { await fn(); } catch (e) { erroGeral = e.message || String(e); imp.ocupado = false; } redesenhar(); };
  document.addEventListener('submit', (e) => {
    const f = e.target;
    if (f.id === 'cx-arquivo-form') { e.preventDefault(); const arq = f.arquivo.files[0]; if (arq) rodar(() => abrirArquivo(arq)); }
    if (f.id === 'cx-cartao-novo') {
      e.preventDefault();
      rodar(async () => { await criarCartao(f.identificacao.value, f.nome.value); await carregar(); dizer('Cartão cadastrado.'); });
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target; if (!t.matches || !imp.arquivo) return;
    if (t.matches('[data-cx-col]')) { imp.mapa.colunas[t.dataset.cxCol] = t.value; reanalisar(); redesenhar(); }
    else if (t.matches('[data-cx-cab]')) { imp.cab = Math.max(0, (Number(t.value) || 1) - 1); imp.mapa.colunas = adivinhar((imp.linhas[imp.cab] || []).map(String), imp.mapa.colunas); reanalisar(); redesenhar(); }
    else if (t.matches('[data-cx-plan]')) rodar(() => abrirArquivo(imp.arquivo, Number(t.value)));
    else if (t.matches('[data-cx-palavras]')) { imp.mapa.palavras[t.dataset.cxPalavras] = t.value; reanalisar(); redesenhar(); }
    else if (t.matches('[data-cx-semtipo]')) { imp.mapa.semTipo = t.value; reanalisar(); redesenhar(); }
    else if (t.matches('[data-cx-cartao]')) { imp.cartao = t.value; redesenhar(); }
  });
  document.addEventListener('input', (e) => {
    const t = e.target; if (!t.matches) return;
    if (t.matches('[data-cx-novo-id]')) { imp.novoId = t.value; const b = document.querySelector('[data-cx-importar]'); if (b) b.disabled = !(imp.resultado && !imp.resultado.erros.length && imp.resultado.periodo && imp.novoId.trim()); }
    if (t.matches('[data-cx-novo-nome]')) imp.novoNome = t.value;
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-cx-cancelar],[data-cx-salvar-mapa],[data-cx-importar],[data-cx-vincular]'); if (!t) return;
    if (t.matches('[data-cx-cancelar]')) { zerarImportacao(); redesenhar(); }
    else if (t.matches('[data-cx-salvar-mapa]')) rodar(async () => { await gravarMapeamento(imp.mapa); dados.mapeamento = imp.mapa; imp.msg = 'Mapeamento salvo para as próximas importações.'; });
    else if (t.matches('[data-cx-importar]')) {
      imp.ocupado = true; redesenhar();
      rodar(async () => {
        let cartao = cartaoPorId(imp.cartao);
        if (imp.cartao === 'novo') { cartao = await criarCartao(imp.novoId, imp.novoNome); await carregar(); imp.cartao = String(cartao.id); }
        const r = await gravarImportacao({ cartao, nomeArquivo: imp.nome, hash: imp.hash, analise: imp.resultado });
        await carregar();
        const semVinculo = !cartaoPorId(cartao.id).vinculo_confirmado;
        dizer(`Importado: ${r.novos} gasto(s)${r.ignorados ? `, ${r.ignorados} já existiam e foram ignorados` : ''}.${semVinculo ? ' Confirme o responsável deste cartão na aba Cartões e responsáveis.' : ''}`);
        zerarImportacao(); imp.cartao = '';
        location.hash = semVinculo ? '#/caixinha/cartoes' : '#/caixinha';
      });
    } else if (t.matches('[data-cx-vincular]')) {
      const id = t.dataset.cxVincular; const sel = document.querySelector(`[data-cx-usuario="${id}"]`);
      rodar(async () => {
        if (!sel || !sel.value) throw new Error('Escolha o usuário do sistema para este cartão.');
        const c = cartaoPorId(id);
        await mudarCartao(id, { usuario: sel.value, vinculo_confirmado: true }, 'vinculo', { cartao: c.identificacao, nome_beevale: c.nome_beevale, de: nomeUsuario(c.usuario) || '—', para: nomeUsuario(sel.value) });
        await carregar(); dizer('Vínculo confirmado.');
      });
    }
  });
}
