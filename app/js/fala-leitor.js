// Leitor de reunião falada: transforma a transcrição (gravada ao vivo ou colada) ou um resumo em tópicos num rascunho de ata,
// separando PENDÊNCIA (ação: verbo, responsável, prazo) de INFORMATIVO (o que foi dito/decidido), no padrão da ata Sólida:
// cada item é "ASSUNTO, descritivo". Sem IA paga (regra do projeto): são regras de leitura; o rascunho sempre passa por conferência.
//  - Resumo em tópicos (títulos com #, itens com "-", seção "Próximos passos"): lê a estrutura; é o caso mais exato.
//  - Fala corrida (transcrição): acha as frases de ação e as informações relevantes, acompanhando a obra de que se está falando.
import { acharPrazo, acharResponsavel, nomeCurto, papelCurto } from './ata-leitor.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cap1 = (s) => { const t = String(s || '').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; };
const VERBOS_INF = 'enviar|mandar|cobrar|verificar|conferir|fazer|entregar|definir|agendar|marcar|revisar|atualizar|comprar|solicitar|pedir|providenciar|criar|contratar|confirmar|ligar|retornar|alinhar|preparar|organizar|passar|levar|buscar|trocar|corrigir|instalar|medir|orçar|lançar|cadastrar|reunir|acompanhar|validar|aprovar|programar|resolver|ver|checar|emitir|cotar|negociar|imprimir|publicar|separar|retirar|devolver|lembrar|analisar|finalizar|concluir|incluir|protocolar|formalizar|regularizar|reforçar|treinar|divulgar|montar|rever|ajustar|avisar|informar|responder|encaminhar|repassar|levantar|registrar|reenviar|trazer|identificar|deixar|incluir|apresentar|fechar|botar|colocar|pautar';
const RE_INICIA_VERBO = new RegExp(`^(?:${VERBOS_INF})\\b`, 'iu');

// pessoas da equipe que podem ser citadas mesmo sem login no sistema
const EQUIPE = ['júlia', 'julia', 'simone', 'márcio', 'marcio', 'pedro', 'larissa', 'rose', 'enio', 'marcos', 'mariana', 'isabel', 'isabelle', 'paiva', 'anderson', 'leandro', 'letícia', 'leticia', 'carlos', 'wanderson', 'maurílio', 'augusto', 'taisa', 'thaissa'];
const CLIENTES = ['agatha', 'cliente'];
const ARQUITETURA = ['fernanda', 'bárbara', 'barbara', 'arquitetura', 'arquiteta', 'arquiteto'];

