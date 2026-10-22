// Coletor: manda para o Supabase o que este computador lê do Drive (dados/json + o dados.json dos agentes).
// Cada arquivo vai para duas pastas do armazenamento "dados":
//   valores/  completo — só sócio e financeiro conseguem ler (regra do banco)
//   todos/    sem valores (diárias, custos, área financeira, indicadores marcados como restritos)
// Acesso: config.local.json (fica só neste computador, fora do GitHub). O coletor entra com a própria conta
// ("coletor", que só consegue gravar no armazenamento "dados"):
//   { "supabaseUrl": "https://....supabase.co", "chavePublica": "...", "coletorEmail": "...", "coletorSenha": "..." }
// (ainda aceita { "serviceRoleKey": "..." } no lugar da conta do coletor)
// Uso: node scripts/enviar-nuvem.mjs   (o servidor.ps1 roda sozinho a cada leitura do Drive)

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
  produtividade: 'produtividade.json', 'posobra-estado': 'posobra-estado.json', orcamentos: 'orcamentos.json', projetos: 'projetos.json', estoque: 'estoque.json', evidencias: 'evidencias.json', 'ferramentas-checklist': 'ferramentas-checklist.json', terceirizados: 'terceirizados.json', efetivo: 'efetivo.json',
};
const SO_VALORES = new Set(['financeiro']);   // não vai para todos/

let ok = 0; const erros = [];
const painel = ler(join(raiz, 'dados', 'painel-cache.json'));
const tarefas = [];
if (painel) tarefas.push(['painel', { atualizado: new Date().toISOString(), dados: painel }]);
for (const [nome, arq] of Object.entries(arquivos)) { const d = ler(join(pasta, arq)); if (d) tarefas.push([nome, d]); }
for (const [nome, d] of tarefas) {
  try {
    await enviar(`valores/${nome}.json`, d);
    if (!SO_VALORES.has(nome)) await enviar(`todos/${nome}.json`, nome === 'projetos' ? semValoresProjetos(d) : semValores(d));
    ok++;
  } catch (e) { erros.push(e.message); }
}
// Histórico do efetivo (quem estava em cada obra em cada dia): fica no banco, tabela efetivo_diario (grava e atualiza, nunca apaga)
const ef = ler(join(pasta, 'efetivo.json'));
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
console.log(`Nuvem: ${ok} de ${tarefas.length} arquivos enviados${erros.length ? ` · erros: ${erros.join(' | ')}` : ''}`);
process.exit(erros.length ? 1 : 0);
