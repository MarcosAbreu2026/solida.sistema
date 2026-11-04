// Contas por obra usadas no Início, em Operações e na página da obra (desenho do Marcos).
// Só lê o que já existe (agentes, Drive, WhatsApp, celular da obra); o que não tem fonte volta null (a tela mostra traço).

import { obrasAcompanhadas, cronogramaDa, infoDoAgente, enderecoDa } from '../telas/operacao.js';
import { programacoes, registroDoDia, feriado } from '../programacao.js';
import { efetivoDoDia } from '../analise-medicoes.js';
import { somarDias, inicioDaSemana } from '../datas.js';
import { alertasDoAgente } from '../telas/painel-dep.js';

export const lista = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);
const semAc = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// o grupo "Mo565" vale para a obra Mo565D (e vice-versa)
export const mesmaObra = (a, b) => { const x = semAc(a).replace(/\s.*$/, ''); const y = semAc(b).replace(/\s.*$/, ''); return !!x && !!y && (x === y || x.startsWith(y) || y.startsWith(x)); };
export const chaveDe = (mapa, cod) => Object.keys(mapa || {}).find((k) => k === cod) || Object.keys(mapa || {}).find((k) => mesmaObra(k, cod));

export const obrasDoPainel = (ctx) => obrasAcompanhadas(ctx.CFG, ctx.visiveis);
export const cronograma = (ctx, cod) => cronogramaDa(ctx.drive && ctx.drive.projetos, cod);
export const endereco = (ctx, cod) => enderecoDa(ctx.drive && ctx.drive.projetos, cod);
export const projetoDa = (ctx, cod) => (((ctx.drive && ctx.drive.projetos) || {}).obras || []).find((p) => p.obra === cod) || null;
export const revisao = (arquivo) => ((String(arquivo || '').match(/_R(\d+)/i) || [])[1] ? `R${String(arquivo).match(/_R(\d+)/i)[1]}` : '');
export const medicao = (ctx, cod) => infoDoAgente(ctx.CFG, 'operacao', cod, /medi[çc]/i);
export const diario = (ctx, cod) => infoDoAgente(ctx.CFG, 'operacao', cod, /di[áa]rio/i);
export const progDa = (ctx, cod) => programacoes(ctx.CFG).find((p) => mesmaObra(p.obra, cod)) || null;

// dia útil antes / depois (pula sábado, domingo e feriado)
const util = (d) => { const s = new Date(`${d}T12:00:00`).getDay(); return s !== 0 && s !== 6 && !feriado(d); };
export const diaUtil = (d, passo) => { let x = somarDias(d, passo); for (let i = 0; i < 10 && !util(x); i++) x = somarDias(x, passo); return x; };

// efetivo de um dia (Sólida + terceirizados) com o nome do grupo casado pelo código
export function efetivo(ctx, dia, cod) {
  const doDia = (ctx.efetivo && ctx.efetivo.dias && ctx.efetivo.dias[dia]) || {};
  const k = chaveDe(doDia, cod);
  const e = k ? efetivoDoDia(ctx.efetivo, dia, k) : { enviado: false, solida: 0, terceiros: 0, total: 0 };
  const bruto = k ? doDia[k] : null;
  return { ...e, hora: bruto ? bruto.hora || '' : '', nomes: bruto && bruto.solida ? lista(bruto.solida.nomes) : [], empresas: e.empresas || [] };
}
// o grupo da obra foi lido hoje? (o sistema só diz "não enviou" se leu)
export const efetivoLidoHoje = (ctx, cod) => { const l = (ctx.efetivo && ctx.efetivo.leituras) || {}; const k = chaveDe(l, cod); return k ? String(l[k]).slice(0, 10) === ctx.hoje : false; };

