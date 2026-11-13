// Feed: notícias e recados para todo mundo (pedido do Felipe, 15/10). Qualquer pessoa publica e comenta;
// a diretoria fixa no topo e apaga qualquer publicação; cada um apaga o que escreveu.
// Servidor: dados/feed.jsonl, uma linha por ação (publicar, comentar, curtir, fixar, apagar).

import { html } from '../formato.js';
import { avatar } from './perfil.js';
import { NA_NUVEM, eventosFeed, acaoFeed } from '../nuvem.js';

let eventos = [];
let jaLeu = false;   // o sino só compara depois da primeira leitura de verdade (senão tudo antigo viraria novidade)
export const feedLido = () => jaLeu;

export async function carregar() {
  if (NA_NUVEM) { try { eventos = await eventosFeed(); jaLeu = true; } catch { /* sem conexão */ } return eventos; }
  try { const r = await fetch('/api/feed', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); eventos = Array.isArray(j) ? j : []; jaLeu = true; } } catch { /* sem servidor */ }
  return eventos;
}

export async function enviar(acao) {
  if (NA_NUVEM) { await acaoFeed(acao); await carregar(); return; }
  const r = await fetch('/api/feed', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(acao) });
  if (!r.ok) throw new Error(await r.text());
  await carregar();
}

// publicações já montadas (comentários, curtidas, fixada, apagadas fora), fixadas primeiro, depois as mais novas
export function publicacoes() {
  const posts = new Map();
  for (const e of eventos) {
    if (e.acao === 'publicar') posts.set(e.id, { id: e.id, autor: e.autor, funcao: e.funcao, texto: e.texto, em: e.em, fixado: false, curtidas: new Set(), comentarios: [] });
    const p = posts.get(e.post);
    if (!p) continue;
    if (e.acao === 'comentar') p.comentarios.push({ id: e.id, autor: e.autor, texto: e.texto, em: e.em });
    if (e.acao === 'curtir') { if (e.valor) p.curtidas.add(e.autor); else p.curtidas.delete(e.autor); }
    if (e.acao === 'fixar') p.fixado = !!e.valor;
    if (e.acao === 'apagar') { if (e.texto && e.texto.startsWith('c:')) p.comentarios = p.comentarios.filter((c) => c.id !== e.texto.slice(2)); else posts.delete(e.post); }
  }
  return [...posts.values()].sort((a, b) => (b.fixado - a.fixado) || String(b.em).localeCompare(String(a.em)));
}

// quantas publicações novas desde a última visita ao feed (bolinha no menu)
export function novas(nome) {
  let visto = '';
  try { visto = localStorage.getItem('solida.feed.visto') || ''; } catch { /* nada */ }
  return publicacoes().filter((p) => Date.parse(p.em) > Date.parse(visto || 0) && p.autor !== nome).length;
}
// publicações e comentários de outras pessoas, do mais novo para o mais antigo (alimenta o sino do topo)
export function novidades(nome) {
  const itens = [];
  for (const p of publicacoes()) {
    itens.push({ id: `p${p.id}`, tipo: 'post', post: p.id, autor: p.autor, texto: p.texto, em: p.em });
    for (const c of p.comentarios) itens.push({ id: `c${c.id}`, tipo: 'comentario', post: p.id, autor: c.autor, texto: c.texto, em: c.em });
  }
  return itens.filter((i) => i.autor !== nome).sort((a, b) => Date.parse(b.em) - Date.parse(a.em));
}
export function marcarVisto() { try { localStorage.setItem('solida.feed.visto', new Date().toISOString()); } catch { /* nada */ } }

const quando = (iso) => {
  const d = new Date(iso); const agora = new Date();
  const min = Math.round((agora - d) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24 && d.getDate() === agora.getDate()) return `hoje às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ` às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};
// links e quebras de linha no texto (o resto continua escapado)
const textoRico = (t) => html.seguro(String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  .replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`).replace(/\n/g, '<br>'));

export function render({ eu, diretoria, msg = '' }) {
  const lista = publicacoes();
  return html`<div class="pagina feed">
    <form class="fd-novo" id="fd-form">
      ${avatar(eu.nome, 42)}
      <div class="fd-campo"><textarea name="texto" rows="3" placeholder="Escreva uma notícia ou um recado para todo mundo…" required></textarea>
        <div class="fd-acoes">${diretoria ? html`<label class="pequeno"><input type="checkbox" name="fixar"> fixar no topo</label>` : ''}
          <span class="pequeno fd-msg">${msg}</span><button type="submit" class="botao on">Publicar</button></div></div>
    </form>
    ${lista.length ? lista.map((p) => {
      const curti = p.curtidas.has(eu.nome);
      const podeApagar = diretoria || p.autor === eu.nome;
      return html`<article class="fd-post ${p.fixado ? 'fixado' : ''}">
        <header>${avatar(p.autor, 40)}<div><b>${p.autor}</b><span class="pequeno">${p.funcao ? `${p.funcao} · ` : ''}${quando(p.em)}</span></div>
          ${p.fixado ? html`<span class="fd-fixo">📌 fixado</span>` : ''}
          <span class="fd-menu">${diretoria ? html`<button type="button" class="link" data-feed="fixar|${p.id}|${p.fixado ? '0' : '1'}">${p.fixado ? 'desafixar' : 'fixar'}</button>` : ''}
            ${podeApagar ? html`<button type="button" class="link" data-feed="apagar|${p.id}|">apagar</button>` : ''}</span></header>
        <div class="fd-texto">${textoRico(p.texto)}</div>
        <div class="fd-rodape"><button type="button" class="fd-curtir ${curti ? 'on' : ''}" data-feed="curtir|${p.id}|${curti ? '0' : '1'}">👍 ${p.curtidas.size || ''}</button>
          <span class="pequeno">${p.comentarios.length ? `${p.comentarios.length} ${p.comentarios.length > 1 ? 'comentários' : 'comentário'}` : ''}</span></div>
        ${p.comentarios.length ? html`<ul class="fd-coments">${p.comentarios.map((c) => html`<li>${avatar(c.autor, 28)}<div><b>${c.autor}</b> <span class="pequeno">${quando(c.em)}</span>
          ${diretoria || c.autor === eu.nome ? html`<button type="button" class="link fd-x" data-feed="apagar|${p.id}|c:${c.id}" title="Apagar comentário">×</button>` : ''}<p>${textoRico(c.texto)}</p></div></li>`)}</ul>` : ''}
        <form class="fd-comentar" data-feed-comentar="${p.id}"><input name="texto" placeholder="Comentar…" autocomplete="off"><button type="submit" class="botao">Enviar</button></form>
      </article>`;
    }) : html`<p class="vazio">Nada publicado ainda. Escreva a primeira notícia ou recado para a equipe.</p>`}
  </div>`;
}
