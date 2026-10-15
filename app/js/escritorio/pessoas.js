// Quem está no escritório virtual: grupo "Solida Escritório" do WhatsApp, nomes confirmados pelo Felipe
// em 15/10/2026 (Tati e Vanderlei, do Estúdio Pindó, ficam de fora). O bonequinho de cada um foi
// desenhado com características gerais da foto do perfil (cabelo, barba); nenhuma foto é guardada.
// Para ajustar um bonequinho, é só mudar os campos abaixo.
//
// pele: clara · media · morena · escura      cabelo.estilo: curto · medio · longo · coque · cacheado · careca

const P = (id, nome, funcao, pele, cor, estilo, camisa, extra = {}) => ({ id, nome, funcao, pele, cabelo: { cor, estilo }, camisa, ...extra });

export const PESSOAS = [
  P('felipe', 'Felipe', 'Diretoria · ferramentas', 'clara', '#3B2A20', 'curto', '#2B5E96', { barba: true }),
  P('marcos', 'Marcos', 'Diretoria · marketing', 'clara', '#9A948A', 'curto', '#C8B79A', { barba: true }),
  P('marcio', 'Márcio', 'Técnico / qualidade', 'clara', '#1E1A18', 'curto', '#2F2F35', { barba: true }),
  P('simone', 'Simone', 'Coordenação de operações', 'clara', '#D9B46A', 'longo', '#15253A'),
  P('larissa', 'Larissa', 'Gestora de obra', 'clara', '#3A2418', 'longo', '#A07D4F'),
  P('rose', 'Rose', 'Gestora de obra', 'clara', '#E3C98A', 'longo', '#6B8F71'),
  P('mariana', 'Mariana C.', 'Planejamento', 'clara', '#8A6240', 'longo', '#F4F1EA'),
  P('isabel', 'Isabel', 'Projeto + orçamento', 'escura', '#1A1412', 'coque', '#26262A'),
  P('julia', 'Julia', 'Orçamento terceirizado', 'clara', '#B98A4E', 'longo', '#5C7F68'),
  P('leandro', 'Leandro', 'Estagiário de orçamentos', 'media', '#1E1A18', 'curto', '#3D4A5C', { barba: true }),
  P('marcos_h', 'Marcos H.', 'Compras + materiais', 'clara', '#1E1A18', 'curto', '#1D3049'),
  P('augusto', 'Augusto', 'Estagiário de obra', 'clara', '#2E2019', 'curto', '#26262A'),
  P('taisa', 'Taísa', 'Estagiária de obra', 'morena', '#1F1612', 'cacheado', '#7E6039'),
  P('pedro_n', 'Pedro Novais', 'Estagiário', 'clara', '#5A4030', 'curto', '#F4F1EA', { barba: true }),
  P('pedro_g', 'Pedro', 'Estagiário do galpão', 'morena', '#1E1A18', 'curto', '#2B5E96'),
  P('thaissa', 'Thaissa', 'Estagiária de obra', 'media', '#4A3022', 'longo', '#A07D4F', { semFoto: true }),
  P('enio', 'Enio', 'Gestor do pós-obra', 'media', '#1E1A18', 'curto', '#22303E', { barba: true }),
  P('leticia', 'Leticia', 'Financeiro', 'media', '#5A3825', 'longo', '#D9822B'),
  P('isabelle', 'Isabelle', 'Administrativo', 'clara', '#6B4A33', 'medio', '#2B5E96', { semFoto: true }),
];

export const pessoaPorId = (id) => PESSOAS.find((p) => p.id === id);

// Cada login já tem o seu bonequinho (ninguém escolhe — pedido do Felipe, 15/10/2026).
// O usuário (ou o nome) do login é comparado com o id, o nome e os apelidos abaixo.
const APELIDOS = {
  felipe: ['paiva', 'felipe paiva'],
  marcos: ['marcos solida'],
  marcos_h: ['marcos h', 'marcosh', 'marcos h.'],
  pedro_n: ['pedro novais', 'pedro n', 'pedron'],
  pedro_g: ['pedro', 'pedro g', 'pedro galpao'],
  mariana: ['mariana', 'mariana c'],
  taisa: ['taisa', 'taisa escalzo'],
  leandro: ['leandro', 'leandro azevedo'],
};
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export function pessoaDoLogin(sessao) {
  const chaves = [sessao && sessao.usuario, sessao && sessao.nome].map(norm).filter(Boolean);
  const nomesDe = (p) => [p.id.replace('_', ' '), p.id, p.nome, ...(APELIDOS[p.id] || [])].map(norm);
  for (const k of chaves) {
    const exata = PESSOAS.find((p) => nomesDe(p).includes(k));
    if (exata) return exata;
  }
  // só o primeiro nome, quando não há dúvida (ex.: "simone lima" → Simone)
  for (const k of chaves) {
    const primeiro = k.split(' ')[0];
    const achadas = PESSOAS.filter((p) => nomesDe(p).some((n) => n.split(' ')[0] === primeiro));
    if (achadas.length === 1) return achadas[0];
  }
  return null;
}