// O assunto de cada item é o TEMA GERAL, não o objeto (pedido do Marcos): "reforço da escada" → ESTRUTURA. A primeira regra que casar vale;
// o que é ação administrativa (pagamento, aditivo, contratação) vem antes dos temas de obra. Sem tema: GERAL.
const ASSUNTOS = [
  [/sistema novo|software|extens[ãa]o de navegador|supabase|dashboard|plataforma|bitrix|mais controle|conta azul|banco de dados/i, 'SISTEMAS'],
  [/pagamento|sinal de|estorno|nota fiscal|rejeito de nota|reembolso|boleto|fatura/i, 'FINANCEIRO'],
  [/aditivo|or[çc]amento|or[çc]ar|proposta(?!:)|desconto|consultoria|subtrativo/i, 'ORÇAMENTO E ADITIVOS'],
  [/contrata[çc][ãa]o|contratad|terceirizad|empreiteir|m[ãa]o de obra/i, 'CONTRATAÇÃO'],
  [/refor[çc]o|estrutur|laje|viga|pilar|funda[çc][ãa]o|concreto|alvenaria|demoli|enchimento|desn[íi]vel|calculista|engenheiro/i, 'ESTRUTURA'],
  [/impermeabil|vazament|infiltra|manta asf|goteira|umidade/i, 'IMPERMEABILIZAÇÃO'],
  [/el[ée]tric|eletricista|tomada|interruptor|disjuntor|fia[çc][ãa]o|dps|surto|queda de luz|lumin[áa]ria|ilumina[çc][ãa]o|light design|spots?|fitas? de led/i, 'ELÉTRICA E ILUMINAÇÃO'],
  [/hidr[áa]ulic|esgoto|ralos?|registros?|tubula[çc][ãa]o|sif[ãa]o|aquecedor|(?:^|[^\p{L}])g[áa]s(?![\p{L}])/iu, 'HIDRÁULICA E ESGOTO'],
  [/ar[- ]condicionado|climatiza|exaust[ãa]o|dutos?|ventokit|ventila/i, 'AR-CONDICIONADO E VENTILAÇÃO'],
  [/marcenaria|arm[áa]rios?|roupeiro|painel de madeira|madeira/i, 'MARCENARIA'],
  [/m[áa]rmore|granito|travertino|bancadas?|pedras?|marmoraria|soleira|peitoril/i, 'MÁRMORES E PEDRAS'],
  [/esquadrias?|vidros?|blindex|persianas?|janelas?|espelhos?|guarda[- ]corpo|cortina de vidro|porta de correr/i, 'ESQUADRIAS E VIDROS'],
  [/gesso|forro|drywall|sanca|tabica|teto|divis[óo]rias?/i, 'GESSO E FORRO'],
  [/pintura|textura|grafiato|massa corrida|selar|lixar|emass|ep[óo]xi/i, 'PINTURA E TEXTURA'],
  [/porcelanato|cer[âa]mica|piso|revestimento|rodap[ée]|rejunte|azulejo|assentamento/i, 'REVESTIMENTOS'],
  [/lou[çc]as?|metais|vaso sanit|torneira|cubas?|chuveiro/i, 'LOUÇAS E METAIS'],
  [/fachada|cobertura|telhado|rufos?|pingadeiro|calha|jardineira/i, 'FACHADA E COBERTURA'],
  [/piscina|paisagismo|jardim|deck|churrasqueira/i, 'ÁREA EXTERNA'],
  [/coifa|cooktop|forno|eletrodom[ée]stico|equipamentos?/i, 'EQUIPAMENTOS'],
  [/automa[çc][ãa]o|c[âa]meras?|fechadura|interfone|alarme|inc[êe]ndio|reconhecimento facial|seguran[çc]a/i, 'AUTOMAÇÃO E SEGURANÇA'],
  [/limpeza|dedetiza|descupiniza/i, 'LIMPEZA'],
  [/compras?|pedido|entrega|fornecedor|cota[çc][ãa]o|material|estoque|umber/i, 'COMPRAS E ENTREGAS'],
  [/medi[çc][ãa]o/i, 'MEDIÇÃO'],
  [/projeto|arquitet|dwg|detalh|planta|layout|compatibiliza/i, 'PROJETO'],
  [/cronograma|prazos?|atraso|programa[çc][ãa]o|planejamento|planilhas?|lista de pend/i, 'PLANEJAMENTO'],
  [/p[óo]s[- ]obra|garantia|manuten[çc][ãa]o|chamado/i, 'PÓS-OBRA'],
  [/e-?mail|formalizar|mensagem|relat[óo]rio|grupo/i, 'COMUNICAÇÃO'],
  [/reuni[ãa]o|pontinho|alinhamento|agendar/i, 'REUNIÃO'],
];
// o tema é o que aparece PRIMEIRO na frase ("reforço da escada" → ESTRUTURA; "sinal de pagamento dos espelhos" → FINANCEIRO)
const topico = (t) => {
  let melhor = ''; let pos = Infinity;
  for (const [re, nome] of ASSUNTOS) { const m = re.exec(t); if (m && m.index < pos) { pos = m.index; melhor = nome; } }
  return melhor;
};

const codigoObra = (digitos, obras) => (obras.find((o) => o.replace(/\D/g, '') === digitos) || '');

