// Atas e pendências (pedido de 21/10, primeira prioridade da reunião): o Bitrix está sendo pouco usado, então as
// atas e as ações que saem delas ficam aqui. Cada ata é ligada a uma obra ou a um departamento. Item que exige
// ação vira pendência, com responsável e prazo, que dá para filtrar por pessoa, setor ou obra.
// Pendências em quadro por prazo (como o Bitrix: Vencido · Hoje · Esta semana · Próxima semana · Sem prazo ·
// Em duas semanas · Concluído) ou em lista. Na nuvem os dados ficam no Supabase (tabelas atas e pendencias,
// com as regras de quem vê no próprio banco); no computador do escritório ficam só neste navegador (teste).

import { html, data as fmtData } from '../formato.js';
import { hojeISO, somarDias, inicioDaSemana, diasEntre } from '../datas.js';
import { NA_NUVEM, perfilAtual, listarAtasPendencias, criarAtaNuvem, criarPendenciaNuvem, atualizarPendenciaNuvem, atualizarAtaNuvem, apagarPendenciaNuvem, apagarAtaNuvem } from '../nuvem.js';
import { SETORES } from '../funcoes.js';
import { sessao, idPessoa, funcaoReal, funcaoAtual } from '../sessao.js';
import { lerPessoasTarefas } from '../armazenamento.js';
import { analisarAta, lerArquivoAta } from '../ata-leitor.js';

export const ABAS = [['pendencias', 'Pendências'], ['atas', 'Atas'], ['nova', 'Nova ata']];
export const SETORES_ATA = [...SETORES.map(([, nome]) => nome), 'Diretoria / geral'];

let dados = { atas: [], pendencias: [], pessoas: [], erro: '' };
let rascunho = null;   // ata lida de um arquivo/texto, esperando conferência

export const temRascunho = () => !!rascunho;
export function descartarRascunho() { rascunho = null; }
// lê um arquivo (PDF ou texto) ou texto colado e monta o rascunho da ata
export async function importar({ arquivo = null, texto = '' }, obras) {
  if (!dados.pessoas.length) await carregar();
  let t = texto; let nome = ''; let paginas = null;
  if (arquivo) { const r = await lerArquivoAta(arquivo); t = r.texto; paginas = r.paginas; nome = String(arquivo.name || '').replace(/\.[^.]+$/, ''); }
  if (!String(t).trim()) throw new Error('Não há texto para ler.');
  rascunho = analisarAta(t, { pessoas: dados.pessoas, obras, setores: SETORES_ATA, hoje: hojeISO(), nomeArquivo: nome, paginas });
  return rascunho;
}

// ---------------------------------------------------------------- armazenamento
const CHAVE = 'solida.atas';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || { atas: [], pendencias: [], seq: 1 }; } catch { return { atas: [], pendencias: [], seq: 1 }; } };
const gravarLocal = (v) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
function pessoasLocais() {
  const m = new Map([[idPessoa(), { id: idPessoa(), nome: sessao().nome }]]);
  for (const [id, p] of Object.entries(lerPessoasTarefas())) if (p && p.nome && !m.has(id)) m.set(id, { id, nome: p.nome, funcao: p.funcao });
  return [...m.values()];
}
const souEu = () => (NA_NUVEM ? perfilAtual() && perfilAtual().id : idPessoa());

// Quem vê o quê: só sócios e administrativo veem as pendências e atas de outras pessoas da Sólida fora da própria obra
// ou departamento. Os demais veem o que é seu (responsável ou criador), da(s) sua(s) obra(s) e, quem não é de obra,
// do(s) departamento(s) da sua função. O banco já aplica esta regra para valer (tabelas atas e pendencias); aqui ela
// também vale no modo teste e no "ver como", para a tela mostrar o mesmo.
function visivelParaMim(x, ehAta, pendDaAta) {
  const f = funcaoAtual();
  if (['socio', 'administrativo'].includes(f.id)) return true;
  const eu = souEu();
  if (x.criado_por === eu || (!ehAta && x.responsavel === eu)) return true;
  if (x.obra && (sessao().obras || []).includes(x.obra)) return true;
  if (!f.porObra && x.setor) {
    const nomes = SETORES.filter(([id]) => (f.areas || []).includes(id)).map(([, nome]) => nome);
    if (nomes.includes(x.setor)) return true;
  }
  return ehAta && pendDaAta.some((p) => String(p.ata_id) === String(x.id) && p.responsavel === eu);
}
export async function carregar() {
  try {
    if (NA_NUVEM) dados = { ...(await listarAtasPendencias()), erro: '' };
    else { const l = lerLocal(); dados = { atas: [...l.atas].sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.id - a.id), pendencias: l.pendencias, pessoas: pessoasLocais(), erro: '' }; }
    const todasPend = dados.pendencias;
    dados = { ...dados, pendencias: todasPend.filter((p) => visivelParaMim(p, false, [])), atas: dados.atas.filter((a) => visivelParaMim(a, true, todasPend)) };
  } catch (e) { dados = { ...dados, erro: String(e.message || e) }; }
  return dados;
}
const nomeDe = (id, reserva) => ((dados.pessoas.find((p) => p.id === id) || {}).nome) || reserva || '—';

