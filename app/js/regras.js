// Regras de negócio do pós-obra — reproduzem as fórmulas da planilha
// "SL_Pos Obra_Controle Integrado_R01" (abas Cálculos, Cálculos Agenda, Obras, Serviços, Equipe, PJ).
// Ver docs/modulo-pos-obra.md. Qualquer mudança aqui deve continuar batendo com verificar.html.

import { ehData, noPeriodo, diasEntre, somarDias, inicioDaSemana } from './datas.js';

export const RECEITA = 'Receita (cobrança)';
export const ENCERRADAS = ['Concluído', 'Cancelado'];

// Prioridade da situação da obra (aba Obras, coluna E): a primeira que existir vence.
export const PRIORIDADE_SITUACAO = ['Execução', 'Atrasado', 'Planejamento', 'Agendamento', 'Orçamento',
  'Análise', 'Fixo', 'Pausado', 'Concluído', 'Cancelado'];
export const SITUACOES_ABERTAS = PRIORIDADE_SITUACAO.filter((s) => !ENCERRADAS.includes(s));

const minusc = (s) => String(s).toLocaleLowerCase('pt-BR');
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
const ehLetra = (c) => !!c && /[\p{L}\p{N}]/u.test(c);

// ---------------------------------------------------------------- Equipe

// Equipe!M: "genérico" = nome com parênteses ou vínculo Terceirizado → conta 1 por menção, não divide.
function prepararEquipe(equipe) {
  return equipe
    .filter((e) => e.profissional)
    .map((e) => {
      const nome = e.profissional;
      return {
        ...e,
        nome,
        termos: [nome, e.apelido_1, e.apelido_2].filter(Boolean).map(minusc),
        // a marcação de falta/atestado só é procurada com o nome principal (igual à planilha)
        ausencias: [`${nome} (falta)`, `${nome} (atestado)`].map(minusc),
        generico: nome.includes('(') || e.vinculo === 'Terceirizado',
        diaria: num(e.valor_diaria),
        diariaInformada: typeof e.valor_diaria === 'number',
      };
    });
}

// SEARCH do Excel: trecho de texto, sem diferenciar maiúsculas; acentos contam.
// Devolve também se só casou no meio de outra palavra (ex.: "Bil" em "mobilizar").
// Casar no começo da palavra é normal: os apelidos servem para pegar erros como "Nasciemento".
function procurar(pessoa, textoMin) {
  let achou = false;
  let inicioDePalavra = false;
  for (const t of pessoa.termos) {
    let i = textoMin.indexOf(t);
    while (i >= 0) {
      achou = true;
      if (!ehLetra(textoMin[i - 1])) inicioDePalavra = true;
      i = textoMin.indexOf(t, i + 1);
    }
  }
  if (!achou) return null;
  const ausente = pessoa.ausencias.some((a) => textoMin.includes(a));
  return { ausente, ambiguo: !inicioDePalavra };
}

// ---------------------------------------------------------------- Agenda

// Para cada célula da agenda: quem foi reconhecido, quanto de diária e custo ela gera.
// Cálculos Agenda, linhas 5-64: N = em quantas obras a pessoa aparece no dia (sem falta/atestado).
// Linhas 105-184: diária da célula = Σ (genérico ? 1 : 1/N); custo = Σ diária × valor.
function analisarAgenda(agenda, equipe) {
  const entradas = agenda
    .filter((a) => a.obra && ehData(a.data) && a.texto)
    .map((a) => {
      const textoMin = minusc(a.texto);
      const pessoas = [];
      const ausentes = [];
      equipe.forEach((p) => {
        const r = procurar(p, textoMin);
        if (!r) return;
        if (r.ausente) ausentes.push(p.nome);
        else pessoas.push({ pessoa: p, ambiguo: r.ambiguo });
      });
      return { ...a, pessoas, ausentes, diarias: 0, custo: 0 };
    });

  // N por pessoa por dia
  const n = new Map(); // `${data}|${nome}` → contagem
  for (const e of entradas) {
    for (const { pessoa } of e.pessoas) {
      const k = `${e.data}|${pessoa.nome}`;
      n.set(k, (n.get(k) || 0) + 1);
    }
  }
  for (const e of entradas) {
    for (const item of e.pessoas) {
      const nDia = n.get(`${e.data}|${item.pessoa.nome}`);
      item.fracao = item.pessoa.generico ? 1 : 1 / nDia;
      item.custo = item.fracao * item.pessoa.diaria;
      e.diarias += item.fracao;
      e.custo += item.custo;
    }
  }
  return { entradas, n };
}

