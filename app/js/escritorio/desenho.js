// Desenho do escritório virtual (estilo Gather): planta vista de cima com paredes em perspectiva leve,
// piso de madeira, móveis com sombra, e os bonequinhos em pixel art com contorno.
// Cores tiradas das fotos do escritório (piso cinza-amadeirado, mesas de carvalho, parede azul com o
// logo, ripado de madeira, balcão de travertino, copa branca). Tudo desenhado no canvas, sem imagens.

import { PLANTA, LARGURA, ALTURA, DECOR, TAPETES, tile, salaDe } from './mapa.js';

export const T = 32;          // tamanho de um quadrado na tela (px)
const U = T / 16;             // 1 "pixel" do boneco = 2 px de tela

const PELE = { clara: '#F1C9A5', media: '#D9A07A', morena: '#B07A55', escura: '#734426' };
const C = {
  fora: '#16263A', foraPonto: '#1D3049',
  paredeTopo: '#C9C3B8', paredeTopoEscuro: '#B5AEA2', paredeFrente: '#F4F2ED', rodape: '#DCD7CE',
  madeira: ['#A28A73', '#9B836C', '#A78F78', '#957E68'], madeiraJunta: '#85705C',
  ceramica: '#E7ECEE', ceramicaJunta: '#D3DADD',
  mesa: '#CFA36B', mesaClara: '#DDB582', mesaBorda: '#A97E4D',
  nogueira: '#7B4F33', nogueiraClara: '#93613F', nogueiraBorda: '#5E3A24',
  cadeira: '#26292E', cadeiraAssento: '#3A3F46', cadeiraBraco: '#54595F',
  futon: '#ECE6DA', futonSombra: '#D6CEBF', sofa: '#7D8896', sofaClaro: '#94A0AE',
  armario: '#BE8E5F', armarioClaro: '#CFA071', armarioCinza: '#B9B4AB',
  branco: '#F7F7F5', inox: '#C3CACF', travertino: '#E3D7C3', travertinoClaro: '#EEE5D5',
  azul: '#23408E', ripado: ['#B57B45', '#A86F3C', '#C08852'],
  vaso: '#D9D3C9', folha: '#4E7B55', folhaClara: '#6E9C6D', vidro: '#BBD6E3', persiana: '#EEE7D7',
  sombra: 'rgba(30, 24, 18, .18)',
};

