// Quem está usando o sistema e o que pode ver.
// Modo teste (até o Supabase): a tela de login aceita qualquer usuário e senha, e a função/obras são
// escolhidas ali mesmo. A senha não é guardada. A sessão fica só neste navegador.
// "Ver como" (só sócio): mostra o sistema como outra função vê, sem sair da conta.
// Quando o login de verdade entrar, só este arquivo muda: o resto do sistema lê daqui.

import { funcaoPorId, AREAS_DE_OBRA } from './funcoes.js';

const CHAVE = 'solida.sessao';
const CHAVE_SIM = 'solida.verComo';

function ler(k) {
  try { return JSON.parse(localStorage.getItem(k)) || null; } catch { return null; }
}
function gravar(k, v) {
  try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch { /* sem armazenamento */ }
}

let atual = ler(CHAVE);
let sim = ler(CHAVE_SIM);   // { funcao, obras } quando o sócio está vendo como outra função

export const logado = () => !!atual;
const real = () => atual || { nome: '', usuario: '', funcao: 'socio', obras: [] };

// Sessão efetiva: com "ver como", a função e as obras são as simuladas
export const sessao = () => (sim && podeVerComo() ? { ...real(), funcao: sim.funcao, obras: sim.obras || [] } : real());
export const funcaoAtual = () => funcaoPorId(sessao().funcao);
export const veValores = () => !!funcaoAtual().veValores;

// Fase de teste: a faixa "Ver como" aparece para todo mundo, para trocar de perfil com um clique.
// Quando o login de verdade entrar, mudar para false: aí só o sócio vê a faixa.
export const MODO_TESTE = true;
export const podeVerComo = () => MODO_TESTE || real().funcao === 'socio';
export const simulando = () => !!(sim && podeVerComo() && sim.funcao !== real().funcao);
export const funcaoReal = () => funcaoPorId(real().funcao);
export function verComo(funcao, obras = []) {
  sim = funcao === real().funcao ? null : { funcao, obras };
  gravar(CHAVE_SIM, sim);
}

// Obras que a pessoa acompanha. Vazio = todas (funções que não são de obra).
export function obrasDaPessoa() {
  return funcaoAtual().porObra ? (sessao().obras || []) : [];
}

// Setor visível? Quem não vê valores não pode nem saber que o Financeiro existe.
// E cada função só vê os setores do seu trabalho (lista em funcoes.js).
export function podeVerArea(area) {
  if (!area) return false;
  if (area.restrita && !veValores()) return false;
  if (funcaoAtual().porObra && !AREAS_DE_OBRA.includes(area.id)) return false;
  // cada função vê só os setores da sua lista (funcoes.js › areas); sem lista = todos (diretoria)
  const lista = funcaoAtual().areas;
  if (lista && !lista.includes(area.id)) return false;
  return true;
}

export function entrar({ usuario, nome, funcao, obras }) {
  const u = String(usuario || '').trim().toLowerCase();
  atual = { usuario: u, nome: String(nome || '').trim() || u, funcao, obras: obras || [] };
  sim = null;
  gravar(CHAVE, atual);
  gravar(CHAVE_SIM, null);
  return atual;
}

export function sair() {
  atual = null;
  sim = null;
  gravar(CHAVE, null);
  gravar(CHAVE_SIM, null);
}

// identificador estável para guardar checks e lançamentos de teste
export const idPessoa = () => `${sessao().funcao}:${sessao().usuario || sessao().nome.toLowerCase()}`;
