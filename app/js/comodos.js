// Dicionário de cômodos (pedido do Felipe, 18/11/2026): pendência cujo ASSUNTO é um cômodo ("Cozinha", "A/S", "Banheiro social", "Qto 2"…) é pendência da OBRA,
// não tarefa de uma pessoa: vai para a lista da obra (por cômodo) e não entra nas tarefas, na Agenda nem nos contadores das pessoas.
// As pessoas escrevem de qualquer jeito, então o reconhecimento ignora acento, maiúscula, pontuação, plural e aceita abreviações e variações
// (área de serviço = A/S = AS = A.S. = área serviço = ár. serviço = lavanderia…). Tudo no navegador, sem IA e sem rede.

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/º|°|ª/g, '').replace(/[\/\\.,;:()\[\]_+&|-]+/g, ' ').replace(/\s+/g, ' ').trim();

// canônico → variações (já como as pessoas escrevem; a normalização cuida de acento, pontuação e caixa)
const GRUPOS = [
  ['Sala', ['sala', 'salas', 'sl', 'sala de estar', 'sala estar', 'sala de jantar', 'sala jantar', 'sala de tv', 'sala tv', 'sala de televisao', 'sala intima', 'sala de visita', 'sala de visitas', 'sala de reuniao', 'sala de espera', 'sala comercial', 'sala de musica', 'sala de jogos', 'sala de leitura', 'sala de ginastica', 'sala de estudos', 'living', 'estar', 'jantar', 'estar jantar', 'sala de estar e jantar', 'home theater', 'hometheater', 'cinema', 'ht']],
  ['Cozinha', ['cozinha', 'cozinhas', 'coz', 'cz', 'cozinha americana', 'cozinha gourmet', 'cozinha de apoio', 'kitchen', 'copa', 'copa cozinha', 'copa e cozinha', 'cozinha e copa']],
  ['Área gourmet', ['area gourmet', 'area gourmet externa', 'espaco gourmet', 'espaco gourmet', 'gourmet', 'churrasqueira', 'area de churrasco', 'area de churrasqueira', 'churrasco', 'forno de pizza', 'varanda gourmet', 'terraco gourmet']],
  ['Varanda', ['varanda', 'varandas', 'var', 'sacada', 'sacadas', 'terraco', 'terracos', 'terraço', 'terr', 'balcao', 'balcao externo', 'solarium', 'deck', 'pergolado', 'pergola']],
  ['Quarto', ['quarto', 'quartos', 'qto', 'qtos', 'qt', 'quarto de casal', 'quarto casal', 'quarto de solteiro', 'quarto solteiro', 'quarto de hospedes', 'quarto hospedes', 'quarto de hospede', 'quarto de visita', 'quarto infantil', 'quarto do bebe', 'quarto de bebe', 'quarto de crianca', 'quarto de menino', 'quarto de menina', 'quarto de empregada', 'quarto empregada', 'quarto de servico', 'quarto servico', 'dormitorio', 'dormitorios', 'dorm', 'dorm casal', 'dorm solteiro']],
  ['Suíte', ['suite', 'suites', 'ste', 'suite master', 'suite casal', 'suite principal', 'suite de casal', 'suite hospedes', 'suite de hospedes', 'master', 'quarto master', 'quarto principal', 'suite 1', 'suite 2', 'suite 3']],
  ['Closet', ['closet', 'closets', 'clost', 'guarda roupa', 'guarda-roupa', 'vestiario', 'dressing']],
  ['Banheiro', ['banheiro', 'banheiros', 'banho', 'bh', 'bho', 'bwc', 'b w c', 'wc', 'w c', 'bw', 'banheiro social', 'banheiro suite', 'banheiro da suite', 'banheiro master', 'banheiro de servico', 'banheiro servico', 'banheiro empregada', 'banheiro de empregada', 'banheiro externo', 'banheiro infantil', 'banheiro de hospedes', 'sanitario', 'sanitarios', 'toalete', 'toilette', 'toilet']],
  ['Lavabo', ['lavabo', 'lavabos', 'lav', 'lavatorio', 'lavatorios']],
  ['Área de serviço', ['area de servico', 'area de servicos', 'area servico', 'area servicos', 'area de serv', 'area serv', 'ar servico', 'ar de servico', 'ar serv', 'a servico', 'a de servico', 'a serv', 'a s', 'as', 'servico', 'servicos', 'serv', 'area de apoio', 'area tecnica', 'area de lavar', 'lavanderia', 'lavanderias', 'lavand', 'tanque', 'varal', 'servico externo', 'area de servico externa']],
  ['Dependência', ['dependencia', 'dependencias', 'dep', 'dep empregada', 'dependencia de empregada', 'dependencia empregada', 'dependencia completa', 'edicula', 'edícula', 'casa de hospedes', 'casa de apoio']],
  ['Escritório', ['escritorio', 'escritorios', 'home office', 'homeoffice', 'office', 'biblioteca', 'estudio', 'atelie', 'ateliê', 'sala de trabalho', 'consultorio']],
  ['Hall', ['hall', 'hall de entrada', 'hall social', 'hall de servico', 'hall dos elevadores', 'hall elevador', 'entrada', 'entradas', 'recepcao', 'vestibulo', 'foyer', 'antessala', 'antecamara', 'portaria', 'guarita']],
  ['Circulação', ['circulacao', 'circulacoes', 'corredor', 'corredores', 'passagem', 'galeria', 'escada', 'escadas', 'escadaria', 'rampa', 'patamar', 'elevador', 'elevadores', 'mezanino', 'mezanino interno']],
  ['Garagem', ['garagem', 'garagens', 'gar', 'vaga', 'vagas', 'estacionamento', 'carport', 'cobertura de garagem']],
  ['Área externa', ['area externa', 'areas externas', 'area externa frente', 'jardim', 'jardins', 'jd', 'jard', 'quintal', 'quintais', 'paisagismo', 'gramado', 'pomar', 'horta', 'calcada', 'calcadas', 'frente', 'fundos', 'lateral', 'recuo', 'muro', 'muros', 'portao', 'portoes', 'cerca', 'fachada', 'fachadas', 'frontal', 'area livre', 'patio', 'pateo', 'area descoberta', 'area coberta']],
  ['Lazer', ['piscina', 'piscinas', 'pisc', 'spa', 'sauna', 'academia', 'sala de ginastica', 'brinquedoteca', 'playground', 'salao de festas', 'salao de jogos', 'salao', 'quadra', 'area de lazer', 'espaco de lazer', 'lazer', 'sala de massagem', 'ofuro', 'jacuzzi', 'hidromassagem', 'deck molhado', 'prainha']],
  ['Adega e despensa', ['adega', 'adegas', 'despensa', 'despensas', 'deposito', 'depositos', 'dep material', 'almoxarifado', 'armazem', 'sotao', 'porao', 'subsolo', 'cave', 'rouparia', 'armario', 'armarios', 'closet de servico']],
  ['Cobertura', ['cobertura', 'coberturas', 'cob', 'laje', 'lajes', 'telhado', 'telhados', 'terraco tecnico', 'casa de maquinas', 'caixa dagua', 'caixa d agua', 'reservatorio', 'rooftop', 'platibanda', 'calha', 'calhas', 'forro externo']],
  ['Geral da casa', ['areas comuns', 'area comum', 'ambientes', 'ambiente', 'comodo', 'comodos', 'casa toda', 'toda a casa', 'todos os ambientes', 'apartamento todo', 'pavimento', 'pavimento terreo', 'terreo', '1o pavimento', '2o pavimento', 'andar', '1o andar', '2o andar', 'andar superior', 'andar inferior', 'piso superior', 'piso inferior', 'pavimento superior', 'pavimento inferior']],
];

