// Notificações do topo: sino com a lista de novidades do feed (publicações e comentários dos outros)
// e um aviso rápido quando chega algo novo. Só lê o que o feed já carregou; quem busca é o main.js.

import { novidades, feedLido } from './telas/feed.js';

const CHAVE = 'solida.notif.visto';
const AVISO_MS = 9000;
let conhecidos = null;      // ids já vistos nesta sessão (a primeira leitura não dá aviso)
let irParaFeed = () => {};
let naoLidasAoAbrir = new Set();
let timerAviso = null;
let nomeAtual = '';

const $ = (s) => document.querySelector(s);
const lerVisto = () => { try { return localStorage.getItem(CHAVE) || ''; } catch { return ''; } };
const gravarVisto = () => { try { localStorage.setItem(CHAVE, new Date().toISOString()); } catch { /* nada */ } };
// o servidor local grava a hora com fuso (-03:00) e a nuvem em UTC: comparar sempre como data, nunca como texto
const depois = (a, b) => Date.parse(a) > Date.parse(b);
const resumo =(t, n = 90) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const quando = (iso) => {
  const d = new Date(iso); const min = Math.round((Date.now() - d) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.round(min / 60)} h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};
const frase = (i) => (i.tipo === 'post' ? `${i.autor} publicou no Feed` : `${i.autor} comentou no Feed`);

export function iniciar({ ir }) {
  irParaFeed = ir;
  const sino = $('#bNotif'); const painel = $('#notif-painel'); const aviso = $('#notif-aviso');
  if (!sino || !painel || !aviso) return;
  sino.addEventListener('click', (e) => {
    e.stopPropagation();
    if (painel.hidden) abrirPainel(); else painel.hidden = true;
  });
  document.addEventListener('click', (e) => { if (!painel.hidden && !e.target.closest('#notif-painel')) painel.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { painel.hidden = true; aviso.hidden = true; } });
  painel.addEventListener('click', (e) => { if (e.target.closest('[data-notif-feed]')) { painel.hidden = true; irParaFeed(); } });
  aviso.addEventListener('click', (e) => {
    if (e.target.closest('.na-x')) { aviso.hidden = true; return; }
    aviso.hidden = true; irParaFeed();
  });
}

// chamado depois de cada leitura do feed e a cada redesenho; nome = quem está logado (não avisa do que a própria pessoa fez)
export function atualizar(nome) {
  const sino = $('#bNotif'); if (!sino) return;
  nomeAtual = nome || '';
  if (!nome) { sino.hidden = true; return; }
  sino.hidden = false;
  if (!feedLido()) return;   // ainda não leu o feed: nada para comparar
  const itens = novidades(nome);
  const visto = lerVisto();
  const novos = conhecidos ? itens.filter((i) => !conhecidos.has(i.id)) : [];
  conhecidos = new Set(itens.map((i) => i.id));
  if (!visto) gravarVisto();   // primeiro acesso neste navegador: nada antigo vira "não lido"
  const naoLidas = itens.filter((i) => depois(i.em, lerVisto() || visto));
  const n = sino.querySelector('.nav-n');
  n.textContent = naoLidas.length > 99 ? '99+' : String(naoLidas.length);
  n.hidden = !naoLidas.length;
  sino.classList.toggle('tem', naoLidas.length > 0);
  sino.title = naoLidas.length ? `${naoLidas.length} novidade${naoLidas.length > 1 ? 's' : ''} no Feed` : 'Notificações';
  const painel = $('#notif-painel');
  if (painel && !painel.hidden) desenharPainel(itens);
  if (novos.length) mostrarAviso(novos);
}

function mostrarAviso(novos) {
  const aviso = $('#notif-aviso'); if (!aviso) return;
  const p = novos[0];
  aviso.replaceChildren();
  const corpo = document.createElement('div'); corpo.className = 'na-corpo';
  const t = document.createElement('b'); t.textContent = novos.length > 1 ? `${novos.length} novidades no Feed` : frase(p);
  const s = document.createElement('span'); s.textContent = novos.length > 1 ? `${frase(p)}: ${resumo(p.texto, 70)}` : resumo(p.texto);
  corpo.append(t, s);
  const x = document.createElement('button'); x.type = 'button'; x.className = 'na-x'; x.title = 'Fechar'; x.textContent = '×';
  aviso.append(corpo, x);
  aviso.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => { aviso.hidden = true; }, AVISO_MS);
}

function abrirPainel() {
  const itens = novidades(nomeAtual);
  const visto = lerVisto();
  naoLidasAoAbrir = new Set(itens.filter((i) => depois(i.em, visto)).map((i) => i.id));
  desenharPainel(itens);
  $('#notif-painel').hidden = false;
  gravarVisto();
  const n = $('#bNotif .nav-n'); if (n) { n.hidden = true; n.textContent = '0'; }
  $('#bNotif').classList.remove('tem');
}

function desenharPainel(itens) {
  const painel = $('#notif-painel');
  painel.replaceChildren();
  const cab = document.createElement('div'); cab.className = 'np-cab';
  const h = document.createElement('b'); h.textContent = 'Notificações';
  const ver = document.createElement('button'); ver.type = 'button'; ver.className = 'link'; ver.dataset.notifFeed = '1'; ver.textContent = 'Abrir o Feed';
  cab.append(h, ver); painel.append(cab);
  const lista = itens.slice(0, 12);
  if (!lista.length) { const v = document.createElement('p'); v.className = 'np-vazio'; v.textContent = 'Nenhuma novidade no Feed por enquanto.'; painel.append(v); return; }
  const ul = document.createElement('ul'); ul.className = 'np-lista';
  for (const i of lista) {
    const li = document.createElement('li'); li.className = naoLidasAoAbrir.has(i.id) ? 'nova' : '';
    const b = document.createElement('button'); b.type = 'button'; b.dataset.notifFeed = '1';
    const a = document.createElement('b'); a.textContent = frase(i);
    const t = document.createElement('span'); t.textContent = resumo(i.texto, 110);
    const q = document.createElement('small'); q.textContent = quando(i.em);
    b.append(a, t, q); li.append(b); ul.append(li);
  }
  painel.append(ul);
}
