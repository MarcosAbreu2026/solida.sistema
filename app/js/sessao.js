// Quem está usando o sistema e o que pode ver.
// Modo teste (até o Supabase): a tela de login aceita qualquer usuário e senha, e a função/obras são
// escolhidas ali mesmo. A senha não é guardada. A sessão fica só neste navegador.
// "Ver como" (só sócio): mostra o sistema como outra função vê, sem sair da conta.
// Quando o login de verdade entrar, só este arquivo muda: o resto do sistema lê daqui.

import { funcaoPorId, AREAS_DE_OBRA } from './funcoes.js';
import { NA_NUVEM, perfilAtual } from './nuvem.js';

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

// na nuvem, quem está logado vem do Supabase (perfil com a função que a diretoria definiu)
const daNuvem = () => { const p = perfilAtual(); return p ? { usuario: p.email, nome: p.nome || p.email, funcao: p.funcao, obras: p.obras || [], id: p.id } : null; };
export const logado = () => (NA_NUVEM ? !!(perfilAtual() && perfilAtual().funcao && perfilAtual().ativo !== false && !perfilAtual().trocar_senha) : !!atual);
const real = () => (NA_NUVEM ? daNuvem() : atual) || { nome: '', usuario: '', funcao: 'socio', obras: [] };

// Sessão efetiva: com "ver como", a função e as obras são as simuladas
export const sessao = () => (sim && podeVerComo() ? { ...real(), funcao: sim.funcao, obras: sim.obras || [] } : real());
export const funcaoAtual = () => funcaoPorId(sessao().funcao);
export const veValores = () => !!funcaoAtual().veValores;
// Situação da obra (andamento, pausada, finalizada): só sócios (Marcos, Márcio, Felipe) e a coordenação de operações (Simone) mudam
export const podeMudarSituacaoObra = () => ['socio', 'coord_operacoes'].includes(real().funcao);

// Fase de teste: a faixa "Ver como" aparece para todo mundo, para trocar de perfil com um clique.
// Quando o login de verdade entrar, mudar para false: aí só o sócio vê a faixa.
export const MODO_TESTE = !NA_NUVEM;   // na nuvem, só a diretoria usa o "Ver como"
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
  if (funcaoAtual().porObra && !funcaoAtual().personalizada && !AREAS_DE_OBRA.includes(area.id)) return false;
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
export const idPessoa = () => (NA_NUVEM && real().id ? real().id : `${sessao().funcao}:${sessao().usuario || sessao().nome.toLowerCase()}`);
