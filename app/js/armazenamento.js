// Onde ficam os checks do quadro de funções e os lançamentos de produtividade.
// Fase atual (teste): só neste navegador (localStorage). Com o Supabase, estas mesmas funções passam
// a ler e gravar no banco — as telas não mudam.

function lerJSON(k, padrao) {
  try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; }
}
function gravarJSON(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
}

// ---------------------------------------------------------------- quadro de funções
// checks[pessoa][data][tarefa] = 'feito' | 'nao'
export function lerChecks(pessoa) {
  return lerJSON('solida.checks', {})[pessoa] || {};
}
// info = { nome, funcao, teste } — vai junto para o servidor (a pontuação do Perfil usa)
export function marcarCheck(pessoa, data, tarefa, valor, info = {}) {
  const tudo = lerJSON('solida.checks', {});
  tudo[pessoa] = tudo[pessoa] || {};
  tudo[pessoa][data] = tudo[pessoa][data] || {};
  if (valor) tudo[pessoa][data][tarefa] = valor;
  else delete tudo[pessoa][data][tarefa];
  gravarJSON('solida.checks', tudo);
  enviarCheck({ pessoa, data, tarefa, valor: valor || '', ...info });
}

// ---------------------------------------------------------------- marcações compartilhadas (servidor)
// O servidor guarda todas as marcações (dados/tarefas-feitas.jsonl); este navegador fica com uma cópia.
import { NA_NUVEM, linhasTarefas, marcarTarefa } from './nuvem.js';

function enviarCheck(c) {
  if (NA_NUVEM) { if (!c.registro) marcarTarefa(c).catch(() => {}); return; }
  try { fetch('/api/tarefas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) }).catch(() => {}); } catch { /* sem servidor */ }
}
// Baixa as marcações de todos; o que só existe aqui (marcado antes de ir para o servidor) é enviado.
export async function sincronizarTarefas(atual = null) {
  let linhas;
  if (NA_NUVEM) { try { linhas = await linhasTarefas(); } catch { return false; } }
  else { try { const r = await fetch('/api/tarefas', { cache: 'no-store' }); if (!r.ok) return false; linhas = await r.json(); } catch { return false; } }
  const checks = {}; const pessoas = {};
  for (const l of Array.isArray(linhas) ? linhas : []) {
    if (!l || !l.pessoa) continue;
    pessoas[l.pessoa] = { nome: l.nome || pessoas[l.pessoa]?.nome || '', funcao: l.funcao || pessoas[l.pessoa]?.funcao || '', teste: !!l.teste,
      obras: l.registro ? (Array.isArray(l.obras) ? l.obras : (l.obras ? [l.obras] : [])) : (pessoas[l.pessoa]?.obras || []) };
    if (l.registro) continue;
    checks[l.pessoa] = checks[l.pessoa] || {};
    if (!l.data || !l.tarefa) continue;
    checks[l.pessoa][l.data] = checks[l.pessoa][l.data] || {};
    if (l.valor) checks[l.pessoa][l.data][l.tarefa] = l.valor; else delete checks[l.pessoa][l.data][l.tarefa];
  }
  if (atual && atual.pessoa) {
    const locais = (lerJSON('solida.checks', {})[atual.pessoa]) || {};
    for (const [data, ts] of Object.entries(locais)) {
      for (const [tarefa, valor] of Object.entries(ts)) {
        if (!(checks[atual.pessoa] && checks[atual.pessoa][data] && tarefa in checks[atual.pessoa][data])) {
          enviarCheck({ ...atual, data, tarefa, valor });
          checks[atual.pessoa] = checks[atual.pessoa] || {}; checks[atual.pessoa][data] = checks[atual.pessoa][data] || {};
          checks[atual.pessoa][data][tarefa] = valor;
          pessoas[atual.pessoa] = pessoas[atual.pessoa] || { nome: atual.nome, funcao: atual.funcao, teste: !!atual.teste };
        }
      }
    }
  }
  // cadastro da pessoa (nome, função, obras): manda quando mudou, para a pontuação automática saber as obras dela
  if (atual && atual.pessoa && !NA_NUVEM) {
    const reg = pessoas[atual.pessoa]; const obras = atual.obras || [];
    if (!reg || reg.nome !== atual.nome || JSON.stringify(reg.obras || []) !== JSON.stringify(obras)) {
      enviarCheck({ ...atual, registro: true, data: '', tarefa: '', valor: '' });
      pessoas[atual.pessoa] = { nome: atual.nome, funcao: atual.funcao, teste: !!atual.teste, obras };
    }
  }
  gravarJSON('solida.checks', checks);
  gravarJSON('solida.pessoasTarefas', pessoas);
  return true;
}
// quem já marcou alguma tarefa: { pessoa: { nome, funcao, teste } }
export const lerPessoasTarefas = () => lerJSON('solida.pessoasTarefas', {});
// Primeiro dia em que a pessoa usou o sistema: pendências só contam a partir daí
export function primeiroDia(pessoa, hoje) {
  const desde = lerJSON('solida.desde', {});
  if (!desde[pessoa]) { desde[pessoa] = hoje; gravarJSON('solida.desde', desde); }
  return desde[pessoa];
}
export function lerTodosChecks() {
  return lerJSON('solida.checks', {});
}

// ---------------------------------------------------------------- lançamento direto na tabela da semana
// manuais[`${obra}|${data}|${item}`] = { feito, motivo, por, em }. Vale mais que o WhatsApp
// (é a correção feita por quem está na obra).
const CHAVE_MANUAIS = 'solida.lancamentos-item';
const chaveItem = (obra, data, item) => `${obra}|${data}|${String(item).toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()}`;
export function lerManual(obra, data, item) {
  return lerJSON(CHAVE_MANUAIS, {})[chaveItem(obra, data, item)] || null;
}
export function gravarManual(obra, data, item, dados) {
  const tudo = lerJSON(CHAVE_MANUAIS, {});
  const k = chaveItem(obra, data, item);
  if (dados === null) delete tudo[k];
  else tudo[k] = { ...(tudo[k] || {}), ...dados, em: new Date().toISOString() };
  return gravarJSON(CHAVE_MANUAIS, tudo);
}

// Item sem dia definido que a pessoa vinculou a um dia da semana
// vinculos[`${obra}|${inicioSemana}|${texto}`] = 'aaaa-mm-dd'
const CHAVE_VINCULOS = 'solida.vinculos-dia';
export function lerVinculo(obra, inicio, texto) {
  return lerJSON(CHAVE_VINCULOS, {})[`${obra}|${inicio}|${texto}`] || null;
}
export function vincularDia(obra, inicio, texto, data) {
  const tudo = lerJSON(CHAVE_VINCULOS, {});
  const k = `${obra}|${inicio}|${texto}`;
  if (data) tudo[k] = data; else delete tudo[k];
  return gravarJSON(CHAVE_VINCULOS, tudo);
}

// ---------------------------------------------------------------- produtividade (modo teste)
// lancamentos[`${obra}|${data}`] = { obra, data, por, em, itens: [{ item, meta, unidade, feito, motivo, obs }] }
export function lerLancamentos() {
  return lerJSON('solida.produtividade-teste', {});
}
export function gravarLancamento(l) {
  const tudo = lerLancamentos();
  tudo[`${l.obra}|${l.data}`] = l;
  return gravarJSON('solida.produtividade-teste', tudo);
}
export function apagarLancamento(obra, data) {
  const tudo = lerLancamentos();
  delete tudo[`${obra}|${data}`];
  gravarJSON('solida.produtividade-teste', tudo);
}