const ehParede = (x, y) => tile(x, y) === '#';
const temPisoPerto = (x, y) => {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!ehParede(x + dx, y + dy) && x + dx >= 0 && y + dy >= 0 && x + dx < LARGURA && y + dy < ALTURA) return true;
  return false;
};
const decorEm = (x, y) => DECOR.find(([x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2);

// pseudo-aleatório fixo por posição (para variar tábuas e folhas sem "piscar")
const rnd = (x, y, s = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };

// ---------------------------------------------------------------- planta

export function desenharPlanta() {
  const cv = document.createElement('canvas');
  cv.width = LARGURA * T; cv.height = ALTURA * T;
  const g = cv.getContext('2d');
  const r = (x, y, w, h, cor) => { g.fillStyle = cor; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  // 1. fora e piso
  for (let y = 0; y < ALTURA; y++) {
    for (let x = 0; x < LARGURA; x++) {
      const px = x * T; const py = y * T;
      if (ehParede(x, y)) {
        if (!temPisoPerto(x, y)) { r(px, py, T, T, C.fora); if (rnd(x, y) > 0.7) r(px + 14, py + 14, 3, 3, C.foraPonto); }
        continue;
      }
      const sala = salaDe(x, y);
      if (sala && sala.piso === 'ceramica') {
        r(px, py, T, T, C.ceramica);
        r(px, py, T, 1, C.ceramicaJunta); r(px, py, 1, T, C.ceramicaJunta); r(px, py + T / 2, T, 1, C.ceramicaJunta); r(px + T / 2, py, 1, T, C.ceramicaJunta);
      } else {
        // tábuas: 4 por quadrado, emendas desencontradas
        for (let i = 0; i < 4; i++) {
          const ty = py + i * (T / 4);
          r(px, ty, T, T / 4, C.madeira[Math.floor(rnd(x, y, i) * 4)]);
          r(px, ty + T / 4 - 1, T, 1, C.madeiraJunta);
          const emenda = Math.floor(rnd(Math.floor(x / 3), y, i) * T);
          if ((x + i) % 3 === 0) r(px + emenda, ty, 1, T / 4, C.madeiraJunta);
        }
      }
      if (tile(x, y) === 'e') { r(px + 3, py + 4, T - 6, T - 8, '#5B5048'); r(px + 6, py + 7, T - 12, T - 14, '#6B5E54'); }
    }
  }

  // 2. tapetes (diretoria e sala 4)
  TAPETES.forEach(([x1, y1, x2, y2, cor, borda]) => tapete(g, x1 * T + 6, y1 * T + 6, (x2 - x1 + 1) * T - 12, (y2 - y1 + 1) * T - 12, cor, borda));

  // 3. sombra das paredes no piso (parede logo acima)
  for (let y = 0; y < ALTURA; y++) for (let x = 0; x < LARGURA; x++) {
    if (ehParede(x, y)) continue;
    if (ehParede(x, y - 1)) { const gr = g.createLinearGradient(0, y * T, 0, y * T + 10); gr.addColorStop(0, 'rgba(40, 30, 20, .22)'); gr.addColorStop(1, 'rgba(40, 30, 20, 0)'); g.fillStyle = gr; g.fillRect(x * T, y * T, T, 10); }
    if (ehParede(x - 1, y)) { g.fillStyle = 'rgba(40, 30, 20, .10)'; g.fillRect(x * T, y * T, 5, T); }
  }

  // 4. móveis (com sombra)
  const mesas = blocos('T');
  for (let y = 0; y < ALTURA; y++) for (let x = 0; x < LARGURA; x++) moveis(g, x, y, r);
  divisorias(g, mesas);
  monitores(g);
  blocos('O').forEach((b) => {   // mesa redonda (diretoria)
    const cx = ((b.x1 + b.x2 + 1) / 2) * T; const cy = ((b.y1 + b.y2 + 1) / 2) * T; const rr = ((b.x2 - b.x1 + 1) / 2) * T - 2;
    g.fillStyle = C.sombra; g.beginPath(); g.ellipse(cx + 3, cy + 5, rr, rr, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.mesaBorda; g.beginPath(); g.arc(cx, cy + 3, rr, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.mesa; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.mesaClara; g.beginPath(); g.arc(cx - rr * 0.25, cy - rr * 0.25, rr * 0.45, 0, Math.PI * 2); g.fill();
  });

  // 5. paredes (por último, para a parede "na frente" cobrir o que está atrás)
  for (let y = 0; y < ALTURA; y++) for (let x = 0; x < LARGURA; x++) if (ehParede(x, y) && temPisoPerto(x, y)) parede(g, x, y, r);
  logoSolida(g);
  return cv;
}

function tapete(g, x, y, w, h, cor, borda) {
  g.fillStyle = 'rgba(30, 24, 18, .12)'; g.fillRect(x + 3, y + 4, w, h);
  g.fillStyle = borda; g.fillRect(x, y, w, h);
  g.fillStyle = cor; g.fillRect(x + 6, y + 6, w - 12, h - 12);
}

function parede(g, x, y, r) {
  const px = x * T; const py = y * T;
  const d = decorEm(x, y);
  const pisoAbaixo = !ehParede(x, y + 1) && y + 1 < ALTURA;
  const pisoDireita = !ehParede(x + 1, y);
  const pisoEsquerda = !ehParede(x - 1, y);
  // topo da parede
  r(px, py, T, T, C.paredeTopo);
  r(px, py, T, 2, C.paredeTopoEscuro);
  if (pisoAbaixo) {
    // face da parede vista de frente
    const fy = py + T * 0.35; const fh = T * 0.65;
    let face = C.paredeFrente;
    if (d && (d[4] === 'azul' || d[4] === 'logo')) face = C.azul;
    r(px, fy, T, fh, face);
    if (d && d[4] === 'ripado') ripado(g, px, fy, T, fh, x, y);
    if (d && d[4] === 'janela') { r(px + 2, fy + 2, T - 4, fh - 4, C.vidro); r(px + 2, fy + 2, T - 4, fh * 0.4, C.persiana); r(px, fy, T, 2, '#FFFFFF'); r(px + T / 2 - 1, fy + 2, 2, fh - 4, '#E8EEF1'); }
    if (d && d[4] === 'tv') { r(px + 4, fy + 3, T - 8, fh - 10, '#15171A'); r(px + 6, fy + 5, T - 12, fh - 14, '#2B3240'); }
    if (d && d[4] === 'prateleira') {
      // prateleiras de madeira com objetos (sala do Marcos)
      [fy + 3, fy + 10].forEach((sy, k) => {
        r(px, sy + 5, T, 2, C.armario);
        for (let i = 0; i < 4; i++) if (rnd(x, y, i + k * 4) > 0.3) r(px + 2 + i * 7, sy, 5, 5, ['#2B5E96', '#8E3A33', '#EDEAE3', '#5C7F68', '#A9802F', '#3A3A3A'][Math.floor(rnd(x, i, k) * 6)]);
      });
    }
    if (d && d[4] === 'hexagono') {
      r(px, fy, T, fh, '#8F8B87');
      g.fillStyle = '#A09C97';
      for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) { const hx = px + 3 + i * 10 + (k % 2) * 5; const hy = fy + 3 + k * 9; g.beginPath(); for (let a = 0; a < 6; a++) { const an = Math.PI / 3 * a; g.lineTo(hx + 4 + Math.cos(an) * 4, hy + 4 + Math.sin(an) * 4); } g.closePath(); g.fill(); }
    }
    if (d && d[4] === 'terracota') {
      r(px, fy, T, fh, '#C9805E');
      g.fillStyle = 'rgba(255, 240, 230, .55)';
      for (let k = 0; k < 6; k++) g.fillRect(px, fy + 3 + k * 3.4, T, 1);
      for (let k = 0; k < 6; k++) g.fillRect(px + ((k % 2) ? 6 : 14), fy + 3 + k * 3.4, 1, 3);
    }
    r(px, py + T - 3, T, 3, d && (d[4] === 'azul' || d[4] === 'logo') ? '#1B336F' : C.rodape);
    r(px, fy, T, 1, 'rgba(0, 0, 0, .08)');
  } else if (d) {
    // detalhe numa parede lateral (ou de baixo): faixa na borda que dá para a sala
    const pisoAcima = !ehParede(x, y - 1) && y > 0;
    // com sala dos dois lados (ex.: quadro branco), vale o lado esquerdo
    const lado = pisoEsquerda ? px : pisoDireita ? px + T - 9 : null;
    if (lado !== null) {
      if (d[4] === 'janela') { r(lado, py, 9, T, '#FFFFFF'); r(lado + 2, py + 1, 5, T - 2, C.vidro); }
      if (d[4] === 'quadro') { r(lado + 1, py, 8, T, '#9AA3AB'); r(lado + 2, py + 1, 6, T - 2, '#FBFBFA'); if (rnd(x, y) > 0.6) r(lado + 3, py + 8, 3, 10, '#C0504A'); }
      if (d[4] === 'prateleira') { r(lado, py + 2, 9, T - 4, C.armario); ['#2B5E96', '#8E3A33', '#F0EEE8', '#5C7F68', '#A9802F'].forEach((cor, i) => { if (rnd(x, y, i) > 0.35) r(lado + 1, py + 4 + i * 5, 6, 4, cor); }); }
      if (d[4] === 'ripado') ripado(g, lado, py, 9, T, x, y);
      if (d[4] === 'azul') r(lado, py, 9, T, C.azul);
      if (d[4] === 'tv') { r(lado, py + 3, 7, T - 6, '#15171A'); r(lado + 1, py + 5, 5, T - 10, '#2B3240'); }
    } else if (pisoAcima) {
      const fy = py;
      if (d[4] === 'azul') r(px, fy, T, 9, C.azul);
      if (d[4] === 'ripado') ripado(g, px, fy, T, 9, x, y);
      if (d[4] === 'janela') { r(px, fy, T, 9, '#FFFFFF'); r(px + 1, fy + 2, T - 2, 5, C.vidro); }
      if (d[4] === 'quadro') { r(px, fy, T, 8, '#9AA3AB'); r(px + 1, fy + 1, T - 2, 6, '#FBFBFA'); }
    }
  }
}

function ripado(g, x, y, w, h, gx, gy) {
  for (let yy = 0; yy < h; yy += 4) {
    let xx = -Math.floor(rnd(gx, gy + yy) * 10);
    while (xx < w) {
      const larg = 8 + Math.floor(rnd(gx + xx, gy, yy) * 10);
      g.fillStyle = C.ripado[Math.floor(rnd(gx, yy, xx) * 3)];
      g.fillRect(x + Math.max(0, xx), y + yy, Math.min(larg, w - Math.max(0, xx)), 3);
      xx += larg + 1;
    }
  }
}

function logoSolida(g) {
  const d = DECOR.find((x) => x[4] === 'logo');
  if (!d) return;
  const x = d[0] * T; const w = (d[2] - d[0] + 1) * T; const y = d[1] * T + T * 0.35;
  g.fillStyle = '#D9DEE6'; g.font = `800 ${Math.round(T * 0.42)}px Manrope, "Segoe UI", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('SÓLIDA', x + w / 2, y + T * 0.3);
  g.textAlign = 'left';
}

// componentes ligados de um tipo de móvel (para mesas)
function blocos(ch) {
  const visto = new Set(); const out = [];
  for (let y = 0; y < ALTURA; y++) for (let x = 0; x < LARGURA; x++) {
    if (tile(x, y) !== ch || visto.has(`${x},${y}`)) continue;
    const b = { x1: x, y1: y, x2: x, y2: y }; const fila = [[x, y]]; visto.add(`${x},${y}`);
    while (fila.length) {
      const [a, c] = fila.pop();
      b.x1 = Math.min(b.x1, a); b.x2 = Math.max(b.x2, a); b.y1 = Math.min(b.y1, c); b.y2 = Math.max(b.y2, c);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${a + dx},${c + dy}`; if (tile(a + dx, c + dy) === ch && !visto.has(k)) { visto.add(k); fila.push([a + dx, c + dy]); } }
    }
    out.push(b);
  }
  return out;
}

// divisória branca no meio das bancadas (como nas fotos)
function divisorias(g, mesas) {
  for (const b of mesas) {
    const cadeiraLado = (dx, dy) => { for (let y = b.y1; y <= b.y2; y++) for (let x = b.x1; x <= b.x2; x++) if (tile(x + dx, y + dy) === 'c') return true; return false; };
    g.fillStyle = '#F4F4F2';
    if (cadeiraLado(-1, 0) && cadeiraLado(1, 0) && b.y2 - b.y1 >= 3) {
      const cx = ((b.x1 + b.x2 + 1) / 2) * T;
      for (let y = b.y1 * T + 6; y < (b.y2 + 1) * T - 6; y += 22) g.fillRect(cx - 2, y, 4, 18);
    } else if (cadeiraLado(0, -1) && cadeiraLado(0, 1)) {
      const cy = ((b.y1 + b.y2 + 1) / 2) * T;
      for (let x = b.x1 * T + 6; x < (b.x2 + 1) * T - 6; x += 22) g.fillRect(x, cy - 2, 18, 4);
    }
  }
}

// monitor + teclado na frente de cada cadeira que fica de frente para uma mesa
function monitores(g) {
  for (let y = 0; y < ALTURA; y++) for (let x = 0; x < LARGURA; x++) {
    if (tile(x, y) !== 'c') continue;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const ch = tile(x + dx, y + dy);
      if (ch !== 'T' && ch !== 'M') continue;
      const mx = (x + dx) * T; const my = (y + dy) * T;
      if (ch === 'M') { // notebook na mesa da diretoria
        g.fillStyle = '#B9BEC4'; g.fillRect(mx + 7, my + (dy > 0 ? 4 : dy < 0 ? 12 : 8), 18, 14);
        g.fillStyle = '#7E8790'; g.fillRect(mx + 9, my + (dy > 0 ? 6 : dy < 0 ? 14 : 10), 14, 9);
        break;
      }
      g.fillStyle = 'rgba(0, 0, 0, .18)';
      if (dy) {
        const fundo = dy < 0 ? my + 3 : my + T - 9;   // monitor do lado oposto à cadeira
        g.fillRect(mx + 5, fundo + 2, 24, 6);
        g.fillStyle = '#15171A'; g.fillRect(mx + 4, fundo, 24, 5);
        g.fillStyle = '#3B4656'; g.fillRect(mx + 6, fundo + 1, 20, 2);
        g.fillStyle = '#E4E6E8'; g.fillRect(mx + 8, dy < 0 ? my + T - 11 : my + 6, 16, 5);
      } else {
        const fundo = dx < 0 ? mx + 3 : mx + T - 9;
        g.fillRect(fundo + 2, my + 5, 6, 24);
        g.fillStyle = '#15171A'; g.fillRect(fundo, my + 4, 5, 24);
        g.fillStyle = '#3B4656'; g.fillRect(fundo + 1, my + 6, 2, 20);
        g.fillStyle = '#E4E6E8'; g.fillRect(dx < 0 ? mx + T - 11 : mx + 6, my + 8, 5, 16);
      }
      break;
    }
  }
}

