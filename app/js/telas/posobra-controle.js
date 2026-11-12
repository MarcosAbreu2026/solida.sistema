// Controle de obras do PÓS-OBRA (visão geral): a mesma lista do "Controle Operacional Pós-Obra" (planilha R12), mas montada com o que o sistema tem:
// os pós-obras cadastrados (Cadastros) e as OS do Quadro de OS, mais as tarefas abertas de cada um.
// Uma linha por pós-obra · colunas: OS/Obra · Cliente · Situação · Data início · Relato da pendência · Responsável · Prazo · Obs.
// A situação sai das OS do pós-obra: Atrasado (alguma OS aberta com data limite vencida) · Execução · Planejamento (falta agendar/agendado) · Orçamento · Análise
// (solicitação/análise) · Concluído (todas as OS concluídas) · Pausado (cadastro pausado) · Sem OS.
import { html } from '../formato.js';
import { lista as osLista, STATUS } from '../os-quadro.js';
import { codigoDaObra } from './atas.js';

const SITUACOES = ['Atrasado', 'Execução', 'Planejamento', 'Orçamento', 'Análise', 'Pausado', 'Sem OS', 'Concluído'];
const COR = { Atrasado: '#B3261E', Execução: '#2F5F86', Planejamento: '#C0692B', Orçamento: '#B58A1B', Análise: '#7B6AA8', Pausado: '#6E7782', 'Sem OS': '#8A94A0', Concluído: '#4F7D5C' };
const dBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '');
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ehMo = (cod) => /^mo/i.test(String(cod || '').trim());

// monta uma linha por pós-obra (cadastro + clientes que aparecem nas OS)
export function montarLinhas({ obrasCad = [], pendencias = [], hoje = '' }) {
  const grupos = new Map();
  const pega = (chave, rotulo) => { if (!grupos.has(chave)) grupos.set(chave, { chave, rotulo, nome: '', cad: null, os: [], tarefas: [] }); return grupos.get(chave); };
  for (const c of obrasCad) {
    if (ehMo(c.codigo) || c.situacao === 'nao_fechado') continue;   // só pós-obras
    const g = pega(codigoDaObra(c.codigo), c.codigo); g.cad = c; g.nome = c.nome || '';
  }
  for (const o of osLista) { if (!o.cliente) continue; const g = pega(codigoDaObra(o.cliente), o.cliente); g.os.push(o); }
  for (const p of pendencias) {
    if (p.status !== 'aberta' || !p.obra || p.na_lista === false) continue;
    const g = grupos.get(codigoDaObra(p.obra)); if (g) g.tarefas.push(p);
  }
  return [...grupos.values()].map((g) => {
    const abertas = g.os.filter((o) => o.status !== 'concluido');
    const atrasada = abertas.some((o) => o.data_limite && o.data_limite < hoje);
    const tem = (...ids) => abertas.some((o) => ids.includes(o.status));
    let situacao;
    if (g.cad && g.cad.situacao === 'pausada') situacao = 'Pausado';
    else if (!g.os.length) situacao = g.cad && g.cad.situacao === 'finalizada' ? 'Concluído' : 'Sem OS';
    else if (!abertas.length) situacao = 'Concluído';
    else if (atrasada) situacao = 'Atrasado';
    else if (tem('execucao')) situacao = 'Execução';
    else if (tem('agendado', 'falta_agendar')) situacao = 'Planejamento';
    else if (tem('orcamento')) situacao = 'Orçamento';
    else situacao = 'Análise';
    const inicio = g.os.map((o) => o.d_solicitacao).filter(Boolean).sort()[0] || '';
    const prazos = abertas.map((o) => o.data_limite).filter(Boolean).sort();
    const resp = [...new Set([...abertas.map((o) => o.responsavel_nome), ...g.tarefas.map((p) => p.responsavel_nome)].filter(Boolean))];
    return { ...g, abertas, situacao, inicio, prazo: prazos[0] || '', resp };
  });
}

