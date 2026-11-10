// Escritório virtual (estilo Gather): a planta do escritório com um bonequinho para cada pessoa.
// Dá para andar, entrar nas salas, sentar nas cadeiras, acenar e mandar um balão de mensagem.
// Sem reunião, vídeo ou áudio (pedido do Felipe, 15/10/2026).
//
// Presença: cada tela manda a própria posição para o servidor (/api/escritorio) a cada segundo e recebe
// a dos outros. Hoje o servidor é local (este computador); com o sistema hospedado (Etapa 2), basta
// apontar SERVIDOR para lá (ou trocar por um canal em tempo real do Supabase).

import { html } from '../formato.js';
import { LARGURA, ALTURA, ENTRADA, andavel, sentavel, noVaso, tile, caminho, salaEm } from '../escritorio/mapa.js';
import { T, desenharPlanta, desenharBoneco, desenharEtiqueta, desenharBalao, desenharIcone } from '../escritorio/desenho.js';
import { PESSOAS, pessoaPorId, pessoaDoLogin } from '../escritorio/pessoas.js';
import { sessao } from '../sessao.js';
import { NA_NUVEM, presenca, sairDaPresenca } from '../nuvem.js';

const SERVIDOR = '/api/escritorio';
const VELOCIDADE = 6;          // quadrados por segundo
const BALAO_MS = 9000;
const ACENO_MS = 3500;
const STATUS = { ok: 'Disponível', ocupado: 'Concentrado', fora: 'Fora (almoço / rua)' };

// o bonequinho vem do login (cada funcionário tem o seu)
const euDoLogin = () => pessoaDoLogin(sessao());

let jogo = null;   // estado enquanto a tela está aberta

// ---------------------------------------------------------------- HTML da tela

export function render() {
  const eu = euDoLogin();
  if (!eu) {
    const s = sessao();
    return html`<div class="pagina esc-escolha">
      <p class="resumo" style="margin:0">O seu login (${s.nome || s.usuario || '—'}) ainda não tem bonequinho no escritório.</p>
      <p class="pequeno" style="margin:0">Cada funcionário entra com o próprio usuário e já aparece com o seu boneco (ex.: felipe, simone, marcos h, pedro novais).
        Se o seu nome estiver aqui embaixo e mesmo assim não entrou, peça pelo botão "Pedir alteração".</p>
      <div class="esc-pessoas">${PESSOAS.map((p) => html`<div class="esc-pessoa">
        <canvas width="64" height="80" data-esc-preview="${p.id}"></canvas><b>${p.nome}</b><span class="pequeno">${p.funcao}</span></div>`)}</div>
    </div>`;
  }
  return html`<div class="esc">
    <div class="esc-palco">
      <canvas id="esc-canvas" tabindex="0" aria-label="Planta do escritório"></canvas>
      <div class="esc-sala" id="esc-sala"></div>
      <div class="esc-zoom"><button type="button" data-esc-zoom="menos" title="Afastar">−</button><button type="button" data-esc-zoom="mais" title="Aproximar">+</button><button type="button" data-esc-zoom="tudo" title="Ver o escritório inteiro">Ver tudo</button></div>
      <p class="esc-ajuda">Setas ou W A S D para andar · clique no piso para ir até lá · clique numa cadeira para sentar</p>
    </div>
    <aside class="esc-lado">
      <div class="esc-eu">
        <canvas width="48" height="72" data-esc-preview="${eu.id}"></canvas>
        <div><b>${eu.nome}</b><span class="pequeno">${eu.funcao}</span>
          <label class="esc-status">Status<select id="esc-status">${Object.entries(STATUS).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select></label></div>
      </div>
      <form id="esc-form" class="esc-msg" autocomplete="off">
        <input type="text" id="esc-texto" maxlength="120" placeholder="Mensagem (aparece num balão)…">
        <button type="submit" class="botao on">Enviar</button>
      </form>
      <div class="esc-acoes">
        <button type="button" class="botao" data-esc-acao="👋">👋 Acenar</button>
        <button type="button" class="botao" data-esc-acao="👍">👍</button>
        <button type="button" class="botao" data-esc-acao="☕">☕ Café?</button>
        <button type="button" class="botao" data-esc-acao="😂">😂</button>
      </div>
      <p class="esc-sub">No escritório agora</p>
      <ul class="esc-online" id="esc-online"></ul>
      <p class="pequeno esc-rodape">Clique num nome para ir até a pessoa.</p>
    </aside>
  </div>`;
}

