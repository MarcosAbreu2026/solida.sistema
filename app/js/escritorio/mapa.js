// Planta do escritório (Rua Francisco Sá 23, sala 1102), traçada sobre a planta em CAD e ajustada com as
// fotos e correções do Felipe (15/10/2026): sala das baias menor, sem sala individual, balcão da recepção
// em L com a cadeira atrás, banheiros com bancada única, sala 2 = "Sala do Marcos". Recepção, arquivo,
// copa e banheiros redesenhados pela planta real dessa parte (recepção bem menor, junto do corredor).
// Escala: cada quadrado ≈ 50 cm (uma pessoa por quadrado, como no Gather). 15 × 35 quadrados.
// Para mudar algo, edite SALAS (pisos), PORTAS, MOVEIS, DECOR e TAPETES.
//
// Grade:  #  parede/fora   .  piso   _  passagem sem porta   D  porta   e  entrada
//   T mesa (carvalho) · M mesa de nogueira · O mesa redonda · c cadeira · S sofá/futon · R poltrona
//   A armário/bancada · K bancada da copa · B balcão da recepção · W vaso sanitário
//   L bancada com cuba (banheiro) · V planta · Y impressora (sobre a mesa)

export const LARGURA = 15;
export const ALTURA = 35;

// Pisos de cada cômodo [x1, y1, x2, y2] (inclusive)
export const SALAS = [
  { id: 'baias', nome: 'Sala das baias', r: [[1, 1, 6, 9]], piso: 'madeira' },
  { id: 'arquivo', nome: 'Arquivo', r: [[1, 11, 3, 13]], piso: 'madeira' },
  { id: 'diretoria', nome: 'Diretoria', r: [[8, 1, 13, 7]], piso: 'madeira' },
  { id: 'marcos', nome: 'Sala do Marcos', r: [[8, 9, 13, 13]], piso: 'madeira' },
  { id: 'corredor', nome: 'Corredor', r: [[5, 11, 6, 14]], piso: 'madeira', semRotulo: true },
  { id: 'copa', nome: 'Copa', r: [[8, 15, 10, 16]], piso: 'madeira' },
  { id: 'cantocopa', nome: 'Canto da copa', r: [[12, 15, 13, 16]], piso: 'ceramica' },
  { id: 'recepcao', nome: 'Recepção', r: [[2, 15, 6, 20]], piso: 'madeira' },
  { id: 'wcrecepcao', nome: 'Banheiro da recepção', r: [[8, 18, 9, 20]], piso: 'madeira' },
  { id: 'wccopa', nome: 'Banheiro da copa', r: [[11, 18, 13, 20]], piso: 'madeira' },
  { id: 'azul', nome: 'Sala azul', r: [[1, 22, 8, 26]], piso: 'madeira' },
  { id: 'sala3', nome: 'Sala 3', r: [[10, 22, 13, 26]], piso: 'madeira' },
  { id: 'hallsul', nome: 'Corredor', r: [[4, 28, 5, 30]], piso: 'madeira', semRotulo: true },
  { id: 'wc3', nome: 'Banheiro', r: [[1, 28, 2, 30]], piso: 'madeira' },
  { id: 'deposito', nome: 'Depósito', r: [[1, 32, 5, 33]], piso: 'madeira' },
  { id: 'sala4', nome: 'Sala 4', r: [[7, 28, 13, 33]], piso: 'madeira' },
];

// Portas [x, y, tipo]
const PORTAS = [
  [7, 2, 'D'], [7, 3, 'D'],                         // baias → diretoria
  [1, 10, 'D'],                                     // baias → arquivo
  [5, 10, 'D'], [6, 10, 'D'],                       // baias → corredor (porta branca no fim do corredor)
  [7, 12, 'D'],                                     // corredor → sala do Marcos
  [7, 16, 'D'],                                     // recepção/corredor → copa
  [11, 16, 'D'],                                    // copa → canto da copa (janelão)
  [12, 17, 'D'],                                    // canto da copa → banheiro da copa
  [7, 18, 'D'],                                     // recepção → banheiro da recepção
  [1, 20, 'e'],                                     // entrada (fechadura digital)
  [4, 21, '_'], [5, 21, '_'],                       // recepção → sala azul (passagem sem porta)
  [9, 26, 'D'],                                     // sala azul → sala 3
  [4, 27, 'D'], [3, 29, 'D'], [4, 31, 'D'], [6, 29, 'D'],   // sala azul → corredor → banheiro, depósito, sala 4
];

