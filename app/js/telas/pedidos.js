// "Pedir alteração": botão em todas as telas, para todo mundo. O pedido vai para o servidor local
// (dados/pedidos.json). Pedido da diretoria já entra aprovado; o dos outros espera a diretoria aprovar
// (pedido de 15/10). O Claude faz só os aprovados e marca como feito, com uma resposta curta.
//
// status: aprovacao (aguardando a diretoria) → aberto (aprovado, aguardando o Claude) → fazendo → feito
//         ou recusado (pela diretoria ou pelo Claude)

import { html, data as fmtData } from '../formato.js';

const TEXTO_STATUS = {
  aprovacao: 'aguardando aprovação', aberto: 'aprovado, na fila', fazendo: 'em andamento', feito: 'feito', recusado: 'recusado',
};
export const pendenteAprovacao = (p) => p.status === 'aprovacao';
export const emAberto = (p) => !['feito', 'recusado'].includes(p.status);

export async function listar() {
  try {
    const r = await fetch('/api/pedidos', { cache: 'no-store' });
    const j = r.ok ? await r.json() : [];
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}

async function postar(url, corpo) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error(`O servidor respondeu ${r.status}.`);
  return r.json();
}
export const enviar = (pedido) => postar('/api/pedidos', pedido);
export const decidir = (id, status, pessoa) => postar('/api/pedidos/decidir', { id, status, pessoa });

const item = (p, { mostrarTela = false, decidir: podeDecidir = false } = {}) => html`<li class="pd-item pd-${p.status}">
  <span class="pd-status">${TEXTO_STATUS[p.status] || p.status}</span>
  <span class="pd-data">${fmtData(String(p.data).slice(0, 10)).slice(0, 5)}${p.pessoa ? ` · ${p.pessoa}` : ''}${mostrarTela ? ` · ${p.titulo || p.tela}` : ''}</span>
  <span class="pd-texto">${p.texto}</span>
  ${p.resposta ? html`<span class="pd-resposta">${p.resposta}</span>` : ''}
  ${podeDecidir ? html`<span class="pd-decidir">
    <button type="button" class="botao on" data-pedido-decidir="${p.id}|aberto">Aprovar</button>
    <button type="button" class="botao" data-pedido-decidir="${p.id}|recusado">Recusar</button></span>` : ''}
</li>`;

// Painel aberto: campo do pedido, pedidos desta tela e, para a diretoria, os que aguardam aprovação
export function painel({ tela, titulo, pedidos, msg = '', diretoria = false }) {
  const daTela = pedidos.filter((p) => p.tela === tela && !(diretoria && pendenteAprovacao(p))).reverse();
  const paraAprovar = diretoria ? pedidos.filter(pendenteAprovacao).reverse() : [];
  return html`<div class="pd-painel" role="dialog" aria-label="Pedir alteração">
    <div class="pd-cab"><b>Pedir alteração</b><span class="pequeno">nesta tela: ${titulo}</span><button type="button" class="pd-fechar" data-pedido="fechar" aria-label="Fechar">×</button></div>
    ${paraAprovar.length ? html`<div class="pd-aprovar"><p class="pd-sub">Aguardando sua aprovação (${paraAprovar.length})</p>
      <ul class="pd-lista">${paraAprovar.map((p) => item(p, { mostrarTela: true, decidir: true }))}</ul></div>` : ''}
    <form id="pd-form">
      <textarea name="texto" rows="4" placeholder="Escreva o que quer mudar aqui. Ex.: tirar a coluna X, juntar estas abas, mostrar o total por obra…" required></textarea>
      <div class="pd-acoes"><button type="submit" class="botao on">Enviar pedido</button><span class="pequeno pd-msg">${msg}</span></div>
      <p class="pequeno" style="margin:6px 0 0">${diretoria ? 'Pedido da diretoria já vai aprovado.' : 'O pedido vai para a aprovação da diretoria.'}</p>
    </form>
    ${daTela.length ? html`<p class="pd-sub">Pedidos desta tela</p><ul class="pd-lista">${daTela.slice(0, 8).map((p) => item(p))}</ul>` : ''}
  </div>`;
}

// Botão fechado: diretoria vê quantos aguardam aprovação; os outros, quantos pedidos seus estão em aberto
export function botao(n, diretoria) {
  return html`<button type="button" class="pd-botao" data-pedido="abrir" title="${diretoria && n ? `${n} pedido(s) aguardando sua aprovação` : 'Pedir uma alteração nesta tela'}">✎ Pedir alteração${n ? html` <span class="pd-n">${n}</span>` : ''}</button>`;
}

// Perfil da diretoria: as sugestões da equipe sobre o sistema (todos os pedidos de alteração)
export function secaoEquipe(lista) {
  const ps = lista.slice().reverse();
  const aguardando = ps.filter(pendenteAprovacao);
  const andamento = ps.filter((p) => ['aberto', 'fazendo'].includes(p.status));
  const fechados = ps.filter((p) => ['feito', 'recusado'].includes(p.status)).slice(0, 10);
  const grupo = (titulo, itens, opc) => (itens.length ? html`<p class="pd-sub">${titulo} (${itens.length})</p><ul class="pd-lista">${itens.map((p) => item(p, opc))}</ul>` : '');
  return html`<section class="secao"><h2>Sugestões da equipe sobre o sistema <span class="pequeno">pedidos de alteração</span></h2>
    ${ps.length ? html`<div class="pd-equipe">
      ${grupo('Aguardando sua aprovação', aguardando, { mostrarTela: true, decidir: true })}
      ${grupo('Aprovados, na fila ou em andamento', andamento, { mostrarTela: true })}
      ${grupo('Últimos resolvidos', fechados, { mostrarTela: true })}
    </div>` : html`<p class="vazio">Nenhuma sugestão ainda. Todo mundo pode sugerir pelo botão “✎ Pedir alteração”, em qualquer tela.</p>`}
  </section>`;
}