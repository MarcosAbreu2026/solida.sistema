// Controle de obras do PÓS-OBRA (visão geral): a lista do "Controle Operacional Pós-Obra" (planilha), montada com o que o sistema tem:
// os pós-obras (Cadastros), as OS do Quadro de OS e as pendências (tarefas) de cada OS.
// Estrutura (pedido do Felipe, 13/11/2026): em ordem de número do PO; cada PO é uma faixa e embaixo dela vêm as suas OS, uma linha por OS, com
// STATUS em coluna própria (Solicitação, Análise, Orçamento, Falta agendar…), relato, responsável e prazo (dá para definir ali mesmo); embaixo de cada OS,
// as pendências dela e "+ Nova pendência"; embaixo de cada PO, o campo "Nova OS". Tudo que é pós-obra é PO (nada de MO aqui).
import { html } from '../formato.js';
import { lista as osLista, STATUS } from '../os-quadro.js';
import { pessoasDaEquipe } from './atas.js';
import { feriados } from '../calendario.js';

const SITUACOES = ['Atrasado', 'Execução', 'Planejamento', 'Orçamento', 'Análise', 'Pausado', 'Sem OS', 'Concluído'];
const COR = { Atrasado: '#B3261E', Execução: '#2F5F86', Planejamento: '#C0692B', Orçamento: '#B58A1B', Análise: '#7B6AA8', Pausado: '#6E7782', 'Sem OS': '#8A94A0', Concluído: '#4F7D5C' };
const dBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : '');
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ehMo = (cod) => /^mo/i.test(String(cod || '').trim());
const stDe = (id) => STATUS.find((s) => s.id === id) || { nome: id, cor: '#6E7782' };

// "Po420", "Mo556 Estúdio Pindó", "Po Carol", "PO - Sogra do Thiago" → { codigo: 'PO420' | 'PO - Carol', nome: 'Estúdio Pindó', chave }
export function rotuloPO(txt) {
  const s = String(txt || '').trim();
  let m = /^(?:mo|po)\s*[-_]?\s*(\d+[a-z]?)\b\s*[-_·]?\s*(.*)$/i.exec(s);
  if (m) return { codigo: `PO${m[1].toUpperCase()}`, nome: m[2].trim(), chave: `po${m[1].toLowerCase()}` };
  m = /^(?:mo|po)\s*[-_]?\s*(.+)$/i.exec(s);
  const resto = (m ? m[1] : s).trim();
  return { codigo: `PO - ${resto}`, nome: '', chave: norm(`po - ${resto}`) };
}
// sábado, domingo ou feriado: aviso ao lado do prazo
const avisoDia = (iso) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return ''; const fer = feriados(Number(iso.slice(0, 4)))[iso]; const dow = new Date(`${iso}T12:00:00`).getDay(); const t = fer ? `Feriado: ${fer}` : dow === 0 ? 'Domingo' : dow === 6 ? 'Sábado' : ''; return t ? html`<span class="prazo-aviso">⚠ ${t}</span>` : ''; };
const numeroDe = (codigo) => { const m = /^PO(\d+)/.exec(codigo); return m ? Number(m[1]) : null; };

// uma faixa por pós-obra: cadastro + clientes das OS
export function montarGrupos({ obrasCad = [], pendencias = [], hoje = '' }) {
  const grupos = new Map();
  const pega = (txt) => { const r = rotuloPO(txt); if (!grupos.has(r.chave)) grupos.set(r.chave, { chave: r.chave, codigo: r.codigo, nome: r.nome, cad: null, os: [], soltas: [] }); const g = grupos.get(r.chave); if (!g.nome && r.nome) g.nome = r.nome; return g; };
  for (const c of obrasCad) {
    if (ehMo(c.codigo) || c.situacao === 'nao_fechado') continue;   // só pós-obras
    const g = pega(c.codigo); g.cad = c; if (c.nome) g.nome = c.nome;
  }
  for (const o of osLista) { if (o.cliente) pega(o.cliente).os.push(o); }
  const porCodigoOs = new Map(osLista.map((o) => [o.codigo, o]));
  for (const p of pendencias) {
    if (p.na_lista === false || p.status === 'cancelada') continue;
    const cod = p.os || (String(p.origem || '').startsWith('os:') ? String(p.origem).slice(3) : '');
    const os = cod ? porCodigoOs.get(cod) : null;
    if (os) { (os.__pend || (os.__pend = [])).push(p); continue; }
    if (p.obra && !ehMo(p.obra)) { const r = rotuloPO(p.obra); const g = grupos.get(r.chave); if (g && p.status === 'aberta') g.soltas.push(p); }
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
    return { ...g, abertas, situacao };
  });
}

