// Reuniões (pedido do Felipe, 17/11/2026): criadas e editadas AQUI; o sistema leva cada reunião para o Google Agenda do sistema (uma única conta, logada no computador do
// escritório), que convida as pessoas. Quem criou, as pessoas da Sólida convidadas e a diretoria podem editar. Nome automático: R_<obra ou pós-obra>_<título>
// (sem obra, R_<departamento>_<título>). Cada reunião guarda o resultado do envio ao Google Agenda (gcal_sync: pendente · ok · erro).
// Na nuvem: tabela reunioes (supabase/30-reunioes.sql); no computador de teste: neste navegador.
import { html } from './formato.js';
import { hojeISO, somarDias } from './datas.js';
import { NA_NUVEM, perfilAtual, listarReunioes, gravarReunioes, atualizarReuniao, sincronizarReunioesGoogle, pessoasSemEmailAgenda, adicionarEmailAgenda } from './nuvem.js';
import { idPessoa, funcaoReal } from './sessao.js';

const CHAVE = 'solida.reunioes';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch { return []; } };
const gravarLocal = (l) => { try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch { /* sem armazenamento */ } };
const eu = () => (NA_NUVEM ? (perfilAtual() || {}).id : idPessoa());
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export let lista = [];
export let erro = '';

export let semEmail = new Set();   // pessoas da Sólida ainda sem e-mail para convite (quem cria a reunião informa na hora)
export async function carregar() {
  try { lista = NA_NUVEM ? await listarReunioes() : lerLocal(); erro = ''; } catch (e) { erro = String(e.message || e); }
  await carregarSemEmail();
  return lista;
}
export async function carregarSemEmail() { if (NA_NUVEM) { try { semEmail = new Set(await pessoasSemEmailAgenda()); } catch { /* sem a lista desta vez */ } } return semEmail; }
// grava o e-mail informado no cadastro da pessoa (próxima reunião não pede de novo)
export async function guardarEmailsDasPessoas(lista) {
  for (const { id, email } of lista) { if (NA_NUVEM) await adicionarEmailAgenda(id, email); semEmail.delete(id); }
}
export const porId = (id) => lista.find((r) => String(r.id) === String(id));

// nome automático: R_ + obra (ou pós-obra; sem obra, o departamento) + _ + título
export const nomeDaReuniao = ({ obra, setor, titulo }) => `R_${String(obra || setor || '').trim()}_${String(titulo || '').trim()}`;

export const prefixoDaReuniao = ({ obra, setor }) => `R_${String(obra || setor || '…').trim()}_`;
// reuniões que entram nas telas de Tarefas e Agenda: as que a pessoa criou ou para as quais foi convidada ("Só as minhas");
// "Todos" mostra todas as que ela pode ver; escolhendo outra pessoa, as dela. Cancelada nunca aparece.
export function daPessoa(filtro = 'eu') {
  const me = eu();
  return lista.filter((r) => {
    if (r.cancelada) return false;
    if (filtro === 'todos' || String(filtro).startsWith('tipo:') || String(filtro).startsWith('cat:')) return true;
    const alvo = filtro === 'eu' || !filtro ? me : filtro;
    return r.criado_por === alvo || (r.convidados || []).includes(alvo);
  });
}
export const horaDe = (r) => `${r.ini}–${r.fim}`;
// cartão violeta para o quadro (Tarefas › Tabela) e para a faixa "dia todo" da Agenda
export const cartaoReuniao = (r, extra = '') => html`<article class="at-card rn-card ${extra}" data-reun-abrir="${r.id}" title="Reunião · ${r.nome} · ${horaDe(r)}${r.local ? ` · ${r.local}` : ''} — clique para abrir">
  <div class="rn-card-h"><span>🎥 ${horaDe(r)}</span><small>${dm(r.data)}</small></div><div class="rn-card-t">${r.nome}</div>${r.local ? html`<div class="rn-card-l">📍 ${r.local}</div>` : ''}</article>`;