export function render({ params, obrasCad = [], pendencias = [], hoje = '' }) {
  const todas = montarLinhas({ obrasCad, pendencias, hoje });
  const sit = params.get('sit') || ''; const q = norm(params.get('q'));
  const emAberto = (l) => l.situacao !== 'Concluído';
  const visiveis = todas.filter((l) => (sit === 'todas' ? true : sit ? l.situacao === sit : emAberto(l)))
    .filter((l) => !q || norm(`${l.rotulo} ${l.nome} ${l.os.map((o) => `${o.codigo} ${o.assunto} ${o.problema || ''}`).join(' ')} ${l.resp.join(' ')}`).includes(q))
    .sort((a, b) => SITUACOES.indexOf(a.situacao) - SITUACOES.indexOf(b.situacao) || String(a.prazo || '9999').localeCompare(String(b.prazo || '9999')) || a.rotulo.localeCompare(b.rotulo, 'pt-BR', { numeric: true }));
  const conta = (s) => todas.filter((l) => l.situacao === s).length;
  const cartoes = SITUACOES.map((s) => html`<a class="pc-card" href="#/posobra/controle?sit=${encodeURIComponent(s)}" style="border-top-color:${COR[s]}"><b>${conta(s)}</b><span>${s}</span></a>`);
  const linha = (l) => html`<tr>
    <td class="pc-obra"><b>${l.rotulo}</b></td>
    <td>${l.nome || html`<span class="muted">—</span>`}</td>
    <td><span class="pc-sit" style="background:${COR[l.situacao]}">${l.situacao}</span></td>
    <td>${dBR(l.inicio) || html`<span class="muted">—</span>`}</td>
    <td class="pc-relato">${l.abertas.length ? l.abertas.map((o) => html`<div><a href="#" data-osq="${o.id}" title="Abrir a OS">${o.codigo}</a> <span class="pc-st" style="color:${(STATUS.find((s) => s.id === o.status) || {}).cor}">${(STATUS.find((s) => s.id === o.status) || {}).nome}</span> · ${o.assunto || String(o.problema || '').slice(0, 120)}</div>`) : html`<span class="muted">${l.os.length ? 'Todas as OS concluídas' : 'Nenhuma OS'}</span>`}</td>
    <td>${l.resp.length ? l.resp.join(', ') : html`<span class="muted">[definir]</span>`}</td>
    <td>${l.prazo ? html`<span class="${l.prazo < hoje ? 'pc-venc' : ''}">${dBR(l.prazo)}</span>` : html`<span class="muted">—</span>`}</td>
    <td class="pc-obs">${l.tarefas.length ? html`<b>${l.tarefas.length} ${l.tarefas.length === 1 ? 'tarefa aberta' : 'tarefas abertas'}</b>${l.tarefas.slice(0, 2).map((p) => html`<div>${p.descricao.length > 90 ? `${p.descricao.slice(0, 90)}…` : p.descricao}</div>`)}` : html`<span class="muted">—</span>`}</td></tr>`;
  return html`<section class="pc">
    <p class="pequeno">Visão geral dos pós-obras, no mesmo formato do Controle Operacional (planilha), montada com os pós-obras cadastrados e as OS do Quadro de OS. A situação sai das OS de cada pós-obra. Clique no código de uma OS para abrir.</p>
    <div class="pc-cards">${cartoes}</div>
    <div class="at-filtros">
      <label>Situação<select data-atas-filtro="sit"><option value="">Em aberto (sem concluídos)</option><option value="todas" ${sit === 'todas' ? html.seguro('selected') : ''}>Todas</option>${SITUACOES.map((s) => html`<option value="${s}" ${sit === s ? html.seguro('selected') : ''}>${s}</option>`)}</select></label>
      <label>Procurar<input type="search" data-atas-filtro="q" value="${params.get('q') || ''}" placeholder="pós-obra, cliente, OS, responsável…"></label>
    </div>
    <div class="pd-tab-caixa"><div class="tabela-rolagem"><table class="pd-tab pc-tab">
      <thead><tr><th>OS / Obra</th><th>Cliente</th><th>Situação</th><th>Data início</th><th>Relato da pendência</th><th>Responsável</th><th>Prazo</th><th>Obs. (tarefas abertas)</th></tr></thead>
      <tbody>${visiveis.length ? visiveis.map(linha) : html`<tr><td colspan="8"><p class="pd-vazio">Nenhum pós-obra com esse filtro.</p></td></tr>`}</tbody>
    </table></div></div>
    <p class="pequeno">${visiveis.length} de ${todas.length} pós-obras · ${osLista.filter((o) => o.status !== 'concluido').length} OS abertas.</p>
  </section>`;
}