// quem faz: "Márcio deve fornecer…", "pedir pra Júlia botar…"; quem é só alvo ("cobrar Rafael") não é responsável
function quemFaz(frase, pessoas) {
  const re1 = frase.match(/(\p{Lu}[\p{L}]+)\s+(?:vai|vão|deve|devem|precisa|precisam|fica|tem que|tá|está|ficou de|ficam de)(?![\p{L}])/u);
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

// nomes de projeto que as pessoas usam no lugar do código da obra ("Remax" = Mo602)
const ALIAS_OBRA = [[/\bremax\b/i, '602'], [/maracuxi/i, '344'], [/\bpipa\b/i, '533'], [/l[úu]cio costa/i, '531'], [/cosme velho/i, '358'], [/bras[íi]lia/i, '566']];
const MESES = { jan: 1, feb: 2, fev: 2, mar: 3, apr: 4, abr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, ago: 8, sep: 9, set: 9, oct: 10, out: 10, nov: 11, dec: 12, dez: 12 };
const dd = (n) => String(n).padStart(2, '0');

// data da reunião no cabeçalho do resumo: "Tue, 03 Nov 26" ou "03/11/2026"
function dataDoCabecalho(linhas) {
  for (const l of linhas.slice(0, 8)) {
    let m = l.match(/\b(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{2,4})\b/);
    if (m && MESES[m[2].toLowerCase()]) { let a = Number(m[3]); if (a < 100) a += 2000; return `${a}-${dd(MESES[m[2].toLowerCase()])}-${dd(m[1])}`; }
    m = l.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
    if (m) { let a = Number(m[3]); if (a < 100) a += 2000; return `${a}-${dd(m[2])}-${dd(m[1])}`; }
  }
  return '';
}

// participantes pelos e-mails do cabeçalho: "solida.felipepaiva@gmail.com" → Felipe Paiva (Sólida); "yuri@aetheostech.com" → Yuri (Aetheostech)
function participantesDoCabecalho(linhas, pessoas) {
  const emails = linhas.slice(0, 8).join(' ').match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) || [];
  const primeiroDe = (nome) => norm(nome).replace(/\(.*?\)/g, ' ').split(/[\s.]+/).filter((t) => t.length >= 2)[0] || '';
  const vistos = new Set(); const lista = [];
  for (const e of emails) {
    const [user, dom] = e.toLowerCase().split('@');
    const interno = /solida/.test(dom) || /^solida\./.test(user);
    const limpo = user.replace(/^solida\./, '').replace(/[._-]+/g, '');
    if (interno) {
      const p = pessoas.find((x) => { const pn = primeiroDe(x.nome); return pn.length >= 3 && limpo.startsWith(pn); });
      const nome = p ? p.nome : cap1(limpo);
      if (!vistos.has(norm(nome))) { vistos.add(norm(nome)); lista.push({ nome, papel: 'Sólida' }); }
    } else {
      const nome = cap1(user.split(/[._-]/)[0]); const empresa = cap1(dom.split('.')[0]);
      if (!vistos.has(norm(nome))) { vistos.add(norm(nome)); lista.push({ nome, papel: empresa }); }
    }
  }
  return lista;
}

// "(Yuri)", "(Marcos)" no fim do próximo passo: quem faz. Pessoa da Sólida pelo nome inteiro primeiro; senão participante de fora
function donoDe(nome, pessoas, externos) {
  const n = norm(nome).replace(/[.]/g, '');
  const exato = pessoas.find((p) => norm(p.nome).replace(/[.]/g, '') === n);
  if (exato) return { responsavel: exato.id };
  const p = acharResponsavel(nome, pessoas);
  if (p && p.id) return { responsavel: p.id };
  if (p && p.ambiguo) return { externoNome: nome, externoTipo: 'solida' };
  if (EQUIPE.map(norm).includes(n)) return { externoNome: nome, externoTipo: 'solida' };
  if (CLIENTES.includes(n)) return { externoNome: nome, externoTipo: 'cliente' };
  if (ARQUITETURA.map(norm).includes(n)) return { externoNome: nome, externoTipo: 'arquitetura' };
  return { externoNome: nome, externoTipo: externos.includes(n) ? 'terceirizado' : 'terceirizado' };
}

// duas frases falam da mesma tarefa? (palavras de 5+ letras em comum, metade da menor frase)
const tokens = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 5));
function parecidas(a, b) {
  const A = tokens(a); const B = tokens(b); if (A.size < 2 || B.size < 2) return false;
  let c = 0; for (const w of A) if (B.has(w)) c++;
  return c >= 2 && c / Math.min(A.size, B.size) >= 0.5;
}
// frase que é uma ação: começa com verbo ("Montar aditivo") ou "Fulano deve/vai/precisa <verbo>"
const RE_NOME_DEVE = /^\p{Lu}[\p{L}]+\s+(?:deve|devem|vai|vão|precisa|precisam|tem que|fica de|ficou de|ficaram de)\s+\p{L}+r(?![\p{L}])/u;
const ehAcao = (t) => RE_INICIA_VERBO.test(t) || RE_NOME_DEVE.test(t);