function lado(x, y, alvo) {
  if (alvo.includes(tile(x, y - 1))) return 'cima';
  if (alvo.includes(tile(x, y + 1))) return 'baixo';
  if (alvo.includes(tile(x - 1, y))) return 'esquerda';
  if (alvo.includes(tile(x + 1, y))) return 'direita';
  return null;
}

function moveis(g, x, y, r) {
  const ch = tile(x, y); const px = x * T; const py = y * T;
  const sala = salaDe(x, y);
  const sombra = (sx, sy, w, h) => r(sx + 3, sy + 4, w, h, C.sombra);
  if (ch === 'T' || ch === 'M') {
    const borda = ch === 'T' ? C.mesaBorda : C.nogueiraBorda;
    const topo = ch === 'T' ? C.mesa : C.nogueira;
    const claro = ch === 'T' ? C.mesaClara : C.nogueiraClara;
    if (tile(x, y + 1) !== ch) sombra(px, py, T, T);
    r(px, py, T, T, topo);
    if (tile(x, y - 1) !== ch) r(px, py, T, 3, claro);
    if (tile(x, y + 1) !== ch) r(px, py + T - 5, T, 5, borda);
    if (tile(x - 1, y) !== ch) r(px, py, 2, T, borda);
    if (tile(x + 1, y) !== ch) r(px + T - 2, py, 2, T, borda);
    // veios da madeira
    g.fillStyle = 'rgba(120, 80, 40, .10)';
    for (let i = 0; i < 3; i++) g.fillRect(px, py + 6 + i * 9 + Math.floor(rnd(x, y, i) * 4), T, 1);
    if (ch === 'M' && rnd(x, y) > 0.8) { r(px + 10, py + 8, 6, 9, '#E9F1F5'); r(px + 11, py + 9, 4, 7, '#CFE2EC'); }  // copo/garrafa
  } else if (ch === 'Y') {
    r(px, py, T, T, C.mesa);
    sombra(px + 4, py + 6, 24, 18); r(px + 4, py + 5, 24, 18, '#1E2023'); r(px + 7, py + 7, 18, 5, '#F6F6F4'); r(px + 6, py + 16, 20, 4, '#34373C');
  } else if (ch === 'c') {
    const mesa = lado(x, y, 'TMYO');
    sombra(px + 7, py + 7, 18, 18);
    // assento
    r(px + 7, py + 7, 18, 18, C.cadeira); r(px + 9, py + 9, 14, 14, C.cadeiraAssento);
    // encosto do lado oposto à mesa
    const enc = { cima: [px + 6, py + 24, 20, 6], baixo: [px + 6, py + 2, 20, 6], esquerda: [px + 24, py + 6, 6, 20], direita: [px + 2, py + 6, 6, 20] }[mesa || 'cima'];
    r(enc[0], enc[1], enc[2], enc[3], C.cadeira);
    // braços
    if (mesa === 'cima' || mesa === 'baixo' || !mesa) { r(px + 4, py + 10, 3, 12, C.cadeiraBraco); r(px + 25, py + 10, 3, 12, C.cadeiraBraco); }
    else { r(px + 10, py + 4, 12, 3, C.cadeiraBraco); r(px + 10, py + 25, 12, 3, C.cadeiraBraco); }
  } else if (ch === 'S') {
    const futon = sala && sala.id === 'diretoria';
    const base = futon ? C.futon : C.sofa; const claro = futon ? C.futonSombra : C.sofaClaro;
    const parede = lado(x, y, '#');
    sombra(px, py, T, T);
    r(px + 1, py + 1, T - 2, T - 2, base);
    // encosto no lado da parede
    const enc = { cima: [px + 1, py + 1, T - 2, 8], baixo: [px + 1, py + T - 9, T - 2, 8], esquerda: [px + 1, py + 1, 8, T - 2], direita: [px + T - 9, py + 1, 8, T - 2] }[parede || 'cima'];
    r(enc[0], enc[1], enc[2], enc[3], claro);
    // divisão entre almofadas
    if (parede === 'esquerda' || parede === 'direita') r(px + 1, py + T - 2, T - 2, 1, claro); else r(px + T - 2, py + 1, 1, T - 2, claro);
  } else if (ch === 'R') {
    sombra(px + 4, py + 4, 24, 24);
    r(px + 4, py + 4, 24, 24, '#B98352'); r(px + 7, py + 9, 18, 16, '#2A2A2A'); r(px + 6, py + 4, 20, 5, '#2A2A2A');
  } else if (ch === 'A') {
    const cinza = sala && (sala.id === 'arquivo' || sala.id === 'deposito' || sala.id === 'tecnica');
    const base = cinza ? C.armarioCinza : C.armario; const claro = cinza ? '#C9C4BB' : C.armarioClaro;
    if (tile(x, y + 1) !== 'A') sombra(px, py, T, T);
    r(px, py, T, T, base); r(px + 2, py + 2, T - 4, T - 6, claro);
    if (tile(x, y + 1) !== 'A') r(px, py + T - 4, T, 4, 'rgba(0, 0, 0, .15)');
    if (sala && sala.id === 'diretoria') { r(px + 6, py + 8, 8, 12, '#E9E3D7'); r(px + 17, py + 10, 8, 10, '#8E3A33'); }       // amostras
    else if (rnd(x, y) > 0.55) { ['#2B5E96', '#F0EEE8', '#A9802F'].forEach((cor, i) => r(px + 6 + i * 7, py + 7, 5, 14, cor)); }  // pastas
  } else if (ch === 'K') {
    if (tile(x, y + 1) !== 'K') sombra(px, py, T, T);
    r(px, py, T, T, C.branco); r(px, py + T - 6, T, 6, '#E2E2DE'); r(px, py, T, 2, '#FFFFFF');
    // pia no 2º quadrado da bancada, micro-ondas no 4º, purificador no último
    const i = (() => { let n = 0; while (tile(x - n - 1, y) === 'K') n++; return n; })();
    const fim = tile(x + 1, y) !== 'K';
    if (i === 1) { r(px + 4, py + 6, 24, 16, C.inox); r(px + 7, py + 8, 18, 12, '#AEB6BC'); r(px + 14, py + 2, 3, 6, '#2A2A2A'); }
    if (i === 3 || (i === 2 && fim)) { r(px + 4, py + 4, 22, 16, '#EDEDEB'); r(px + 6, py + 6, 12, 12, '#2A2F35'); }
    if (fim && i > 3) { r(px + 8, py + 4, 16, 20, '#FFFFFF'); r(px + 10, py + 8, 12, 6, '#D7DEE2'); }
  } else if (ch === 'B') {
    sombra(px, py, T, T);
    r(px, py, T, T, C.travertino); r(px + 2, py + 2, T - 4, T - 6, C.travertinoClaro);
    g.fillStyle = 'rgba(160, 140, 110, .25)'; for (let i = 0; i < 3; i++) g.fillRect(px + 2, py + 6 + i * 8, T - 4, 1);
  } else if (ch === 'W') {
    // caixa acoplada encostada na parede
    sombra(px + 3, py + 3, 26, 26);
    if (tile(x - 1, y) === '#') { r(px + 2, py + 9, 8, 14, C.branco); r(px + 10, py + 8, 18, 16, C.branco); r(px + 13, py + 11, 12, 10, '#DCE4E7'); }
    else if (tile(x + 1, y) === '#') { r(px + 22, py + 9, 8, 14, C.branco); r(px + 4, py + 8, 18, 16, C.branco); r(px + 7, py + 11, 12, 10, '#DCE4E7'); }
    else if (tile(x, y + 1) === '#' && tile(x, y - 1) !== '#') { r(px + 9, py + 22, 14, 8, C.branco); r(px + 8, py + 4, 16, 18, C.branco); r(px + 11, py + 7, 10, 12, '#DCE4E7'); }
    else { r(px + 9, py + 2, 14, 8, C.branco); r(px + 8, py + 10, 16, 18, C.branco); r(px + 11, py + 13, 10, 12, '#DCE4E7'); }
  } else if (ch === 'L') {
    // bancada única ao longo da parede, com uma cuba só no meio
    let i = 0; while (tile(x - i - 1, y) === 'L') i++;
    let n = i + 1; while (tile(x + n - i, y) === 'L') n++;
    const ini = i === 0; const fim = i === n - 1;
    sombra(px, py + 8, T, 22);
    r(px + (ini ? 2 : 0), py + 8, T - (ini ? 2 : 0) - (fim ? 2 : 0), 22, C.branco);
    r(px + (ini ? 2 : 0), py + 8, T - (ini ? 2 : 0) - (fim ? 2 : 0), 2, '#FFFFFF');
    const centro = (n * T) / 2 - i * T;   // centro da bancada, em relação a este quadrado
    if (centro >= 0 && centro <= T) {
      r(px + centro - 10, py + 12, 20, 12, '#D0D9DD'); r(px + centro - 8, py + 14, 16, 8, '#C3CDD2');
      r(px + centro - 1, py + 24, 2, 5, C.inox);
    }
  } else if (ch === 'V') {
    const bambu = sala && sala.id === 'diretoria';
    g.fillStyle = C.sombra; g.beginPath(); g.ellipse(px + 18, py + 26, 12, 5, 0, 0, Math.PI * 2); g.fill();
    r(px + 9, py + 16, 14, 12, C.vaso); r(px + 9, py + 16, 14, 3, '#C7C0B4');
    const folhas = bambu ? 9 : 6;
    for (let i = 0; i < folhas; i++) {
      const a = rnd(x, y, i) * Math.PI * 2; const d = 4 + rnd(x, y, i + 9) * (bambu ? 11 : 8);
      g.fillStyle = i % 2 ? C.folha : C.folhaClara;
      g.beginPath(); g.ellipse(px + 16 + Math.cos(a) * d, py + (bambu ? 6 : 10) + Math.sin(a) * d * 0.7, bambu ? 4 : 6, bambu ? 7 : 5, a, 0, Math.PI * 2); g.fill();
    }
  }
}