// Móveis [x1, y1, x2, y2, caractere]
const MOVEIS = [
  // sala das baias: bancada de 8 lugares, cadeiras dos dois lados, passagem junto aos quadros brancos
  [3, 1, 4, 8, 'T'], [2, 1, 2, 1, 'c'], [2, 3, 2, 3, 'c'], [2, 5, 2, 5, 'c'], [2, 7, 2, 7, 'c'],
  [5, 1, 5, 1, 'c'], [5, 3, 5, 3, 'c'], [5, 5, 5, 5, 'c'], [5, 7, 5, 7, 'c'],
  // arquivo
  [1, 13, 3, 13, 'A'], [3, 11, 3, 12, 'A'],
  // diretoria (planta): mesa redonda com 3 cadeiras e duas mesas
  [10, 2, 11, 3, 'O'], [9, 3, 9, 3, 'c'], [12, 2, 12, 2, 'c'], [11, 4, 11, 4, 'c'],
  [8, 6, 9, 6, 'T'], [9, 7, 9, 7, 'c'], [12, 6, 13, 6, 'T'], [12, 7, 12, 7, 'c'], [13, 1, 13, 1, 'V'],
  // sala do Marcos (foto): futon sob as prateleiras, bambu, mesa de nogueira, bancada de amostras
  [8, 9, 11, 9, 'S'], [13, 9, 13, 9, 'V'],
  [10, 11, 13, 12, 'M'], [11, 10, 11, 10, 'c'], [13, 10, 13, 10, 'c'], [9, 11, 9, 11, 'c'], [11, 13, 11, 13, 'c'], [13, 13, 13, 13, 'c'],
  [8, 13, 8, 13, 'A'],
  // copa: bancada branca (pia, micro-ondas)
  [8, 15, 10, 15, 'K'],
  // banheiro da recepção: bancada da pia na parede de baixo, vaso na parede de cima
  [8, 20, 9, 20, 'L'], [9, 18, 9, 18, 'W'],
  // banheiro da copa: bancada da pia na parede de baixo, vaso na parede da esquerda
  [11, 20, 13, 20, 'L'], [11, 18, 11, 18, 'W'],
  [1, 30, 1, 30, 'W'], [1, 28, 1, 28, 'L'],
  // recepção: balcão de travertino em L com a cadeira atrás, poltrona junto à passagem
  [4, 16, 4, 16, 'B'], [2, 17, 4, 17, 'B'], [3, 16, 3, 16, 'c'], [6, 20, 6, 20, 'R'],
  // sala azul: 4 mesas com impressora, gaveteiro, planta
  [1, 24, 5, 25, 'T'], [2, 23, 2, 23, 'c'], [5, 23, 5, 23, 'c'], [2, 26, 2, 26, 'c'], [5, 26, 5, 26, 'c'],
  [3, 24, 3, 24, 'Y'], [6, 25, 6, 25, 'A'], [1, 22, 1, 22, 'V'],
  // sala 3
  [10, 22, 10, 25, 'A'], [12, 24, 13, 25, 'T'], [13, 23, 13, 23, 'c'], [13, 26, 13, 26, 'c'], [13, 22, 13, 22, 'V'],
  // sala 4: mesa até a janela
  [10, 30, 13, 31, 'T'], [11, 29, 11, 29, 'c'], [13, 29, 13, 29, 'c'], [11, 32, 11, 32, 'c'], [13, 32, 13, 32, 'c'],
  [7, 30, 7, 32, 'S'], [7, 33, 8, 33, 'A'], [10, 33, 12, 33, 'A'], [13, 28, 13, 28, 'V'],
  // depósito
  [1, 33, 5, 33, 'A'], [1, 32, 1, 32, 'A'],
];