export function analisarResumo(texto, { pessoas = [], obras = [], hoje } = {}) {
  const linhas = String(texto || '').split(/\r?\n/);
  const dataAta = dataDoCabecalho(linhas); const base = dataAta || hoje;   // "hoje", "amanhã" e "sexta" contam a partir do dia da reunião
  const h1 = (linhas.find((l) => /^\s*#\s+\S/.test(l)) || '').replace(/^\s*#\s+/, '').trim();
  const partic = participantesDoCabecalho(linhas, pessoas);
  const externos = partic.filter((p) => p.papel !== 'Sólida').map((p) => norm(p.nome));
  const pends = []; const infos = []; let n = 0; let secao = ''; let proximos = false; let ultimaPend = null; let paiObra = ''; let paiTitulo = ''; let paiAssunto = ''; let secaoObra = '';
  const obraDe = (t) => {
    const m = t.match(/\b(\d{3})\b/); const porNumero = m ? codigoObra(m[1], obras) : ''; if (porNumero) return porNumero;
    for (const [re, num] of ALIAS_OBRA) if (re.test(t)) return codigoObra(num, obras);
    return '';
  };
  for (const bruta of linhas) {
    const l = bruta.replace(/\t/g, '    ');
    const cab = l.match(/^\s*#{1,6}\s*(.+)$/);
    if (cab) {
      secao = limpaMd(cab[1]);
      // só é a lista de tarefas quando o título COMEÇA assim ("Próximos Passos"); "Pontos Técnicos e Próximos Passos" é conteúdo
      proximos = /^(?:pr[óo]ximos passos|a[çc][õo]es\b|encaminhamentos|tarefas|pend[êe]ncias a)/i.test(secao) && !/lista de pend/i.test(secao);
      paiObra = ''; paiTitulo = ''; paiAssunto = ''; secaoObra = obraDe(secao); ultimaPend = null; continue;
    }
    const b = l.match(/^(\s*)(?:[-*•]|\d+[.)])\s+(.*)$/); if (!b) continue;
    const nivel = b[1].length >= 2 ? 1 : 0; const t0 = limpaMd(b[2]); if (t0.length < 4) continue;
    if (proximos && nivel === 1) { if (ultimaPend) ultimaPend._extra.push(t0); continue; }   // detalhe do próximo passo de cima
    // uma linha com duas ações ("Montar aditivo; Márcio deve fornecer a explicação") vira duas
    const partes = !proximos ? t0.split(/;\s+/) : [t0];
    const trechos = partes.length > 1 && partes.slice(1).some(ehAcao) ? partes : [t0];
    for (const t of trechos) {
      const aposDoisPontos = t.includes(':') && t.indexOf(':') <= 30 ? t.slice(t.indexOf(':') + 1).trim() : '';
      const ehPend = proximos ? nivel === 0 : (ehAcao(t) || (aposDoisPontos && ehAcao(aposDoisPontos)));
      if (nivel === 0) {
        paiObra = obraDe(t.split(':')[0]);
        paiTitulo = '';
        const antesDoisPontos = t.includes(':') ? t.split(':')[0] : '';
        if (!proximos && antesDoisPontos && antesDoisPontos.length < 45 && !ehPend) paiTitulo = antesDoisPontos.replace(/\(.*?\)/g, '').replace(/^\d{3}\s*/, '').trim();
      }
      const obra = obraDe(t) || paiObra || secaoObra;
      const prefixoObra = obra ? obra.toUpperCase() : '';
      const top = topico(t) || (trechos.length > 1 ? topico(t0) : '');   // frase dividida em duas ações: o assunto vem da frase inteira
      const assunto = [prefixoObra, top || (nivel === 1 ? paiAssunto : '') || 'GERAL'].filter(Boolean).join(' ');
      if (nivel === 0) paiAssunto = top;
      if (ehPend) {
        let limpo = t.replace(/\s*\((\d{3})\)\s*$/u, '').replace(/^enviar\b/i, 'Enviar');
        let dono = '';
        const md = limpo.match(/\s*\(([^()]{2,40})\)\s*$/u);   // "(Yuri)": quem faz; "(Remax)": a obra
        if (md) { if (ALIAS_OBRA.some(([re]) => re.test(md[1]))) limpo = limpo.slice(0, md.index).trim(); else if (/^\p{Lu}/u.test(md[1])) { dono = md[1].trim(); limpo = limpo.slice(0, md.index).trim(); } }
        const p = { _extra: [], base: limpo, item: ++n, assunto, obra, dono, proximo: proximos };
        pends.push(p); ultimaPend = p;
      } else {
        ultimaPend = null;
        const corpo = nivel === 0 && t.includes(':') ? t.slice(t.indexOf(':') + 1).trim() : t;
        if (corpo.length >= 8) infos.push(montaItem({ kind: 'informativo', assunto, texto: corpo, item: ++n }));
      }
    }
  }
  // quando há "Próximos passos", ele manda: a ação do corpo que repete um próximo passo não vira outra pendência
  const lista = pends.filter((p) => p.proximo || !pends.some((q) => q.proximo && parecidas(p.base, [q.base, ...q._extra].join(' '))));
  const pendencias = lista.map((p) => {
    const todo = [p.base, ...p._extra].join('; ');
    const quem = p.dono ? donoDe(p.dono, pessoas, externos) : quemFaz(todo, pessoas);
    return montaItem({ kind: 'pendencia', assunto: p.assunto, texto: p._extra.length ? `${p.base} — ${p._extra.map(semPontoFinal).join('; ')}` : p.base, item: p.item, quem, prazo: prazoDe(todo, base) });
  });
  const r = envelope(pendencias, infos, obras, base);
  r.data = base; r.titulo = h1;
  r.participantes = partic.map((p) => `${nomeCurto(p.nome)} (${papelCurto(p.papel)})`);
  // tipo da reunião só com evidência: alguém de fora da Sólida participou → terceirizado; fala de cronograma/obras → planejamento
  r.tipoReuniao = externos.length ? 'TERCEIRIZADO' : /cronograma|planejamento|programa[çc][ãa]o|obras em andamento/i.test(texto) ? 'PLANEJAMENTO' : 'REUNIÃO';
  return r;
}

// ---------------------------------------------------------------- fala corrida (transcrição)
// Numa reunião, toda frase com conteúdo é uma de duas coisas: PENDÊNCIA (alguém vai fazer algo: verbo de ação no futuro/necessidade,
// pedido, combinado, prazo) ou INFORMATIVO (o que foi dito, decidido ou constatado). O que for conversa solta (teste de som,
// cumprimento, pergunta) fica de fora. O assunto vem da palavra-chave de obra/serviço ou, se não houver, da palavra principal da frase.
const RE_ACAO = new RegExp(`(?:\\b(?:vou|vamos|tenho que|tem que|temos que|têm que|preciso|precisamos|precisa|precisam|deve|devemos|devem|ficou de|fica de|fico de|ficamos de|combinamos de|combinado de|a gente (?:vai|precisa|tem que|deve)|vai precisar|vão precisar|importante|não esquecer de|lembrar de|é preciso|é necess[áa]rio|falta|faltam)\\b[^.?!]{0,60}?\\b(?:${VERBOS_INF}|[\\p{L}]{3,}(?:ar|er|ir))\\b|\\b(?:eu|a gente|nós|ele|ela|você|voc[êe]s)\\s+vai(?:mos)?\\s+(?:${VERBOS_INF})\\b|(?:^|[.;]\\s*)(?:${VERBOS_INF})\\b[^.?!]{3,}|\\b[\\p{Lu}][\\p{L}]+\\s+(?:vai|vão|fica|ficou|deve|precisa)\\s+(?:[\\p{L}]+r\\b))`, 'iu');
const RE_PASSADO = /\b(?:j[áa] (?:foi|fiz|fez|mandei|enviei|falei|conclu[íi]|entreg|comprad|instalad|resolvi)|eu fiz|n[ãa]o foi|foi feito|mandou|enviou|fez|fizemos)\b/iu;
const RE_LIXO = /\b(?:teste|testando|gravação|gravando|microfone|reconhecid|alô|bom dia|boa tarde|boa noite|obrigad[oa]|pode falar|vai falando)\b/iu;
const FILLER = /^(?:e |ent[ãa]o |a[ií] |tá |ta |n[ée] |mas |sim |n[ãa]o |ah |ó |olha |tipo |assim |bom |ok |okay |certo |bem |então, )+/iu;
const PARADAS = new Set(['varias', 'vários', 'varios', 'algumas', 'alguns', 'algumas', 'outros', 'outras', 'essas', 'esses', 'aquela', 'aquele', 'sobre', 'quando', 'depois', 'antes', 'ainda', 'também', 'tambem', 'porque', 'então', 'entao', 'assim', 'muito', 'muita', 'pouco', 'coisa', 'coisas', 'assunto', 'através', 'atraves', 'precisa', 'precisam', 'temos', 'estamos', 'estou', 'aqui', 'agora', 'hoje', 'ontem', 'amanhã', 'semana', 'tenho', 'fazer', 'proposta', 'cliente', 'segunda', 'terça', 'quarta', 'quinta', 'sexta'].map((w) => norm(w)));
const NOMES = new Set([...EQUIPE, ...CLIENTES, ...ARQUITETURA].map(norm));
// palavra principal da frase quando não há palavra-chave de obra/serviço (ignora verbos e palavras de ligação)
function palavraPrincipal(f) {
  for (const w of f.replace(/[.,;:!?()"]/g, ' ').split(/\s+/)) {
    const n = norm(w); if (n.length < 5 || PARADAS.has(n) || NOMES.has(n) || /(ando|endo|indo|ar|er|ir|ou|ei|am|em|ado|ido|mos|ava|ia)$/.test(n) || /^\d/.test(n)) continue;
    return w.toLocaleUpperCase('pt-BR');
  }
  return '';
}

export function analisarFala(texto, { pessoas = [], obras = [], hoje } = {}) {
  const frases = String(texto || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.split(' ').length >= 4);
  const pends = []; const infos = []; const vistos = new Set(); let ctx = ''; let n = 0;
  const obrasNums = obras.map((o) => o.replace(/\D/g, '')).filter(Boolean);
  for (const f0 of frases) {
    const nums = [...new Set((f0.match(/\b\d{3}\b/g) || []).filter((d) => obrasNums.includes(d)))];
    if (nums.length === 1) ctx = codigoObra(nums[0], obras);          // frase de uma obra só: passa a ser o contexto
    else if (nums.length === 2 && f0.split(' ').length < 14) ctx = codigoObra(nums[0], obras);
    const f = f0.replace(FILLER, '').replace(FILLER, '').trim(); if (f.split(' ').length < 4) continue;
    const chave = norm(f).slice(0, 48); if (vistos.has(chave)) continue;
    if (RE_LIXO.test(f)) continue;
    const pergunta = /\?$/.test(f) && !/\b(?:precisa|preciso|tem que|temos que)\b/i.test(f);
    if (pergunta) continue;
    vistos.add(chave);
    const acao = RE_ACAO.test(f) && !RE_PASSADO.test(f);
    const prazo = prazoDe(f, hoje);
    const t = topico(f) || 'GERAL';
    const assunto = [ctx ? ctx.toUpperCase() : '', t].filter(Boolean).join(' ') || 'GERAL';
    const texto2 = f.length > 230 ? `${f.slice(0, 230).replace(/\s+\S*$/, '')}…` : f;
    if (acao) pends.push(montaItem({ kind: 'pendencia', assunto, texto: texto2, item: ++n, quem: quemFaz(f, pessoas), prazo }));
    else infos.push(montaItem({ kind: 'informativo', assunto, texto: texto2, item: ++n }));
    if (n >= 120) break;
  }
  return envelope(pends, infos, obras, hoje);
}
export function analisarReuniao(texto, opc) { return pareceResumoEmTopicos(texto) ? analisarResumo(texto, opc) : analisarFala(texto, opc); }