// ---------------------------------------------------------------- revisão da ata (R01, R02…)
// Criar revisão = abrir a ata no formulário, mexer em qualquer coisa (dados, pendências, informativos) e salvar.
// Os itens mantidos continuam sendo as mesmas pendências (status e reprogramações preservados); os tirados somem; os novos entram.
// O nome ganha o próximo Rnn e o PDF novo vai para o Drive (o PDF da revisão anterior continua lá).
const mapaInfo = (p) => ({ n: p.item || null, texto: p.descricao, quem: p.responsavel ? nomeDe(p.responsavel) : (p.externoNome || p.externoCategoria || (p.externoTipo === 'cliente' ? 'Cliente' : p.externoTipo === 'arquitetura' ? 'Arquitetura' : '')), tipo: p.responsavel ? 'solida' : (p.externoTipo || 'terceirizado'), categoria: p.responsavel ? null : (p.externoCategoria || null) });
const camposPend = (p) => ({ item: p.item || null, descricao: p.descricao, responsavel: p.responsavel || null, responsavel_nome: p.responsavel ? nomeDe(p.responsavel) : (p.externoNome || p.externoCategoria || (p.externoTipo === 'cliente' ? 'Cliente' : p.externoTipo === 'arquitetura' ? 'Arquitetura' : null)), responsavel_tipo: p.responsavel ? 'solida' : (p.externoTipo || 'terceirizado'), responsavel_categoria: p.responsavel ? null : (p.externoCategoria || null), prazo: p.prazo || null });
export const ataPorId = (id) => dados.atas.find((x) => String(x.id) === String(id));
// a ata salva, na forma que o formulário entende (para editar)
export function ataComoRascunho(a) {
  const semA = (s) => semAcento(String(s || '')).toLowerCase().trim();
  const pend = dados.pendencias.filter((p) => String(p.ata_id) === String(a.id) && p.status !== 'cancelada').map((p) => ({ kind: 'pendencia', pid: p.id, item: p.item, descricao: p.descricao, responsavel: p.responsavel || '', externoTipo: p.responsavel ? '' : (p.responsavel_tipo || 'terceirizado'), externoCategoria: p.responsavel_categoria || '', externoNome: p.responsavel ? '' : (p.responsavel_nome || ''), prazo: p.prazo || '' }));
  const infos = (a.informativos || []).map((x, i) => {
    const t = typeof x === 'string' ? { texto: x } : x; const pessoa = t.quem ? dados.pessoas.find((q) => semA(q.nome) === semA(t.quem)) : null;
    return { kind: 'informativo', item: t.n || (1000 + i), descricao: t.texto, responsavel: pessoa ? pessoa.id : '', externoTipo: pessoa ? '' : (t.tipo || 'solida'), externoCategoria: t.categoria || '', externoNome: pessoa ? '' : (t.quem || '') };
  });
  return { data: a.data, obra: a.obra || '', setor: a.setor || '', local: a.local || '', participantes: a.participantes || [], tipoReuniao: a.tipo_reuniao || 'REUNIÃO', resumo: a.resumo || '', pendencias: pend, informativosLista: infos, revisando: a };
}
export async function revisar(id, { data, tipoReuniao, obra, setor, local, participantes, resumo, pendencias, informativos }) {
  const a = ataPorId(id); if (!a) throw new Error('ata não encontrada');
  const revisao = (Number(a.revisao) || 0) + 1;
  const titulo = nomePadrao({ obra, setor, data, tipo: tipoReuniao, revisao });
  const mudAta = { titulo, data, tipo: obra ? 'obra' : 'departamento', obra: obra || null, setor: setor || null, participantes, resumo, tipo_reuniao: tipoReuniao || 'REUNIÃO', revisao, local: local || null, informativos: informativos.map(mapaInfo), arquivo: null, arquivada_em: null, arquivo_erro: null };
  const existentes = dados.pendencias.filter((p) => String(p.ata_id) === String(id) && p.status !== 'cancelada');
  const manter = new Set(pendencias.filter((p) => p.pid).map((p) => String(p.pid)));
  const remover = existentes.filter((e) => !manter.has(String(e.id)));
  const agora = new Date().toISOString(); const quem = sessao().nome || '';
  const mudancasDe = (p) => {
    const e = existentes.find((x) => String(x.id) === String(p.pid)); const m = { ...camposPend(p), obra: obra || null, setor: setor || null };
    if (e && e.prazo && m.prazo && m.prazo !== e.prazo) { m.prazo_original = e.prazo_original || e.prazo; m.reprogramacoes = [...(e.reprogramacoes || []), { de: e.prazo, para: m.prazo, em: agora, por: quem }]; }
    return m;
  };
  if (NA_NUVEM) {
    await atualizarAtaNuvem(id, mudAta);
    for (const p of pendencias) { if (p.pid) await atualizarPendenciaNuvem(p.pid, mudancasDe(p)); else await criarPendenciaNuvem({ ...camposPend(p), ata_id: id, status: 'aberta', obra: obra || null, setor: setor || null }); }
    for (const e of remover) await apagarPendenciaNuvem(e.id);
  } else {
    const l = lerLocal(); Object.assign(l.atas.find((x) => String(x.id) === String(id)), mudAta);
    for (const p of pendencias) {
      if (p.pid) { const q = l.pendencias.find((x) => String(x.id) === String(p.pid)); if (q) Object.assign(q, mudancasDe(p)); }
      else l.pendencias.push({ id: l.seq++, ata_id: id, ...camposPend(p), status: 'aberta', obra: obra || null, setor: setor || null, criado_por: idPessoa(), criado_em: agora, concluida_em: null });
    }
    l.pendencias = l.pendencias.filter((x) => !remover.some((e) => String(e.id) === String(x.id)));
    gravarLocal(l);
  }
  await carregar();
  return id;
}
// ---------------------------------------------------------------- acompanhamento da ata e pauta da próxima reunião
// As pendências ficam ligadas à ata (mesmo se saírem da lista de pendências). Daqui sai o acompanhamento ("x de y concluídas")
// e a pauta da próxima reunião: o que ficou aberto da ata e das atas anteriores da mesma obra/departamento.
const pendDaAta = (a) => dados.pendencias.filter((p) => String(p.ata_id) === String(a.id) && p.status !== 'cancelada');
export function acompanhamento(a) {
  const ps = pendDaAta(a); const hoje = hojeISO();
  return { total: ps.length, feitas: ps.filter((p) => p.status === 'feita').length, abertas: ps.filter((p) => p.status === 'aberta').length, atrasadas: ps.filter((p) => p.status === 'aberta' && p.prazo && p.prazo < hoje).length, reprogramadas: ps.filter(reprogramada).length };
}
export function pautaTexto(a) {
  const hoje = hojeISO(); const mesmoLugar = (x) => (a.obra ? x.obra === a.obra : x.setor === a.setor);
  const linha = (p) => { const [ass, resto] = dividirDescricao(p.descricao); const quem = String(nomeDe(p.responsavel, p.responsavel_nome)).toLocaleUpperCase('pt-BR'); const atras = p.prazo && p.prazo < hoje ? ' [ATRASADA]' : ''; const rep = reprogramada(p) ? ` [reprogramada, era ${dm(p.prazo_original).slice(0, 5)}]` : '';
    return `- ${ass ? `${ass}, ${resto}` : p.descricao} — ${quem}${p.prazo ? ` — prazo ${dm(p.prazo).slice(0, 5)}` : ''}${atras}${rep}`; };
  const daAta = pendDaAta(a); const abertasAta = daAta.filter((p) => p.status === 'aberta').sort((x, y) => String(x.prazo || '9').localeCompare(String(y.prazo || '9')));
  const feitas = daAta.filter((p) => p.status === 'feita');
  const outras = dados.pendencias.filter((p) => String(p.ata_id) !== String(a.id) && p.status === 'aberta' && p.ata_id && mesmoLugar(p)).sort((x, y) => String(x.prazo || '9').localeCompare(String(y.prazo || '9')));
  const out = [`PAUTA DA PRÓXIMA REUNIÃO — ${a.obra || a.setor || 'Escritório'}`, `Base: ${a.titulo}`, ''];
  out.push(`1. Pendências abertas da reunião de ${dm(a.data)} (${abertasAta.length})`, ...(abertasAta.length ? abertasAta.map(linha) : ['- nenhuma pendência aberta']), '');
  if (feitas.length) out.push(`2. Concluídas desde a reunião (${feitas.length})`, ...feitas.map((p) => linha(p).replace(/ \[.*$/, '')), '');
  if (outras.length) out.push(`${feitas.length ? 3 : 2}. Outras pendências abertas ${a.obra ? 'desta obra' : 'deste departamento'}, de atas anteriores (${outras.length})`, ...outras.map(linha), '');
  out.push('Assuntos novos:', '- ');
  return out.join('\n');
}
// ---------------------------------------------------------------- nome padrão da ata
// Obra (ou pós-obra) _ aaaa.mm.dd _ ATA _ tipo _ Rnn   ex.: Mo344_2026.07.10_ATA_ARQUITETURA-CLIENTE_R00
// Salva no Drive, na pasta da obra: GERENCIAMENTO\ATA (obra) ou PÓS OBRA\PO_OBRAS\<ano>\Po_NNN\GERENCIAMENTO\ATA (pós-obra).
export const TIPOS_REUNIAO = ['REUNIÃO', 'ARQUITETURA', 'CLIENTE', 'ARQUITETURA-CLIENTE', 'TERCEIRIZADO', 'PLANEJAMENTO'];
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
// A ata é da obra E do departamento (a obra manda no nome e na pasta do Drive); reunião só do escritório não tem nenhum dos dois.
const semEspaco = (s) => semAcento(s).replace(/\s*\/\s*/g, '-').replace(/\s+/g, '');
const baseDe = ({ obra, setor }) => obra || semEspaco(setor || '') || 'ESCRITORIO';
export const rev2 = (n) => `R${String(Number(n) || 0).padStart(2, '0')}`;
export function proximaRevisao({ obra, setor, data, tipo }) {
  const base = baseDe({ obra, setor });
  const iguais = dados.atas.filter((a) => baseDe(a) === base && a.data === data && (a.tipo_reuniao || 'REUNIÃO') === tipo);
  return iguais.length ? Math.max(...iguais.map((a) => Number(a.revisao) || 0)) + 1 : 0;
}
export function nomePadrao({ obra, setor, data, tipo, revisao }) {
  if (!data) return '';
  return `${baseDe({ obra, setor })}_${String(data).replace(/-/g, '.')}_ATA_${tipo || 'REUNIÃO'}_${rev2(revisao)}`;
}
// atualiza o nome mostrado no formulário (e a revisão, se a pessoa não mexeu nela)
export function atualizarNomeDoForm(form) {
  const obra = form.obra.value === '-' ? '' : form.obra.value; const setor = form.setor.value; const data = form.data.value; const tipo = form.tipo_reuniao.value;
  form.revisao.value = form.dataset.revisar ? form.dataset.revisao : 0;   // ata nova é R00; revisão é a próxima da ata editada
  const nome = nomePadrao({ obra, setor, data, tipo, revisao: form.revisao.value });
  const el = document.getElementById('ata-nome'); if (el) el.textContent = nome ? `${nome}.pdf` : 'escolha a data';
  const dest = document.getElementById('ata-destino');
  if (dest) dest.textContent = obra ? (/^Po/i.test(obra) ? 'Vai para a pasta do pós-obra: PÓS OBRA › PO_OBRAS › ano › obra › GERENCIAMENTO › ATA.' : 'Vai para a pasta da obra: OPERACOES › OBRAS › obra › GERENCIAMENTO › ATA.') : 'Sem obra: a ata fica só no sistema.';
  return nome;
}

export async function criarAta({ titulo, data, tipo, obra, setor, participantes, resumo, pendencias, informativos = [], tipoReuniao, revisao, local, horario }) {
  // informativo = texto + quem informou (Sólida, terceirizado ou cliente)
  informativos = informativos.map((p) => ({ n: p.item || null, texto: p.descricao, quem: p.responsavel ? nomeDe(p.responsavel) : (p.externoNome || p.externoCategoria || (p.externoTipo === 'cliente' ? 'Cliente' : p.externoTipo === 'arquitetura' ? 'Arquitetura' : '')), tipo: p.responsavel ? 'solida' : (p.externoTipo || 'terceirizado'), categoria: p.responsavel ? null : (p.externoCategoria || null) }));
  const ata = { informativos, titulo, data, tipo, obra: obra || null, setor: setor || null, participantes, resumo, tipo_reuniao: tipoReuniao || 'REUNIÃO', revisao: Number(revisao) || 0, local: local || null, horario: horario || null };
  const pends = pendencias.map((p) => ({ item: p.item || null, descricao: p.descricao, responsavel: p.responsavel || null, responsavel_nome: p.responsavel ? nomeDe(p.responsavel) : (p.externoNome || p.externoCategoria || (p.externoTipo === 'cliente' ? 'Cliente' : p.externoTipo === 'arquitetura' ? 'Arquitetura' : null)), responsavel_tipo: p.responsavel ? 'solida' : (p.externoTipo || 'terceirizado'), responsavel_categoria: p.responsavel ? null : (p.externoCategoria || null), prazo: p.prazo || null, status: 'aberta' }));
  let nova;
  if (NA_NUVEM) nova = await criarAtaNuvem(ata, pends);
  else {
    const l = lerLocal(); const id = l.seq++;
    nova = { id, ...ata, criado_por: idPessoa(), criado_por_nome: sessao().nome, criado_em: new Date().toISOString() };
    l.atas.push(nova);
    for (const p of pends) l.pendencias.push({ id: l.seq++, ata_id: id, ...p, obra: ata.obra, setor: ata.setor, criado_por: idPessoa(), criado_em: new Date().toISOString(), concluida_em: null });
    gravarLocal(l);
  }
  rascunho = null;
  await carregar();
  return nova;
}
export async function criarPendencia({ ata_id, descricao, responsavel, externoNome, externoTipo, externoCategoria, prazo, obra, setor }) {
  const p = { ata_id: ata_id || null, descricao, responsavel: responsavel || null, responsavel_nome: responsavel ? nomeDe(responsavel) : (externoNome || externoCategoria || (externoTipo === 'cliente' ? 'Cliente' : externoTipo === 'arquitetura' ? 'Arquitetura' : null)), responsavel_tipo: responsavel ? 'solida' : (externoTipo || 'terceirizado'), responsavel_categoria: responsavel ? null : (externoCategoria || null), prazo: prazo || null, status: 'aberta', obra: obra || null, setor: setor || null };
  if (ata_id) { const a = dados.atas.find((x) => String(x.id) === String(ata_id)); const ns = [...dados.pendencias.filter((x) => String(x.ata_id) === String(ata_id)).map((x) => Number(x.item) || 0), ...((a && a.informativos) || []).map((x) => (x && x.n) || 0)]; p.item = Math.max(0, ...ns) + 1; }
  if (NA_NUVEM) await criarPendenciaNuvem(p);
  else { const l = lerLocal(); l.pendencias.push({ id: l.seq++, ...p, criado_por: idPessoa(), criado_em: new Date().toISOString(), concluida_em: null }); gravarLocal(l); }
  await carregar();
}
export async function mudarStatus(id, status) {
  const mud = { status, concluida_em: status === 'feita' ? new Date().toISOString() : null };
  if (NA_NUVEM) await atualizarPendenciaNuvem(id, mud);
  else { const l = lerLocal(); const p = l.pendencias.find((x) => String(x.id) === String(id)); if (p) Object.assign(p, mud); gravarLocal(l); }
  await carregar();
}
// "Excluir" na lista de pendências NÃO mexe na ata: se a pendência veio de uma ata, só sai da lista (continua no item da ata);
// só a pendência avulsa (sem ata) é apagada de verdade. Para tirar um item da ata, é pela revisão da ata.
export async function apagarPendencia(id) {
  const p = pendenciaPorId(id);
  if (p && p.ata_id) await mudarNaLista(id, false);
  else {
    if (NA_NUVEM) await apagarPendenciaNuvem(id);
    else { const l = lerLocal(); l.pendencias = l.pendencias.filter((x) => String(x.id) !== String(id)); gravarLocal(l); }
    await carregar();
  }
}
export async function mudarNaLista(id, valor) {
  if (NA_NUVEM) await atualizarPendenciaNuvem(id, { na_lista: valor });
  else { const l = lerLocal(); const p = l.pendencias.find((x) => String(x.id) === String(id)); if (p) p.na_lista = valor; gravarLocal(l); }
  await carregar();
}
export async function apagarAta(id) {
  if (NA_NUVEM) await apagarAtaNuvem(id);
  else { const l = lerLocal(); l.atas = l.atas.filter((x) => String(x.id) !== String(id)); l.pendencias = l.pendencias.filter((x) => String(x.ata_id) !== String(id)); gravarLocal(l); }
  await carregar();
}

// quantas pendências abertas são minhas (para a bolinha do menu)
export function minhasAbertas() {
  const eu = souEu();
  return dados.pendencias.filter((p) => naLista(p) && p.status === 'aberta' && p.responsavel && p.responsavel === eu).length;
}

// ---------------------------------------------------------------- apoio
const dm = (iso) => (iso ? fmtData(iso) : '');
const textoRico = (t) => html.seguro(String(t || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`).replace(/\n/g, '<br>'));
const ataDe = (p) => dados.atas.find((a) => a.id === p.ata_id);
const onde = (x) => x.obra || x.setor || '';

// em que coluna do quadro a pendência cai
function coluna(p, hoje) {
  if (p.status === 'feita') return 'concluido';
  if (!p.prazo) return 'sem';
  if (p.prazo < hoje) return 'vencido';
  if (p.prazo === hoje) return 'hoje';
  const fimSemana = somarDias(inicioDaSemana(hoje), 6);
  if (p.prazo <= fimSemana) return 'semana';
  if (p.prazo <= somarDias(fimSemana, 7)) return 'proxima';
  return 'duas';
}
const COLUNAS = [
  ['vencido', 'Vencido'], ['hoje', 'Vencimento hoje'], ['semana', 'Vencimento esta semana'], ['proxima', 'Vencimento na próxima semana'],
  ['sem', 'Sem prazo'], ['duas', 'Vencimento em duas semanas ou mais'], ['concluido', 'Concluído'],
];

// padrão da Sólida: o assunto vem primeiro, em negrito, e depois da vírgula o que é ("ACM, Retirar da área gourmet")
// a descrição é guardada como Assunto, o que fazer; no formulário são duas caixinhas
export const dividirDescricao = (t) => { const s = String(t || ''); const i = s.indexOf(','); return i > 0 && i < 60 ? [s.slice(0, i).trim().toLocaleUpperCase('pt-BR'), s.slice(i + 1).trim()] : ['', s]; };
const descRica = (t) => { const s = String(t || ''); const i = s.indexOf(','); return i > 0 && i < 60 ? html`<b>${s.slice(0, i).toLocaleUpperCase('pt-BR')}</b>${s.slice(i)}` : s; };
const opcoesPessoas = (sel = '') => dados.pessoas.map((p) => html`<option value="${p.id}" ${p.id === sel ? html.seguro('selected') : ''}>${p.nome}</option>`);

export const CATEGORIAS_TERC = ['Arquitetura', 'Ar-condicionado', 'Automação', 'ACM / fachada', 'Elétrica', 'Hidráulica', 'Iluminação', 'Esquadrias / vidros', 'Gesso / forro', 'Impermeabilização', 'Marcenaria', 'Marmoraria / pedras', 'Paisagismo', 'Pintura', 'Piscina', 'Revestimentos', 'Serralheria', 'Limpeza', 'Outro'];
const ROTULO_TIPO = { terceirizado: 'Terceirizado', cliente: 'Cliente', arquitetura: 'Arquitetura', outro: 'Externo' };
let sugestoesNomes = [];   // nomes de terceirizados já conhecidos (programações e pendências anteriores) para completar o campo
export const definirSugestoes = (lista) => { sugestoesNomes = lista; };
const nomesConhecidos = () => [...new Set([...sugestoesNomes, ...dados.pendencias.filter((p) => p.responsavel_tipo && p.responsavel_tipo !== 'solida' && p.responsavel_nome).map((p) => p.responsavel_nome)])].sort((x, y) => x.localeCompare(y, 'pt-BR'));

// Uma linha de pendência, tudo em uma linha: pendência · quem (Sólida, Terceirizado ou Cliente) · detalhe · prazo
// Sólida → escolhe a pessoa. Terceirizado → nome da empresa ou pessoa.
// Cliente → nome (opcional).
export function linhaForm(v = {}) {
  const tipo = v.responsavel ? 'solida' : (v.externoTipo === 'cliente' ? 'cliente' : (v.externoTipo === 'arquitetura' || v.externoCategoria === 'Arquitetura') ? 'arquitetura' : (v.externoTipo === 'terceirizado' || v.externoTipo === 'outro') ? 'terceirizado' : 'solida');
  const categoria = v.externoCategoria || (v.externoTipo === 'arquitetura' ? 'Arquitetura' : '');
  const nome = tipo === 'solida' ? '' : (v.externoNome || categoria || '');
  const falta = !!v.descricao && tipo === 'solida' && !v.responsavel;
  const dica = v.responsavelAmbiguo ? `Há mais de um ${v.responsavelAmbiguo}: escolha quem` : v.externoNome && v.externoTipo === 'solida' ? `${v.externoNome} não tem login no sistema: escolha outra pessoa` : 'Escolha o responsável';
  const info = v.kind === 'informativo';
  const [ass, resto] = dividirDescricao(v.descricao);
  return String(html`<div class="pf-linha" data-tipo="${tipo}" data-kind="${info ? 'informativo' : 'pendencia'}" data-pid="${v.pid || ''}"><select name="p_kind" data-pf-kind ${v.semKind ? html.seguro('hidden') : ''} title="Pendência vai para as pendências das pessoas; informativo só fica registrado na ata"><option value="pendencia" ${info ? '' : html.seguro('selected')}>Pendência</option><option value="informativo" ${info ? html.seguro('selected') : ''}>Informativo</option></select><input name="p_assunto" class="pf-assunto" placeholder="Assunto (ex.: ACM)" autocomplete="off" value="${ass}" title="Assunto: aparece em negrito"><input name="p_desc" placeholder="${info ? 'Informação (ex.: Fachada liberada)' : 'O que fazer (ex.: Retirar da área gourmet)'}" autocomplete="off" value="${resto}" title="${resto}">
    <select name="p_tipo" data-pf-tipo title="Quem é o responsável"><option value="solida" ${tipo === 'solida' ? html.seguro('selected') : ''}>Sólida</option><option value="terceirizado" ${tipo === 'terceirizado' ? html.seguro('selected') : ''}>Terceirizado</option><option value="cliente" ${tipo === 'cliente' ? html.seguro('selected') : ''}>Cliente</option><option value="arquitetura" ${tipo === 'arquitetura' ? html.seguro('selected') : ''}>Arquitetura</option></select>
    <select name="p_resp" class="pf-sol ${falta ? 'pf-falta' : ''}" title="${falta ? dica : ''}" ${tipo === 'solida' ? '' : html.seguro('hidden')}><option value="">Pessoa da Sólida…</option>${opcoesPessoas(v.responsavel || '')}</select>
    <input name="p_nome" class="pf-ext" list="dl-terceiros" placeholder="${tipo === 'cliente' ? 'Nome do cliente' : tipo === 'arquitetura' ? 'Nome da arquitetura ou arquiteto' : 'Nome da empresa ou pessoa'}" autocomplete="off" value="${nome}" ${tipo === 'solida' ? html.seguro('hidden') : ''}>
    <input type="date" name="p_prazo" title="Prazo" value="${v.prazo || ''}"><button type="button" class="pf-x" data-pf-del title="Tirar esta linha">×</button></div>`);
}
export const datalistTerceiros = () => html`<datalist id="dl-terceiros">${nomesConhecidos().map((n) => html`<option value="${n}">`)}</datalist>`;
function filtrar(params) {
  const q = (params.get('q') || '').trim().toLocaleLowerCase('pt-BR');
  const pessoa = params.get('pessoa') || ''; const setor = params.get('setor') || ''; const obra = params.get('obra') || '';
  const eu = souEu();
  return dados.pendencias.filter((p) => {
    if (p.status === 'cancelada' || !naLista(p)) return false;
    if (pessoa.startsWith('cat:')) { if (p.responsavel_categoria !== pessoa.slice(4)) return false; }
    else if (pessoa.startsWith('tipo:')) { if ((p.responsavel_tipo || 'solida') !== pessoa.slice(5)) return false; }
    else if (pessoa === 'eu' ? p.responsavel !== eu : pessoa && p.responsavel !== pessoa) return false;
    const terc = params.get('terc') || '';
    if (terc && (p.responsavel || (terc.startsWith('cat:') ? p.responsavel_categoria !== terc.slice(4) : p.responsavel_nome !== terc.slice(5)))) return false;
    if (setor && p.setor !== setor) return false;
    if (obra && p.obra !== obra) return false;
    if (q && !`${p.descricao} ${nomeDe(p.responsavel, p.responsavel_nome)} ${onde(p)} ${(ataDe(p) || {}).titulo || ''}`.toLocaleLowerCase('pt-BR').includes(q)) return false;
    return true;
  });
}

// só aparecem nos filtros as pessoas e os terceirizados que realmente têm pendência (senão a lista fica enorme)
const pessoasComPendencia = () => { const ids = new Set(dados.pendencias.filter((p) => naLista(p) && p.status !== 'cancelada' && p.responsavel).map((p) => p.responsavel)); return dados.pessoas.filter((p) => ids.has(p.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')); };
// o campo "Terceirizado" aparece depois de escolher "Terceirizados (todos)" em Responsável: só nomes de empresa ou pessoa
// (sem tipo de serviço, para a lista não ficar enorme)
function seletorTerceirizado(atual) {
  const terc = dados.pendencias.filter((p) => naLista(p) && p.status !== 'cancelada' && !p.responsavel && p.responsavel_tipo !== 'cliente' && p.responsavel_tipo !== 'arquitetura');
  const nomes = [...new Set([...nomesConhecidos(), ...terc.map((p) => p.responsavel_nome)].filter((n) => n && !CATEGORIAS_TERC.includes(n)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return html`<label class="at-terc-sel">Terceirizado<select data-atas-filtro="terc"><option value="">Todos os terceirizados</option>
    ${nomes.map((n) => html`<option value="nome:${n}" ${atual === `nome:${n}` ? html.seguro('selected') : ''}>${n}</option>`)}</select></label>`;
}
// ---------------------------------------------------------------- telas
function barraFiltros(params, obras, aba) {
  const sel = (nome, rotulo, opcoes, atual) => html`<label>${rotulo}<select data-atas-filtro="${nome}"><option value="">Todos</option>${opcoes.map(([v, t]) => html`<option value="${v}" ${atual === v ? html.seguro('selected') : ''}>${t}</option>`)}</select></label>`;
  const vista = params.get('vista') === 'lista' ? 'lista' : 'prazo';
  return html`<div class="at-filtros">
    ${aba === 'atas' ? '' : html`<div class="subnav" role="tablist"><a role="tab" class="${vista === 'prazo' ? 'on' : ''}" href="#/atas?vista=prazo">Prazo</a><a role="tab" class="${vista === 'lista' ? 'on' : ''}" href="#/atas?vista=lista">Lista</a></div>`}
    ${aba === 'atas' ? '' : sel('pessoa', 'Responsável', [['eu', 'Só as minhas'], ['tipo:solida', 'Equipe da Sólida'], ['tipo:terceirizado', 'Terceirizados (todos)'], ['tipo:cliente', 'Clientes'], ['tipo:arquitetura', 'Arquitetura'], ...pessoasComPendencia().map((p) => [p.id, p.nome])], params.get('pessoa') || '')}
    ${aba !== 'atas' && params.get('pessoa') === 'tipo:terceirizado' ? seletorTerceirizado(params.get('terc') || '') : ''}
    ${sel('setor', 'Setor', SETORES_ATA.map((s) => [s, s]), params.get('setor') || '')}
    ${sel('obra', 'Obra', obras.map((o) => [o, o]), params.get('obra') || '')}
    <label>Procurar<input type="search" data-atas-filtro="q" value="${params.get('q') || ''}" placeholder="texto…"></label>
  </div>`;
}

// reprogramar: o prazo pode mudar, mas fica guardado o prazo original e cada troca (a pendência vira "reprogramada")
const reprogramada = (p) => !!p.prazo_original && p.prazo_original !== p.prazo;
const tituloRepro = (p) => `Prazo original ${dm(p.prazo_original)}${(p.reprogramacoes || []).length ? ` · ${(p.reprogramacoes || []).length} ${(p.reprogramacoes || []).length === 1 ? 'reprogramação' : 'reprogramações'}: ${(p.reprogramacoes || []).map((r) => `${dm(r.de)} → ${dm(r.para)}${r.por ? ` (${r.por})` : ''}`).join('; ')}` : ''}`;
// clicar na data abre o mini calendário (com feriados) para reprogramar; só nas pendências abertas
const prazoBtn = (p, conteudo, cls = '') => (p.status === 'feita' ? html`<span class="${cls}">${conteudo}</span>` : html`<button type="button" class="at-data-btn ${cls}" data-cal-prazo="${p.id}" title="Clique para reprogramar (escolher outra data)">${conteudo}</button>`);
const naLista = (p) => p.na_lista !== false;   // false = tirada da lista de pendências (continua só na ata)
export const pendenciaPorId = (id) => dados.pendencias.find((x) => String(x.id) === String(id));
export async function reprogramar(id, novo) {
  const p = dados.pendencias.find((x) => String(x.id) === String(id)); if (!p || !novo || novo === p.prazo) return;
  const mud = { prazo: novo, prazo_original: p.prazo_original || p.prazo || null, reprogramacoes: [...(p.reprogramacoes || []), { de: p.prazo || null, para: novo, em: new Date().toISOString(), por: sessao().nome || '' }] };
  if (!p.prazo) { mud.prazo_original = null; mud.reprogramacoes = p.reprogramacoes || []; }   // primeira data dada a uma pendência sem prazo não é reprogramação
  if (NA_NUVEM) await atualizarPendenciaNuvem(id, mud);
  else { const l = lerLocal(); const q = l.pendencias.find((x) => String(x.id) === String(id)); if (q) Object.assign(q, mud); gravarLocal(l); }
  await carregar();
}

function cartao(p, hoje) {
  const a = ataDe(p); const col = coluna(p, hoje);
  const dias = p.prazo ? diasEntre(hoje, p.prazo) : null;
  const rotuloPrazo = !p.prazo ? 'Sem prazo' : col === 'vencido' ? `${dm(p.prazo)} · ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'} de atraso` : col === 'hoje' ? 'Hoje' : dm(p.prazo);
  return html`<article class="at-card at-${col}">
    <div class="at-tit">${descRica(p.descricao)}</div>
    <div class="at-meta">${prazoBtn(p, rotuloPrazo, `at-prazo at-p-${col}`)}${reprogramada(p) ? html`<span class="at-repro-tag" title="${tituloRepro(p)}">↻ Reprogramada (era ${dm(p.prazo_original).slice(0, 5)})</span>` : ''}${onde(p) ? html`<span class="at-chip">${onde(p)}</span>` : ''}</div>
    <div class="at-quem"><span class="at-pessoa">${nomeDe(p.responsavel, p.responsavel_nome)}</span>${p.responsavel_tipo && p.responsavel_tipo !== 'solida' ? html`<span class="at-tipo at-t-${p.responsavel_tipo}">${ROTULO_TIPO[p.responsavel_tipo] || 'Externo'}${p.responsavel_categoria ? ` · ${p.responsavel_categoria}` : ''}</span>` : ''}${a ? html`<a class="at-ata" href="#/atas?aba=atas&ata=${a.id}" title="Ata de origem">ata ${dm(a.data).slice(0, 5)}</a>` : ''}</div>
    <div class="at-acoes">
      ${p.status === 'feita' ? html`<button type="button" class="ac-mini" data-pend="${p.id}|aberta">↺ reabrir</button>` : html`<button type="button" class="ac-mini at-ok" data-pend="${p.id}|feita">✓ concluir</button>`}
      <button type="button" class="ac-mini" data-pend-del="${p.id}" title="${p.ata_id ? 'Tirar da lista de pendências (o item continua na ata)' : 'Excluir esta pendência'}">${p.ata_id ? 'tirar da lista' : 'excluir'}</button>
    </div></article>`;
}

// prazo sugerido ao criar uma pendência pela caixinha (pendência nem sempre vem de uma ata)
function prazoDaColuna(id, hoje) {
  const seg = inicioDaSemana(hoje);
  if (id === 'hoje') return hoje;
  if (id === 'semana') { const sex = somarDias(seg, 4); return sex >= hoje ? sex : somarDias(seg, 6); }
  if (id === 'proxima') return somarDias(seg, 11);
  if (id === 'duas') return somarDias(seg, 18);
  return '';
}
// formulário de pendência avulsa (sem ata): janela com rótulos e grade organizada
export function formAvulsa(obras, prazo) {
  return html`<form class="at-nova-pend at-avulsa" id="pend-form" data-avulsa="1">
    <h3>Nova pendência</h3>
    <p class="pequeno at-av-sub">Para o que não veio de uma ata. Tudo marcado em vermelho precisa ser preenchido.</p>
    <div class="at-av-grade">
      <label class="av-m">Obra<select name="av_obra"><option value="">Nenhuma</option>${obras.map((o) => html`<option value="${o}">${o}</option>`)}</select></label>
      <label class="av-m">Departamento<select name="av_setor" required><option value="">— escolher —</option>${SETORES_ATA.map((s) => html`<option value="${s}">${s}</option>`)}</select></label>
      <div class="pf-linha av-linha" data-tipo="solida" data-kind="pendencia">
        <label class="av-ass">Assunto<input name="p_assunto" class="pf-assunto" placeholder="ex.: ACM" autocomplete="off"></label>
        <label class="av-desc">O que fazer<input name="p_desc" placeholder="ex.: Retirar da área gourmet" autocomplete="off"></label>
        <label>Responsável<select name="p_tipo" data-pf-tipo><option value="solida">Sólida</option><option value="terceirizado">Terceirizado</option><option value="cliente">Cliente</option><option value="arquitetura">Arquitetura</option></select></label>
        <label class="av-quem">Nome da empresa ou pessoa
          <select name="p_resp" class="pf-sol"><option value="">Pessoa da Sólida…</option>${opcoesPessoas('')}</select>
          <input name="p_nome" class="pf-ext" list="dl-terceiros" placeholder="Nome da empresa ou pessoa" autocomplete="off" hidden></label>
        <label>Prazo<input type="date" name="p_prazo" value="${prazo || ''}"></label>
      </div>
    </div>
    <div class="at-av-botoes"><button type="button" class="botao" data-av-fechar>Cancelar</button><button type="submit" class="botao on">Criar pendência</button></div></form>`;
}
function vistaPrazo(lista, hoje) {
  return html`<div class="at-quadro">${COLUNAS.map(([id, nome]) => {
    let itens = lista.filter((p) => coluna(p, hoje) === id);
    if (id === 'concluido') itens = itens.sort((a, b) => String(b.concluida_em).localeCompare(String(a.concluida_em))).slice(0, 30);
    const pz = prazoDaColuna(id, hoje);
    return html`<section class="at-col at-c-${id}"><header><b>${nome}</b><span>${lista.filter((p) => coluna(p, hoje) === id).length}</span>${pz ? html`<button type="button" class="at-col-mais" data-av-nova="${pz}" title="Nova pendência com prazo ${dm(pz)}">+</button>` : ''}</header>
      <div class="at-itens">${itens.map((p) => cartao(p, hoje))}</div></section>`;
  })}</div>`;
}

function vistaLista(lista, hoje, params) {
  const st = params.get('status') || 'abertas';
  const itens = lista.filter((p) => (st === 'todas' ? true : st === 'feitas' ? p.status === 'feita' : p.status === 'aberta'));
  return html`<div class="at-lista-topo"><label>Mostrar<select data-atas-filtro="status"><option value="abertas" ${st === 'abertas' ? html.seguro('selected') : ''}>Abertas</option><option value="feitas" ${st === 'feitas' ? html.seguro('selected') : ''}>Concluídas</option><option value="todas" ${st === 'todas' ? html.seguro('selected') : ''}>Todas</option></select></label></div>
    <div class="tabela-rolagem"><table class="tab ordenavel at-tab"><thead><tr><th>Pendência</th><th>Responsável</th><th>Prazo</th><th>Obra / setor</th><th>Ata</th><th>Situação</th><th></th></tr></thead><tbody>
      ${itens.map((p) => { const col = coluna(p, hoje); const a = ataDe(p); return html`<tr><td>${descRica(p.descricao)}</td><td>${nomeDe(p.responsavel, p.responsavel_nome)}</td>
        <td class="${col === 'vencido' ? 'pendente' : ''}">${prazoBtn(p, p.prazo ? dm(p.prazo) : html`<span class="muted">sem prazo</span>`)}${reprogramada(p) ? html` <span class="at-repro-tag" title="${tituloRepro(p)}">↻ era ${dm(p.prazo_original).slice(0, 5)}</span>` : ''}</td><td>${onde(p)}</td>
        <td>${a ? html`<a class="link" href="#/atas?aba=atas&ata=${a.id}">${dm(a.data).slice(0, 5)}</a>` : ''}</td>
        <td>${p.status === 'feita' ? 'Concluída' : col === 'vencido' ? 'Atrasada' : 'Aberta'}</td>
        <td class="at-acoes">${p.status === 'feita' ? html`<button type="button" class="ac-mini" data-pend="${p.id}|aberta">↺</button>` : html`<button type="button" class="ac-mini at-ok" data-pend="${p.id}|feita">✓ concluir</button>`} <button type="button" class="ac-mini" data-pend-del="${p.id}" title="${p.ata_id ? 'Tirar da lista de pendências (o item continua na ata)' : 'Excluir esta pendência'}">${p.ata_id ? 'tirar da lista' : 'excluir'}</button></td></tr>`; })}
    </tbody></table></div>${itens.length ? '' : html`<p class="vazio">Nenhuma pendência com esses filtros.</p>`}`;
}

function listaAtas(params, obras) {
  const obra = params.get('obra') || ''; const setor = params.get('setor') || ''; const q = (params.get('q') || '').toLocaleLowerCase('pt-BR');
  const atas = dados.atas.filter((a) => (!obra || a.obra === obra) && (!setor || a.setor === setor) && (!q || `${a.titulo} ${a.resumo} ${onde(a)}`.toLocaleLowerCase('pt-BR').includes(q)));
  return html`${atas.length ? html`<div class="at-atas">${atas.map((a) => {
    const ps = dados.pendencias.filter((p) => p.ata_id === a.id && p.status !== 'cancelada'); const ab = ps.filter((p) => p.status === 'aberta').length;
    return html`<a class="at-ata-card" href="#/atas?aba=atas&ata=${a.id}"><b>${a.titulo}</b><span class="pequeno">${dm(a.data)} · ${onde(a) || 'sem vínculo'}${a.criado_por_nome ? ` · por ${a.criado_por_nome}` : ''}</span>
      <span class="at-contagem ${ab ? 'tem' : ''}">${ps.length ? `${ab} aberta${ab === 1 ? '' : 's'} de ${ps.length}` : 'sem pendências'}</span></a>`; })}</div>` : html`<p class="vazio">Nenhuma ata ainda. Crie a primeira em "Nova ata".</p>`}`;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dMes = (iso) => (iso ? `${iso.slice(8, 10)}/${MESES[Number(iso.slice(5, 7)) - 1]}` : '');
// participantes no padrão da Sólida: "Nome" em preto e "(papel)" em cinza
const participantesRico = (lista) => (lista && lista.length ? lista.map((t, i) => { const m = String(t).match(/^(.*?)\s*(\(.*\))\s*$/); return html`${i ? ', ' : ''}${m ? html`${m[1]} <span class="sd-papel">${m[2]}</span>` : t}`; }) : '—');
// itens da ata na ordem em que foram lançados (pendências e informativos misturados, como na ata da Sólida)
function linhasDaAta(a, ps) {
  const itens = [...ps.map((p, i) => ({ kind: 'pend', p, n: Number(p.item) || 0, i })), ...((a.informativos || []).map((x, i) => ({ kind: 'info', x, n: (x && x.n) || 0, i: 1000 + i })))];
  return itens.sort((x, y) => ((x.n || 1e6) - (y.n || 1e6)) || (x.i - y.i));
}
function detalheAta(id, hoje, obras) {
  const a = dados.atas.find((x) => String(x.id) === String(id));
  if (!a) return html`<p class="vazio">Ata não encontrada (ou você não tem acesso a ela). <a class="link" href="#/atas?aba=atas">Voltar às atas</a></p>`;
  const ps = dados.pendencias.filter((p) => p.ata_id === a.id && p.status !== 'cancelada');
  const podeApagar = funcaoReal().id === 'socio' || a.criado_por === souEu();
  return html`<p><a class="link" href="#/atas?aba=atas">← Todas as atas</a></p>
    <article class="at-ata-det">
      <h2>${a.titulo}</h2>
      <p class="pequeno at-drive ${a.arquivada_em ? 'ok' : a.arquivo_erro ? 'erro' : ''}">${a.arquivada_em ? html`✓ Salva no Drive (${new Date(a.arquivada_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}): ${a.arquivo || a.titulo + '.pdf'}` : a.arquivo_erro ? html`Não consegui salvar no Drive: ${a.arquivo_erro}. Vou tentar de novo no próximo ciclo.` : a.obra ? 'Aguardando ser salva no Drive (o computador do escritório salva a cada 10 minutos).' : 'Ata sem obra: fica só no sistema.'}${a.criado_por_nome ? ` Registrada por ${a.criado_por_nome}.` : ''}</p>
      ${(() => { const ac = acompanhamento(a); return ac.total ? html`<p class="at-acomp"><b>Acompanhamento:</b> ${ac.feitas} de ${ac.total} pendências concluídas${ac.atrasadas ? html` · <span class="pendente">${ac.atrasadas} ${ac.atrasadas === 1 ? 'atrasada' : 'atrasadas'}</span>` : ''}${ac.reprogramadas ? ` · ${ac.reprogramadas} ${ac.reprogramadas === 1 ? 'reprogramada' : 'reprogramadas'}` : ''}</p>` : ''; })()}
      ${a.resumo ? html`<div class="at-resumo">${textoRico(a.resumo)}</div>` : ''}
      <div class="sd-folha">
        <div class="sd-cab">
          <div class="sd-logo"></div>
          <div class="sd-tit">ATA DE REUNIÃO ${dm(a.data).replace(/\//g, '.')}</div><div class="sd-cod">${a.obra || a.setor || ''}</div><div class="sd-cod">R${String(Number(a.revisao) || 0).padStart(2, '0')}</div>
          <div class="sd-linha"><b>LOCAL:</b> ${a.local || '—'}${a.setor ? html` · <b>DEPARTAMENTO:</b> ${a.setor}` : ''}</div>
          <div class="sd-linha"><b>PARTICIPANTES:</b> ${participantesRico(a.participantes)}</div>
        </div>
        <div class="tabela-rolagem"><table class="sd-tab"><thead><tr><th>ITEM</th><th>TIPO</th><th></th><th>RESPONSÁVEL</th><th>DATA LIMITE</th><th class="sd-sem-pdf"></th></tr></thead><tbody>
          ${linhasDaAta(a, ps).map((r, k) => r.kind === 'info' ? html`<tr><td class="c">${k + 1}</td><td class="c sd-t-info">INFORMATIVO</td><td>${descRica(typeof r.x === 'string' ? r.x : r.x.texto)}</td><td class="c">${typeof r.x === 'string' || !r.x.quem ? '—' : html`${String(r.x.quem).toLocaleUpperCase('pt-BR')}${r.x.tipo && r.x.tipo !== 'solida' ? html`<small>${ROTULO_TIPO[r.x.tipo] || 'Externo'}${r.x.categoria ? ` · ${r.x.categoria}` : ''}</small>` : ''}`}</td><td class="c"></td><td class="sd-sem-pdf"></td></tr>`
            : html`<tr class="${r.p.status === 'feita' ? 'sd-feita' : ''}"><td class="c">${k + 1}</td><td class="c sd-t-pend">PENDÊNCIA</td><td>${descRica(r.p.descricao)}${naLista(r.p) ? '' : html` <span class="at-fora-lista" title="Tirada da lista de pendências; continua nesta ata">fora da lista</span>`}</td><td class="c">${String(nomeDe(r.p.responsavel, r.p.responsavel_nome)).toLocaleUpperCase('pt-BR')}${r.p.responsavel_tipo && r.p.responsavel_tipo !== 'solida' ? html`<small>${ROTULO_TIPO[r.p.responsavel_tipo] || 'Externo'}${r.p.responsavel_categoria ? ` · ${r.p.responsavel_categoria}` : ''}</small>` : ''}</td>
              <td class="c ${reprogramada(r.p) ? 'sd-repro' : ''}" ${reprogramada(r.p) ? html.seguro(`title="${tituloRepro(r.p).replace(/"/g, '')}"`) : ''}>${prazoBtn(r.p, r.p.prazo ? dMes(r.p.prazo) : '—')}${reprogramada(r.p) ? html`<small>↻ era ${dMes(r.p.prazo_original)}</small>` : ''}</td>
              <td class="sd-sem-pdf at-acoes">${r.p.status === 'feita' ? html`<button type="button" class="ac-mini" data-pend="${r.p.id}|aberta">↺</button>` : html`<button type="button" class="ac-mini at-ok" data-pend="${r.p.id}|feita" title="Concluir">✓</button>`}${naLista(r.p) ? '' : html`<button type="button" class="ac-mini" data-pend-lista="${r.p.id}" title="Voltar esta pendência para a lista de pendências">+ lista</button>`}</td></tr>`)}
        </tbody></table></div>
      </div>
      ${podeApagar ? html`<p style="margin-top:18px"><a class="botao on" href="#/atas?aba=nova&revisar=${a.id}">Criar revisão ${rev2((Number(a.revisao) || 0) + 1)}</a> <button type="button" class="botao" data-pauta="${a.id}">Pauta da próxima reunião</button> <button type="button" class="botao at-excluir" data-ata-del="${a.id}">Excluir esta ata e as pendências dela</button></p>` : ''}
    </article>`;
}

function formNova(obras, revisarId = '') {
  const hoje = hojeISO();
  const ataRev = revisarId ? ataPorId(revisarId) : null;
  if (revisarId && !ataRev) return html`<p class="vazio">Ata não encontrada. <a class="link" href="#/atas?aba=atas">Voltar às atas</a></p>`;
  const r = ataRev ? ataComoRascunho(ataRev) : rascunho;
  const proxRev = ataRev ? (Number(ataRev.revisao) || 0) + 1 : 0;
  const linhasIniciais = r && (r.pendencias.length || (r.informativosLista || []).length) ? [...r.pendencias, ...(r.informativosLista || [])].sort((x, y) => (Number(x.item) || 0) - (Number(y.item) || 0)).map((p) => linhaForm(p)).join('') : linhaForm();
  const importador = html`<details class="caixa at-importar" ${r ? '' : html.seguro('open')}><summary><span class="caixa-tit">Importar uma ata pronta</span><span class="pequeno">PDF ou texto: eu leio e já separo as pendências</span></summary>
    <div class="caixa-corpo">
      <p class="pequeno">Envie o PDF (ou um arquivo de texto) da ata, ou cole o texto abaixo. O sistema acha o título, a data, a obra, os participantes e as linhas que são ação (verbo no infinitivo, "responsável:", "prazo:", itens sob "Ações" ou "Pendências"), com responsável pelo primeiro nome e prazo. Depois você confere tudo e salva. PDF de foto ou digitalização não tem texto para ler: cole o texto.</p>
      <div class="at-imp-linha"><label class="botao">Escolher arquivo<input type="file" id="ata-arquivo" accept=".pdf,.txt,.md,.text,.csv,application/pdf,text/*" hidden></label><span class="pequeno at-imp-msg"></span></div>
      <label>…ou cole o texto da ata<textarea id="ata-colada" rows="5" placeholder="Cole aqui o texto da ata"></textarea></label>
      <p><button type="button" class="botao" data-ata-ler>Ler o texto colado</button></p>
    </div></details>`;
  return html`${ataRev ? html`<p><a class="link" href="#/atas?aba=atas&ata=${ataRev.id}">← Voltar à ata sem mudar nada</a></p><div class="aviso at-aviso-imp"><b>Criando a revisão ${rev2(proxRev)}</b> da ata ${ataRev.titulo}. Mexa no que precisar: dados da reunião, participantes, e acrescente, tire ou edite pendências e informativos. As pendências que você mantiver continuam as mesmas (com o andamento e as reprogramações); as que você tirar saem da lista de pendências. O PDF novo vai para o Drive com o nome ${rev2(proxRev)}; o anterior continua lá.</div>` : importador}
  ${r && !ataRev ? html`<p class="aviso at-aviso-imp">Ata lida${r.lidoDaTabela ? ' (padrão de ata da Sólida)' : ''}: encontrei <b>${r.pendencias.length}</b> ${r.pendencias.length === 1 ? 'pendência' : 'pendências'}${r.informativos ? `, mais ${r.informativos} informativo${r.informativos === 1 ? '' : 's'} que entraram como informativo (não viram pendência de ninguém)` : ''}${r.pendencias.some((p) => !p.responsavel && !p.externoNome) ? ', algumas sem responsável (em destaque)' : ''}. Confira, corrija o que precisar e salve. <button type="button" class="ac-mini" data-ata-descartar>descartar e começar do zero</button></p>` : ''}
  <form class="at-form" id="ata-form" ${ataRev ? html.seguro(`data-revisar="${ataRev.id}" data-revisao="${proxRev}"`) : ''}>
    <div class="at-form-grade">
      <label>Data<input type="date" name="data" value="${r ? r.data : hoje}" required></label>
      <label>Tipo da reunião<select name="tipo_reuniao">${TIPOS_REUNIAO.map((x) => html`<option ${(r && r.tipoReuniao ? r.tipoReuniao : 'REUNIÃO') === x ? html.seguro('selected') : ''}>${x}</option>`)}</select></label>
      <input name="revisao" type="hidden" value="${proxRev}">
      <label>Obra<select name="obra" required><option value="">— escolher —</option><option value="-" ${ataRev && !ataRev.obra ? html.seguro('selected') : ''}>Nenhuma</option>${(r && r.obra && !obras.includes(r.obra) ? [...obras, r.obra] : obras).map((o) => html`<option value="${o}" ${r && r.obra === o ? html.seguro('selected') : ''}>${o}</option>`)}</select></label>
      <label>Departamento<select name="setor" required><option value="">— escolher —</option>${SETORES_ATA.map((s) => html`<option value="${s}" ${r && r.setor === s ? html.seguro('selected') : ''}>${s}</option>`)}</select></label>
    </div>
    <p class="at-nome-linha">Nome da ata: <b id="ata-nome">escolha a data</b> <span class="pequeno" id="ata-destino"></span></p>
    <div class="at-form-grade2"><label>Local<input name="local" required autocomplete="off" placeholder="ex.: online, ou o endereço" value="${r && r.local ? r.local : ''}"></label></div>
    <label>Participantes <span class="pequeno">escreva os nomes separados por vírgula; pode pôr a empresa entre parênteses</span><input name="participantes" required autocomplete="off" placeholder="ex.: Marcos (Sólida), Fernanda (Arquitetura), Julio (Cliente)" value="${r ? r.participantes.join(', ') : ''}"></label>
    <textarea name="resumo" hidden>${r ? r.resumo : ''}</textarea>
    <h3>Pendências <span class="pequeno">o que precisa de ação: quem faz e até quando</span></h3>
    <div id="pend-linhas">${html.seguro(linhasIniciais)}</div>
    <p><button type="button" class="ac-mini" data-pf-add>+ outro item</button></p>
    <p style="margin-top:14px"><button type="submit" class="botao on">${ataRev ? `Salvar revisão ${rev2(proxRev)}` : 'Salvar ata'}</button> <span class="pequeno at-msg"></span></p>
  </form>`;
}
export function render({ params, obras = [], msg = '', sugestoes = [] }) {
  definirSugestoes(sugestoes);
  const hoje = hojeISO();
  const aba = ABAS.some(([id]) => id === params.get('aba')) ? params.get('aba') : 'pendencias';
  const abertas = dados.pendencias.filter((p) => naLista(p) && p.status === 'aberta');
  const atrasadas = abertas.filter((p) => p.prazo && p.prazo < hoje).length;
  const minhas = minhasAbertas();
  const topo = html`<div class="subnav at-abas" role="tablist">${ABAS.map(([id, nome]) => html`<a role="tab" class="${id === aba ? 'on' : ''}" href="#/atas${id === 'pendencias' ? '' : `?aba=${id}`}">${nome}${id === 'pendencias' ? html` <span class="est-n">${abertas.length}</span>` : id === 'atas' ? html` <span class="est-n">${dados.atas.length}</span>` : ''}</a>`)}</div>`;
  let corpo;
  if (aba === 'nova') corpo = formNova(obras, params.get('revisar') || '');
  else if (aba === 'atas') corpo = params.get('ata') ? detalheAta(params.get('ata'), hoje, obras) : html`${barraFiltros(params, obras, 'atas')}${listaAtas(params, obras)}`;
  else {
    const lista = filtrar(params);
    corpo = html`<div class="cards at-cards"><div class="card"><div class="card-valor">${abertas.length}</div><div class="card-rotulo">Pendências abertas</div></div>
      <div class="card"><div class="card-valor ${atrasadas ? 'tom-ruim' : ''}">${atrasadas}</div><div class="card-rotulo">Atrasadas</div></div>
      <div class="card"><div class="card-valor">${minhas}</div><div class="card-rotulo">Abertas comigo</div></div></div>
      ${barraFiltros(params, obras, 'pendencias')}
      ${params.get('vista') === 'lista' ? vistaLista(lista, hoje, params) : vistaPrazo(lista, hoje)}`;
  }
  return html`<div class="pagina atas">
    ${datalistTerceiros()}
    ${dados.erro ? html`<p class="erro">Não consegui carregar: ${dados.erro}</p>` : ''}
    ${msg ? html`<p class="msg ok">${msg}</p>` : ''}
    ${topo}<div style="margin-top:16px">${corpo}</div>
    ${NA_NUVEM ? '' : html`<p class="pequeno" style="margin-top:20px">Modo de teste (computador do escritório): as atas ficam só neste navegador. Na internet elas ficam no banco, compartilhadas.</p>`}
  </div>`;
}
