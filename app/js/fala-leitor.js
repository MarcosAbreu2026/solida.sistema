// Leitor de reunião falada: transforma a transcrição (gravada ao vivo ou colada) ou um resumo em tópicos num rascunho de ata,
// separando PENDÊNCIA (ação: verbo, responsável, prazo) de INFORMATIVO (o que foi dito/decidido), no padrão da ata Sólida:
// cada item é "ASSUNTO, descritivo". Sem IA paga (regra do projeto): são regras de leitura; o rascunho sempre passa por conferência.
//  - Resumo em tópicos (títulos com #, itens com "-", seção "Próximos passos"): lê a estrutura; é o caso mais exato.
//  - Fala corrida (transcrição): acha as frases de ação e as informações relevantes, acompanhando a obra de que se está falando.
import { acharPrazo, acharResponsavel } from './ata-leitor.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cap1 = (s) => { const t = String(s || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; };
const VERBOS_INF = 'enviar|mandar|cobrar|verificar|conferir|fazer|entregar|definir|agendar|marcar|revisar|atualizar|comprar|solicitar|pedir|providenciar|criar|contratar|confirmar|ligar|retornar|alinhar|preparar|organizar|passar|levar|buscar|trocar|corrigir|instalar|medir|orçar|lançar|cadastrar|reunir|acompanhar|validar|aprovar|programar|resolver|ver|checar|emitir|cotar|negociar|imprimir|publicar|separar|retirar|devolver|lembrar|analisar|finalizar|concluir|incluir|protocolar|formalizar|regularizar|reforçar|treinar|divulgar|montar|rever|ajustar|avisar|informar|responder|encaminhar|repassar|levantar|registrar|reenviar|trazer|identificar|deixar|incluir|apresentar|fechar|botar|colocar|pautar';
const RE_INICIA_VERBO = new RegExp(`^(?:${VERBOS_INF})\\b`, 'iu');

// pessoas da equipe que podem ser citadas mesmo sem login no sistema
const EQUIPE = ['júlia', 'julia', 'simone', 'márcio', 'marcio', 'pedro', 'larissa', 'rose', 'enio', 'marcos', 'mariana', 'isabel', 'isabelle', 'paiva', 'anderson', 'leandro', 'letícia', 'leticia', 'carlos', 'wanderson', 'maurílio', 'augusto', 'taisa', 'thaissa'];
const CLIENTES = ['agatha', 'cliente'];
const ARQUITETURA = ['fernanda', 'bárbara', 'barbara', 'arquitetura', 'arquiteta', 'arquiteto'];

// assunto de cada frase pela palavra-chave (a primeira da lista que aparecer)
const ASSUNTOS = [
  [/marcenaria/i, 'MARCENARIA'], [/m[áa]rmore|granito|bancadas?|pedras?/i, 'MÁRMORE'], [/ar[- ]condicionado|climatiza/i, 'AR-CONDICIONADO'],
  [/luminárias?|luminarias?|ilumina[çc][ãa]o|light design/i, 'ILUMINAÇÃO'], [/esquadrias?/i, 'ESQUADRIAS'], [/blindex|blinx|cortina de vidro|vidro/i, 'VIDROS'],
  [/piscina/i, 'PISCINA'], [/vazamentos?/i, 'VAZAMENTOS'], [/dps|queda de luz|surto/i, 'DPS'], [/acabamento el[ée]trico|el[ée]trica|eletricista/i, 'ELÉTRICA'],
  [/textura|grafiato|grafiata/i, 'TEXTURA'], [/ralos?/i, 'RALOS'], [/lou[çc]as?|metais/i, 'LOUÇAS E METAIS'], [/espelhos?/i, 'ESPELHOS'], [/coifa/i, 'COIFA'],
  [/forro/i, 'FORRO'], [/rodap[ée]/i, 'RODAPÉ'], [/c[âa]meras?/i, 'CÂMERAS'], [/fachada|rufos?/i, 'FACHADA'], [/exaust[ãa]o/i, 'EXAUSTÃO'], [/inc[êe]ndio/i, 'INCÊNDIO'],
  [/divis[óo]rias?/i, 'DIVISÓRIAS'], [/paisagismo|vetor garden/i, 'PAISAGISMO'], [/aditivos?/i, 'ADITIVO'], [/cronograma/i, 'CRONOGRAMA'], [/planilha|lista de pend[êe]ncias/i, 'PENDÊNCIAS'],
  [/p[óo]s[- ]obra/i, 'PÓS-OBRA'], [/or[çc]amento/i, 'ORÇAMENTO'], [/projeto/i, 'PROJETO'], [/compras?|comprad/i, 'COMPRAS'], [/entrega/i, 'ENTREGA'], [/medi[çc][ãa]o/i, 'MEDIÇÃO'],
  [/prazos?/i, 'PRAZOS'], [/contrata[çc][ãa]o|contratad/i, 'CONTRATAÇÃO'], [/remax/i, 'REMAX'], [/acústic/i, 'ACÚSTICA'],
];
const topico = (t) => { for (const [re, nome] of ASSUNTOS) if (re.test(t)) return nome; return ''; };