// ---------------------------------------------------------------- bonequinho

// (x, y) = canto superior esquerdo do quadrado onde a pessoa está (px de tela).
// dir: baixo | cima | esquerda | direita · passo: 0..1 (animação) · sentado: bool
export function desenharBoneco(g, p, x, y, { dir = 'baixo', passo = 0, sentado = false, destaque = false } = {}) {
  const pele = PELE[p.pele] || PELE.clara;
  const cab = p.cabelo || { cor: '#3B2A20', estilo: 'curto' };
  const oy = y - 8 * U + (sentado ? 2 * U : 0);
  const bob = !sentado && passo ? (Math.sin(passo * Math.PI * 2) > 0 ? -1 : 0) : 0;
  const CONT = 'rgba(22, 20, 24, .85)';
  const r = (lx, ly, w, h, cor) => { g.fillStyle = cor; g.fillRect(Math.round(x + lx * U), Math.round(oy + (ly + bob) * U), w * U, h * U); };
  // contorno: o mesmo retângulo um pouco maior, escuro, desenhado antes
  const rc = (lx, ly, w, h, cor) => { g.fillStyle = CONT; g.fillRect(Math.round(x + lx * U) - 2, Math.round(oy + (ly + bob) * U) - 2, w * U + 4, h * U + 4); r(lx, ly, w, h, cor); };

  // sombra no chão
  g.fillStyle = 'rgba(25, 20, 15, .25)';
  g.beginPath(); g.ellipse(x + 8 * U, y + (sentado ? 13 : 15.5) * U, 5.5 * U, 1.8 * U, 0, 0, Math.PI * 2); g.fill();
  if (destaque) { g.strokeStyle = 'rgba(232, 196, 120, .95)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x + 8 * U, y + 15.5 * U, 7 * U, 2.6 * U, 0, 0, Math.PI * 2); g.stroke(); }

  const camisa = p.camisa || '#2B5E96';
  // contorno geral do corpo (cabeça + tronco) para destacar do piso
  if (!sentado) {
    const a = passo ? Math.round(Math.sin(passo * Math.PI * 2) * 1.5) : 0;
    rc(5, 19 + Math.max(0, a), 3, 4 - Math.max(0, a), '#2E3440');
    rc(9, 19 + Math.max(0, -a), 3, 4 - Math.max(0, -a), '#2E3440');
    r(5, 23, 3, 1, '#16191E'); r(9, 23, 3, 1, '#16191E');
  } else {
    rc(5, 19, 7, 2, '#2E3440');
  }
  rc(4, 12, 9, 8, camisa);
  rc(3, 13, 1, 5, camisa); rc(13, 13, 1, 5, camisa);
  r(4, 12, 9, 1, 'rgba(255, 255, 255, .18)');
  r(3, 18, 1, 1, pele); r(13, 18, 1, 1, pele);
  // cabelo atrás
  if (cab.estilo === 'longo') rc(3, 4, 11, dir === 'cima' ? 12 : 10, cab.cor);
  if (cab.estilo === 'cacheado') rc(2, 2, 13, 11, cab.cor);
  if (cab.estilo === 'medio') rc(3, 4, 11, 7, cab.cor);
  // cabeça
  rc(4, 3, 9, 9, pele); r(5, 12, 7, 1, pele);
  // rosto
  if (dir !== 'cima') {
    const ex = dir === 'esquerda' ? -1 : dir === 'direita' ? 1 : 0;
    const olho = '#1F2329';
    if (dir !== 'direita') r(6 + ex, 7, 1, 2, olho);
    if (dir !== 'esquerda') r(10 + ex, 7, 1, 2, olho);
    r(5 + ex, 9, 1, 1, 'rgba(220, 120, 110, .35)'); r(11 + ex, 9, 1, 1, 'rgba(220, 120, 110, .35)');
    if (p.oculos) { r(5 + ex, 6, 3, 1, '#2A2A2A'); r(9 + ex, 6, 3, 1, '#2A2A2A'); }
    if (p.barba) r(5, 10, 7, 2, escurecer(cab.estilo === 'careca' ? '#3B2A20' : cab.cor));
    else r(7 + ex, 10, 3, 1, '#B5655A');
  }
  // cabelo em cima
  if (cab.estilo !== 'careca') {
    r(4, 2, 9, 2, cab.cor);
    if (dir === 'cima') r(4, 2, 9, 9, cab.cor);
    else {
      r(4, 4, 1, cab.estilo === 'curto' ? 2 : 4, cab.cor); r(12, 4, 1, cab.estilo === 'curto' ? 2 : 4, cab.cor);
      if (cab.estilo !== 'curto') r(5, 4, 3, 1, cab.cor);
    }
    if (cab.estilo === 'coque') rc(6, 0, 5, 3, cab.cor);
    if (cab.estilo === 'cacheado') r(3, 1, 11, 3, cab.cor);
    r(5, 2, 3, 1, 'rgba(255, 255, 255, .15)');
  }
}

function escurecer(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * 0.8));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

