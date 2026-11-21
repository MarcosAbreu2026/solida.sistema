// Coletor: manda para o Supabase o que este computador lê do Drive (dados/json + o dados.json dos agentes).
// Cada arquivo vai para duas pastas do armazenamento "dados":
//   valores/  completo — só sócio e financeiro conseguem ler (regra do banco)
//   todos/    sem valores (diárias, custos, área financeira, indicadores marcados como restritos)
// Acesso: config.local.json (fica só neste computador, fora do GitHub). O coletor entra com a própria conta
// ("coletor", que só consegue gravar no armazenamento "dados"):
//   { "supabaseUrl": "https://....supabase.co", "chavePublica": "...", "coletorEmail": "...", "coletorSenha": "..." }
// (ainda aceita { "serviceRoleKey": "..." } no lugar da conta do coletor)
// Uso: node scripts/enviar-nuvem.mjs                  (manda tudo)
//      node scripts/enviar-nuvem.mjs produtividade    (manda só os arquivos citados; útil quando este computador só tem dado novo de uma fonte)
// produtividade.json é MESCLADO com o que já está na nuvem (por obra e dia), para um computador não apagar o que o outro mandou.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfgArq = join(raiz, 'config.local.json');
if (!existsSync(cfgArq)) { console.log('Sem config.local.json: nada enviado para a nuvem.'); process.exit(0); }
const cfg = JSON.parse(readFileSync(cfgArq, 'utf8').replace(/^﻿/, ''));
const { supabaseUrl } = cfg;
let chave = cfg.serviceRoleKey && !/COLE/.test(cfg.serviceRoleKey) ? cfg.serviceRoleKey : null;   // apikey + token
let token = chave;
if (!supabaseUrl || (!chave && !(cfg.chavePublica && cfg.coletorEmail && cfg.coletorSenha))) { console.log('config.local.json sem o acesso do coletor: nada enviado.'); process.exit(0); }
if (!token) {
  // entra com a conta do coletor (o token vale 1 hora; a cada rodada entra de novo)
  const r = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: cfg.chavePublica, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cfg.coletorEmail, password: cfg.coletorSenha }),
  });
  if (!r.ok) { console.log(`Não consegui entrar com a conta do coletor (${r.status}): nada enviado.`); process.exit(1); }
  token = (await r.json()).access_token; chave = cfg.chavePublica;
}

const ler = (arq) => (existsSync(arq) ? JSON.parse(readFileSync(arq, 'utf8').replace(/^﻿/, '')) : null);

// tira o que é restrito: itens marcados restrito/restrita e os campos de dinheiro
const CAMPOS_VALOR = /^(valor_diaria|custo_total|valor_hora|salario)$/i;
function semValores(x) {
  if (Array.isArray(x)) return x.filter((i) => !(i && typeof i === 'object' && (i.restrito === true || i.restrita === true))).map(semValores);
  if (x && typeof x === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(x)) if (!CAMPOS_VALOR.test(k)) o[k] = semValores(v);
    return o;
  }
  return x;
}

// Escopo e aditivos: a grade da planilha traz as colunas de valor (material, mão de obra, locação, subtotal);
// na cópia para todos elas saem (a tela já esconde, mas aqui não pode nem chegar no navegador)
function semValoresProjetos(d) {
  const limpaGrade = (g, cols) => {
    if (!g || !Array.isArray(g.linhas)) return g;
    const fora = new Set([].concat(cols || []));
    return { ...g, linhas: g.linhas.map((l) => ({ ...l, c: (l.c || []).filter((x) => !fora.has(x[0])) })) };
  };
  const o = semValores(d);
  for (const obra of o.obras || []) {
    // terceirizados: valores orçado, fechado, diferença e forma de pagamento só para sócios (gestores veem situação, loja e prazos)
    const t = obra.terceirizados;
    if (t) for (const l of [t.cinza, t.laranja]) for (const i of l || []) { delete i.estimado; delete i.estimadoAditivo; delete i.fechado; delete i.diferenca; delete i.pagamento; }
    const e = obra.escopo; if (!e) continue;
    e.grade = limpaGrade(e.grade, e.colunasValor);
    for (const a of [].concat(e.aditivos || [])) { a.grade = limpaGrade(a.grade, a.colunasValor); delete a.total; }
  }
  return o;
}

async function enviar(caminho, obj) {
  const r = await fetch(`${supabaseUrl}/storage/v1/object/dados/${caminho}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: chave, 'Content-Type': 'application/json', 'x-upsert': 'true', 'Cache-Control': 'no-cache' },
    body: JSON.stringify(obj),
  });
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${await r.text()}`);
}

const pasta = join(raiz, 'dados', 'json');
const arquivos = {
  obras: 'obras.json', servicos: 'servicos.json', equipe: 'equipe.json', agenda: 'agenda.json', financeiro: 'financeiro.json', listas: 'listas.json',
  produtividade: 'produtividade.json', 'medicoes-mc': 'medicoes-mc.json', 'posobra-estado': 'posobra-estado.json', orcamentos: 'orcamentos.json', projetos: 'projetos.json', estoque: 'estoque.json', 'equipe-programada': 'equipe-programada.json', 'rotas-semana': 'rotas-semana.json', caixinha: 'caixinha.json', evidencias: 'evidencias.json', 'ferramentas-checklist': 'ferramentas-checklist.json', terceirizados: 'terceirizados.json', efetivo: 'efetivo.json', automacoes: 'automacoes.json',
};
const SO_VALORES = new Set(['financeiro']);   // não vai para todos/