// ---------------------------------------------------------------- ciclo da tela

export function iniciar(raiz) {
  parar();
  desenharPreviews(raiz);
  if (!raiz.dataset.escOuvindo) { raiz.addEventListener('click', aoClicarPainel); raiz.dataset.escOuvindo = '1'; }
  const eu = euDoLogin();
  const canvas = raiz.querySelector('#esc-canvas');
  if (!eu || !canvas) return;

  const planta = desenharPlanta();
  jogo = {
    raiz, canvas, g: canvas.getContext('2d'), planta, eu,
    pos: { x: ENTRADA.x, y: ENTRADA.y }, de: null, caminho: [], dir: 'cima', passo: 0,
    status: 'ok', balao: '', balaoId: 0, aceno: '', acenoId: 0,
    teclas: new Set(), outros: new Map(), ultimoQuadro: performance.now(), rodando: true,
  };
  // volta para onde estava (mesma aba)
  try { const s = JSON.parse(sessionStorage.getItem('solida.escritorio.pos') || 'null'); if (s && andavel(s.x, s.y)) jogo.pos = s; } catch { /* nada */ }
  try { const st = sessionStorage.getItem('solida.escritorio.status'); if (st && STATUS[st]) { jogo.status = st; const sel = raiz.querySelector('#esc-status'); if (sel) sel.value = st; } } catch { /* nada */ }

  jogo.aoTecla = (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    const k = { ArrowUp: 'cima', ArrowDown: 'baixo', ArrowLeft: 'esquerda', ArrowRight: 'direita', w: 'cima', s: 'baixo', a: 'esquerda', d: 'direita', W: 'cima', S: 'baixo', A: 'esquerda', D: 'direita' }[e.key];
    if (!k) return;
    e.preventDefault();
    if (e.type === 'keydown') {
      jogo.teclas.add(k);
      // toque rápido já anda um quadrado (sem esperar o próximo quadro)
      if (!e.repeat) { jogo.caminho = jogo.caminho.slice(0, 1); if (!jogo.caminho.length) passoDaTecla(k); else jogo.proxima = k; }
    } else jogo.teclas.delete(k);
  };
  window.addEventListener('keydown', jogo.aoTecla);
  window.addEventListener('keyup', jogo.aoTecla);
  jogo.aoClicarMapa = (e) => {
    const r = canvas.getBoundingClientRect();
    const cam = camera();
    const x = Math.floor(((e.clientX - r.left) / cam.z + cam.x) / T); const y = Math.floor(((e.clientY - r.top) / cam.z + cam.y) / T);
    irPara({ x, y });
    canvas.focus();
  };
  canvas.addEventListener('click', jogo.aoClicarMapa);
  jogo.aoRedimensionar = () => ajustarTamanho();
  window.addEventListener('resize', jogo.aoRedimensionar);
  raiz.querySelector('#esc-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const campo = raiz.querySelector('#esc-texto');
    const t = campo.value.trim();
    if (t) { jogo.balao = t; jogo.balaoId = Date.now(); campo.value = ''; sincronizar(); }
    canvas.focus();
  });
  raiz.querySelector('#esc-status').addEventListener('change', (e) => { jogo.status = e.target.value; sincronizar(); });

  ajustarTamanho();
  // zoom: o último usado; na primeira vez, o suficiente para ver boa parte do escritório
  const caber = Math.min(jogo.w / (LARGURA * T), jogo.h / (ALTURA * T));
  let zSalvo = NaN; try { zSalvo = parseFloat(localStorage.getItem('solida.escritorio.zoom')); } catch { /* nada */ }
  jogo.zoom = zSalvo > 0 ? Math.max(caber, Math.min(1.6, zSalvo)) : Math.max(caber, 0.8);
  canvas.focus();
  jogo.timer = setInterval(sincronizar, 1000);
  sincronizar();
  requestAnimationFrame(quadro);
}