// itens de um dia: meta da programação + o que foi relatado (WhatsApp) + o que foi lançado no celular da obra
export function itensDoDia(ctx, cod, dia) {
  const p = progDa(ctx, cod);
  const prog = p ? (p.dias || []).find((d) => d.data === dia) : null;
  const reg = p ? registroDoDia(p, dia) : null;
  const cel = lista(ctx.celular).filter((r) => r.tipo === 'executado' && r.data === dia && mesmaObra(r.obra, cod));
  const itens = (prog ? prog.itens : []).filter((i) => i.item).map((i) => {
    const r = reg ? lista(reg.itens).find((x) => semAc(x.item) === semAc(i.item)) : null;
    const c = cel.find((x) => semAc(x.item) === semAc(i.item));
    const feito = c ? Number(c.valor) : r ? r.feito : undefined;
    let sit = null;
    if (feito === true || (typeof feito === 'number' && typeof i.meta === 'number' && i.meta > 0 && feito >= i.meta * 0.9)) sit = 'feito';
    else if (typeof feito === 'number' && feito > 0) sit = 'avancou';
    else if (feito === false || feito === 0) sit = 'nao';
    return { item: i.item, meta: typeof i.meta === 'number' ? i.meta : null, unidade: i.unidade || '', feito, sit, motivo: r && r.motivo };
  });
  return { itens, temProg: !!prog, relatou: !!reg && !reg.semRelatorio, registro: reg };
}

// aderência à meta da semana: itens com meta concluídos ÷ itens com resultado, nos dias já passados da semana
export function aderenciaSemana(ctx, cod) {
  const ini = inicioDaSemana(ctx.hoje); let tot = 0; let ok = 0;
  for (let i = 0; i < 5; i++) {
    const d = somarDias(ini, i); if (d >= ctx.hoje) break;
    for (const it of itensDoDia(ctx, cod, d).itens) { if (it.sit) { tot++; if (it.sit === 'feito') ok++; } }
  }
  return tot ? { valor: ok / tot, ok, tot } : null;
}

// alertas de todas as áreas (e do geral) que citam a obra
export function alertasDaObra(ctx, cod, { areas = null } = {}) {
  const fontes = [(ctx.CFG && ctx.CFG.geral) || {}, ...((ctx.CFG && ctx.CFG.areas) || []).filter((a) => !areas || areas.includes(a.id))];
  const re = new RegExp(`\\bM[oO]\\s?${cod.replace(/^Mo/i, '').replace(/[A-Z]$/i, '')}[A-Z]?\\b`, 'i');
  const vistos = new Set(); const out = [];
  for (const a of fontes) for (const x of lista(a.alertas)) {
    if (!x || !x.texto || (x.restrito && !ctx.veValores) || !re.test(x.texto) || vistos.has(x.texto)) continue;
    vistos.add(x.texto);
    const limpo = alertasDoAgente({ alertas: [x] }, { veValores: true })[0] || {};
    out.push({ nivel: x.nivel === 'critico' ? 'critico' : 'atencao', texto: limpo.texto || x.texto, resp: limpo.resp || '', obra: cod, area: a.id || 'geral' });
  }
  return out.sort((x, y) => (x.nivel === y.nivel ? 0 : x.nivel === 'critico' ? -1 : 1));
}

// pendências (atas e avulsas) da obra, abertas primeiro
export const pendenciasDaObra = (ctx, cod) => lista(ctx.pendencias).filter((p) => p.status !== 'cancelada' && p.na_lista !== false && mesmaObra(p.obra, cod))
  .sort((a, b) => (a.status === b.status ? String(a.prazo || '9').localeCompare(String(b.prazo || '9')) : a.status === 'aberta' ? -1 : 1));

// equipe da obra hoje (lista do RH / efetivo do dia): gestor, estagiário e encarregado
export function equipeDa(ctx, cod) {
  const fs = lista(ctx.CFG && (ctx.CFG.funcionariosRH || ctx.CFG.funcionarios)).filter((f) => mesmaObra(f.obra, cod));
  const de = (re) => fs.filter((f) => re.test(f.funcao || '')).map((f) => f.nome.split(' (')[0]);
  return { gestor: de(/gestor/i), estagiario: de(/estagi/i), encarregado: de(/encarreg/i) };
}
