// Onde ficam o galpão e as obras, e quanto tempo de carro há entre eles (usado para montar a rota do Anderson).
// Endereços: nomes das pastas em OPERACOES/OBRAS no Drive. O galpão fica em São Cristóvão (sem endereço
// exato ainda: ponto no bairro). Tempos de carro em segundos, calculados uma vez no OpenStreetMap/OSRM (sem
// trânsito). Obra nova: acrescentar o endereço e as coordenadas aqui e refazer a matriz (ver README).
// Aproximados: Mo465 (Av. Lúcio Costa, 4000; o mapa só acha a avenida, não o número) e Mo581 (colocada ao lado da Mo531).

export const LOCAIS = {
  galpao: { nome: 'Galpão', endereco: 'São Cristóvão', lat: -22.899318, lon: -43.2219346 },
  Mo358: { endereco: 'Rua Cosme Velho, 318 · Cosme Velho', lat: -22.9398417, lon: -43.2029035 },
  Mo465: { endereco: 'Av. Lúcio Costa, 4000 · Barra da Tijuca (ponto aproximado)', lat: -23.0125, lon: -43.343 },
  Mo531: { endereco: 'Av. Lúcio Costa, 2960 · Barra da Tijuca', lat: -23.0111215, lon: -43.3245688 },
  Mo533: { endereco: 'Rua Delfim Moreira, 710 · Leblon', lat: -22.9867924, lon: -43.2230032 },
  Mo581: { endereco: 'Av. Lúcio Costa, 2930 · Barra da Tijuca', lat: -23.0112, lon: -43.3247 },
};

// segundos de carro: DURACAO[de][para]
const DURACAO = {
  galpao: { galpao: 0, Mo358: 758, Mo465: 1670, Mo531: 1456, Mo533: 781, Mo581: 1454 },
  Mo358: { galpao: 684, Mo358: 0, Mo465: 1305, Mo531: 1092, Mo533: 416, Mo581: 1089 },
  Mo465: { galpao: 1490, Mo358: 1199, Mo465: 0, Mo531: 168, Mo533: 967, Mo581: 166 },
  Mo531: { galpao: 1428, Mo358: 1137, Mo465: 239, Mo531: 0, Mo533: 906, Mo581: 2 },
  Mo533: { galpao: 756, Mo358: 466, Mo465: 1073, Mo531: 859, Mo533: 0, Mo581: 857 },
  Mo581: { galpao: 1426, Mo358: 1135, Mo465: 236, Mo531: 2, Mo533: 903, Mo581: 0 },
};

const PADRAO_S = 20 * 60; // lugar sem coordenadas: 20 min

// distância em linha reta, para obra que ainda não está na matriz
function reta(a, b) {
  const R = 6371; const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat); const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// segundos de carro entre dois lugares (ids: 'galpao', 'Mo531'...)
export function tempoEntre(a, b) {
  if (a === b) return 0;
  if (DURACAO[a] && DURACAO[a][b] != null) return DURACAO[a][b];
  if (LOCAIS[a] && LOCAIS[b]) return Math.round((reta(LOCAIS[a], LOCAIS[b]) * 1.4 / 25) * 3600); // 25 km/h de média na cidade
  return PADRAO_S;
}
export const enderecoDe = (id) => (LOCAIS[id] ? LOCAIS[id].endereco : '');