// Detalhes nas paredes [x1, y1, x2, y2, tipo]
export const DECOR = [
  // janelas na fachada
  [1, 0, 6, 0, 'janela'], [8, 0, 13, 0, 'janela'], [14, 1, 14, 7, 'janela'], [14, 9, 14, 13, 'janela'],
  [14, 15, 14, 16, 'janela'], [14, 18, 14, 20, 'janela'], [14, 22, 14, 26, 'janela'], [14, 28, 14, 33, 'janela'], [7, 34, 13, 34, 'janela'],
  [7, 4, 7, 8, 'quadro'],                     // quadros brancos da sala das baias (parede do corredor)
  [8, 8, 11, 8, 'prateleira'],                // prateleiras com o logo (sala do Marcos)
  [2, 14, 4, 14, 'logo'],                     // parede azul com o logo SÓLIDA (recepção)
  [1, 17, 1, 18, 'tv'],                       // TV da recepção
  [9, 22, 9, 24, 'quadro'],                   // sala azul: quadro branco
  [1, 27, 8, 27, 'azul'],                     // sala azul: parede azul (com a porta)
  [0, 22, 0, 26, 'ripado'],                   // sala azul: ripado de madeira
  [8, 17, 9, 17, 'hexagono'],                 // banheiro da recepção: revestimento hexagonal cinza
  [13, 17, 13, 17, 'terracota'],              // banheiro da copa: plaquinhas terracota
];

// Tapetes [x1, y1, x2, y2, cor, borda]
export const TAPETES = [
  [9, 1, 12, 5, '#C9BDAA', '#B7A991'],
  [10, 10, 13, 13, '#CFC6B6', '#BDB29F'],
  [9, 29, 13, 32, '#B7C0C9', '#A3ADB8'],
];

export const ENTRADA = { x: 2, y: 20 };

// ---------------------------------------------------------------- montagem da grade

const grade = Array.from({ length: ALTURA }, () => Array(LARGURA).fill('#'));
const pinta = (x1, y1, x2, y2, ch) => { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) if (grade[y] && x >= 0 && x < LARGURA) grade[y][x] = ch; };
SALAS.forEach((s) => s.r.forEach(([x1, y1, x2, y2]) => pinta(x1, y1, x2, y2, '.')));
PORTAS.forEach(([x, y, t]) => pinta(x, y, x, y, t));
MOVEIS.forEach(([x1, y1, x2, y2, ch]) => pinta(x1, y1, x2, y2, ch));

export const PLANTA = grade.map((l) => l.join(''));

export const tile = (x, y) => (grade[y] && grade[y][x]) || '#';
export const sentavel = (x, y) => 'cSRW'.includes(tile(x, y));   // W: dá para sentar no vaso 💩
export const andavel = (x, y) => '._DecSRW'.includes(tile(x, y));
export const noVaso = (x, y) => tile(Math.round(x), Math.round(y)) === 'W';

const DENTRO = (s, x, y) => s.r.some(([x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2);
export const salaDe = (x, y) => SALAS.find((s) => DENTRO(s, x, y));
export function salaEm(x, y) {
  const s = salaDe(x, y);
  return s ? s.nome : '';
}

// Caminho mais curto (busca em largura). Dá para passar por cadeiras (como no Gather: a pessoa passa por trás)
export function caminho(de, para) {
  if (!andavel(para.x, para.y)) return [];
  const k = (x, y) => y * LARGURA + x;
  const veio = new Map([[k(de.x, de.y), null]]);
  const fila = [de];
  while (fila.length) {
    const a = fila.shift();
    if (a.x === para.x && a.y === para.y) {
      const passos = [];
      for (let p = a; p && !(p.x === de.x && p.y === de.y); p = veio.get(k(p.x, p.y))) passos.unshift(p);
      return passos;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: a.x + dx, y: a.y + dy };
      if (!veio.has(k(n.x, n.y)) && andavel(n.x, n.y)) { veio.set(k(n.x, n.y), a); fila.push(n); }
    }
  }
  return [];
}
