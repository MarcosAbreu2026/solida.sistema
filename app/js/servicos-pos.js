// Serviços (OS) do pós-obra. A OS tem os dados dela (fase, datas, prazo, quem faz), as atualizações (anotações e mudanças de fase e prazo) e as
// pendências que realmente são pendências (essas ficam em Atas e pendências, ligadas à OS). A OS NÃO vira pendência.
// A planilha continua sendo a origem dos serviços que já existem; o que o sistema muda (fase, prazo) fica aqui e vale por cima dela,
// e serviços novos criados no sistema também ficam aqui. Na nuvem: tabelas servicos_pos e os_atualizacoes; no computador do escritório: neste navegador.
import { NA_NUVEM, listarServicosPos, gravarServicoPos, apagarServicoPos, listarAtualizacoesOs, criarAtualizacaoOs } from './nuvem.js';
import { sessao } from './sessao.js';

const CHAVE = 'solida.servicosPos';
const CHAVE_AT = 'solida.osAtualizacoes';
const lerLocal = (k = CHAVE) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const gravarLocal = (v, k = CHAVE) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

export const FASES = ['Análise', 'Orçamento', 'Agendamento', 'Planejamento', 'Execução', 'Atrasado', 'Concluído'];
export const OUTRAS = ['Fixo', 'Pausado', 'Cancelado'];

export let linhas = [];        // o que o sistema mudou ou criou: { os, obra, relato, prazo, prazo_original, reprogramacoes, profissionais, situacao, concluido_em, origem }
export let atualizacoes = [];  // { id, os, tipo: nota | fase | prazo, texto, de, para, por_nome, criado_em }
export let erro = '';
export async function carregar() {
  try {
    linhas = NA_NUVEM ? await listarServicosPos() : lerLocal();
    atualizacoes = NA_NUVEM ? await listarAtualizacoesOs() : lerLocal(CHAVE_AT).sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)));
    erro = '';
  } catch (e) { erro = String(e.message || e); }
  return linhas;
}
export const atualizacoesDa = (os) => atualizacoes.filter((a) => a.os === os);

// serviços da planilha + o que o sistema mudou + os serviços novos
export function mesclar(planilha) {
  const por = new Map(linhas.map((l) => [l.os, l]));
  const vindos = (planilha || []).map((s) => { const l = por.get(s.os); return l && l.origem === 'planilha' ? { ...s, situacao: l.situacao, concluido_em: l.concluido_em || (l.situacao === 'Concluído' ? s.concluido_em : null), prazo: l.prazo || s.prazo, prazo_original: l.prazo_original || null, reprogramacoes: l.reprogramacoes || [] } : s; });
  const novos = linhas.filter((l) => l.origem === 'sistema').map((l) => ({ os: l.os, obra: l.obra, relato: l.relato, prazo: l.prazo || null, prazo_original: l.prazo_original || null, reprogramacoes: l.reprogramacoes || [], profissionais: l.profissionais || null, situacao: l.situacao, concluido_em: l.concluido_em || null, data_inicio: null, noSistema: true }));
  return [...vindos, ...novos];
}
export const reprogramado = (s) => !!s && !!s.prazo_original && s.prazo_original !== s.prazo;
export const tituloReprogramacao = (s) => `Prazo original ${s.prazo_original}${(s.reprogramacoes || []).length ? ` · ${(s.reprogramacoes || []).length} ${(s.reprogramacoes || []).length === 1 ? 'reprogramação' : 'reprogramações'}: ${(s.reprogramacoes || []).map((r) => `${r.de || 'sem prazo'} → ${r.para}${r.por ? ` (${r.por})` : ''}`).join('; ')}` : ''}`;

const hoje = () => new Date().toISOString().slice(0, 10);
async function salvar(l) {
  if (NA_NUVEM) await gravarServicoPos(l);
  else { const t = lerLocal().filter((x) => x.os !== l.os); t.push(l); gravarLocal(t); }
}
async function registrar(os, tipo, { texto = null, de = null, para = null } = {}) {
  const linha = { os, tipo, texto, de, para, por_nome: sessao().nome || '' };
  if (NA_NUVEM) await criarAtualizacaoOs(linha);
  else { const t = lerLocal(CHAVE_AT); t.push({ id: Date.now() + Math.random(), ...linha, criado_em: new Date().toISOString() }); gravarLocal(t, CHAVE_AT); }
}
const baseDe = (servico) => linhas.find((l) => l.os === servico.os) || { os: servico.os, origem: servico.noSistema ? 'sistema' : 'planilha', obra: servico.noSistema ? servico.obra : null, relato: servico.noSistema ? servico.relato : null, prazo: servico.noSistema ? servico.prazo : null, profissionais: servico.noSistema ? servico.profissionais : null, prazo_original: servico.prazo_original || null, reprogramacoes: servico.reprogramacoes || [] };

// muda a fase de um serviço (da planilha ou do sistema); fica registrado nas atualizações da OS
export async function mudarFase(servico, fase) {
  const base = baseDe(servico);
  await salvar({ ...base, situacao: fase, concluido_em: fase === 'Concluído' ? hoje() : null });
  await registrar(servico.os, 'fase', { de: servico.situacao || 'sem fase', para: fase });
  await carregar();
}
// reprograma o prazo: guarda o prazo original e cada troca (a OS passa a aparecer como "reprogramada"); registra nas atualizações
export async function reprogramarPrazo(servico, novo) {
  if (!novo || novo === servico.prazo) return;
  const base = baseDe(servico); const atual = servico.prazo && /^\d{4}/.test(servico.prazo) ? servico.prazo : null;
  const rep = [...(base.reprogramacoes || []), { de: atual, para: novo, em: new Date().toISOString(), por: sessao().nome || '' }];
  await salvar({ ...base, situacao: base.situacao || servico.situacao, concluido_em: base.concluido_em || servico.concluido_em || null, prazo: novo, prazo_original: atual ? (base.prazo_original || atual) : base.prazo_original || null, reprogramacoes: atual ? rep : base.reprogramacoes || [] });
  await registrar(servico.os, 'prazo', { de: atual, para: novo });
  await carregar();
}
export async function nota(os, texto) { await registrar(os, 'nota', { texto }); await carregar(); }
export async function criar({ obra, relato, prazo, profissionais, situacao }) {
  const n = linhas.filter((l) => l.origem === 'sistema').map((l) => Number(String(l.os).replace(/\D/g, '')) || 0);
  const os = `S-${String(Math.max(0, ...n) + 1).padStart(3, '0')}`;
  await salvar({ os, obra, relato, prazo: prazo || null, profissionais: profissionais || null, situacao, concluido_em: situacao === 'Concluído' ? hoje() : null, origem: 'sistema', reprogramacoes: [] });
  await registrar(os, 'fase', { de: null, para: situacao });
  await carregar();
}
// serviço criado no sistema pode ser apagado; o da planilha só muda de fase
export async function apagar(os) {
  if (NA_NUVEM) await apagarServicoPos(os); else gravarLocal(lerLocal().filter((x) => x.os !== os));
  await carregar();
}