const ordemDePO = (a, b) => { const na = numeroDe(a.codigo); const nb = numeroDe(b.codigo); if (na != null && nb != null) return na - nb || a.codigo.localeCompare(b.codigo); if (na != null) return -1; if (nb != null) return 1; return a.codigo.localeCompare(b.codigo, 'pt-BR'); };

export function render({ params, obrasCad = [], pendencias = [], hoje = '', podeEditar = false }) {
  for (const o of osLista) delete o.__pend;
  const todos = montarGrupos({ obrasCad, pendencias, hoje });
  const sit = params.get('sit') || ''; const q = norm(params.get('q'));
  const texto = (g) => norm(`${g.codigo} ${g.nome} ${g.os.map((o) => `${o.codigo} ${o.assunto} ${o.problema || ''} ${o.responsavel_nome || ''}`).join(' ')}`);
  const visiveis = todos.filter((g) => (sit === 'todas' ? true : sit ? g.situacao === sit : g.situacao !== 'Concluído')).filter((g) => !q || texto(g).includes(q)).sort(ordemDePO);
  const conta = (s) => todos.filter((g) => g.situacao === s).length;
  const cartoes = SITUACOES.map((s) => html`<a class="pc-card" href="#/posobra/controle?sit=${encodeURIComponent(s)}" style="border-top-color:${COR[s]}"><b>${conta(s)}</b><span>${s}</span></a>`);
  const pessoas = [...pessoasDaEquipe()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  // a OS não tem responsável nem prazo: ela mostra o problema e a solução; quem faz e quando são das pendências dela
  const linhaOS = (o) => html`<tr class="pc-os">
    <td class="pc-cod"><a href="#" data-osq="${o.id}" title="Abrir a OS">${o.codigo}</a></td>
    <td><span class="pc-sit" style="background:${stDe(o.status).cor}">${stDe(o.status).nome}</span></td>
    <td class="pc-relato"><b>${o.assunto || ''}</b>${o.problema ? html`<div class="pc-prob"><span>Problema:</span> ${o.problema}</div>` : ''}${o.solucao ? html`<div class="pc-prob"><span>Solução:</span> ${o.solucao}</div>` : ''}</td>
    <td></td><td></td>
    <td>${podeEditar ? html`<button type="button" class="ac-mini" data-os-pend="${o.codigo}" data-os-obra="${o.__po}" data-os-fase="${o.status}" title="Nova pendência desta OS na fase ${stDe(o.status).nome}">+ pendência</button>` : ''}</td></tr>`;
  const quemPend = (p) => (podeEditar
    ? html`<select class="pc-resp ${p.responsavel ? '' : 'pc-sem'}" data-pc-presp="${p.id}" title="Definir o responsável desta pendência"><option value="">[definir]</option>${pessoas.map((x) => html`<option value="${x.id}" ${x.id === p.responsavel ? html.seguro('selected') : ''}>${x.nome}</option>`)}${p.responsavel_nome && !p.responsavel ? html`<option value="" selected hidden>${p.responsavel_nome}</option>` : ''}</select>`
    : (p.responsavel_nome || html`<span class="pc-sem-txt">[definir]</span>`));
  const prazoPend = (p) => (podeEditar && p.status === 'aberta'
    ? html`<input type="date" class="pc-prazo ${p.prazo && p.prazo < hoje ? 'pc-venc' : ''}" data-pc-pprazo="${p.id}" value="${p.prazo || ''}">${avisoDia(p.prazo)}`
    : (p.prazo ? html`<span class="${p.status === 'aberta' && p.prazo < hoje ? 'pc-venc' : ''}">${dBR(p.prazo)}</span>` : html`<span class="muted">—</span>`));
  const linhaPend = (p) => html`<tr class="pc-pend" data-tarefa="${p.id}" title="Clique no texto para abrir a pendência (anotações, prioridade, observadores)">
    <td></td><td><span class="pc-pst ${p.status === 'feita' ? 'ok' : ''}">${(stDe(p.os_fase).nome && p.os_fase) ? stDe(p.os_fase).nome : 'pendência'}${p.status === 'feita' ? ' · feita' : ''}</span></td>
    <td class="pc-relato">${p.descricao}</td>
    <td>${quemPend(p)}</td><td>${prazoPend(p)}</td><td></td></tr>`;
  const faixa = (g) => {
    const abertas = [...g.os].filter((o) => o.status !== 'concluido').sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
    const concl = [...g.os].filter((o) => o.status === 'concluido').sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }));
    g.os.forEach((o) => { o.__po = g.codigo; });
    return html`<tbody class="pc-po-grupo">
      <tr class="pc-po"><td colspan="6"><div class="pc-po-in"><b>${g.codigo}</b>${g.nome ? html` <span class="pc-nome">${g.nome}</span>` : ''}<span class="pc-sit" style="background:${COR[g.situacao]}">${g.situacao}</span><span class="pc-cont">${abertas.length} ${abertas.length === 1 ? 'OS aberta' : 'OS abertas'}${concl.length ? ` · ${concl.length} concluídas` : ''}</span>${podeEditar ? html`<button type="button" class="ac-mini pc-po-mais" data-pc-nova="${g.codigo}" title="Criar uma OS neste PO">+ OS</button>` : ''}</div></td></tr>
      ${abertas.length ? abertas.map((o) => html`${linhaOS(o)}${(o.__pend || []).filter((p) => p.status === 'aberta').map(linhaPend)}`) : html`<tr class="pc-os"><td></td><td colspan="5"><span class="muted">${g.os.length ? 'Todas as OS concluídas' : 'Nenhuma OS ainda'}</span></td></tr>`}
      ${g.soltas.map((p) => html`<tr class="pc-pend" data-tarefa="${p.id}"><td></td><td><span class="pc-pst">tarefa</span></td><td class="pc-relato">${p.descricao}</td><td>${p.responsavel_nome || html`<span class="pc-sem-txt">[definir]</span>`}</td><td>${p.prazo ? dBR(p.prazo) : ''}</td><td></td></tr>`)}
      ${concl.length ? html`<tr class="pc-conc"><td></td><td colspan="5"><details><summary>${concl.length} ${concl.length === 1 ? 'OS concluída' : 'OS concluídas'}</summary>${concl.map((o) => html`<div><a href="#" data-osq="${o.id}">${o.codigo}</a> · ${o.assunto || ''}</div>`)}</details></td></tr>` : ''}
    </tbody>`;
  };
  return html`<section class="pc">
    <p class="pequeno">Visão geral dos pós-obras no formato do Controle Operacional (planilha), em ordem de número do PO. Cada PO tem as suas OS (uma linha cada, com o status). A OS guarda o problema e a solução; quem faz o quê são as <b>pendências</b> dela, que surgem a partir da fase em que a OS está. ${podeEditar ? 'Use "+ OS" no PO para criar uma OS, "+ pendência" na OS e defina o responsável e o prazo direto na linha da pendência.' : ''}</p>
    <div class="pc-cards">${cartoes}</div>
    <div class="at-filtros">
      ${podeEditar ? html`<button type="button" class="botao on pc-novo-po" data-pc-novo-po title="Cadastrar um pós-obra novo (PO)">+ Novo PO</button>` : ''}
      <label>Situação<select data-atas-filtro="sit"><option value="">Em aberto (sem concluídos)</option><option value="todas" ${sit === 'todas' ? html.seguro('selected') : ''}>Todas</option>${SITUACOES.map((s) => html`<option value="${s}" ${sit === s ? html.seguro('selected') : ''}>${s}</option>`)}</select></label>
      <label>Procurar<input type="search" data-atas-filtro="q" value="${params.get('q') || ''}" placeholder="PO, cliente, OS, responsável…"></label>
    </div>
    <div class="pd-tab-caixa"><div class="tabela-rolagem"><table class="pd-tab pc-tab">
      <thead><tr><th>PO / OS</th><th>Status / fase</th><th>OS: problema e solução · pendências</th><th>Responsável</th><th>Prazo</th><th></th></tr></thead>
      ${visiveis.length ? visiveis.map(faixa) : html`<tbody><tr><td colspan="6"><p class="pd-vazio">Nenhum pós-obra com esse filtro.</p></td></tr></tbody>`}
    </table></div></div>
    <p class="pequeno">${visiveis.length} de ${todos.length} pós-obras · ${osLista.filter((o) => o.status !== 'concluido').length} OS abertas.</p>
  </section>`;
}
