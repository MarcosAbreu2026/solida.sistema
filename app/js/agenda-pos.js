// Agenda semanal do pós-obra feita no sistema: quem vai para qual obra em qual dia (cartões de funcionários arrastados para a semana).
// Na nuvem fica na tabela agenda_pos (quem edita: sócio, gestor do pós-obra e coordenação); no computador do escritório, só neste navegador (teste).
import { NA_NUVEM, listarAgendaPos, criarAgendaPos, criarAgendaPosLote, atualizarAgendaPos, apagarAgendaPos } from './nuvem.js';

const CHAVE = 'solida.agendaPos';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || { linhas: [], seq: 1 }; } catch { return { linhas: [], seq: 1 }; } };
const gravarLocal = (v) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

export let linhas = [];   // lançamentos da semana carregada: { id, data, obra, pessoa }
export let erro = '';

export async function carregar(de, ate) {
  try {
    linhas = NA_NUVEM ? await listarAgendaPos(de, ate) : lerLocal().linhas.filter((x) => x.data >= de && x.data <= ate);
    erro = '';
  } catch (e) { erro = String(e.message || e); }
  return linhas;
}
// coloca a pessoa na obra naquele dia (a mesma pessoa não entra duas vezes na mesma obra e dia)
export async function atribuir({ data, obra, pessoa }, de, ate) {
  if (linhas.some((x) => x.data === data && x.obra === obra && x.pessoa === pessoa)) return;
  if (NA_NUVEM) await criarAgendaPos({ data, obra, pessoa });
  else { const l = lerLocal(); l.linhas.push({ id: l.seq++, data, obra, pessoa }); gravarLocal(l); }
  await carregar(de, ate);
}
export async function mover(id, { data, obra }, de, ate) {
  const x = linhas.find((l) => String(l.id) === String(id)); if (!x) return;
  if (linhas.some((l) => l.data === data && l.obra === obra && l.pessoa === x.pessoa && String(l.id) !== String(id))) { await remover(id, de, ate); return; }
  if (NA_NUVEM) await atualizarAgendaPos(id, { data, obra });
  else { const l = lerLocal(); const y = l.linhas.find((q) => String(q.id) === String(id)); if (y) { y.data = data; y.obra = obra; } gravarLocal(l); }
  await carregar(de, ate);
}
export async function remover(id, de, ate) {
  if (NA_NUVEM) await apagarAgendaPos(id);
  else { const l = lerLocal(); l.linhas = l.linhas.filter((q) => String(q.id) !== String(id)); gravarLocal(l); }
  await carregar(de, ate);
}

// traz para o sistema o que a planilha do pós-obra já diz (só quem foi reconhecido e ainda não está na agenda)
export async function importar(lista, de, ate) {
  const novas = lista.filter((n) => !linhas.some((x) => x.data === n.data && x.obra === n.obra && x.pessoa === n.pessoa));
  if (!novas.length) return 0;
  if (NA_NUVEM) await criarAgendaPosLote(novas);
  else { const l = lerLocal(); for (const n of novas) l.linhas.push({ id: l.seq++, ...n }); gravarLocal(l); }
  await carregar(de, ate);
  return novas.length;
}
