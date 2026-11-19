// Quadro de alocação das obras em andamento (pedido do Marcos, 19/11/2026), em Operações: igual à agenda semanal do pós-obra.
// À esquerda a lista de funcionários; no meio as obras em andamento × dias da semana. Arrasta o funcionário para a obra e o dia
// (semana atual, próximas e anteriores). Segunda visão: funcionários × semana (em que obra cada um está), com uma cor por função.
// Na nuvem: tabela alocacao_obras (supabase/33-alocacao-obras.sql); no computador do escritório (teste): neste navegador.
import { html } from './formato.js';
import { somarDias } from './datas.js';
import { NA_NUVEM, listarAlocacao, criarAlocacao, atualizarAlocacao, apagarAlocacao } from './nuvem.js';

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
  if (NA_NUVEM) await criarAlocacao({ data, obra, pessoa });
  else { const l = lerLocal(); l.linhas.push({ id: l.seq++, data, obra, pessoa }); gravarLocal(l); }
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
const legenda = () => html`<p class="al-legenda">${FUNCOES.map(([n, , c]) => html`<span><i style="background:${c}"></i>${n}</span>`)}<span><i style="background:#6B7280"></i>Outras funções</span></p>`;

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

export function render({ semanaIni, vista, podeEditar, obras = [], equipeProg = null, selecionado = '' }) {
  const dias = DIAS.map((_, i) => somarDias(semanaIni, i));
  const todos = gente(equipeProg);
  const funcaoDe = (nome) => (todos.find((g) => chaveNome(g.nome) === chaveNome(nome)) || {}).funcao || '';
  const nav = html`<div class="periodo ap-nav">
    <button type="button" class="botao" data-al-sem="${somarDias(semanaIni, -7)}">← Semana anterior</button>
    <div class="atual"><span>Semana</span><b>${dm(semanaIni)} a ${dm(somarDias(semanaIni, 5))}</b></div>
    <button type="button" class="botao" data-al-sem="hoje">Esta semana</button>
    <button type="button" class="botao" data-al-sem="${somarDias(semanaIni, 7)}">Próxima semana →</button>
    <span class="al-vistas"><button type="button" class="botao ${vista === 'func' ? '' : 'on'}" data-al-vista="obras">Obras × dias</button><button type="button" class="botao ${vista === 'func' ? 'on' : ''}" data-al-vista="func">Funcionários × semana</button></span>
  </div>`;
  const naSemana = (nome) => new Set(linhas.filter((l) => chaveNome(l.pessoa) === chaveNome(nome)).map((l) => l.data)).size;
  let corpo;
  if (vista === 'func') {
    const nomes = [...new Set([...todos.map((g) => g.nome), ...linhas.map((l) => l.pessoa)])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const celula = (nome, d) => {
      const ls = linhas.filter((l) => chaveNome(l.pessoa) === chaveNome(nome) && l.data === d);
      return html`<td class="al-fcel">${ls.map((l) => html`<span class="al-fchip" style="background:${corDaFuncao(funcaoDe(nome))}" title="${nome} · ${funcaoDe(nome) || 'função não informada'} · ${l.obra}">${l.obra}${ls.length > 1 ? html` <small>1/${ls.length}</small>` : ''}</span>`)}</td>`;
    };
    corpo = html`${legenda()}<div class="ap-grade tabela-rolagem"><table class="ap-tab al-ftab"><thead><tr><th>Funcionário</th>${dias.map((d, i) => html`<th>${DIAS[i]} <small>${dm(d)}</small></th>`)}<th>Dias</th></tr></thead>
      <tbody>${nomes.map((n) => html`<tr><th class="ap-obra"><span class="al-dot" style="background:${corDaFuncao(funcaoDe(n))}"></span>${n}<small>${funcaoDe(n) || ''}</small></th>${dias.map((d) => celula(n, d))}<td class="n">${naSemana(n)}</td></tr>`)}</tbody></table>
      ${nomes.length ? '' : html`<p class="vazio">Sem funcionários lidos do RH ainda.</p>`}</div>`;
  } else {
    const celula = (o, d) => {
      const daqui = linhas.filter((l) => l.obra === o && l.data === d);
      return html`<td class="al-cel" data-al-obra="${o}" data-al-data="${d}">${daqui.map((l) => {
        const n = linhas.filter((x) => x.data === d && chaveNome(x.pessoa) === chaveNome(l.pessoa)).length;
        return html`<span class="ap-chip al-chip ${n > 1 ? 'ap-div' : ''}" style="border-left:4px solid ${corDaFuncao(funcaoDe(l.pessoa))}" ${podeEditar ? html.seguro('draggable="true"') : ''} data-al-chip="${l.id}" title="${n > 1 ? `${l.pessoa} está em ${n} obras neste dia: a diária é dividida` : l.pessoa}">${l.pessoa}${n > 1 ? html` <small>1/${n}</small>` : ''}${podeEditar ? html`<button type="button" data-al-del="${l.id}" title="Tirar da obra">×</button>` : ''}</span>`;
      })}</td>`;
    };
    corpo = html`${legenda()}<div class="ap-corpo">
      ${podeEditar ? html`<aside class="ap-func"><h3>Funcionários</h3>
        ${todos.map((e) => html`<div class="ap-card al-card ${selecionado === e.nome ? 'sel' : ''}" style="border-left:4px solid ${corDaFuncao(e.funcao)}" draggable="true" data-al-pessoa="${e.nome}"><b>${e.nome}</b><small>${e.funcao || ''}</small><span class="ap-n">${naSemana(e.nome)} ${naSemana(e.nome) === 1 ? 'dia' : 'dias'}</span></div>`)}
        ${todos.length ? '' : html`<p class="pequeno">Sem funcionários lidos do RH ainda.</p>`}</aside>` : ''}
      <div class="ap-grade tabela-rolagem"><table class="ap-tab"><thead><tr><th>Obra em andamento</th>${dias.map((d, i) => html`<th>${DIAS[i]} <small>${dm(d)}</small></th>`)}</tr></thead>
        <tbody>${obras.map((o) => html`<tr><th class="ap-obra"><a href="#/obra/${encodeURIComponent(o)}">${o}</a></th>${dias.map((d) => celula(o, d))}</tr>`)}</tbody></table>
        ${obras.length ? '' : html`<p class="vazio">Nenhuma obra em andamento no cadastro.</p>`}</div></div>`;
  }
  return html`<section class="ap al">${nav}${erro ? html`<p class="erro">${erro}</p>` : ''}
    <p class="pequeno">${vista === 'func' ? 'Cada linha é um funcionário e cada cor é uma função. Quem está em mais de uma obra no dia divide a diária.' : podeEditar ? 'Arraste o funcionário (à esquerda) para a obra e o dia, ou toque no nome e depois no quadrado. Dá para arrastar o nome de um dia para outro e tirar no ×. Use as setas para ver e planejar outras semanas.' : 'Só a coordenação, o planejamento, o gestor de obra e a diretoria mexem na alocação; você vê quem vai para onde.'}</p>
    ${corpo}</section>`;
}