const codigoObra = (digitos, obras) => (obras.find((o) => o.replace(/\D/g, '') === digitos) || '');

// quem faz: "Márcio deve fornecer…", "pedir pra Júlia botar…"; quem é só alvo ("cobrar Rafael") não é responsável
function quemFaz(frase, pessoas) {
  const re1 = frase.match(/(\p{Lu}[\p{L}]+)\s+(?:vai|vão|deve|devem|precisa|fica|tem que|tá|está)\b/u);
  const re2 = frase.match(/(?:pedir|pedi|pra|para)\s+(?:a\s+|à\s+)?(\p{Lu}[\p{L}]+)\s+(?:[\p{L}]+r)\b/u);
  const nome = (re1 && re1[1]) || (re2 && re2[1]);
  if (!nome) return {};
  const n = norm(nome);
  const p = acharResponsavel(nome, pessoas);
  if (p && p.id) return { responsavel: p.id };
  if (p && p.ambiguo) return { externoNome: nome, externoTipo: 'solida' };
  if (EQUIPE.map(norm).includes(n)) return { externoNome: nome, externoTipo: 'solida' };
  if (CLIENTES.includes(n)) return { externoNome: nome, externoTipo: 'cliente' };
  if (ARQUITETURA.map(norm).includes(n)) return { externoNome: nome, externoTipo: 'arquitetura' };
  return {};
}

// prazo da frase, entendendo também "reunião de sexta" e "até sexta"
function prazoDe(frase, hoje) {
  const m = norm(frase).match(/(?:reuniao de|antes de|antes da)\s+(segunda|terca|quarta|quinta|sexta)/);
  return acharPrazo(frase, hoje) || (m ? acharPrazo(`até ${m[1]}`, hoje) : '');
}

const limpaMd = (s) => String(s).replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
const semPontoFinal = (s) => String(s).replace(/[\s.;,]+$/u, '');

// monta o texto do item: "ASSUNTO, descritivo"
function montaItem({ kind, assunto, texto, item, quem = {}, prazo = '' }) {
  const ass = String(assunto || 'GERAL').replace(/,/g, ' ').trim().toLocaleUpperCase('pt-BR').slice(0, 50);
  return { kind, descricao: `${ass}, ${cap1(semPontoFinal(texto))}`, item, responsavel: quem.responsavel || '', externoNome: quem.externoNome || '', externoTipo: quem.externoTipo || '', externoCategoria: '', prazo: kind === 'pendencia' ? prazo : '' };
}