const so = new Set(process.argv.slice(2));   // vazio = tudo
let ok = 0; const erros = [];

// mescla os registros de produtividade deste computador com os da nuvem: vale o registro mais completo de cada obra e dia
async function mesclarProdutividade(local) {
  try {
    const r = await fetch(`${supabaseUrl}/storage/v1/object/dados/valores/produtividade.json`, { headers: { Authorization: `Bearer ${token}`, apikey: chave } });
    if (!r.ok) return local;
    const nuvem = await r.json();
    const nota = (x) => (x.relatorio ? 4 : 0) + (x.programacao ? 1 : 0) + ((x.itens || []).length) + ((x.extras || []).length) + (x.semRelatorio ? 0 : 1);
    const mapa = new Map();
    for (const x of (nuvem.registros || [])) mapa.set(`${x.obra}|${x.data}`, x);
    for (const x of (local.registros || [])) { const k = `${x.obra}|${x.data}`; const o = mapa.get(k); if (!o || nota(x) >= nota(o)) mapa.set(k, x); }
    const todos = [...mapa.values()];
    const ultimo = todos.map((x) => x.data).sort().pop() || '';
    const corte = ultimo ? new Date(Date.parse(`${ultimo}T12:00:00Z`) - 30 * 86400000).toISOString().slice(0, 10) : '';
    const registros = todos.filter((x) => x.data >= corte).sort((a, b) => `${a.data}${a.obra}`.localeCompare(`${b.data}${b.obra}`));
    return { ...nuvem, ...local, atualizadoEm: [local.atualizadoEm, nuvem.atualizadoEm].filter(Boolean).sort().pop(), registros };
  } catch { return local; }
}
// contas ligadas a cada automação (Configurações › Automações): quem sabe é este computador
try { (await import('./contas-automacoes.mjs')).montarAutomacoes(raiz, cfg); } catch { /* sem as contas desta rodada */ }
const painel = ler(join(raiz, 'dados', 'painel-cache.json'));
const tarefas = [];
if (painel && (!so.size || so.has('painel'))) tarefas.push(['painel', { atualizado: new Date().toISOString(), dados: painel }]);
for (const [nome, arq] of Object.entries(arquivos)) {
  if (so.size && !so.has(nome)) continue;
  let d = ler(join(pasta, arq));
  if (d && nome === 'produtividade') d = await mesclarProdutividade(d);
  if (d) tarefas.push([nome, d]);
}
for (const [nome, d] of tarefas) {
  try {
    await enviar(`valores/${nome}.json`, d);
    if (!SO_VALORES.has(nome)) await enviar(`todos/${nome}.json`, nome === 'projetos' ? semValoresProjetos(d) : semValores(d));
    ok++;
  } catch (e) { erros.push(e.message); }
}
// Histórico do efetivo (quem estava em cada obra em cada dia): fica no banco, tabela efetivo_diario (grava e atualiza, nunca apaga)
const ef = (!so.size || so.has('efetivo')) ? ler(join(pasta, 'efetivo.json')) : null;
if (ef && ef.dias) {
  const linhas = [];
  for (const [dia, obras] of Object.entries(ef.dias)) for (const [obra, e] of Object.entries(obras || {})) {
    linhas.push({ dia, obra, hora: e.hora || null, postado_por: null, solida_qtd: (e.solida && e.solida.qtd) || 0, solida_nomes: (e.solida && e.solida.nomes) || [], terceiros: e.terceiros || [], total: e.total || 0, atualizado_em: new Date().toISOString() });
  }
  if (linhas.length) {
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/efetivo_diario?on_conflict=dia,obra`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, apikey: chave, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(linhas),
      });
      if (r.ok) ok++; else erros.push(`efetivo_diario: ${r.status} ${await r.text()}`);
      tarefas.push(['efetivo_diario', linhas]);
    } catch (e) { erros.push(`efetivo_diario: ${e.message}`); tarefas.push(['efetivo_diario', linhas]); }
  }
}
// Situação das obras (andamento · pausada · finalizada), que sócios e coordenação mudam no topo da página da obra: vem do banco
// para dados/json/obras-situacao.json, que os agentes lêem (só obras em andamento geram meta, produtividade e alerta)
try {
  const r = await fetch(`${supabaseUrl}/rest/v1/obras_cadastro?select=codigo,nome,situacao&order=codigo`, { headers: { Authorization: `Bearer ${token}`, apikey: chave } });
  if (r.ok) { const obras = await r.json(); if (Array.isArray(obras) && obras.length) (await import('node:fs')).writeFileSync(join(pasta, 'obras-situacao.json'), JSON.stringify({ atualizadoEm: new Date().toISOString(), obras }, null, 2)); }
} catch { /* sem a situação das obras: os agentes usam a última gravada */ }
console.log(`Nuvem: ${ok} de ${tarefas.length} arquivos enviados${erros.length ? ` · erros: ${erros.join(' | ')}` : ''}`);
process.exit(erros.length ? 1 : 0);
