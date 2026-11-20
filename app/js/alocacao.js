// Quadro de alocação das obras em andamento (pedido do Marcos, 19/11/2026), em Operações: igual à agenda semanal do pós-obra.
// À esquerda a lista de funcionários; no meio as obras em andamento × dias da semana. Arrasta o funcionário para a obra e o dia
// (semana atual, próximas e anteriores). Segunda visão: funcionários × semana (em que obra cada um está), com uma cor por função.
// Na nuvem: tabela alocacao_obras (supabase/33-alocacao-obras.sql); no computador do escritório (teste): neste navegador.
import { html } from './formato.js';
import { somarDias } from './datas.js';
import { feriado } from './feriados.js';
import { listaConfig } from './config.js';
import { NA_NUVEM, listarAlocacao, criarAlocacao, atualizarAlocacao, apagarAlocacao, listarAgendaPos } from './nuvem.js';

const CHAVE = 'solida.alocacaoObras';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || { linhas: [], seq: 1 }; } catch { return { linhas: [], seq: 1 }; } };
const gravarLocal = (v) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export let linhas = [];   // lançamentos da semana carregada: { id, data, obra, pessoa }
export let erro = '';
export async function carregar(de, ate) {
  try { linhas = NA_NUVEM ? await listarAlocacao(de, ate) : lerLocal().linhas.filter((x) => x.data >= de && x.data <= ate); erro = ''; }
  catch (e) { erro = String(e.message || e); }
  return linhas;
}
export async function atribuir({ data, obra, pessoa }, de, ate) {
  if (linhas.some((x) => x.data === data && x.obra === obra && x.pessoa === pessoa)) return;
  const jaNoDia = linhas.filter((x) => x.data === data && chaveNome(x.pessoa) === chaveNome(pessoa) && (x.periodo || 'dia') === 'dia');
  const periodo = jaNoDia.length ? 'tarde' : 'dia';
  for (const x of jaNoDia) await mudarPeriodoBase(x.id, 'manha');
  if (NA_NUVEM) await criarAlocacao({ data, obra, pessoa, periodo });
  else { const l = lerLocal(); l.linhas.push({ id: l.seq++, data, obra, pessoa, periodo }); gravarLocal(l); }
  await carregar(de, ate);
}
export async function mover(id, { data, obra }, de, ate) {
  const x = linhas.find((l) => String(l.id) === String(id)); if (!x) return;
  if (linhas.some((l) => l.data === data && l.obra === obra && l.pessoa === x.pessoa && String(l.id) !== String(id))) { await remover(id, de, ate); return; }
  if (NA_NUVEM) await atualizarAlocacao(id, { data, obra });
  else { const l = lerLocal(); const y = l.linhas.find((q) => String(q.id) === String(id)); if (y) { y.data = data; y.obra = obra; } gravarLocal(l); }
  await carregar(de, ate);
}
export async function remover(id, de, ate) {
  if (NA_NUVEM) await apagarAlocacao(id);
  else { const l = lerLocal(); l.linhas = l.linhas.filter((q) => String(q.id) !== String(id)); gravarLocal(l); }
  await carregar(de, ate);
}

// ---------------------------------------------------------------- cores por função (fase 2 do pedido, já pronta)
const FUNCOES = [
  ['Servente / ajudante', /servente|ajudante|auxiliar/, '#8A8F98'],
  ['Pedreiro', /pedreiro|oficial/, '#B5651D'],
  ['Eletricista', /eletric/, '#C9A227'],
  ['Bombeiro / encanador', /bombeiro|encanador|hidraul/, '#2F7DB5'],
  ['Ladrilheiro / azulejista', /ladrilh|azulej|revestid/, '#2E8B7A'],
  ['Pintor', /pintor|pintura/, '#8E5AB5'],
  ['Gesseiro', /gesso|gesseiro|forro/, '#C06C84'],
  ['Carpinteiro / marceneiro', /carpint|marcen|madeir/, '#7A5C3A'],
  ['Mestre / encarregado', /mestre|encarreg|gestor|engenh|estag/, '#3F4E9C'],
];
export const corDaFuncao = (f) => { const t = sem(f); const x = FUNCOES.find(([, re]) => re.test(t)); return x ? x[2] : '#6B7280'; };
export const nomeDaFuncao = (f) => { const t = sem(f); const x = FUNCOES.find(([, re]) => re.test(t)); return x ? x[0] : 'Outras funções'; };
const legenda = () => html`<p class="al-legenda">${FUNCOES.map(([n, , c]) => html`<span><i style="background:${c}"></i>${n}</span>`)}<span><i style="background:#6B7280"></i>Outras funções</span><span><i style="background:#111827"></i>Pós-obra (qualquer PO)</span></p>`;