export const podeEditar = (r) => !!r && (r.criado_por === eu() || (r.convidados || []).includes(eu()) || funcaoReal().id === 'socio');

// data da k-ésima repetição: semanal = +7 dias; mensal = mesmo dia do mês (nos meses curtos, o último dia)
function dataDaSerie(base, freq, k) {
  if (freq !== 'mensal') return somarDias(base, 7 * k);
  const [a, m, d] = base.split('-').map(Number); const t = (m - 1) + k; const ano = a + Math.floor(t / 12); const mes = ((t % 12) + 12) % 12;
  const ult = new Date(ano, mes + 1, 0).getDate();
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(Math.min(d, ult)).padStart(2, '0')}`;
}

export async function criar(c) {
  const n = c.recorrente ? 12 : 1;
  const serie = c.recorrente ? `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}` : null;
  const base = { nome: nomeDaReuniao(c), titulo: c.titulo.trim(), obra: c.obra || null, setor: c.setor || null, ini: c.ini, fim: c.fim, local: (c.local || '').trim() || null,
    convidados: c.convidados || [], emails_externos: c.emails || [], recorrente: !!c.recorrente, frequencia: c.recorrente ? (c.frequencia === 'mensal' ? 'mensal' : 'semanal') : null, serie, meet: c.meet !== false, gcal_sync: 'pendente' };
  const linhas = Array.from({ length: n }, (_, k) => ({ ...base, data: dataDaSerie(c.data, base.frequencia, k) }));
  let novas = [];
  if (NA_NUVEM) novas = await gravarReunioes(linhas);
  else { const l = lerLocal(); let seq = l.reduce((m, x) => Math.max(m, x.id), 0); for (const x of linhas) l.push({ id: ++seq, ...x, cancelada: false, criado_por: eu(), criado_em: new Date().toISOString(), gcal_event_id: null }); gravarLocal(l); }
  if (NA_NUVEM) { await sincronizarReunioesGoogle(novas.map((x) => x.id)); }
  await carregar();
}

async function atualizarVarias(ids, mud) {
  if (NA_NUVEM) { for (const i of ids) await atualizarReuniao(i, mud(i)); }
  else { const l = lerLocal(); for (const x of l) if (ids.some((i) => String(i) === String(x.id))) Object.assign(x, mud(x.id)); gravarLocal(l); }
}
// mudar uma reunião (ou ela e as próximas da série): marca como pendente para o Google Agenda refazer o evento
export async function salvar(id, c, escopo = 'uma') {
  const r = porId(id); if (!r) return;
  const alvo = escopo === 'seguintes' && r.serie ? lista.filter((x) => x.serie === r.serie && x.data >= r.data && !x.cancelada) : [r];
  const delta = c.data && c.data !== r.data ? Math.round((Date.parse(`${c.data}T12:00:00Z`) - Date.parse(`${r.data}T12:00:00Z`)) / 86400000) : 0;
  const agora = new Date().toISOString();
  await atualizarVarias(alvo.map((x) => x.id), (i) => {
    const x = lista.find((y) => String(y.id) === String(i));
    return { nome: nomeDaReuniao(c), titulo: c.titulo.trim(), obra: c.obra || null, setor: c.setor || null, ini: c.ini, fim: c.fim, local: (c.local || '').trim() || null,
      convidados: c.convidados || [], emails_externos: c.emails || [], meet: c.meet !== false, data: String(i) === String(id) ? c.data : (delta ? somarDias(x.data, delta) : x.data), gcal_sync: 'pendente', gcal_erro: null, atualizado_em: agora, atualizado_por: eu() };
  });
  if (NA_NUVEM) await sincronizarReunioesGoogle(alvo.map((x) => x.id));
  await carregar();
}
// "excluir" cancela: o Google Agenda precisa apagar o evento, então a linha fica marcada até o envio
export async function cancelar(id, escopo = 'uma') {
  const r = porId(id); if (!r) return;
  const alvo = escopo === 'seguintes' && r.serie ? lista.filter((x) => x.serie === r.serie && x.data >= r.data) : [r];
  await atualizarVarias(alvo.map((x) => x.id), () => ({ cancelada: true, gcal_sync: 'pendente', gcal_erro: null, atualizado_em: new Date().toISOString(), atualizado_por: eu() }));
  if (NA_NUVEM) await sincronizarReunioesGoogle(alvo.map((x) => x.id));
  await carregar();
}

// ---------------------------------------------------------------- telas
// convidados: pessoas da Sólida (lista) e e-mails de quem é de fora; os botões e chips são tratados pelo main.js (mesmos do campo Observadores)
export function caixaConvidados(pessoas, ids = [], emails = []) {
  const ch = (id) => (pessoas.find((x) => x.id === id) || {}).nome || id;
  return html`<div class="obs" data-obs="r_conv">
    <span class="obs-rot">Convidados <small>(pessoas da Sólida da lista, ou o e-mail de quem é de fora)</small></span>
    <div class="obs-chips">${ids.map((id) => html`<span class="obs-chip" data-obs-chip="${id}">${ch(id)}<button type="button" data-obs-del="${id}" title="Tirar">×</button><input type="hidden" name="r_conv" value="${id}"></span>`)}${emails.map((em) => html`<span class="obs-chip obs-ext" data-obs-chip="${em}">${em} <small>externo</small><button type="button" data-obs-del="${em}" title="Tirar">×</button><input type="hidden" name="r_conv_email" value="${em}"></span>`)}</div>
    <input type="search" class="obs-busca" placeholder="Procurar um nome da Sólida…" data-obs-busca autocomplete="off">
    <div class="obs-lista">${pessoas.map((x) => html`<button type="button" class="obs-item ${ids.includes(x.id) ? 'on' : ''}" data-obs-add="${x.id}" data-obs-nome="${x.nome}">${x.nome}</button>`)}</div>
    <div class="rn-email"><input type="email" placeholder="E-mail de quem não é da Sólida (cliente, arquiteto…)" data-conv-email autocomplete="off"><button type="button" class="botao" data-conv-email-add>Adicionar e-mail</button></div>
  </div>`;
}

const selo = (r) => (r.gcal_sync === 'ok' ? html`<span class="rn-sync rn-sync-ok" title="${r.gcal_erro || 'Já está no Google Agenda do sistema'}">no Google Agenda ✓${r.gcal_erro ? ' (faltou convidar alguém)' : ''}</span>`
  : r.gcal_sync === 'erro' ? html`<span class="rn-sync rn-sync-erro" title="${r.gcal_erro || 'Falhou'}">erro no Google Agenda</span>`
    : html`<span class="rn-sync rn-sync-pend" title="Aguardando a conta do Google do sistema ser conectada em Configurações › Automações (ou o envio em andamento)">indo para o Google Agenda…</span>`);

// painel "Reuniões" (na Agenda): as próximas reuniões que a pessoa criou ou para as quais foi convidada (a diretoria vê todas)
export function renderLista({ pessoas = [], hoje = hojeISO() } = {}) {
  const me = eu(); const dir = funcaoReal().id === 'socio';
  const itens = lista.filter((r) => !r.cancelada && r.data >= hoje && (dir || r.criado_por === me || (r.convidados || []).includes(me))).sort((a, b) => `${a.data}${a.ini}`.localeCompare(`${b.data}${b.ini}`)).slice(0, 15);
  const nome = (id) => (pessoas.find((x) => x.id === id) || {}).nome || '';
  return html`<section class="rn-lista"><h3>Reuniões <span class="pequeno">${itens.length ? `próximas ${itens.length}` : ''}</span></h3>
    ${erro ? html`<p class="erro">${erro}</p>` : ''}
    ${itens.length ? itens.map((r) => html`<button type="button" class="rn-item" data-reun-abrir="${r.id}" title="Clique para editar a reunião">
      <span class="rn-quando"><b>${dm(r.data)}</b> ${SEM[new Date(`${r.data}T12:00:00`).getDay()]}<small>${r.ini}–${r.fim}</small></span>
      <span class="rn-nome"><b>${r.nome}</b><small>${r.local ? `${r.local} · ` : ''}${(r.convidados || []).length + (r.emails_externos || []).length} convidados${(r.convidados || []).length ? ` (${(r.convidados || []).slice(0, 3).map(nome).filter(Boolean).join(', ')}${(r.convidados || []).length > 3 ? '…' : ''})` : ''}${r.serie ? ' · recorrente' : ''}</small></span>${r.meet_link ? html`<a class="rn-meet" href="${r.meet_link}" target="_blank" rel="noopener" title="Entrar na reunião (Google Meet)">🎥 Entrar</a>` : r.meet ? html`<span class="rn-meet rn-meet-pend" title="O link do Meet aparece assim que a reunião for ao Google Agenda">🎥 online</span>` : ''}${selo(r)}</button>`)
      : html`<p class="vazio">Nenhuma reunião marcada. Crie uma em Tarefas › Nova tarefa › Reunião.</p>`}
  </section>`;
}

// janela para editar uma reunião (mesmos campos da criação)
export function formEdicao(r, { gruposObras = '', setores = [], pessoas = [] } = {}) {
  const pode = podeEditar(r); const dis = pode ? '' : html.seguro('disabled');
  return html`<div class="tf tf-nova"><form id="reun-form" data-reun-form="${r.id}" class="tf-esq" autocomplete="off">
    <div class="tf-cab"><h3>Reunião</h3>${selo(r)}${r.serie ? html`<span class="at-chip">recorrente</span>` : ''}</div>
    <div class="tf-grade av-linha">
      <label>Obra ou pós-obra<select name="r_obra" class="tf-req" ${dis}><option value="">— sem obra (reunião de departamento) —</option>${gruposObras}</select></label>
      <label>Departamento<select name="r_setor" class="tf-req" ${dis}><option value="">— escolher (obrigatório sem obra) —</option>${setores.map((s) => html`<option ${s === r.setor ? html.seguro('selected') : ''}>${s}</option>`)}</select></label>
      <label class="tf-desc" style="grid-column:1/-1">Título<div class="rn-titulo-wrap"><span class="rn-prefixo" data-rn-prefixo>${prefixoDaReuniao(r)}</span><input name="r_titulo" class="rn-titulo" value="${r.titulo}" required ${dis}></div></label>
      <label>Data<input type="date" name="r_data" value="${r.data}" required ${dis}></label>
      <label>Início<input type="time" name="r_ini" value="${r.ini}" required ${dis}></label>
      <label>Fim <span class="rn-dica">(mínimo 1 hora)</span><input type="time" name="r_fim" value="${r.fim}" required ${dis}></label>
      <label>Local<input name="r_local" value="${r.local || ''}" required ${dis}></label>
      <label class="rn-meet-chk" style="grid-column:1/-1;flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="r_meet" ${r.meet ? html.seguro('checked') : ''} ${dis}> Reunião online (link do Google Meet)${r.meet_link ? html` · <a href="${r.meet_link}" target="_blank" rel="noopener">Entrar na reunião</a>` : ''}</label>
    </div>
    ${pode ? caixaConvidados(pessoas, r.convidados || [], r.emails_externos || []) : html`<p class="pequeno">Só quem criou a reunião, os convidados da Sólida e a diretoria podem editar.</p>`}
    <p class="pequeno">Edite sempre por aqui: o sistema atualiza o Google Agenda e avisa os convidados. Mudanças feitas direto no Google Agenda não voltam para cá.</p>
    <div class="tf-botoes"><button type="button" class="botao" data-av-fechar>Fechar</button>${pode ? html`<button type="button" class="botao esc-perigo" data-reun-cancelar="${r.id}">Cancelar reunião</button><button type="submit" class="botao on">Salvar</button>` : ''}</div>
  </form></div>`;
}