export function parar() {
  if (!jogo) return;
  jogo.rodando = false;
  clearInterval(jogo.timer);
  window.removeEventListener('keydown', jogo.aoTecla);
  window.removeEventListener('keyup', jogo.aoTecla);
  window.removeEventListener('resize', jogo.aoRedimensionar);
  try { sessionStorage.setItem('solida.escritorio.pos', JSON.stringify({ x: Math.round(jogo.pos.x), y: Math.round(jogo.pos.y) })); sessionStorage.setItem('solida.escritorio.status', jogo.status || 'ok'); } catch { /* nada */ }
  // na nuvem a pessoa continua no escritório enquanto o sistema estiver aberto (presença de fundo, abaixo); só no teste local avisa que saiu
  if (!NA_NUVEM) { try { navigator.sendBeacon(`${SERVIDOR}/sair`, JSON.stringify({ id: jogo.eu.id })); } catch { /* nada */ } }
  jogo = null;
}

export const ativo = () => !!jogo;

// ---------------------------------------------------------------- presença de fundo (pedido do Felipe, 10/11/2026)
// Enquanto o sistema estiver aberto (em qualquer tela), a pessoa aparece no escritório virtual, parada onde estava (ou na entrada),
// e todo mundo se vê. Ao abrir a tela do escritório, o boneco volta a andar a partir dali. Fechar o sistema tira a pessoa sozinho.
let fundo = null;
function meuFundo() {
  const eu = euDoLogin(); if (!eu) return null;
  let pos = { x: ENTRADA.x, y: ENTRADA.y }; let status = 'ok';
  try { const s = JSON.parse(sessionStorage.getItem('solida.escritorio.pos') || 'null'); if (s && andavel(s.x, s.y)) pos = s; status = sessionStorage.getItem('solida.escritorio.status') || 'ok'; } catch { /* nada */ }
  return { id: eu.id, x: pos.x, y: pos.y, dir: 'baixo', sentado: sentavel(pos.x, pos.y), status, balao: '', balaoId: 0, aceno: '', acenoId: 0, sala: salaEm(pos.x, pos.y) };
}
export function presencaDeFundo() {
  if (!NA_NUVEM || fundo) return;
  const bater = async () => { if (jogo) return; const m = meuFundo(); if (m) { try { await presenca(m); } catch { /* sem conexão: tenta de novo */ } } };
  fundo = setInterval(bater, 10000);
  bater();
}
export function pararPresencaDeFundo() {
  if (fundo) { clearInterval(fundo); fundo = null; }
  if (NA_NUVEM) sairDaPresenca();
}

function aoClicarPainel(e) {
  const zb = e.target.closest('[data-esc-zoom]');
  if (zb) { zoomPara(zb.dataset.escZoom); if (jogo) jogo.canvas.focus(); return; }
  const acao = e.target.closest('[data-esc-acao]');
  if (acao && jogo) { jogo.aceno = acao.dataset.escAcao; jogo.acenoId = Date.now(); sincronizar(); jogo.canvas.focus(); return; }
  const ir = e.target.closest('[data-esc-ir]');
  if (ir && jogo) {
    const o = jogo.outros.get(ir.dataset.escIr);
    if (o) {
      const alvo = { x: Math.round(o.x), y: Math.round(o.y) };
      const perto = [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]].map(([dx, dy]) => ({ x: alvo.x + dx, y: alvo.y + dy })).find((p) => andavel(p.x, p.y) && !sentavel(p.x, p.y));
      if (perto) irPara(perto);
    }
    jogo.canvas.focus();
  }
}

function desenharPreviews(raiz) {
  raiz.querySelectorAll('canvas[data-esc-preview]').forEach((c) => {
    const p = pessoaPorId(c.dataset.escPreview);
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.save(); g.scale(c.width / T, c.width / T);
    desenharBoneco(g, p, 0, 8 * 2, { dir: 'baixo' });
    g.restore();
  });
}