// ---------------------------------------------------------------- telas
const chaveNome = (n) => sem(n).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
// lista de funcionários {nome, funcao}: a do RH (equipe programada); tira repetidos
function gente(equipeProg) {
  const vistos = new Map();
  for (const p of (equipeProg && equipeProg.pessoas) || []) {
    const nome = String(p.nome || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim(); if (nome.length < 3) continue;
    const k = chaveNome(nome); if (!vistos.has(k)) vistos.set(k, { nome, funcao: p.funcao || '' });
  }
  return [...vistos.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function render({ semanaIni, vista, podeEditar, obras = [], equipeProg = null, selecionado = '', posLinhas = [] }) {
  const dias = DIAS.map((_, i) => somarDias(semanaIni, i));
  const todos = gente(equipeProg);
  const funcaoDe = (nome) => (todos.find((g) => chaveNome(g.nome) === chaveNome(nome)) || {}).funcao || '';
  const nav = html`<div class="periodo ap-nav">
    <button type="button" class="botao" data-al-sem="${somarDias(semanaIni, -7)}">← Semana anterior</button>
    <div class="atual"><span>Semana</span><b>${dm(semanaIni)} a ${dm(somarDias(semanaIni, 5))}</b></div>
    <button type="button" class="botao" data-al-sem="hoje">Esta semana</button>
    <button type="button" class="botao" data-al-sem="${somarDias(semanaIni, 7)}">Próxima semana →</button>
    <span class="al-vistas"><button type="button" class="botao ${vista === 'func' ? '' : 'on'}" data-al-vista="obras">Obras × dias</button><button type="button" class="botao ${vista === 'func' ? 'on' : ''}" data-al-vista="func">Funcionários × semana</button><button type="button" class="botao" data-al-img title="Baixa uma imagem (PNG) desta visão, só com quem tem alocação, para colar no grupo do WhatsApp">📷 Salvar imagem</button><button type="button" class="botao" data-imprimir="" title="Imprimir esta visão">🖨 Imprimir</button></span>
  </div>`;
  const naSemana = (nome) => new Set(linhas.filter((l) => chaveNome(l.pessoa) === chaveNome(nome)).map((l) => l.data)).size;
  // pós-obra: quem está na agenda do pós-obra naquele dia aparece como "Pós-obra" (não importa em qual PO); casa o nome inteiro ou a primeira palavra
  const primeiro = (n) => chaveNome(n).split(/[\s-]+/)[0];
  const emPos = (nome, d) => (posLinhas || []).some((l) => l.data === d && (chaveNome(l.pessoa) === chaveNome(nome) || (primeiro(nome).length > 2 && primeiro(l.pessoa) === primeiro(nome))));
  const posPeriodo = (nome, d) => { const l = (posLinhas || []).find((x) => x.data === d && (chaveNome(x.pessoa) === chaveNome(nome) || (primeiro(nome).length > 2 && primeiro(x.pessoa) === primeiro(nome)))); return (l && l.periodo) || 'dia'; };
  const diasTotais =(nome) => new Set([...linhas.filter((l) => chaveNome(l.pessoa) === chaveNome(nome)).map((l) => l.data), ...dias.filter((d) => emPos(nome, d))]).size;
  // funcionários livres da OPERAÇÃO (quem acompanha é a Simone ou o gestor de obra): sem obra no dia e sem pós-obra. O pessoal do pós-obra tem a linha própria na agenda do pós-obra.
  const equipePosNomes = () => { const l = listaConfig('funcionarios.posobra'); return (l && l.length ? l : ['Nascimento', 'Cleviano', 'Carlos']).map(primeiro); };
  const ehDoPos = (n) => { const p = primeiro(n); return equipePosNomes().includes(p) && todos.filter((g) => primeiro(g.nome) === p).length <= 1; };   // dois "Carlos" no RH: não dá para saber qual é o do pós-obra, ficam na operação
  const livresOperacao = (d) => todos.filter((g) => !ehDoPos(g.nome) && !linhas.some((l) => l.data === d && chaveNome(l.pessoa) === chaveNome(g.nome)) && !emPos(g.nome, d));
  const rodapeLivres = () => html`<tfoot><tr class="ap-livres"><th class="ap-obra">Funcionários livres<small>operação · sem obra no dia</small></th>${dias.map((d, i) => {
    const fer = feriado(d); if (i === 5) return html`<td class="ap-livre-vazio">—</td>`;
    if (fer) return html`<td class="ap-feriado" title="${fer}">feriado<small>${fer}</small></td>`;
    const l = livresOperacao(d);
    return html`<td class="ap-livre-cel">${l.length ? l.map((g) => html`<span class="ap-livre al-livre" style="border-color:${corDaFuncao(g.funcao)}" title="${g.funcao || ''}">${g.nome}</span>`) : html`<span class="ap-todos">todos alocados</span>`}</td>`;
  })}</tr></tfoot>`;
  let corpo;
  if (vista === 'func') {
    const nomes = [...new Set([...todos.map((g) => g.nome), ...linhas.map((l) => l.pessoa)])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const celula = (nome, d) => {
      const ls = linhas.filter((l) => chaveNome(l.pessoa) === chaveNome(nome) && l.data === d);
      const pos = emPos(nome, d);
      return html`<td class="al-fcel">${ls.map((l) => html`<span class="al-fchip" style="background:${corDaFuncao(funcaoDe(nome))}" title="${nome} · ${funcaoDe(nome) || 'função não informada'} · ${l.obra}">${l.obra}${(l.periodo || 'dia') !== 'dia' ? html` <small>${PERIODO_ROT[l.periodo]}</small>` : ((ls.length + (pos ? 1 : 0)) > 1 ? html` <small>1/${ls.length + (pos ? 1 : 0)}</small>` : '')}</span>`)}${pos ? html`<span class="al-fchip al-pos" title="${nome} está no pós-obra neste dia (agenda do pós-obra)">Pós-obra${posPeriodo(nome, d) !== 'dia' ? html` <small>${PERIODO_ROT[posPeriodo(nome, d)]}</small>` : (ls.length ? html` <small>1/${ls.length + 1}</small>` : '')}</span>` : ''}</td>`;
    };
    corpo = html`${legenda()}<div class="ap-grade tabela-rolagem"><table class="ap-tab al-ftab"><thead><tr><th>Funcionário</th>${dias.map((d, i) => html`<th>${DIAS[i]} <small>${dm(d)}</small></th>`)}<th>Dias</th></tr></thead>
      <tbody>${nomes.map((n) => html`<tr class="${diasTotais(n) ? '' : 'al-vazia'}"><th class="ap-obra"><span class="al-dot" style="background:${corDaFuncao(funcaoDe(n))}"></span>${n}<small>${funcaoDe(n) || ''}</small></th>${dias.map((d) => celula(n, d))}<td class="n">${diasTotais(n)}</td></tr>`)}</tbody></table>
      ${nomes.length ? '' : html`<p class="vazio">Sem funcionários lidos do RH ainda.</p>`}</div>`;
  } else {
    const celula = (o, d) => {
      const daqui = linhas.filter((l) => l.obra === o && l.data === d);
      return html`<td class="al-cel" data-al-obra="${o}" data-al-data="${d}">${daqui.map((l) => {
        const n = linhas.filter((x) => x.data === d && chaveNome(x.pessoa) === chaveNome(l.pessoa)).length;
        return html`<span class="ap-chip al-chip ${n > 1 ? 'ap-div' : ''}" style="border-left:4px solid ${corDaFuncao(funcaoDe(l.pessoa))}" ${podeEditar ? html.seguro('draggable="true"') : ''} data-al-chip="${l.id}" title="${n > 1 ? `${l.pessoa} está em ${n} obras neste dia: escolha manhã ou tarde em cada uma` : l.pessoa}">${l.pessoa}${(l.periodo || 'dia') !== 'dia' || n > 1 ? (podeEditar ? html` <button type="button" class="ap-per ap-per-${l.periodo || 'dia'}" data-al-per="${l.id}" title="Clique para mudar: dia todo → manhã → tarde">${PERIODO_ROT[l.periodo || 'dia']}</button>` : html` <small>${PERIODO_ROT[l.periodo || 'dia']}</small>`) : ''}${podeEditar ? html`<button type="button" data-al-del="${l.id}" title="Tirar da obra">×</button>` : ''}</span>`;
      })}</td>`;
    };
    corpo = html`${legenda()}<div class="ap-corpo">
      ${podeEditar ? html`<aside class="ap-func"><h3>Funcionários</h3>
        ${todos.map((e) => html`<div class="ap-card al-card ${selecionado === e.nome ? 'sel' : ''}" style="border-left:4px solid ${corDaFuncao(e.funcao)}" draggable="true" data-al-pessoa="${e.nome}"><b>${e.nome}</b><small>${e.funcao || ''}</small><span class="ap-n">${naSemana(e.nome)} ${naSemana(e.nome) === 1 ? 'dia' : 'dias'}</span></div>`)}
        ${todos.length ? '' : html`<p class="pequeno">Sem funcionários lidos do RH ainda.</p>`}</aside>` : ''}
      <div class="ap-grade tabela-rolagem"><table class="ap-tab"><thead><tr><th>Obra em andamento</th>${dias.map((d, i) => html`<th>${DIAS[i]} <small>${dm(d)}</small></th>`)}</tr></thead>
        <tbody>${obras.map((o) => html`<tr><th class="ap-obra"><a href="#/obra/${encodeURIComponent(o)}">${o}</a></th>${dias.map((d) => celula(o, d))}</tr>`)}</tbody>${rodapeLivres()}</table>
        ${obras.length ? '' : html`<p class="vazio">Nenhuma obra em andamento no cadastro.</p>`}</div></div>`;
  }
  return html`<section class="ap al"><h2 class="al-imp-tit">${vista === 'func' ? 'Funcionários da semana' : 'Obras da semana'} · ${dm(semanaIni)} a ${dm(somarDias(semanaIni, 5))}</h2>${nav}${erro ? html`<p class="erro">${erro}</p>` : ''}
    <p class="pequeno">${vista === 'func' ? 'Cada linha é um funcionário e cada cor é uma função. Quem está em mais de uma obra no dia divide a diária.' : podeEditar ? 'Arraste o funcionário (à esquerda) para a obra e o dia, ou toque no nome e depois no quadrado. Dá para arrastar o nome de um dia para outro e tirar no ×. Use as setas para ver e planejar outras semanas.' : 'Só a coordenação, o planejamento, o gestor de obra e a diretoria mexem na alocação; você vê quem vai para onde.'}</p>
    ${corpo}</section>`;
}

// consulta de uma semana sem mexer no quadro carregado (usada pela obra e pelo dimensionamento)
export async function buscar(de, ate) {
  try { return NA_NUVEM ? await listarAlocacao(de, ate) : lerLocal().linhas.filter((x) => x.data >= de && x.data <= ate); } catch { return []; }
}

// bloco "Equipe alocada" da página da obra: quem o quadro de alocação (Operações) põe na obra em cada dia da semana
export function equipeDaObraHtml(obra, semanaIni, rows, podeVer = true) {
  if (!podeVer) return '';
  const dias = DIAS.map((_, i) => somarDias(semanaIni, i));
  const daObra = (rows || []).filter((l) => String(l.obra).toUpperCase() === String(obra).toUpperCase());
  const pessoas = [...new Set(daObra.map((l) => l.pessoa))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (!pessoas.length) return html`<p class="pd-vazio">Ninguém alocado nesta obra na semana de ${dm(semanaIni)}. A alocação é feita em Operações › Alocação das obras em andamento.</p>`;
  return html`<div class="pd-tab-caixa"><table class="pd-tab"><thead><tr><th>Funcionário</th>${dias.map((d, i) => html`<th>${DIAS[i]} <small>${dm(d)}</small></th>`)}<th>Dias</th></tr></thead>
    <tbody>${pessoas.map((n) => html`<tr><td class="pd-t1"><b>${n}</b></td>${dias.map((d) => html`<td>${daObra.some((l) => l.pessoa === n && l.data === d) ? '●' : ''}</td>`)}<td class="n">${new Set(daObra.filter((l) => l.pessoa === n).map((l) => l.data)).size}</td></tr>`)}</tbody></table></div>`;
}

// agenda do pós-obra da semana (quem está em qual PO em cada dia): só serve para marcar "Pós-obra" na visão funcionários × semana
export async function buscarPos(de, ate) {
  try {
    if (NA_NUVEM) return await listarAgendaPos(de, ate);
    const v = JSON.parse(localStorage.getItem('solida.agendaPos')) || { linhas: [] };
    return (v.linhas || []).filter((x) => x.data >= de && x.data <= ate);
  } catch { return []; }
}

// período do funcionário na obra: dia todo → manhã → tarde → dia todo
async function mudarPeriodoBase(id, periodo) {
  if (NA_NUVEM) await atualizarAlocacao(id, { periodo });
  else { const l = lerLocal(); const y = l.linhas.find((q) => String(q.id) === String(id)); if (y) y.periodo = periodo; gravarLocal(l); }
}
export async function trocarPeriodo(id, de, ate) {
  const x = linhas.find((l) => String(l.id) === String(id)); if (!x) return;
  await mudarPeriodoBase(id, { dia: 'manha', manha: 'tarde', tarde: 'dia' }[x.periodo || 'dia']); await carregar(de, ate);
}
export const PERIODO_ROT = { dia: 'dia todo', manha: 'manhã', tarde: 'tarde' };

// ---------------------------------------------------------------- imagem (PNG) para mandar no grupo de WhatsApp
// Desenha a visão escolhida (Obras × dias ou Funcionários × semana) só com quem tem alocação na semana, letra grande, uma cor por função.
export function imagemPNG({ semanaIni, vista, obras = [], equipeProg = null, posLinhas = [] }) {
  const dias = DIAS.map((_, i) => somarDias(semanaIni, i));
  const todos = gente(equipeProg);
  const funcaoDe = (nome) => (todos.find((g) => chaveNome(g.nome) === chaveNome(nome)) || {}).funcao || '';
  const primeiro = (n) => chaveNome(n).split(/[\s-]+/)[0];
  const posDe = (nome, d) => (posLinhas || []).find((l) => l.data === d && (chaveNome(l.pessoa) === chaveNome(nome) || (primeiro(nome).length > 2 && primeiro(l.pessoa) === primeiro(nome))));
  const PER = { manha: 'manhã', tarde: 'tarde' };
  // linhas da tabela: [{ titulo, sub, cor, celulas: [[{ txt, cor }]...6] }]
  let linhasTab;
  if (vista === 'func') {
    const nomes = [...new Set([...todos.map((g) => g.nome), ...linhas.map((l) => l.pessoa)])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    linhasTab = nomes.map((n) => ({
      titulo: n, sub: funcaoDe(n), cor: corDaFuncao(funcaoDe(n)),
      celulas: dias.map((d) => {
        const it = linhas.filter((l) => chaveNome(l.pessoa) === chaveNome(n) && l.data === d).map((l) => ({ txt: l.obra + ((l.periodo || 'dia') !== 'dia' ? ` (${PER[l.periodo]})` : ''), cor: corDaFuncao(funcaoDe(n)) }));
        const p = posDe(n, d); if (p) it.push({ txt: `Pós-obra${(p.periodo || 'dia') !== 'dia' ? ` (${PER[p.periodo]})` : ''}`, cor: '#111827' });
        return it;
      }),
    })).filter((r) => r.celulas.some((c) => c.length));
  } else {
    const nomesObras = [...new Set([...obras, ...linhas.map((l) => l.obra)])];
    linhasTab = nomesObras.map((o) => ({
      titulo: o, sub: '', cor: '#1F3A56',
      celulas: dias.map((d) => linhas.filter((l) => l.obra === o && l.data === d).map((l) => ({ txt: l.pessoa + ((l.periodo || 'dia') !== 'dia' ? ` (${PER[l.periodo]})` : ''), cor: corDaFuncao(funcaoDe(l.pessoa)) }))),
    })).filter((r) => r.celulas.some((c) => c.length));
  }
  const W = 1500; const colN = 300; const colD = (W - colN) / 6; const pad = 10; const linhaH = 30;
  const altLinha = (r) => Math.max(56, Math.max(...r.celulas.map((c) => c.length)) * linhaH + pad * 2);
  const topo = 110; const cab = 44; const rodape = 100;
  const H = topo + cab + linhasTab.reduce((s, r) => s + altLinha(r), 0) + rodape + (linhasTab.length ? 0 : 80);
  const esc = 2; const cv = document.createElement('canvas'); cv.width = W * esc; cv.height = H * esc;
  const g = cv.getContext('2d'); g.scale(esc, esc);
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#14283C'; g.font = 'bold 34px Arial'; g.fillText(vista === 'func' ? 'Funcionários da semana · onde cada um vai' : 'Obras da semana · quem vai em cada obra', 24, 48);
  g.fillStyle = '#4B5560'; g.font = '22px Arial'; g.fillText(`Semana de ${dm(semanaIni)} a ${dm(somarDias(semanaIni, 5))} · Construtora Sólida · Operações`, 24, 84);
  // cabeçalho
  let y = topo; g.fillStyle = '#1F3A56'; g.fillRect(24, y, W - 48, cab);
  g.fillStyle = '#fff'; g.font = 'bold 22px Arial';
  g.fillText(vista === 'func' ? 'Funcionário' : 'Obra', 36, y + 29);
  dias.forEach((d, i) => g.fillText(`${DIAS[i]} ${dm(d)}`, 24 + colN + i * colD + 14, y + 29));
  y += cab;
  const caber = (txt, larg) => { let t = txt; while (g.measureText(t).width > larg && t.length > 3) t = t.slice(0, -2); return t === txt ? t : `${t}…`; };
  linhasTab.forEach((r, ri) => {
    const h = altLinha(r);
    g.fillStyle = ri % 2 ? '#F3F5F8' : '#fff'; g.fillRect(24, y, W - 48, h);
    g.fillStyle = r.cor; g.fillRect(24, y, 8, h);
    g.fillStyle = '#0F1B27'; g.font = 'bold 22px Arial'; g.fillText(caber(r.titulo, colN - 30), 44, y + (r.sub ? 28 : h / 2 + 8));
    if (r.sub) { g.fillStyle = '#5B6677'; g.font = '16px Arial'; g.fillText(caber(r.sub, colN - 30), 44, y + 50); }
    r.celulas.forEach((c, i) => c.forEach((it, k) => {
      const x = 24 + colN + i * colD + 8; const yy = y + pad + k * linhaH; const lw = colD - 16;
      g.fillStyle = it.cor; g.beginPath(); if (g.roundRect) g.roundRect(x, yy, lw, linhaH - 4, 6); else g.rect(x, yy, lw, linhaH - 4); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 18px Arial'; g.fillText(caber(it.txt, lw - 16), x + 8, yy + 20);
    }));
    g.strokeStyle = '#D5DCE4'; g.lineWidth = 1; g.beginPath(); g.moveTo(24, y + h); g.lineTo(W - 24, y + h); g.stroke();
    y += h;
  });
  if (!linhasTab.length) { g.fillStyle = '#5B6677'; g.font = '22px Arial'; g.fillText('Ninguém alocado nesta semana ainda.', 36, y + 50); y += 80; }
  // legenda
  let lx = 24; g.font = '16px Arial';
  const leg = [...FUNCOES.map(([n, , c]) => [n, c]), ['Pós-obra', '#111827']];
  leg.forEach(([n, c]) => { const w = g.measureText(n).width + 34; if (lx + w > W - 24) { lx = 24; y += 26; } g.fillStyle = c; g.fillRect(lx, y + 26, 14, 14); g.fillStyle = '#333'; g.fillText(n, lx + 20, y + 38); lx += w + 10; });
  return cv.toDataURL('image/png');
}