// palavras que podem aparecer junto do cômodo sem mudar o fato de ser cômodo ("Quarto de casal 2", "Banheiro social A", "Sala e cozinha")
const LIGACAO = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'em', 'no', 'na', 'nos', 'nas', 'com', 'para']);
const QUALIF = new Set(['social', 'servico', 'servicos', 'principal', 'master', 'casal', 'solteiro', 'hospede', 'hospedes', 'visita', 'visitas', 'empregada', 'empregado', 'infantil', 'bebe', 'externo', 'externa', 'interno', 'interna', 'superior', 'inferior', 'frente', 'fundos', 'lateral', 'direito', 'direita', 'esquerdo', 'esquerda', 'cima', 'baixo', 'terreo', 'andar', 'pavimento', 'unidade', 'apoio', 'completo', 'completa', 'novo', 'nova', 'velho', 'velha', 'antigo', 'antiga', 'primeiro', 'segundo', 'terceiro', 'quarto', 'comum', 'comuns', 'estar', 'jantar', 'tv', 'gourmet', 'americana', 'americano', 'grande', 'pequeno', 'pequena']);

// índice: variação normalizada → canônico; e lista de variações por tamanho (maior primeiro) para casar a mais longa
const MAPA = new Map();
for (const [canon, vars] of GRUPOS) for (const v of vars) { const k = norm(v); if (k && !MAPA.has(k)) MAPA.set(k, canon); }
const CHAVES = [...MAPA.keys()].map((k) => k.split(' ')).sort((a, b) => b.length - a.length);
const semS = (t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t);
const ehNumero = (t) => /^\d{1,3}[oa]?$/.test(t) || /^[ivx]{1,4}$/.test(t) || /^[a-z]$/.test(t);

// Reconhece o assunto como cômodo. Devolve o nome canônico do primeiro cômodo ("Área de serviço", "Cozinha"…) ou '' se não for cômodo.
export function comodoDe(assunto) {
  const toks = norm(assunto).split(' ').filter(Boolean);
  if (!toks.length || toks.length > 8) return '';
  let i = 0; let primeiro = ''; let comodos = 0;
  while (i < toks.length) {
    let achou = false;
    for (const ch of CHAVES) {   // ordem: variações mais longas primeiro
      if (i + ch.length > toks.length) continue;
      if (ch.every((c, j) => toks[i + j] === c || semS(toks[i + j]) === semS(c))) {
        const canon = MAPA.get(ch.join(' ')); if (!primeiro) primeiro = canon; comodos++; i += ch.length; achou = true; break;
      }
    }
    if (achou) continue;
    const t = toks[i];
    // ligações e qualificadores só valem DEPOIS de um cômodo (nunca no começo): "de casal", "social", "2", "B"
    if (comodos && (LIGACAO.has(t) || QUALIF.has(t) || QUALIF.has(semS(t)) || ehNumero(t))) { i++; continue; }
    return '';
  }
  return comodos ? primeiro : '';
}
export const ehComodo = (assunto) => !!comodoDe(assunto);

// "ASSUNTO, o que fazer" → ASSUNTO (mesma regra da lista de tarefas: até a primeira vírgula, curto)
export const assuntoDaDescricao = (desc) => { const s = String(desc || ''); const i = s.indexOf(','); return i > 0 && i < 60 ? s.slice(0, i).trim() : ''; };
export const pendenciaDaObra = (desc) => ehComodo(assuntoDaDescricao(desc));
export const COMODOS_CANONICOS = GRUPOS.map(([c]) => c);
