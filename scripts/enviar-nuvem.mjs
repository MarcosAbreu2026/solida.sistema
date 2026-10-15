// Coletor: manda para o Supabase o que este computador lê do Drive (dados/json + o dados.json dos agentes).
// Cada arquivo vai para duas pastas do armazenamento "dados":
//   valores/  completo — só sócio e financeiro conseguem ler (regra do banco)
//   todos/    sem valores (diárias, custos, área financeira, indicadores marcados como restritos)
// Chave de serviço: config.local.json (fica só neste computador, fora do GitHub):
//   { "supabaseUrl": "https://....supabase.co", "serviceRoleKey": "..." }
// Uso: node scripts/enviar-nuvem.mjs   (o servidor.ps1 roda sozinho a cada leitura do Drive)

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfgArq = join(raiz, 'config.local.json');
if (!existsSync(cfgArq)) { console.log('Sem config.local.json: nada enviado para a nuvem.'); process.exit(0); }
const { supabaseUrl, serviceRoleKey } = JSON.parse(readFileSync(cfgArq, 'utf8').replace(/^﻿/, ''));
if (!supabaseUrl || !serviceRoleKey || /COLE/.test(serviceRoleKey)) { console.log('config.local.json sem a chave de serviço: nada enviado.'); process.exit(0); }

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

async function enviar(caminho, obj) {
  const r = await fetch(`${supabaseUrl}/storage/v1/object/dados/${caminho}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey, 'Content-Type': 'application/json', 'x-upsert': 'true', 'Cache-Control': 'no-cache' },
    body: JSON.stringify(obj),
  });
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${await r.text()}`);
}

const pasta = join(raiz, 'dados', 'json');
const arquivos = {
  obras: 'obras.json', servicos: 'servicos.json', equipe: 'equipe.json', agenda: 'agenda.json', financeiro: 'financeiro.json', listas: 'listas.json',
  produtividade: 'produtividade.json', orcamentos: 'orcamentos.json', projetos: 'projetos.json', estoque: 'estoque.json', evidencias: 'evidencias.json',
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
    if (!SO_VALORES.has(nome)) await enviar(`todos/${nome}.json`, semValores(d));
    ok++;
  } catch (e) { erros.push(e.message); }
}
console.log(`Nuvem: ${ok} de ${tarefas.length} arquivos enviados${erros.length ? ` · erros: ${erros.join(' | ')}` : ''}`);
process.exit(erros.length ? 1 : 0);
