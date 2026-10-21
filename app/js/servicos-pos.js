// Serviços do pós-obra em quadro por fase (pedido de 21/10): os serviços da planilha (OS) aparecem em colunas
// (Análise · Orçamento · Agendamento · Planejamento · Execução · Concluído…) e mudam de fase arrastando o cartão.
// A planilha continua sendo a origem dos serviços já existentes; o que o sistema muda (a fase) fica aqui e vale por cima dela,
// e serviços novos criados no sistema também ficam aqui. Na nuvem: tabela servicos_pos; no computador do escritório: só neste navegador (teste).
import { NA_NUVEM, listarServicosPos, gravarServicoPos, apagarServicoPos } from './nuvem.js';

const CHAVE = 'solida.servicosPos';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch { return []; } };
const gravarLocal = (v) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

export const FASES = ['Análise', 'Orçamento', 'Agendamento', 'Planejamento', 'Execução', 'Atrasado', 'Concluído'];
export const OUTRAS = ['Fixo', 'Pausado', 'Cancelado'];

export let linhas = [];   // o que o sistema mudou ou criou: { os, obra, relato, prazo, profissionais, situacao, concluido_em, origem }
export let erro = '';
export async function carregar() {
  try { linhas = NA_NUVEM ? await listarServicosPos() : lerLocal(); erro = ''; } catch (e) { erro = String(e.message || e); }
  return linhas;
}

// serviços da planilha + o que o sistema mudou + os serviços novos
export function mesclar(planilha) {
  const por = new Map(linhas.map((l) => [l.os, l]));
  const vindos = (planilha || []).map((s) => { const l = por.get(s.os); return l && l.origem === 'planilha' ? { ...s, situacao: l.situacao, concluido_em: l.concluido_em || (l.situacao === 'Concluído' ? s.concluido_em : null) } : s; });
  const novos = linhas.filter((l) => l.origem === 'sistema').map((l) => ({ os: l.os, obra: l.obra, relato: l.relato, prazo: l.prazo || null, profissionais: l.profissionais || null, situacao: l.situacao, concluido_em: l.concluido_em || null, data_inicio: null, noSistema: true }));
  return [...vindos, ...novos];
}

const hoje = () => new Date().toISOString().slice(0, 10);
async function salvar(l) {
  if (NA_NUVEM) await gravarServicoPos(l);
  else { const t = lerLocal().filter((x) => x.os !== l.os); t.push(l); gravarLocal(t); }
  await carregar();
}
// muda a fase de um serviço (da planilha ou do sistema)
export async function mudarFase(servico, fase) {
  const existente = linhas.find((l) => l.os === servico.os);
  const base = existente || { os: servico.os, origem: servico.noSistema ? 'sistema' : 'planilha', obra: servico.noSistema ? servico.obra : null, relato: servico.noSistema ? servico.relato : null, prazo: servico.noSistema ? servico.prazo : null, profissionais: servico.noSistema ? servico.profissionais : null };
  await salvar({ ...base, situacao: fase, concluido_em: fase === 'Concluído' ? hoje() : null });
}
export async function criar({ obra, relato, prazo, profissionais, situacao }) {
  const n = linhas.filter((l) => l.origem === 'sistema').map((l) => Number(String(l.os).replace(/\D/g, '')) || 0);
  await salvar({ os: `S-${String(Math.max(0, ...n) + 1).padStart(3, '0')}`, obra, relato, prazo: prazo || null, profissionais: profissionais || null, situacao, concluido_em: situacao === 'Concluído' ? hoje() : null, origem: 'sistema' });
}
// serviço criado no sistema pode ser apagado; o da planilha só muda de fase
export async function apagar(os) {
  if (NA_NUVEM) await apagarServicoPos(os); else gravarLocal(lerLocal().filter((x) => x.os !== os));
  await carregar();
}