function envelope(pends, infos, obras, hoje, tipoReuniao = 'PLANEJAMENTO') {
  const itens = [...pends, ...infos].sort((a, b) => a.item - b.item);
  itens.forEach((x, i) => { x.item = i + 1; });
  const cods = new Set(itens.map((x) => (x.descricao.match(/^MO\d{3}\b/) || [])[0]).filter(Boolean));
  return { titulo: '', data: hoje, obra: cods.size === 1 ? obras.find((o) => o.toUpperCase() === [...cods][0]) || '' : '', obraForaDaLista: false, setor: '', participantes: [], resumo: '', pendencias: pends, informativosLista: infos, lidoDaTabela: false, informativos: infos.length, local: '', horario: '', tipoReuniao, deFala: true };
}

// ---------------------------------------------------------------- resumo em tópicos
export const pareceResumoEmTopicos = (texto) => (String(texto).match(/^\s*(?:#{1,6}\s|[-*•]\s)/gm) || []).length >= 5;

export function analisarResumo(texto, { pessoas = [], obras = [], hoje } = {}) {
  const linhas = String(texto || '').split(/\r?\n/);
  const pends = []; const infos = []; let n = 0; let secao = ''; let proximos = false; let ultimaPend = null; let paiObra = ''; let paiTitulo = ''; let paiAssunto = ''; let secaoObra = '';
  const obraDe = (t) => { const m = t.match(/\b(\d{3})\b/); return m ? codigoObra(m[1], obras) : ''; };
  for (const bruta of linhas) {
    const l = bruta.replace(/\t/g, '    ');
    const cab = l.match(/^\s*#{1,6}\s*(.+)$/);
    if (cab) { secao = limpaMd(cab[1]); proximos = /pr[óo]ximos passos|a[çc][õo]es|encaminhamentos|pend[êe]ncias a|tarefas/i.test(secao) && !/lista de pend/i.test(secao); paiObra = ''; paiTitulo = ''; paiAssunto = ''; secaoObra = (secao.match(/\b(\d{3})\b/) ? codigoObra(secao.match(/\b(\d{3})\b/)[1], obras) : ''); ultimaPend = null; continue; }
    const b = l.match(/^(\s*)(?:[-*•]|\d+[.)])\s+(.*)$/); if (!b) continue;
    const nivel = b[1].length >= 2 ? 1 : 0; const t = limpaMd(b[2]); if (t.length < 4) continue;
    const aposDoisPontos = t.includes(':') && t.indexOf(':') <= 30 ? t.slice(t.indexOf(':') + 1).trim() : '';
    const ehPend = proximos ? nivel === 0 : (RE_INICIA_VERBO.test(t) || (aposDoisPontos && RE_INICIA_VERBO.test(aposDoisPontos)));
    if (nivel === 0) {
      paiObra = obraDe(t.split(':')[0]) || (t.split(':')[0].length < 40 ? obraDe(t.split(':')[0]) : '');
      paiTitulo = '';
      const antesDoisPontos = t.includes(':') ? t.split(':')[0] : '';
      if (!proximos && antesDoisPontos && antesDoisPontos.length < 45 && !ehPend) paiTitulo = antesDoisPontos.replace(/\(.*?\)/g, '').replace(/^\d{3}\s*/, '').trim();
    }
    if (proximos && nivel === 1) {   // detalhe da pendência de cima: entra no descritivo e ajuda a achar prazo/responsável
      if (ultimaPend) { ultimaPend._extra.push(t); }
      continue;
    }
    const obra = obraDe(t) || paiObra || secaoObra;
    const prefixoObra = obra ? obra.toUpperCase() : '';
    const top = topico(t);
    const assunto = [prefixoObra, top || (nivel === 0 && paiTitulo ? paiTitulo : '') || (nivel === 1 ? paiAssunto : '') || (!prefixoObra ? secao : '')].filter(Boolean).join(' ') || secao;
    if (nivel === 0) paiAssunto = top;
    if (ehPend) {
      const limpo = t.replace(/\s*\((\d{3})\)\s*$/u, '').replace(/^enviar\b/i, 'Enviar');
      const p = { _extra: [], base: limpo, item: ++n, assunto, obra };
      pends.push(p); ultimaPend = p;
    } else {
      ultimaPend = null;
      const corpo = nivel === 0 && t.includes(':') ? t.slice(t.indexOf(':') + 1).trim() : t;
      if (corpo.length >= 8) infos.push(montaItem({ kind: 'informativo', assunto, texto: corpo, item: ++n }));
    }
  }
  const pendencias = pends.map((p) => {
    const todo = [p.base, ...p._extra].join('; ');
    const quem = quemFaz(todo, pessoas);
    return montaItem({ kind: 'pendencia', assunto: p.assunto, texto: p._extra.length ? `${p.base} — ${p._extra.map(semPontoFinal).join('; ')}` : p.base, item: p.item, quem, prazo: prazoDe(todo, hoje) });
  });
  return envelope(pendencias, infos, obras, hoje);
}

// ---------------------------------------------------------------- fala corrida (transcrição)
const RE_ACAO = new RegExp(`\\b(?:vou|vamos|tem que|temos que|precisa|precisamos|preciso|deve|devemos|a gente (?:vai|precisa|tem|deve)|vai precisar|importante)\\b[^.?!]{0,40}?\\b(?:${VERBOS_INF})\\b`, 'iu');
const RE_PASSADO = /\b(?:j[áa] (?:foi|fiz|fez|mandei|enviei|falei|conclu[íi]|entreg|comprad|instalad)|eu fiz|n[ãa]o foi|foi feito)\b/iu;
const RE_FATO = /\b(?:aprovad|aprovou|comprad|contratad|finaliz|entreg|instalad|execut|atras|previs|prazo|data|decidiram|resolvid|medi[çc]|desist|n[ãa]o vai (?:ser|ter)|chegou|chegando|pendente|falta|faltam|pronto|conclu[íi]d)\w*/iu;
const FILLER = /^(?:e |ent[ãa]o |a[ií] |tá |ta |n[ée] |mas |sim |n[ãa]o |ah |ó |olha |tipo |assim |bom |ok |okay |certo )+/iu;

export function analisarFala(texto, { pessoas = [], obras = [], hoje } = {}) {
  const frases = String(texto || '').replace(/\s+/g, ' ').split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.split(' ').length >= 6);
  const pends = []; const infos = []; const vistos = new Set(); let ctx = ''; let n = 0;
  const obrasNums = obras.map((o) => o.replace(/\D/g, '')).filter(Boolean);
  for (const f0 of frases) {
    const nums = [...new Set((f0.match(/\b\d{3}\b/g) || []).filter((d) => obrasNums.includes(d)))];
    if (nums.length === 1) ctx = codigoObra(nums[0], obras);          // frase de uma obra só: passa a ser o contexto
    else if (nums.length === 2 && f0.split(' ').length < 14) ctx = codigoObra(nums[0], obras);
    const f = f0.replace(FILLER, '').replace(FILLER, '');
    const chave = norm(f).slice(0, 48); if (vistos.has(chave)) continue;
    const t = topico(f); const acao = RE_ACAO.test(f) && !RE_PASSADO.test(f); const fato = RE_FATO.test(f) && (t || ctx);
    if (!acao && !fato) continue;
    if (!t && !nums.length && !acao) continue;
    vistos.add(chave);
    const assunto = [ctx ? ctx.toUpperCase() : '', t].filter(Boolean).join(' ') || 'GERAL';
    const texto2 = f.length > 230 ? `${f.slice(0, 230).replace(/\s+\S*$/, '')}…` : f;
    if (acao) pends.push(montaItem({ kind: 'pendencia', assunto, texto: texto2, item: ++n, quem: quemFaz(f, pessoas), prazo: prazoDe(f, hoje) }));
    else infos.push(montaItem({ kind: 'informativo', assunto, texto: texto2, item: ++n }));
    if (n >= 90) break;
  }
  return envelope(pends, infos, obras, hoje);
}

export function analisarReuniao(texto, opc) { return pareceResumoEmTopicos(texto) ? analisarResumo(texto, opc) : analisarFala(texto, opc); }