// ---------------------------------------------------------------- etiquetas e balões

export function desenharEtiqueta(g, texto, cx, topo, { status = 'ok', voce = false } = {}) {
  g.font = `700 ${Math.round(T * 0.3)}px Manrope, "Segoe UI", sans-serif`;
  const w = g.measureText(texto).width + 16;
  const h = Math.round(T * 0.48);
  const x = cx - w / 2; const y = topo - h - 2;
  g.fillStyle = 'rgba(0, 0, 0, .18)'; arredondado(g, x + 1, y + 2, w, h, h / 2); g.fill();
  g.fillStyle = voce ? 'rgba(160, 125, 79, .97)' : 'rgba(21, 37, 58, .88)';
  arredondado(g, x, y, w, h, h / 2); g.fill();
  g.fillStyle = { ok: '#6FCF8A', ocupado: '#E5605B', fora: '#E8B84E' }[status] || '#6FCF8A';
  g.beginPath(); g.arc(x + 7, y + h / 2, 2.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText(texto, x + 12, y + h / 2 + 1);
  return y;
}

// símbolo pequeno acima do nome (ex.: 💩 quando a pessoa está sentada no vaso)
export function desenharIcone(g, simbolo, cx, base) {
  const tam = Math.round(T * 0.5);
  g.font = `${tam}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  g.textBaseline = 'bottom'; g.textAlign = 'center';
  g.fillText(simbolo, cx, base - 2);
  g.textAlign = 'left';
  return base - tam - 4;
}

export function desenharBalao(g, texto, cx, base) {
  g.font = `600 ${Math.round(T * 0.4)}px Manrope, "Segoe UI", sans-serif`;
  const linhas = quebrar(g, texto, T * 6);
  const lh = Math.round(T * 0.5);
  const w = Math.max(...linhas.map((l) => g.measureText(l).width)) + 22;
  const h = linhas.length * lh + 14;
  const x = cx - w / 2; const y = base - h - 10;
  g.fillStyle = 'rgba(0, 0, 0, .15)'; arredondado(g, x + 2, y + 3, w, h, 10); g.fill();
  g.fillStyle = '#fff'; arredondado(g, x, y, w, h, 10); g.fill();
  g.beginPath(); g.moveTo(cx - 6, y + h); g.lineTo(cx, y + h + 8); g.lineTo(cx + 6, y + h); g.closePath(); g.fill();
  g.fillStyle = '#262A2B'; g.textBaseline = 'top'; g.textAlign = 'center';
  linhas.forEach((l, i) => g.fillText(l, cx, y + 7 + i * lh));
  g.textAlign = 'left';
}

function quebrar(g, texto, max) {
  const palavras = String(texto).split(/\s+/); const out = []; let atual = '';
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (g.measureText(teste).width > max && atual) { out.push(atual); atual = p; } else atual = teste;
  }
  if (atual) out.push(atual);
  return out.slice(0, 4);
}

function arredondado(g, x, y, w, h, rr) {
  g.beginPath(); g.moveTo(x + rr, y); g.arcTo(x + w, y, x + w, y + h, rr); g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr); g.arcTo(x, y, x + w, y, rr); g.closePath();
}

export { PLANTA };
