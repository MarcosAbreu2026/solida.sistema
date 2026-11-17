// Configurações do sistema (pedido do Felipe, 11/11/2026): o que cada aba mostra e para quem, definido pela diretoria na página Configurações.
// Tudo é uma lista de funções (cargos) guardada por chave; sem a chave vale o padrão do código. O sócio/diretoria sempre vê tudo.
//   pagina.<id>               quem vê a aba            secao.<pagina>.<bloco>   quem vê um bloco dentro da aba
//   opcao.atas.escopo_todos   funções que veem as atas de todos os departamentos (as demais, só as do próprio departamento)
import { NA_NUVEM, carregarConfiguracoes, gravarConfiguracao, apagarConfiguracao } from './nuvem.js';

const CHAVE_LOCAL = 'solida.configuracoes';
let cfg = {};
try { cfg = JSON.parse(localStorage.getItem(CHAVE_LOCAL) || '{}') || {}; } catch { cfg = {}; }

export async function carregarConfig() {
  if (NA_NUVEM) cfg = await carregarConfiguracoes();
  return cfg;
}
export const snapshotConfig = () => JSON.stringify(cfg);
export const listaConfig = (chave) => (Array.isArray(cfg[chave]) ? cfg[chave] : null);
export const temConfig = (chave) => listaConfig(chave) !== null;
export const textoConfig = (chave) => (typeof cfg[chave] === 'string' ? cfg[chave] : '');
// a função vê? (diretoria sempre vê; sem configuração vale o padrão)
export const funcaoVe = (chave, funcaoId, padrao = true) => { if (funcaoId === 'socio') return true; const l = listaConfig(chave); return l ? l.includes(funcaoId) : padrao; };
export const secaoVisivel = (pagina, bloco, funcaoId) => funcaoVe(`secao.${pagina}.${bloco}`, funcaoId, true);

export async function definirConfig(chave, valor) {
  if (NA_NUVEM) await gravarConfiguracao(chave, valor);
  cfg = { ...cfg, [chave]: valor };
  if (!NA_NUVEM) { try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(cfg)); } catch { /* sem armazenamento */ } }
}
export async function restaurarConfig(chave) {
  if (NA_NUVEM) await apagarConfiguracao(chave);
  const { [chave]: _x, ...resto } = cfg; cfg = resto;
  if (!NA_NUVEM) { try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(cfg)); } catch { /* sem armazenamento */ } }
}