// Equipe!G (via Cálculos Agenda LG5:LG64): próprio/PJ = 1 por dia em que aparece; genérico = soma das menções.
function diariasDaPessoa(base, pessoa, filtroData) {
  let d = 0;
  for (const [k, cont] of base.nPorPessoaDia) {
    const sep = k.indexOf('|');
    if (k.slice(sep + 1) !== pessoa.nome || !filtroData(k.slice(0, sep))) continue;
    d += pessoa.generico ? cont : 1;
  }
  return d;
}

// ---------------------------------------------------------------- Serviços (OS)

function statusPrazo(os, hoje) {
  if (ENCERRADAS.includes(os.situacao)) return 'Encerrado';
  if (!ehData(os.prazo)) return 'Sem prazo';
  if (os.prazo < hoje) return 'Vencido';
  if (diasEntre(hoje, os.prazo) <= 7) return 'Vence em 7 dias';
  return 'No prazo';
}

function prepararServicos(servicos, hoje) {
  return servicos
    .filter((s) => s.obra)
    .map((s) => {
      const aberta = !ENCERRADAS.includes(s.situacao);
      return {
        ...s,
        aberta,
        diasAtraso: aberta && ehData(s.prazo) ? Math.max(0, diasEntre(s.prazo, hoje)) : null,
        statusPrazo: statusPrazo(s, hoje),
      };
    });
}

// ---------------------------------------------------------------- Obras

function situacaoDaObra(oss) {
  if (oss.length === 0) return 'Sem OS';
  for (const sit of PRIORIDADE_SITUACAO) {
    if (oss.some((o) => o.situacao === sit)) return sit;
  }
  return 'Sem situação';
}

// ---------------------------------------------------------------- Base

// Tudo que não depende do período escolhido. `hoje` = data usada no lugar de HOJE() da planilha.
export function montarBase(dados, hoje) {
  const equipe = prepararEquipe(dados.equipe || []);
  const servicos = prepararServicos(dados.servicos || [], hoje);
  const { entradas, n } = analisarAgenda(dados.agenda || [], equipe);
  const financeiro = (dados.financeiro || []).filter((f) => f.obra).map((f) => ({
    ...f,
    valor: num(f.valor),
    receita: f.tipo === RECEITA,
    quitado: f.pago_recebido === 'Sim',
  }));

  const obras = (dados.obras || []).filter((o) => o.obra).map((o, ordem) => {
    const oss = servicos.filter((s) => s.obra === o.obra);
    const abertas = oss.filter((s) => s.aberta);
    const prazos = abertas.map((s) => s.prazo).filter(ehData).sort();
    return {
      ...o,
      ordem,
      situacao: situacaoDaObra(oss),
      servicos: oss,
      abertas: abertas.length,
      proximoPrazo: prazos[0] || null,
    };
  });

  return {
    hoje,
    equipe,
    servicos,
    agenda: entradas,
    nPorPessoaDia: n,
    financeiro,
    obras,
    obraPorNome: new Map(obras.map((o) => [o.obra, o])),
    listas: dados.listas || {},
  };
}

// ---------------------------------------------------------------- Período (Dashboard)

export function resumoPeriodo(base, p) {
  const agendaP = base.agenda.filter((a) => noPeriodo(a.data, p));
  const finP = base.financeiro.filter((f) => noPeriodo(f.data, p));
  const concluidasP = base.servicos.filter((s) => s.situacao === 'Concluído' && noPeriodo(s.concluido_em, p));

  // Cálculos!A:N — uma linha por obra
  const porObra = base.obras.map((o) => {
    const ag = agendaP.filter((a) => a.obra === o.obra);
    const fin = finP.filter((f) => f.obra === o.obra);
    const diarias = soma(ag, 'diarias');
    const custoMO = soma(ag, 'custo');
    const custoLancado = soma(fin.filter((f) => !f.receita), 'valor');
    const receita = soma(fin.filter((f) => f.receita), 'valor');
    const custo = custoMO + custoLancado;
    const concluidos = concluidasP.filter((s) => s.obra === o.obra).length;
    const atividade = ag.length + fin.length + concluidos;
    return {
      obra: o, diarias, custoMO, custoLancado, custo, receita,
      margem: receita === 0 ? null : receita - custo,
      concluidos, atividade,
    };
  });

  // Resumo do período: só obras com atividade; ordem = mais diárias, depois mais OS abertas, depois ordem da lista
  const resumo = porObra
    .filter((r) => r.atividade > 0)
    .sort((a, b) => b.diarias - a.diarias || b.obra.abertas - a.obra.abertas || a.obra.ordem - b.obra.ordem);

  const custoMO = soma(agendaP, 'custo');
  const custoLancado = soma(finP.filter((f) => !f.receita), 'valor');
  const receita = soma(finP.filter((f) => f.receita), 'valor');
  const custo = custoMO + custoLancado;

  return {
    periodo: p,
    cards: {
      obrasComAtividade: resumo.length,
      servicosAbertos: base.obras.reduce((t, o) => t + o.abertas, 0),
      concluidosNoPeriodo: concluidasP.length,
      prazosVencidos: base.servicos.filter((s) => s.statusPrazo === 'Vencido').length,
      diarias: soma(agendaP, 'diarias'),
      custo,
      custoMO,
      custoLancado,
      receita,
      margem: receita === 0 ? null : receita - custo,
    },
    resumo,
    obrasPorSituacao: SITUACOES_ABERTAS.map((sit) => ({
      situacao: sit,
      obras: base.obras.filter((o) => o.situacao === sit).length,
    })),
    // Igual à planilha: as 8 semanas terminam na semana que contém o INÍCIO do período.
    diariasPorSemana: diariasPorSemana(base, inicioDaSemana(p.inicio), 8),
    avisoSemData:
      base.financeiro.some((f) => f.receita && !ehData(f.data)) ||
      base.servicos.some((s) => s.situacao === 'Concluído' && !ehData(s.concluido_em)),
  };
}

