// Férias dos funcionários (pedido do Marcos, 20/11/2026). O RH lança funcionário + início + fim (tabela `ferias`, supabase/40-ferias.sql;
// no computador do escritório sem nuvem: neste navegador). Quem está de férias não conta como livre, não é arrastado para obra e não recebe serviço.
import { html } from './formato.js';
import { NA_NUVEM, listarFerias, criarFerias, apagarFerias } from './nuvem.js';

const CHAVE = 'solida.ferias';
const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || { linhas: [], seq: 1 }; } catch { return { linhas: [], seq: 1 }; } };
const gravarLocal = (v) => { try { localStorage.setItem(CHAVE, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const chaveNome = (n) => sem(n).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
const dma = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export let lista = [];   // { id, funcionario, inicio, fim }
export let erro = '';
export async function carregar() {
  try { lista = NA_NUVEM ? await listarFerias() : lerLocal().linhas; erro = ''; } catch (e) { erro = String(e.message || e); }
  return lista;
}
// mesmo funcionário? nome inteiro igual, ou o primeiro nome igual quando um dos dois é só o primeiro nome (como o efetivo do WhatsApp escreve)
export function mesmaPessoa(a, b) {
  const x = chaveNome(a); const y = chaveNome(b); if (!x || !y) return false; if (x === y) return true;
  const px = x.split(/[\s-]+/); const py = y.split(/[\s-]+/);
  return (px.length === 1 || py.length === 1) && px[0].length > 2 && px[0] === py[0];
}
export const feriasDe = (nome, dia, base = lista) => base.find((f) => f.inicio <= dia && f.fim >= dia && mesmaPessoa(f.funcionario, nome)) || null;
export const emFerias = (nome, dia, base = lista) => !!feriasDe(nome, dia, base);
// férias que tocam o período [de, ate]
export const noPeriodo = (de, ate, base = lista) => base.filter((f) => f.inicio <= ate && f.fim >= de);

export async function lancar({ funcionario, inicio, fim }) {
  if (!funcionario || !inicio || !fim) throw new Error('Escolha o funcionário e as duas datas.');
  if (fim < inicio) throw new Error('A data final não pode ser antes da inicial.');
  if (NA_NUVEM) await criarFerias({ funcionario, inicio, fim });
  else { const l = lerLocal(); l.linhas.push({ id: l.seq++, funcionario, inicio, fim }); gravarLocal(l); }
  await carregar();
}
export async function apagar(id) {
  if (NA_NUVEM) await apagarFerias(id);
  else { const l = lerLocal(); l.linhas = l.linhas.filter((x) => String(x.id) !== String(id)); gravarLocal(l); }
  await carregar();
}

// tela do RH: formulário + lista (atuais e próximas primeiro; as que já acabaram há mais de 30 dias ficam de fora)
export function render({ podeEditar, equipeProg, hoje }) {
  const vistos = new Map();
  for (const p of (equipeProg && equipeProg.pessoas) || []) { const nome = String(p.nome || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim(); if (nome.length > 2 && !vistos.has(chaveNome(nome))) vistos.set(chaveNome(nome), nome); }
  const nomes = [...vistos.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const corte = new Date(new Date(`${hoje}T12:00:00`).getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const itens = lista.filter((f) => f.fim >= corte).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const situ = (f) => (f.fim < hoje ? 'já voltou' : f.inicio <= hoje ? 'de férias agora' : 'programadas');
  return html`<div class="fe">
    ${erro ? html`<p class="erro">${erro}</p>` : ''}
    ${podeEditar ? html`<div class="fe-form"><label>Funcionário <select id="fe-func"><option value="">Escolha…</option>${nomes.map((n) => html`<option value="${n}">${n}</option>`)}</select></label>
      <label>Início <input type="date" id="fe-ini"></label><label>Fim (último dia) <input type="date" id="fe-fim"></label>
      <button type="button" class="botao on" data-fe-add>Lançar férias</button></div>
      <p class="pequeno">A lista de funcionários é a do RH (equipe programada). Quem está de férias aparece marcado no quadro de alocação, não conta como livre e não recebe serviço na programação do dia.</p>`
      : html`<p class="pequeno">Só o RH e a diretoria lançam férias; você vê quem está de férias.</p>`}
    ${itens.length ? html`<div class="tabela-rolagem"><table class="pd-tab"><thead><tr><th>Funcionário</th><th>Início</th><th>Fim</th><th>Situação</th>${podeEditar ? html`<th></th>` : ''}</tr></thead>
      <tbody>${itens.map((f) => html`<tr><td class="pd-t1"><b>${f.funcionario}</b></td><td>${dma(f.inicio)}</td><td>${dma(f.fim)}</td><td>${situ(f)}</td>${podeEditar ? html`<td><button type="button" class="ac-mini" data-fe-del="${f.id}" title="Apagar este lançamento">apagar</button></td>` : ''}</tr>`)}</tbody></table></div>`
      : html`<p class="pd-vazio">Nenhuma férias lançada.</p>`}
  </div>`;
}