// ---------------------------------------------------------------- movimento

function irPara(clique) {
  if (!jogo) return;
  // clicou na mesa ou na parede: vai para a cadeira (ou piso) mais próxima do ponto clicado
  let alvo = clique;
  if (!andavel(alvo.x, alvo.y) || (!sentavel(alvo.x, alvo.y) && vizinhos(alvo, 1).some((p) => sentavel(p.x, p.y)))) {
    const perto = [...vizinhos(clique, 1), ...vizinhos(clique, 2)];
    alvo = perto.find((p) => sentavel(p.x, p.y)) || perto.find((p) => andavel(p.x, p.y)) || clique;
  }
  const de = { x: Math.round(jogo.pos.x), y: Math.round(jogo.pos.y) };
  const passos = caminho(de, alvo);
  if (passos.length) jogo.caminho = passos;
}

function vizinhos(p, r) {
  const out = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) out.push({ x: p.x + dx, y: p.y + dy });
  return out.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
}

function passoDaTecla(dir) {
  const [dx, dy] = { cima: [0, -1], baixo: [0, 1], esquerda: [-1, 0], direita: [1, 0] }[dir];
  const n = { x: Math.round(jogo.pos.x) + dx, y: Math.round(jogo.pos.y) + dy };
  jogo.dir = dir;
  if (andavel(n.x, n.y)) jogo.caminho = [n];
}

function quadro(agora) {
  if (!jogo || !jogo.rodando) return;
  const dt = Math.min(0.05, (agora - jogo.ultimoQuadro) / 1000);
  jogo.ultimoQuadro = agora;
  mover(dt);
  moverOutros(dt);
  desenhar();
  requestAnimationFrame(quadro);
}

function mover(dt) {
  const j = jogo;
  if (!j.caminho.length && j.proxima) { passoDaTecla(j.proxima); j.proxima = null; }
  if (!j.caminho.length && j.teclas.size) passoDaTecla([...j.teclas].pop());
  if (!j.caminho.length) { j.passo = 0; return; }
  const alvo = j.caminho[0];
  const vx = alvo.x - j.pos.x; const vy = alvo.y - j.pos.y;
  const d = Math.hypot(vx, vy);
  if (Math.abs(vx) > Math.abs(vy)) j.dir = vx > 0 ? 'direita' : 'esquerda'; else if (vy) j.dir = vy > 0 ? 'baixo' : 'cima';
  const passo = VELOCIDADE * dt;
  if (d <= passo) { j.pos = { x: alvo.x, y: alvo.y }; j.caminho.shift(); } else { j.pos = { x: j.pos.x + (vx / d) * passo, y: j.pos.y + (vy / d) * passo }; }
  j.passo = (j.passo + dt * 3) % 1;
  if (!j.caminho.length) { j.passo = 0; if (sentavel(j.pos.x, j.pos.y)) j.dir = direcaoSentado(j.pos.x, j.pos.y); }
}

// sentado, olha para a mesa ao lado
function direcaoSentado(x, y) {
  if (tile(x, y) === 'W') {   // no vaso: de costas para a parede
    if (tile(x, y + 1) === '#') return 'cima';
    if (tile(x, y - 1) === '#') return 'baixo';
    if (tile(x - 1, y) === '#') return 'direita';
    if (tile(x + 1, y) === '#') return 'esquerda';
    return 'baixo';
  }
  const mesa = (cx, cy) => 'TOMBY'.includes(tile(cx, cy));
  if (mesa(x, y - 1)) return 'cima';
  if (mesa(x, y + 1)) return 'baixo';
  if (mesa(x - 1, y)) return 'esquerda';
  if (mesa(x + 1, y)) return 'direita';
  return 'baixo';
}