export function diariasPorSemana(base, ultimaSemana, qtd) {
  const out = [];
  for (let i = qtd - 1; i >= 0; i--) {
    const inicio = somarDias(ultimaSemana, -7 * i);
    const fim = somarDias(inicio, 6);
    const diarias = soma(base.agenda.filter((a) => a.data >= inicio && a.data <= fim), 'diarias');
    out.push({ inicio, fim, diarias });
  }
  return out;
}

// ---------------------------------------------------------------- Equipe e PJ

export function equipeNoPeriodo(base, p) {
  return base.equipe.map((pessoa) => {
    const diarias = diariasDaPessoa(base, pessoa, (d) => noPeriodo(d, p));
    const diariasTotal = diariasDaPessoa(base, pessoa, () => true);
    return {
      pessoa,
      diarias,
      custo: diarias * pessoa.diaria,
      diariasTotal,
      custoTotal: diariasTotal * pessoa.diaria,
    };
  });
}

// Aba PJ, "dias escalados por obra no período": dias em que a pessoa aparece na linha da obra
// (sem falta/atestado). O dia não é dividido entre obras.
export function diasPorObra(base, p, pessoas) {
  const nomes = new Set(pessoas.map((x) => x.nome));
  const mapa = new Map(); // obra → Map(nome → Set(datas))
  for (const a of base.agenda) {
    if (!noPeriodo(a.data, p)) continue;
    for (const { pessoa } of a.pessoas) {
      if (!nomes.has(pessoa.nome)) continue;
      if (!mapa.has(a.obra)) mapa.set(a.obra, new Map());
      const m = mapa.get(a.obra);
      if (!m.has(pessoa.nome)) m.set(pessoa.nome, new Set());
      m.get(pessoa.nome).add(a.data);
    }
  }
  return [...mapa].map(([obra, m]) => ({
    obra,
    dias: Object.fromEntries([...m].map(([nome, s]) => [nome, s.size])),
  }));
}

// ---------------------------------------------------------------- Financeiro

export function financeiroNoPeriodo(base, p) {
  const lanc = base.financeiro;
  const doPeriodo = lanc.filter((f) => noPeriodo(f.data, p));
  const receitas = doPeriodo.filter((f) => f.receita);
  const custos = doPeriodo.filter((f) => !f.receita);
  return {
    receitaPeriodo: soma(receitas, 'valor'),
    recebidoPeriodo: soma(receitas.filter((f) => f.quitado), 'valor'),
    custoLancadoPeriodo: soma(custos, 'valor'),
    pagoPeriodo: soma(custos.filter((f) => f.quitado), 'valor'),
    // saldos em aberto não dependem do período
    aReceber: soma(lanc.filter((f) => f.receita && !f.quitado), 'valor'),
    aPagar: soma(lanc.filter((f) => !f.receita && !f.quitado), 'valor'),
    semData: lanc.filter((f) => !ehData(f.data)),
  };
}

// ---------------------------------------------------------------- Avisos da agenda

// Menções que casaram só no meio de outra palavra — a planilha conta, mas podem estar erradas.
export function avisosDaAgenda(base) {
  const out = [];
  for (const a of base.agenda) {
    for (const item of a.pessoas) {
      if (item.ambiguo) out.push({ entrada: a, pessoa: item.pessoa });
    }
  }
  return out;
}

export function soma(lista, campo) {
  return lista.reduce((t, x) => t + (x[campo] || 0), 0);
}
