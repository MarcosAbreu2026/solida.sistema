// Programação de cada obra por dia, a partir do que o agente de Planejamento publica no dados.json:
// - obra com meta diária (programacao.dias): usa a meta do dia como está;
// - obra só com programação/cronograma semanal: os itens CINZA (equipe Sólida) com quantidade são
//   divididos de segunda a sexta ("meta calculada"); os LARANJA (terceiros/fornecedores), os cinza sem
//   quantidade e os avisos ficam no contexto da semana ("na semana").
// A classificação cinza/laranja é automática (pelo que vem entre parênteses); o ideal é o agente
// mandar o tipo de cada item — ver docs/contrato-agentes.md.

import { somarDias } from './datas.js';
import { feriado } from './feriados.js';

export { feriado };

const DIAS_SEM = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const CONTAVEIS = /^(un|unid|pontos?|m[óo]dulos?|conjuntos?|p[çc]s?|pe[çc]as?|portas?)$/i;
const ano = () => String(new Date().getFullYear());

// "05 a 09/10" ou "28/09 a 02/10" → segunda-feira da semana (ISO)
function inicioSemana(txt) {
  const m = String(txt || '').match(/(\d{1,2})(?:\/(\d{1,2}))?\s*a\s*(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const mes = (m[2] || m[4]).padStart(2, '0');
  return `${ano()}-${mes}-${m[1].padStart(2, '0')}`;
}

const rotuloDia = (iso) => {
  const [a, m, d] = iso.split('-').map(Number);
  const ds = (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7;
  return `${DIAS_SEM[ds]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
};

// "Pintura do teto, 1ª demão: 27,6 m² (fecha o saldo)" → { item, meta, unidade, nota }
export function lerItem(texto) {
  const s = String(texto);
  const i = s.lastIndexOf(':');
  if (i < 0) return { item: s.trim(), meta: null, unidade: '', nota: '' };
  const item = s.slice(0, i).trim();
  const resto = s.slice(i + 1).trim();
  const m = resto.match(/^([\d.]*\d(?:,\d+)?)\s*([^(]*?)\s*(\(.*\))?$/);
  if (!m) return { item, meta: null, unidade: '', nota: resto };
  return { item, meta: num(m[1]), unidade: m[2].trim(), nota: (m[3] || '').replace(/[()]/g, '') };
}
const num = (s) => Number(String(s).replace(/\.(?=\d{3})/g, '').replace(',', '.'));

// Separa "(Sólida)", "(Humber)", "(fornecedor)"… do texto
function separarParte(texto) {
  const m = String(texto).match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!m) return { base: String(texto).trim(), parte: '' };
  return { base: m[1].trim(), parte: m[2].trim() };
}

export function classificar(texto) {
  const t = String(texto);
  if (/^(alerta|agendad|pendente)/i.test(t) || /pend[êe]ncias/i.test(t) || /conclu[ií]d/i.test(t)) return 'contexto';
  if (/^(compra|contrata|medi[çc][ãa]o de|entrega)/i.test(t)) return 'laranja';
  const { parte } = separarParte(t);
  if (parte) {
    if (/s[óo]lida/i.test(parte)) return 'cinza';
    if (/terceiriz|fornecedor|arquitetura/i.test(parte)) return 'laranja';
    if (/^\p{Lu}/u.test(parte)) return 'laranja';           // nome de empresa/pessoa de fora: (Humber), (KMK)
  }
  return 'cinza';
}

// Item do cronograma semanal: tenta achar uma quantidade única ("…: 12 m²", "instalação de 2,5 conjuntos")
function lerItemSemanal(texto) {
  const { base, parte } = separarParte(texto);
  const nota = parte && !/s[óo]lida/i.test(parte) ? parte : '';
  const i = base.lastIndexOf(':');
  const nome = i >= 0 ? base.slice(0, i).trim() : base;
  const resto = i >= 0 ? base.slice(i + 1).trim() : '';
  // unidades mais longas primeiro; fim da unidade = espaço, pontuação ou fim do texto (\b não funciona com ² e acentos)
  const qtds = [...resto.matchAll(/(\d+(?:[.,]\d+)?)\s*(m[óo]dulos?|conjuntos?|pontos?|pe[çc]as?|p[çc]s?|unid|un|m²|m2|m³|ml|kg|m)(?=$|[\s,;.)])/giu)];
  if (qtds.length === 1) {
    const q = qtds[0];
    const sobra = resto.replace(q[0], '').replace(/\s+(de|com)\s*$/i, '').replace(/^[,\s]+|[,\s]+$/g, '');
    return { item: sobra ? `${nome} — ${sobra}` : nome, meta: num(q[1]), unidade: q[2], nota };
  }
  return { item: base, meta: null, unidade: '', nota };
}

// Divide a quantidade da semana entre os n dias úteis
function dividir(total, unidade, n) {
  if (CONTAVEIS.test(unidade)) {
    const base = Math.floor(total / n);
    const resto = Math.round(total - base * n);
    return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
  }
  const d = Math.round((total / n) * 10) / 10;
  return Array(n).fill(d);
}

// Uma semana montada a partir do cronograma semanal: divide só pelos dias úteis (sem feriados)
function semanaDerivada(inicio, itensTexto) {
  const dias = [0, 1, 2, 3, 4].map((i) => {
    const data = somarDias(inicio, i);
    return { data, rotulo: rotuloDia(data), itens: [], calculada: true, feriado: feriado(data) };
  });
  const uteis = dias.filter((d) => !d.feriado);
  const naSemana = [];
  let sugerido = 0;
  for (const texto of itensTexto || []) {
    const tipo = classificar(texto);
    if (tipo !== 'cinza' || !uteis.length) { naSemana.push({ texto, tipo, ...(tipo !== 'contexto' ? lerItemSemanal(texto) : {}) }); continue; }
    const it = lerItemSemanal(texto);
    // sem quantidade: vai inteiro para um dia sugerido, revezando entre os dias úteis
    if (it.meta === null) {
      uteis[sugerido % uteis.length].itens.push({ ...it, calculada: true, ia: true, tipo: 'cinza' });
      sugerido++;
      continue;
    }
    // com quantidade: dividida entre os dias úteis (quantidade pequena fica só nos primeiros dias)
    dividir(it.meta, it.unidade, uteis.length).forEach((q, i) => {
      if (q > 0) uteis[i].itens.push({ ...it, meta: q, metaSemana: it.meta, diasUteis: uteis.length, calculada: true, ia: true, tipo: 'cinza' });
    });
  }
  return { inicio, dias, naSemana };
}

// Programação de todas as obras do planejamento, dia a dia
export function programacoes(CFG) {
  const plan = (CFG && CFG.areas.find((a) => a.id === 'planejamento')) || {};
  const sem = plan.semanas || {};
  const atual = inicioSemana(sem.atual);
  const proxima = inicioSemana(sem.proxima) || (atual && somarDias(atual, 7));
  // obra já concluída (ex.: demolição de uma semana) não entra em metas e produtividade
  const concluida = (o) => /conclu[ií]da|100% executada/i.test(`${(o.cronograma || {}).info || ''} ${(o.cronograma || {}).obs || ''}`);
  return (plan.porObra || []).filter((o) => !concluida(o)).map((o) => {
    const prog = o.programacao || {};
    const cron = o.cronograma || {};
    const diarios = (prog.dias || []).map((d) => {
      const m = String(d.dia).match(/(\d{2})\/(\d{2})/);
      const data = m ? `${ano()}-${m[2]}-${m[1]}` : null;
      return { rotulo: d.dia, data, itens: (d.itens || []).map((x) => ({ ...lerItem(x), tipo: 'cinza' })), calculada: false };
    }).filter((d) => d.data);

    const faseFinal = /pend[êe]ncias/i.test(`${prog.info || ''} ${cron.info || ''}`);
    const semanas = [];
    for (const [ini, itensSemana] of [[atual, cron.estaSemana], [proxima, cron.proximaSemana]]) {
      if (!ini) continue;
      // fase final: se a semana não trouxe pendência nova, as pendências abertas da última revisão continuam valendo
      let itens = itensSemana || [];
      const temServico = itens.some((t) => classificar(t) !== 'contexto');
      if (faseFinal && !temServico && ini !== atual) itens = [...(cron.estaSemana || []), ...itens];
      const fim = somarDias(ini, 6);
      const temDiaria = diarios.some((d) => d.data >= ini && d.data <= fim);
      const derivada = semanaDerivada(ini, itens);
      semanas.push({
        inicio: ini,
        fonte: temDiaria ? 'diaria' : ((itens || []).length ? 'semanal' : null),
        dias: temDiaria ? diarios.filter((d) => d.data >= ini && d.data <= fim) : derivada.dias,
        // na semana: laranja e avisos sempre; cinza não divisíveis só quando a semana veio do cronograma
        naSemana: derivada.naSemana.filter((x) => !temDiaria || x.tipo !== 'cinza'),
      });
    }
    // dias diários fora das duas semanas (ex.: semana passada) continuam valendo
    const cobertos = new Set(semanas.flatMap((s) => s.dias.map((d) => d.data)));
    const extras = diarios.filter((d) => !cobertos.has(d.data));
    let dias = [...extras, ...semanas.flatMap((s) => s.dias)];

    // Programação do dia postada no WhatsApp (lida na verificação diária) vale mais que a do painel
    const registros = ((CFG && CFG.whats) || []).filter((r) => r.obra === o.obra);
    for (const r of registros.filter((x) => (x.itens || []).length)) {
      dias = dias.filter((d) => d.data !== r.data);
      dias.push({
        data: r.data, rotulo: rotuloDia(r.data), calculada: false, fonte: 'whatsapp',
        itens: r.itens.map((x) => ({ item: x.item, meta: x.meta ?? null, unidade: x.unidade || '', nota: '', tipo: x.tipo || 'cinza', calculada: false })),
      });
    }
    return {
      obra: o.obra,
      info: prog.info || cron.info || '',
      obs: prog.obs || cron.obs || '',
      faseFinal,
      atualizada: prog.ok !== false && cron.ok !== false,
      semanas,
      registros,
      dias: dias.sort((a, b) => a.data.localeCompare(b.data)),
    };
  });
}

// Registro do WhatsApp (programação do dia, relatório diário, avisos) de uma obra num dia
export const registroDoDia = (p, data) => (p && p.registros ? p.registros.find((r) => r.data === data) : null);

// Semana (da programação) que contém o dia
export function semanaDoDia(p, dia) {
  return p && p.semanas.find((s) => dia >= s.inicio && dia <= somarDias(s.inicio, 6));
}