function moverOutros(dt) {
  for (const o of jogo.outros.values()) {
    const vx = o.alvo.x - o.x; const vy = o.alvo.y - o.y; const d = Math.hypot(vx, vy);
    if (d > 6) { o.x = o.alvo.x; o.y = o.alvo.y; o.passo = 0; continue; }
    const passo = VELOCIDADE * 1.1 * dt;
    if (d <= passo) { o.x = o.alvo.x; o.y = o.alvo.y; o.passo = 0; } else { o.x += (vx / d) * passo; o.y += (vy / d) * passo; o.passo = (o.passo + dt * 3) % 1; }
  }
}

// ---------------------------------------------------------------- desenho

function ajustarTamanho() {
  const c = jogo.canvas;
  const caixa = c.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(320, Math.floor(caixa.width));
  const h = Math.max(360, Math.min(Math.floor(window.innerHeight - c.getBoundingClientRect().top - 40), 760));
  c.style.width = `${w}px`; c.style.height = `${h}px`;
  c.width = Math.floor(w * dpr); c.height = Math.floor(h * dpr);
  jogo.dpr = dpr; jogo.w = w; jogo.h = h;
}

// câmera em coordenadas do mapa (px a zoom 1); a área visível é a tela dividida pelo zoom
function camera() {
  const j = jogo;
  const z = j.zoom || 1;
  const vw = j.w / z; const vh = j.h / z;
  const mw = LARGURA * T; const mh = ALTURA * T;
  let x = (j.pos.x + 0.5) * T - vw / 2; let y = (j.pos.y + 0.5) * T - vh / 2;
  x = mw <= vw ? (mw - vw) / 2 : Math.max(0, Math.min(mw - vw, x));
  y = mh <= vh ? (mh - vh) / 2 : Math.max(0, Math.min(mh - vh, y));
  return { x, y, z };
}

export function zoomPara(modo) {
  const j = jogo;
  if (!j) return;
  const caber = Math.min(j.w / (LARGURA * T), j.h / (ALTURA * T));
  if (modo === 'tudo') j.zoom = caber;
  else if (modo === 'mais') j.zoom = Math.min(1.6, (j.zoom || 1) * 1.25);
  else if (modo === 'menos') j.zoom = Math.max(caber, (j.zoom || 1) / 1.25);
  try { localStorage.setItem('solida.escritorio.zoom', String(j.zoom)); } catch { /* nada */ }
}

function desenhar() {
  const j = jogo; const g = j.g;
  const cam = camera(); const z = cam.z;
  g.setTransform(j.dpr, 0, 0, j.dpr, 0, 0);
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#0F1B2B'; g.fillRect(0, 0, j.w, j.h);
  // planta e bonecos na escala do zoom; nomes e balões em tamanho fixo (legíveis em qualquer zoom)
  g.setTransform(j.dpr * z, 0, 0, j.dpr * z, 0, 0);
  g.drawImage(j.planta, -Math.round(cam.x), -Math.round(cam.y));
  // todos ordenados de cima para baixo (quem está mais embaixo fica na frente)
  const agora = Date.now();
  const todos = [
    ...[...j.outros.values()].map((o) => ({ ...o, voce: false })),
    { pessoa: j.eu, x: j.pos.x, y: j.pos.y, dir: j.dir, passo: j.passo, sentado: !j.caminho.length && sentavel(Math.round(j.pos.x), Math.round(j.pos.y)), status: j.status, voce: true,
      balao: j.balao, balaoVisto: j.balaoId, aceno: j.aceno, acenoVisto: j.acenoId },
  ].sort((a, b) => a.y - b.y);
  for (const o of todos) {
    const px = o.x * T - cam.x; const py = o.y * T - cam.y;
    if (px < -T * 3 || py < -T * 3 || px > j.w / z + T * 3 || py > j.h / z + T * 3) continue;
    desenharBoneco(g, o.pessoa, px, py, { dir: o.dir, passo: o.passo, sentado: o.sentado, destaque: o.voce });
  }
  g.setTransform(j.dpr, 0, 0, j.dpr, 0, 0);
  for (const o of todos) {
    const sx = (o.x * T - cam.x + T / 2) * z; const sy = (o.y * T - cam.y - T * 0.3 + (o.sentado ? 6 : 0)) * z;
    let topo = desenharEtiqueta(g, o.pessoa.nome, sx, sy, { status: o.status, voce: o.voce });
    if (o.sentado && noVaso(o.x, o.y)) topo = desenharIcone(g, '💩', sx, topo);
    if (o.balao && agora - o.balaoVisto < BALAO_MS) desenharBalao(g, o.balao, sx, topo);
    else if (o.aceno && agora - o.acenoVisto < ACENO_MS) desenharBalao(g, o.aceno, sx, topo);
  }
  const sala = salaEm(Math.round(j.pos.x), Math.round(j.pos.y));
  const el = j.raiz.querySelector('#esc-sala');
  if (el && el.textContent !== sala) el.textContent = sala;
}

// ---------------------------------------------------------------- presença

async function sincronizar() {
  const j = jogo;
  if (!j || j.enviando) return;
  j.enviando = true;
  const x = Math.round(j.pos.x); const y = Math.round(j.pos.y);
  const meu = {
    id: j.eu.id, x, y, dir: j.dir, sentado: !j.caminho.length && sentavel(x, y), status: j.status,
    balao: j.balao, balaoId: j.balaoId, aceno: j.aceno, acenoId: j.acenoId, sala: salaEm(x, y),
  };
  try {
    let lista;
    if (NA_NUVEM) lista = await presenca(meu);
    else { const r = await fetch(SERVIDOR, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meu), cache: 'no-store' }); lista = r.ok ? await r.json() : []; }
    if (jogo !== j) return;
    const vistos = new Set();
    for (const s of (Array.isArray(lista) ? lista : [])) {
      if (!s || s.id === j.eu.id) continue;
      const pessoa = pessoaPorId(s.id);
      if (!pessoa) continue;
      vistos.add(s.id);
      const o = j.outros.get(s.id) || { pessoa, x: s.x, y: s.y, passo: 0, balaoVisto: 0, acenoVisto: 0, balaoIdVisto: s.balaoId, acenoIdVisto: s.acenoId };
      o.alvo = { x: s.x, y: s.y }; o.dir = s.dir; o.sentado = s.sentado; o.status = s.status; o.sala = s.sala;
      // balão e aceno aparecem quando chega um novo (marcado pelo id)
      if (s.balaoId && s.balaoId !== o.balaoIdVisto) { o.balao = s.balao; o.balaoVisto = Date.now(); o.balaoIdVisto = s.balaoId; }
      if (s.acenoId && s.acenoId !== o.acenoIdVisto) { o.aceno = s.aceno; o.acenoVisto = Date.now(); o.acenoIdVisto = s.acenoId; }
      j.outros.set(s.id, o);
    }
    for (const id of [...j.outros.keys()]) if (!vistos.has(id)) j.outros.delete(id);
    listarOnline();
  } catch { /* sem servidor: segue sozinho */ } finally { j.enviando = false; }
}

function listarOnline() {
  const j = jogo;
  const el = j.raiz.querySelector('#esc-online');
  if (!el) return;
  const eu = { pessoa: j.eu, sala: salaEm(Math.round(j.pos.x), Math.round(j.pos.y)), status: j.status, voce: true };
  const lista = [eu, ...[...j.outros.values()].sort((a, b) => a.pessoa.nome.localeCompare(b.pessoa.nome))];
  el.innerHTML = String(html`${lista.map((o) => html`<li>
    <button type="button" ${o.voce ? html.seguro('disabled') : ''} data-esc-ir="${o.voce ? '' : o.pessoa.id}">
      <i class="esc-pt esc-${o.status || 'ok'}"></i><b>${o.pessoa.nome}${o.voce ? ' (você)' : ''}</b>
      <span class="pequeno">${o.sala || ''}${o.sentado ? (noVaso(o.x, o.y) ? ' · 💩' : ' · sentado') : ''}${o.status && o.status !== 'ok' ? ` · ${STATUS[o.status].toLowerCase()}` : ''}</span>
    </button></li>`)}${lista.length === 1 ? html`<li class="pequeno">Só você por enquanto.</li>` : ''}`);
}
