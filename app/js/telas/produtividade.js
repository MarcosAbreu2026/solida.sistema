// Metas e produtividade de cada obra.
// - Quadro do dia: duas colunas lado a lado, PROGRAMADO (meta) × EXECUTADO, com alerta dos itens que
//   não bateram a meta nos dias anteriores da mesma semana.
// - Quadro da semana: itens × segunda a sexta, cada célula com executado / meta e a cor da situação.
// Executado: o que o agente de Operação lê nos grupos de WhatsApp (campo `produtividade` da área
// operacao) e, enquanto isso não existe, o lançamento de teste.
// Edição (teste): só os itens da programação/meta do dia; abaixo da meta exige justificativa.

import { html, numero, data as fmtData } from '../formato.js';
import { hojeISO, somarDias, inicioDaSemana } from '../datas.js';
import { obrasDaPessoa, sessao, funcaoAtual } from '../sessao.js';
import { lerLancamentos, lerManual, lerVinculo } from '../armazenamento.js';
import { programacoes, semanaDoDia, registroDoDia, feriado } from '../programacao.js';

export { programacoes };

export const MOTIVOS = ['Falta de mão de obra', 'Falta de material', 'Procrastinação', 'Chuva / clima',
  'Serviço dependia de outra equipe', 'Mudança de prioridade', 'Outro'];

const norm = (s) => String(s || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const DIA_CURTO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
const NOME_DIA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export function fmtQtd(v, unidade) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Feito' : 'Não feito';
  return `${numero(Number(v))}${unidade ? ` ${unidade}` : ''}`;
}
const numeroQtd = (v) => (v === null || v === undefined || v === '' ? '—' : numero(Number(v)));

function situacao(meta, feito) {
  if (feito === null || feito === undefined || feito === '') return { cls: 'sem', txt: 'Sem registro' };
  if (feito === true) return { cls: 'ok', txt: 'Feito' };   // feito, mas o relatório não traz a quantidade
  if (meta === null) return feito ? { cls: 'ok', txt: 'Feito' } : { cls: 'abaixo', txt: 'Não feito' };
  if (Number(feito) >= meta) return { cls: 'ok', txt: 'Atingiu' };
  return { cls: 'abaixo', txt: `Abaixo (${Math.round((Number(feito) / meta) * 100)}%)` };
}

// Executado de um item. Ordem: lançado na tabela (correção de quem está na obra) > produtividade
// do WhatsApp > lançamento de teste antigo
function realizado(CFG, obra, data, item) {
  const m = lerManual(obra, data, item);
  if (m && m.feito !== undefined && m.feito !== null) return { ...m, origem: 'manual' };
  const w = (CFG.whats || []).find((r) => r.obra === obra && r.data === data);
  const wi = w && (w.itens || []).find((x) => norm(x.item) === norm(item));
  if (wi && wi.feito !== undefined && wi.feito !== null) return { ...wi, origem: 'WhatsApp' };
  const op = CFG.areas.find((a) => a.id === 'operacao') || {};
  const reg = (op.produtividade || []).find((r) => r.obra === obra && r.data === data);
  const ag = reg && (reg.itens || []).find((x) => norm(x.item) === norm(item));
  if (ag) return { ...ag, origem: 'WhatsApp' };
  const t = lerLancamentos()[`${obra}|${data}`];
  const lt = t && t.itens.find((x) => norm(x.item) === norm(item));
  return lt ? { ...lt, origem: 'teste' } : null;
}

// ---------------------------------------------------------------- cinza × laranja

export const SELO = {
  cinza: { cls: 'cinza', txt: 'CINZA · Equipe Sólida' },
  laranja: { cls: 'laranja', txt: 'LARANJA · Terceiros / fornecedor' },
  contexto: { cls: 'aviso', txt: 'AVISO' },
};
export const selo = (tipo) => html`<span class="selo selo-${SELO[tipo || 'cinza'].cls}">${SELO[tipo || 'cinza'].txt}</span>`;

// Caixa "Na semana": o que não tem dia definido, separado em cinza (Sólida) e laranja (terceiros)
export function naSemana(p, dia, { titulo = 'Na semana, sem dia definido' } = {}) {
  const s = semanaDoDia(p, dia);
  if (!s || !s.naSemana.length) return '';
  const grupo = (tipo, nome) => {
    const xs = s.naSemana.filter((x) => x.tipo === tipo);
    if (!xs.length) return '';
    return html`<div class="grupo-semana gs-${SELO[tipo].cls}"><div class="gs-tit">${nome}</div>
      <ul>${xs.map((x) => html`<li>${x.texto}</li>`)}</ul></div>`;
  };
  return html`<div class="na-semana"><div class="ns-tit">${titulo}</div>
    ${grupo('cinza', 'CINZA · Equipe Sólida')}
    ${grupo('laranja', 'LARANJA · Terceiros / fornecedores')}
    ${grupo('contexto', 'Avisos')}</div>`;
}

// ---------------------------------------------------------------- alertas da semana

// Dias anteriores (mesma semana) em que um item ficou abaixo da meta, ficou sem lançamento,
// ou em que a obra não mandou o relatório diário no grupo
export function pendenciasDaSemana(CFG, p, dia) {
  const ini = inicioDaSemana(dia);
  const abaixo = [];
  const semLancamento = [];
  const semRelatorio = (p.registros || []).filter((r) => r.semRelatorio && r.data >= ini && r.data < dia).map((r) => r.data);
  for (const d of p.dias.filter((x) => x.data >= ini && x.data < dia)) {
    if (semRelatorio.includes(d.data)) continue;   // já avisado como "relatório não enviado"
    for (const it of d.itens) {
      const r = realizado(CFG, p.obra, d.data, it.item);
      const st = situacao(it.meta, r ? r.feito : null);
      if (st.cls === 'abaixo') abaixo.push({ data: d.data, it, r });
      else if (st.cls === 'sem') semLancamento.push({ data: d.data, it });
    }
  }
  return { abaixo, semLancamento, semRelatorio };
}

// Aviso de que a divisão por dia foi feita pelo sistema (não veio programação diária da obra)
export const seloIA = () => html`<div class="selo-ia">🤖 <b>Distribuição por dia feita por IA</b> — a obra não tem programação diária; os serviços da semana foram divididos entre os dias úteis (feriados ficam de fora). Confira com o gestor.</div>`;

// Caixa que explica, em linguagem simples, por que a obra não tem meta por dia
function porQueSemMeta(p, dia, d) {
  const s = semanaDoDia(p, dia);
  let motivo;
  if (p.faseFinal) {
    motivo = `Obra em fase final: a programação virou a planilha de pendências (${p.info}). As pendências não têm data nem quantidade, então não dá para montar meta por dia.`;
  } else if (!s || !s.fonte) {
    motivo = `Não há programação desta semana no painel. A última que o agente de Planejamento leu é "${p.info}".`;
  } else if (d && !d.itens.length) {
    motivo = 'A programação desta semana não tem serviço da equipe Sólida com quantidade para dividir por dia; o que está programado aparece abaixo, em "Na semana".';
  } else {
    motivo = 'Sem programação para este dia.';
  }
  return html`<div class="sem-meta"><b>Sem meta por dia</b><p>${motivo}</p>
    ${p.obs ? html`<p class="pequeno">Observação do planejamento: ${p.obs}</p>` : ''}
    <p class="pequeno">Para ter meta por dia: o gestor posta as "Atividades do dia" no grupo da obra com as quantidades, ou o planejamento publica a meta diária.</p></div>`;
}

// Faixa do dia com o que veio do WhatsApp: de onde saiu a programação e o relatório, avisos, extras
function blocoWhats(reg) {
  if (!reg) return '';
  const fonte = [
    reg.programacao ? `Programação do dia: ${reg.programacao.titulo || 'WhatsApp'} (${reg.programacao.por}, ${reg.programacao.hora})` : 'Programação do dia não postada no grupo',
    reg.relatorio ? `Produtividade diária: ${reg.relatorio.por}, ${reg.relatorio.hora}` : null,
  ].filter(Boolean).join(' · ');
  return html`<div class="whats">
    <p class="whats-fonte">📱 WhatsApp · ${fonte}</p>
    ${reg.semRelatorio ? html`<div class="alerta-semana"><b>⚠ Produtividade diária não enviada no grupo</b></div>` : ''}
    ${(reg.avisos || []).length ? html`<ul class="whats-avisos">${reg.avisos.map((a) => html`<li>${a}</li>`)}</ul>` : ''}
    ${(reg.extras || []).length ? html`<div class="grupo-semana gs-aviso"><div class="gs-tit">${(reg.itens || []).length ? 'Feito fora da programação do dia' : 'Executado (produtividade diária)'}</div>
      <ul>${reg.extras.map((x) => html`<li>${x}</li>`)}</ul></div>` : ''}
  </div>`;
}

const nomeDia = (iso, hoje) => {
  if (iso === somarDias(hoje, -1)) return 'Ontem';
  const [a, m, d] = iso.split('-').map(Number);
  return NOME_DIA[(new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7];
};

function alertaItem(falhas, it, dia) {
  const minhas = falhas.filter((f) => norm(f.it.item) === norm(it.item));
  if (!minhas.length) return '';
  return html`<div class="im-alerta">⚠ ${minhas.map((f) => {
    if (f.it.meta === null) return html`<span>${nomeDia(f.data, dia)}: não feito${f.r.motivo ? ` (${f.r.motivo})` : ''}</span>`;
    const falta = typeof f.r.feito === 'number' ? f.it.meta - f.r.feito : null;
    return html`<span>${nomeDia(f.data, dia)}: ${fmtQtd(f.r.feito, f.it.unidade)} de ${fmtQtd(f.it.meta, f.it.unidade)}${falta > 0 ? ` — faltaram ${numero(Math.round(falta * 10) / 10)}` : ''}${f.r.motivo ? ` (${f.r.motivo})` : ''}</span>`;
  })}</div>`;
}

// ---------------------------------------------------------------- quadro do dia (programado × executado)

export function quadroDia({ CFG, p, dia, modo }) {
  const d = p.dias.find((x) => x.data === dia);
  const editar = modo === 'edicao';
  const { abaixo, semLancamento, semRelatorio } = pendenciasDaSemana(CFG, p, dia);
  const reg = registroDoDia(p, dia);
  const cab = html`<header class="cartao-cab"><h3>${p.obra}</h3><span class="pequeno">${d && d.fonte === 'whatsapp' ? 'programação do dia postada no WhatsApp' : p.info}</span></header>
    ${d && d.calculada && d.itens.length ? seloIA() : ''}${blocoWhats(reg)}`;

  // alerta no topo: o que não bateu a meta nos dias anteriores desta semana
  const itensAbaixo = [...new Set(abaixo.map((f) => f.it.item))];
  const topo = html`${semRelatorio.length ? html`<div class="alerta-semana"><b>⚠ Produtividade diária não enviada: ${semRelatorio.map((x) => nomeDia(x, dia).toLocaleLowerCase('pt-BR')).join(', ')}</b></div>` : ''}
    ${itensAbaixo.length ? html`<div class="alerta-semana"><b>⚠ Meta não batida nesta semana</b>
      <ul>${itensAbaixo.map((nome) => {
        const fs = abaixo.filter((f) => f.it.item === nome);
        return html`<li><b>${nome}</b> — ${fs.map((f) => (f.it.meta === null ? `${nomeDia(f.data, dia)}: não feito` : `${nomeDia(f.data, dia)} ${fmtQtd(f.r.feito, f.it.unidade)} de ${fmtQtd(f.it.meta, f.it.unidade)}`)).join(' · ')}</li>`;
      })}</ul></div>` : ''}
    ${semLancamento.length ? html`<p class="sem-lanc">${semLancamento.length} ${semLancamento.length > 1 ? 'itens' : 'item'} dos dias anteriores desta semana sem lançamento: ${[...new Set(semLancamento.map((x) => x.it.item))].join(', ')}.</p>` : ''}`;

  if (!d || !d.itens.length) return html`<article class="cartao">${cab}${topo}${porQueSemMeta(p, dia, d)}${naSemana(p, dia)}</article>`;

  const salvo = editar && lerLancamentos()[`${p.obra}|${dia}`];
  const linhas = d.itens.map((it, i) => {
    const r = editar ? null : realizado(CFG, p.obra, dia, it.item);
    const s = editar ? ((salvo && salvo.itens.find((x) => norm(x.item) === norm(it.item))) || {}) : {};
    const st = situacao(it.meta, r ? r.feito : null);
    const pct = r && it.meta ? Math.min(100, Math.round((Number(r.feito) / it.meta) * 100)) : (r && r.feito === true ? 100 : 0);

    const programado = html`<div class="qd-prog">
      <div class="im-topo">${selo(it.tipo)}</div>
      <b class="im-nome">${it.item}</b>
      <div class="im-num"><div><strong>${numeroQtd(it.meta)}</strong> <em>${it.meta === null ? '' : it.unidade}</em></div>
        ${it.calculada && it.metaSemana !== undefined ? html`<small>IA: semana ${fmtQtd(it.metaSemana, it.unidade)} ÷ dias</small>` : ''}
        ${it.calculada && it.meta === null ? html`<small>IA: dia sugerido (a programação não diz o dia)</small>` : ''}
        ${it.nota ? html`<small>${it.nota}</small>` : ''}</div>
    </div>`;

    const executado = editar
      ? html`<div class="qd-exec">
          ${it.meta === null
            ? html`<label class="check grande"><input type="checkbox" name="feito-${i}" ${s.feito ? html.seguro('checked') : ''}> Feito</label>`
            : html`<div class="im-input"><input type="number" min="0" step="any" inputmode="decimal" name="feito-${i}" value="${s.feito ?? ''}" placeholder="0" aria-label="Quanto foi feito de ${it.item}"> <em>${it.unidade}</em></div>`}
          <div class="lanc-motivo" ${s.motivo ? '' : html.seguro('hidden')}>
            <label>Por que ficou abaixo da meta?<select name="motivo-${i}"><option value="">Escolha o motivo…</option>${MOTIVOS.map((m) => html`<option ${m === s.motivo ? html.seguro('selected') : ''}>${m}</option>`)}</select></label>
            <label>Detalhe<input type="search" name="obs-${i}" value="${s.obs || ''}" placeholder="obrigatório em Outro"></label>
          </div>
        </div>`
      : html`<div class="qd-exec">
          <div class="im-num im-feito"><div><strong class="${r ? '' : 'vazio-num'}">${r ? (typeof r.feito === 'boolean' ? (r.feito ? 'Sim' : 'Não') : numeroQtd(r.feito)) : '—'}</strong> <em>${r && typeof r.feito !== 'boolean' ? it.unidade : ''}</em></div></div>
          <div class="im-status st-${st.cls}">${st.txt}</div>
          <div class="barra b-${st.cls}"><i style="width:${pct}%"></i></div>
          ${r && r.motivo ? html`<p class="im-motivo"><b>Motivo:</b> ${r.motivo}${r.obs ? ` — ${r.obs}` : ''}</p>` : ''}
          ${r && !r.motivo && r.obs ? html`<p class="im-obs">${r.obs}</p>` : ''}
          ${r && r.origem === 'teste' ? html`<small class="teste">lançamento de teste</small>` : ''}
          ${r && r.origem === 'WhatsApp' ? html`<small class="origem-whats">produtividade do WhatsApp</small>` : ''}
        </div>`;

    return html`<div class="qd-linha ${editar ? 'lanc' : ''}" data-i="${i}">${programado}${executado}${alertaItem(abaixo, it, dia)}</div>`;
  });

  const quadro = html`<div class="quadro-dia">
    <div class="qd-cab"><span>Programado</span><span>Executado</span></div>
    ${linhas}</div>`;

  return html`<article class="cartao">${cab}${topo}
    ${editar ? html`<form class="form-produtividade" data-obra="${p.obra}" data-dia="${dia}" autocomplete="off">
        ${quadro}
        <div class="acoes">
          <button type="submit" class="btn">Salvar (teste)</button>
          ${salvo ? html`<button type="button" class="btn2 apagar-lanc">Apagar teste</button>
            <span class="pequeno">Salvo por ${salvo.por} em ${fmtData(salvo.em.slice(0, 10))} ${salvo.em.slice(11, 16)}</span>` : ''}
          <span class="msg msg-lanc"></span>
        </div>
      </form>` : quadro}
    ${naSemana(p, dia)}</article>`;
}
export const cartaoDia = quadroDia;

// ---------------------------------------------------------------- quadro da semana

// Célula em edição (clicou numa célula já lançada para corrigir)
let celulaEmEdicao = null;
let somenteLeitura = false;   // ligado enquanto desenha o quadro em modo consulta (Operação)
export const editarCelula = (chave) => { celulaEmEdicao = chave; };
export const chaveCelula = (obra, data, item) => `${obra}|${data}|${item}`;

// Quanto ficou abaixo, em linguagem direta: "67% abaixo da meta"
function textoSituacao(meta, feito) {
  if (meta === null) return feito ? 'feito' : 'não feito';
  if (Number(feito) >= meta) return 'meta batida';
  return `${Math.round((1 - Number(feito) / meta) * 100)}% abaixo da meta`;
}

// Uma célula (item × dia): mostra o lançado ou a caixinha para lançar
function celula(CFG, p, data, it, hoje) {
  const r = realizado(CFG, p.obra, data, it.item);
  const chave = chaveCelula(p.obra, data, it.item);
  const futuro = data > hoje;
  const metaTxt = fmtQtd(it.meta, it.unidade);
  if (futuro) {
    return html`<td class="qs-cel qs-futuro"><span>${it.meta === null ? 'previsto' : `meta ${metaTxt}`}</span></td>`;
  }
  // modo consulta (Operação): só mostra, não deixa preencher
  if (somenteLeitura) {
    if (!r) return html`<td class="qs-cel qs-sem ${data === hoje ? 'qs-hoje' : ''}"><span>meta ${metaTxt}</span><em>sem lançamento</em></td>`;
    const st = situacao(it.meta, r.feito);
    const valor = typeof r.feito === 'boolean' ? (r.feito ? '✓' : '✕') : numeroQtd(r.feito);
    return html`<td class="qs-cel qs-${st.cls} ${data === hoje ? 'qs-hoje' : ''}" title="${r.obs || ''}">
      <strong>${valor}</strong>${it.meta !== null ? html`<span>de ${metaTxt}</span>` : ''}
      <b class="qs-situacao">${textoSituacao(it.meta, r.feito)}</b>
      ${r.motivo ? html`<em>${r.motivo}</em>` : (st.cls === 'abaixo' ? html`<em>sem justificativa</em>` : '')}
      ${r.obs ? html`<small class="qs-quem">${r.obs}</small>` : ''}
    </td>`;
  }
  const editando = celulaEmEdicao === chave;
  // ainda não lançado (ou corrigindo): caixinha para digitar o número e dar Enter
  if (!r || editando) {
    if (it.meta === null) {
      return html`<td class="qs-cel qs-sem ${data === hoje ? 'qs-hoje' : ''}">
        <span>sem quantidade</span>
        <div class="qs-sim-nao"><button type="button" data-lancar="${chave}" data-valor="1">✓ Feito</button><button type="button" data-lancar="${chave}" data-valor="0">✕ Não</button></div>
      </td>`;
    }
    return html`<td class="qs-cel qs-sem qs-entrada ${data === hoje ? 'qs-hoje' : ''}">
      <input type="number" min="0" step="any" inputmode="decimal" class="qs-input" data-cel="${chave}" data-meta="${it.meta}"
        value="${editando && r && typeof r.feito === 'number' ? r.feito : ''}" placeholder="${numeroQtd(it.meta)}" aria-label="Quanto foi feito de ${it.item} em ${data}">
      <span>meta ${metaTxt}</span>
      <em>digite e aperte Enter</em>
    </td>`;
  }
  // lançado: número grande, quanto ficou abaixo e motivo
  const st = situacao(it.meta, r.feito);
  const valor = typeof r.feito === 'boolean' ? (r.feito ? '✓' : '✕') : numeroQtd(r.feito);
  const precisaMotivo = st.cls === 'abaixo' && !r.motivo;
  return html`<td class="qs-cel qs-${st.cls} ${data === hoje ? 'qs-hoje' : ''}">
    <button type="button" class="qs-editar" data-editar="${chave}" title="Clique para corrigir">
      <strong>${valor}</strong>${it.meta !== null ? html`<span>de ${metaTxt}</span>` : ''}
      <b class="qs-situacao">${textoSituacao(it.meta, r.feito)}</b>
    </button>
    ${r.motivo ? html`<em>${r.motivo}</em>` : ''}
    ${precisaMotivo ? html`<select class="qs-motivo" data-motivo="${chave}" data-feito="${typeof r.feito === 'boolean' ? (r.feito ? '1' : '0') : r.feito}" data-bool="${typeof r.feito === 'boolean' ? '1' : ''}" aria-label="Motivo de ficar abaixo da meta"><option value="">por quê?</option>${MOTIVOS.map((m) => html`<option>${m}</option>`)}</select>` : ''}
    ${r.origem === 'WhatsApp' ? html`<small class="origem-whats">WhatsApp</small>` : ''}
  </td>`;
}

// Total programado na semana de um item (soma das metas dos dias)
function totalSemana(p, dias, base) {
  // item que veio da programação semanal: o total é o da semana, mesmo que algum dia tenha mudado
  if (base.metaSemana !== undefined) return fmtQtd(base.metaSemana, base.unidade);
  let total = 0;
  let algum = false;
  for (const data of dias) {
    const d = p.dias.find((x) => x.data === data);
    const it = d && d.itens.find((x) => norm(x.item) === norm(base.item));
    if (it && typeof it.meta === 'number') { total += it.meta; algum = true; }
  }
  if (!algum) return base.metaSemana !== undefined ? fmtQtd(base.metaSemana, base.unidade) : '—';
  return fmtQtd(Math.round(total * 100) / 100, base.unidade);
}

// Quadro da semana: itens (cinza e laranja) × segunda a sexta, com o programado da semana à esquerda.
// Itens sem dia definido aparecem na mesma tabela, sem caixinhas por dia.
export function quadroSemana({ CFG, p, ref, leitura = false }) {
  somenteLeitura = leitura;
  const ini = inicioDaSemana(ref);
  const dias = [0, 1, 2, 3, 4].map((i) => somarDias(ini, i));
  const hoje = hojeISO();
  const nomes = [];
  for (const d of p.dias.filter((x) => dias.includes(x.data))) {
    for (const it of d.itens) if (!nomes.find((n) => norm(n.item) === norm(it.item))) nomes.push(it);
  }
  const s = semanaDoDia(p, ini);
  const semDia = (s && s.naSemana) || [];
  const cab = html`<header class="cartao-cab"><h3>${p.obra}</h3><span class="pequeno">${p.info}</span></header>`;
  if (!nomes.length && !semDia.length) {
    return html`<article class="cartao cartao-largo">${cab}${porQueSemMeta(p, ini, null)}</article>`;
  }
  const porIA = p.dias.some((x) => dias.includes(x.data) && x.calculada && x.itens.length);
  const semProd = (p.registros || []).filter((r) => r.semRelatorio && dias.includes(r.data)).map((r) => r.data);

  let falhas = 0;
  const celFeriado = (data) => html`<td class="qs-cel qs-feriado" title="${feriado(data)}">feriado</td>`;
  const linhaItem = (base) => html`<tr>
    <td class="qs-item"><b>${base.item}</b>${base.nota ? html`<span class="pequeno">${base.nota}</span>` : ''}</td>
    <td class="qs-total">${totalSemana(p, dias, base)}</td>
    ${dias.map((data) => {
      const d = p.dias.find((x) => x.data === data);
      const it = d && d.itens.find((x) => norm(x.item) === norm(base.item));
      if (!it) return feriado(data) ? celFeriado(data) : html`<td class="qs-cel qs-vazia">—</td>`;
      const r = data <= hoje ? realizado(CFG, p.obra, data, it.item) : null;
      if (r && situacao(it.meta, r.feito).cls === 'abaixo') falhas++;
      return celula(CFG, p, data, it, hoje);
    })}
  </tr>`;
  // Sem dia definido: a pessoa escolhe o dia ("+ neste dia") e lança como os outros itens
  const linhaSemDia = (x) => {
    const it = { item: x.item || x.texto, meta: x.meta ?? null, unidade: x.unidade || '', tipo: x.tipo, nota: x.nota || '' };
    const dia = lerVinculo(p.obra, ini, x.texto);
    const ref = (data) => JSON.stringify({ o: p.obra, i: ini, t: x.texto, d: data });
    return html`<tr class="qs-sem-dia">
      <td class="qs-item"><b>${x.texto}</b>
        <span class="pequeno">${dia
          ? html`dia escolhido: ${DIA_CURTO[dias.indexOf(dia)] || ''} ${dia.slice(8, 10)}/${dia.slice(5, 7)}${leitura ? '' : html` · <button type="button" class="qs-link" data-vincular="${ref(null)}">tirar do dia</button>`}`
          : (leitura ? 'sem dia definido' : 'sem dia definido · escolha o dia em que vai ser feito')}</span></td>
      <td class="qs-total">${it.meta !== null ? fmtQtd(it.meta, it.unidade) : '—'}</td>
      ${dias.map((data) => {
        if (feriado(data)) return celFeriado(data);
        if (dia === data) {
          const r = data <= hoje ? realizado(CFG, p.obra, data, it.item) : null;
          if (r && situacao(it.meta, r.feito).cls === 'abaixo') falhas++;
          return celula(CFG, p, data, it, hoje);
        }
        if (dia) return html`<td class="qs-cel qs-vazia">—</td>`;
        if (leitura) return html`<td class="qs-cel qs-vazia">·</td>`;
        return html`<td class="qs-cel qs-vincular"><button type="button" data-vincular="${ref(data)}">+ neste dia</button></td>`;
      })}
    </tr>`;
  };
  const grupo = (tipo, titulo, itensDia, itensSemDia) => (itensDia.length || itensSemDia.length ? html`
    <tr class="qs-grupo gs-${SELO[tipo].cls}"><td colspan="7">${titulo}</td></tr>
    ${itensDia.map(linhaItem)}${itensSemDia.map(linhaSemDia)}` : '');

  const corpo = html`
    ${grupo('cinza', 'CINZA · Equipe Sólida', nomes.filter((n) => (n.tipo || 'cinza') === 'cinza'), semDia.filter((x) => x.tipo === 'cinza'))}
    ${grupo('laranja', 'LARANJA · Terceiros / fornecedores', nomes.filter((n) => n.tipo === 'laranja'), semDia.filter((x) => x.tipo === 'laranja'))}`;
  const avisos = semDia.filter((x) => x.tipo === 'contexto');

  return html`<article class="cartao cartao-largo">${cab}${porIA ? seloIA() : ''}
    ${semProd.length ? html`<div class="alerta-semana"><b>⚠ Produtividade diária não enviada: ${semProd.map((x) => `${DIA_CURTO[dias.indexOf(x)]} ${x.slice(8, 10)}/${x.slice(5, 7)}`).join(', ')}</b></div>` : ''}
    ${falhas ? html`<p class="alerta-linha">⚠ ${falhas} ${falhas > 1 ? 'vezes' : 'vez'} abaixo da meta nesta semana</p>` : ''}
    <div class="tabela-rolagem"><table class="quadro-semana">
      <thead><tr><th>Item</th><th class="qs-total">Programado<br>na semana</th>${dias.map((d, i) => html`<th class="${d === hoje ? 'qs-hoje' : ''}">${DIA_CURTO[i]} ${d.slice(8, 10)}/${d.slice(5, 7)}${feriado(d) ? html`<span class="qs-feriado-tit">feriado</span>` : ''}${semProd.includes(d) ? html`<span class="qs-sem-prod">sem produtividade</span>` : ''}</th>`)}</tr></thead>
      <tbody>${corpo}</tbody></table></div>
    ${avisos.length ? html`<ul class="whats-avisos">${avisos.map((a) => html`<li>${a.texto}</li>`)}</ul>` : ''}
    <p class="legenda-semana"><span class="lg lg-ok"></span> meta batida <span class="lg lg-abaixo"></span> abaixo da meta <span class="lg lg-sem"></span> ${leitura ? 'sem lançamento' : 'falta lançar'} <span class="lg lg-futuro"></span> ainda não chegou${leitura ? '' : ' · clique num número lançado para corrigir'}</p>
  </article>`;
}

// ---------------------------------------------------------------- chave e avisos

export const avisoTeste = (f) => html`<p class="aviso">Modo teste: mostra como vai ser o lançamento pelo sistema. O que você salvar fica só neste navegador e não muda o painel.
  Só dá para lançar os itens da programação ou da meta do dia; abaixo da meta pede justificativa.</p>
  ${!f.editaProdutividade ? html`<p class="pequeno">Na versão final, quem lança é o encarregado, o estagiário ou o gestor da obra.</p>` : ''}`;

export const chaveModo = (base, modo) => html`<div class="modo" role="group" aria-label="Modo">
  <a href="${base}${base.includes('?') ? '&' : '?'}modo=visualizacao" class="${modo !== 'edicao' ? 'on' : ''}">Visualização</a>
  <a href="${base}${base.includes('?') ? '&' : '?'}modo=edicao" class="${modo === 'edicao' ? 'on' : ''}">Edição (teste)</a>
</div>`;

const legendaTipos = () => html`<div class="legenda-tipos">${selo('cinza')} serviço da equipe Sólida, com meta por dia · ${selo('laranja')} terceiro ou fornecedor, vale para a semana</div>`;

// ---------------------------------------------------------------- telas (Meu dia e Operação usam as mesmas)

// Quadro do dia de várias obras, com a chave Visualização/Edição e a navegação por dia
export function telaDia({ CFG, progs, dia, modo, base, attrDia = 'data-dia' }) {
  const hoje = hojeISO();
  const nav = html`<div class="periodo">
    <button type="button" class="botao" ${html.seguro(attrDia)}="${somarDias(dia, -1)}">← Dia anterior</button>
    <div class="atual"><span>${NOME_DIA[(new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7]}</span><b>${fmtData(dia)}</b></div>
    ${dia !== hoje ? html`<button type="button" class="botao" ${html.seguro(attrDia)}="${hoje}">Hoje</button>` : ''}
    <button type="button" class="botao" ${html.seguro(attrDia)}="${somarDias(dia, 1)}">Próximo dia →</button>
    ${chaveModo(base, modo)}
  </div>`;
  return html`${nav}${modo === 'edicao' ? avisoTeste(funcaoAtual()) : ''}${legendaTipos()}
    <div class="cartoes">${progs.length ? progs.map((p) => quadroDia({ CFG, p, dia, modo })) : html`<p class="vazio">Nenhuma obra.</p>`}</div>`;
}

// Quadro da semana de várias obras, com navegação por semana
export function telaSemana({ CFG, progs, ref, attrSemana = 'data-semana-md' }) {
  const ini = inicioDaSemana(ref);
  const hoje = hojeISO();
  const nav = html`<div class="periodo">
    <button type="button" class="botao" ${html.seguro(attrSemana)}="${somarDias(ini, -7)}">← Semana anterior</button>
    <div class="atual"><span>Semana</span><b>${fmtData(ini).slice(0, 5)} a ${fmtData(somarDias(ini, 4)).slice(0, 5)}</b></div>
    ${hoje < ini || hoje > somarDias(ini, 6) ? html`<button type="button" class="botao" ${html.seguro(attrSemana)}="${hoje}">Esta semana</button>` : ''}
    <button type="button" class="botao" ${html.seguro(attrSemana)}="${somarDias(ini, 7)}">Próxima semana →</button>
  </div>`;
  return html`${nav}${legendaTipos()}
    <div class="cartoes cartoes-largos">${progs.length ? progs.map((p) => quadroSemana({ CFG, p, ref: ini })) : html`<p class="vazio">Nenhuma obra.</p>`}</div>`;
}

// ---------------------------------------------------------------- Operação › Metas e produtividade

// Situação de uma obra na semana (dias úteis já passados): produtividade enviada, metas, itens abaixo
// e o que o gestor deve fazer.
function situacaoObra(CFG, p, ini, hoje) {
  const dias = [0, 1, 2, 3, 4].map((i) => somarDias(ini, i));
  const passados = dias.filter((d) => d < hoje && !feriado(d));
  const reg = (d) => registroDoDia(p, d);
  const doDia = (d) => p.dias.find((x) => x.data === d);

  let lancados = 0;
  let batidos = 0;
  const abaixo = [];
  const comProd = [];
  const semProd = [];
  for (const d of passados) {
    const itens = (doDia(d) || {}).itens || [];
    let algum = false;
    for (const it of itens) {
      const r = realizado(CFG, p.obra, d, it.item);
      if (!r) continue;
      algum = true;
      lancados++;
      const st = situacao(it.meta, r.feito);
      if (st.cls === 'ok') batidos++;
      else if (st.cls === 'abaixo') abaixo.push({ d, it, r });
    }
    if ((reg(d) && reg(d).relatorio) || algum) comProd.push(d);
    else if ((reg(d) && reg(d).semRelatorio) || itens.length) semProd.push(d);
  }

  const semanaP = dias.map(doDia).filter(Boolean);
  const programacao = semanaP.some((x) => x.fonte === 'whatsapp') ? 'Atividades do dia (WhatsApp)'
    : semanaP.some((x) => x.calculada && x.itens.length) ? 'Semanal, dividida por IA'
    : p.faseFinal ? 'Pendências, sem data'
    : 'Sem programação';

  const nome = (d) => `${['segunda', 'terça', 'quarta', 'quinta', 'sexta'][dias.indexOf(d)]} (${d.slice(8, 10)}/${d.slice(5, 7)})`;
  const acoes = [];
  if (semProd.length) acoes.push(`Cobrar a produtividade diária de ${semProd.map(nome).join(', ')}`);
  if (programacao === 'Sem programação' || programacao === 'Pendências, sem data') acoes.push('Pedir a programação da semana com dia e quantidade');
  const porMotivo = (m) => abaixo.filter((a) => a.r.motivo === m);
  if (porMotivo('Falta de mão de obra').length) acoes.push(`Rever a equipe: ${porMotivo('Falta de mão de obra').map((a) => `${a.it.item} (${fmtQtd(a.r.feito, a.it.unidade)} de ${fmtQtd(a.it.meta, a.it.unidade)})`).join('; ')}`);
  if (porMotivo('Falta de material').length) acoes.push(`Verificar compra/entrega de material: ${porMotivo('Falta de material').map((a) => a.it.item).join('; ')}`);
  const semMotivo = abaixo.filter((a) => !a.r.motivo);
  if (semMotivo.length) acoes.push(`Pedir justificativa de ${semMotivo.length} ${semMotivo.length > 1 ? 'itens abaixo da meta' : 'item abaixo da meta'}`);
  if (programacao === 'Semanal, dividida por IA') acoes.push('Confirmar com o gestor da obra a divisão por dia feita por IA');

  const nivel = semProd.length || abaixo.length >= 3 ? 'critico'
    : abaixo.length || programacao === 'Sem programação' || programacao === 'Pendências, sem data' ? 'atencao' : 'ok';
  return { passados, comProd, semProd, lancados, batidos, abaixo, programacao, acoes, nivel };
}

const NIVEL_TXT = { ok: 'Em dia', atencao: 'Atenção', critico: 'Crítico' };

// Meta × executado da semana, por obra (painel do CEO, Início): dos itens programados com meta nos dias úteis já
// passados, quantos bateram a meta, ficaram abaixo ou ficaram sem registro; e, em cada dia útil, se a obra mandou a
// produtividade no grupo do WhatsApp. Estados do dia: enviada · nao (o agente leu o grupo e não havia) ·
// naolido (ainda não verificado no grupo) · hoje (dentro do prazo) · futuro · feriado.
// Obra em fase de pendências (sem meta por dia): vem do cronograma/programação ou do tipo da meta semanal
const ehPendencia = (CFG, p) => !!p.faseFinal || (((CFG.metasSemanais || {}).semanas || []).some((s) => (s.obras || []).some((o) => o.obra === p.obra && o.tipo === 'pendencias')));

// Obras fora do acompanhamento de metas (parada, finalizada): CFG.metasSemanais.ignorar
// Situação das obras vem do cadastro de obras (andamento · pausada · finalizada), que sócios e coordenação mudam no topo da página da obra.
// Sem o cadastro (modo local), vale metasSemanais.encerradas. Pausada aparece com a situação; finalizada some do painel.
export const obrasEncerradas = (CFG) => {
  const cad = CFG && CFG.obrasCad;
  if (Array.isArray(cad)) {
    const o = {};
    for (const r of cad) if (/^mo/i.test(r.codigo) && (r.situacao === 'pausada' || r.situacao === 'finalizada')) o[r.codigo] = r.situacao === 'pausada' ? 'Pausada' : 'Finalizada';
    return o;
  }
  return (CFG && CFG.metasSemanais && CFG.metasSemanais.encerradas) || {};
};
// situação de uma obra do painel (ex.: Mo565C): o código exato do cadastro vale mais; senão vale o cadastro da obra-mãe (Mo565)
export const situacaoDeObra = (CFG, cod) => {
  const cad = (CFG && CFG.obrasCad) || null;
  const rotulo = { andamento: '', pausada: 'Pausada', finalizada: 'Finalizada' };
  if (cad) {
    const exato = cad.find((r) => r.codigo === cod);
    if (exato) return rotulo[exato.situacao] || '';
    const mae = cad.find((r) => cod.startsWith(r.codigo) || r.codigo.startsWith(cod));
    return mae ? (rotulo[mae.situacao] || '') : '';
  }
  return obrasEncerradas(CFG)[cod] || '';
};
// Finalizada some do painel; pausada continua aparecendo, com a situação
export const obrasFinalizadas = (CFG) => Object.entries(obrasEncerradas(CFG)).filter(([, st]) => /finaliz|conclu/i.test(st)).map(([c]) => c);
export const obrasIgnoradas = (CFG) => Object.keys(obrasEncerradas(CFG));

export function resumoMetasSemana(CFG, obrasVisiveis = null, ref = hojeISO()) {
  const hoje = hojeISO();
  const ini = inicioDaSemana(ref);
  const dias = [0, 1, 2, 3, 4].map((i) => somarDias(ini, i));
  const progs = programacoes(CFG).filter((p) => (!obrasVisiveis || obrasVisiveis.includes(p.obra)) && !obrasIgnoradas(CFG).includes(p.obra));
  // dias em que alguém leu os grupos (há registro de alguma obra): num dia que ninguém leu ainda, não dá para dizer que a obra não enviou
  const diasLidos = new Set((CFG.whats || []).map((r) => r.data));
  const linhas = progs.map((p) => {
    let atingiu = 0; let abaixo = 0; let sem = 0;
    const porDia = dias.map((data) => {
      if (feriado(data)) return { data, estado: 'feriado', titulo: feriado(data) };
      if (data > hoje) return { data, estado: 'futuro' };
      const semLeitura = data < hoje && !diasLidos.has(data);
      const reg = registroDoDia(p, data);
      const itens = ehPendencia(CFG, p) ? [] : ((p.dias.find((x) => x.data === data) || {}).itens) || [];
      let algum = false;
      for (const it of itens) {
        const r = realizado(CFG, p.obra, data, it.item);
        if (r) {
          algum = true;
          const cls = situacao(it.meta, r.feito).cls;
          // nada feito (0 ou "não feito") conta como não feito, não como "abaixo da meta"
          const nada = r.feito === 0 || r.feito === false;
          if (cls === 'ok') atingiu++; else if (cls === 'abaixo' && !nada) abaixo++; else sem++;
        } else if (data < hoje && !semLeitura) sem++;   // hoje ainda está no prazo, e dia sem leitura dos grupos não conta como "sem registro"
      }
      if ((reg && reg.relatorio) || algum) return { data, estado: 'enviada' };
      if (data === hoje) return { data, estado: 'hoje' };
      if (semLeitura) return { data, estado: 'aguardando' };
      return { data, estado: reg && reg.semRelatorio ? 'nao' : 'naolido' };
    });
    const total = atingiu + abaixo + sem;
    return { obra: p.obra, info: p.info, atingiu, abaixo, sem, total, pct: total ? atingiu / total : null, dias: porDia };
  });
  const soma = (k) => linhas.reduce((t, l) => t + l[k], 0);
  const contaDias = (estado) => linhas.reduce((t, l) => t + l.dias.filter((d) => d.estado === estado).length, 0);
  const total = soma('total');
  // diasSem = falta confirmada (o agente leu o grupo e não havia); diasNaoLidos = ainda sem leitura do grupo
  return { ini, hoje, dias, linhas, totais: { atingiu: soma('atingiu'), abaixo: soma('abaixo'), sem: soma('sem'), total, pct: total ? soma('atingiu') / total : null, diasSem: contaDias('nao'), diasNaoLidos: contaDias('naolido') } };
}

// Meta SEMANAL × executado, por item (painel do CEO, Início). A meta vem dos PDFs de metas semanais (Drive), postados na
// semana anterior; o executado vem dos relatórios diários dos grupos. Fica em CFG.metasSemanais (produtividade.json).
// Item: concluído (feito ≥ meta) · em andamento (parte) · sem execução registrada. Cumprimento = média de min(1, feito/meta) por item.
export function resumoMetasItens(CFG, obrasVisiveis = null, ref = hojeISO()) {
  const ms = CFG && CFG.metasSemanais;
  const semanas = (ms && ms.semanas) || [];
  const sem = semanas.find((s) => s.ini <= ref && ref <= somarDias(s.fim, 2)) || semanas[semanas.length - 1];
  if (!sem) return null;
  const linhas = (sem.obras || []).filter((o) => (!obrasVisiveis || obrasVisiveis.includes(o.obra)) && !obrasIgnoradas(CFG).includes(o.obra)).map((o) => {
    // só os itens sem dia fixo contam pela semana; os que estão na programação de um dia contam no dia
    const itens = (o.itens || []).filter((i) => o.tipo === 'pendencias' || i.noDia === true);
    const cont = (e) => itens.filter((i) => i.estado === e).length;
    const parte = (i) => (i.estado === 'ok' ? 1 : i.estado === 'parcial' && i.meta ? Math.min(1, i.feito / i.meta) : 0);
    // pendências (obra sem cronograma): o total é o das pendências previstas na semana; as que nenhum relatório traz contam como sem execução
    const total = Math.max(o.total || 0, itens.length);
    const ok = cont('ok'); const parcial = cont('parcial');
    const nao = o.semLeitura ? 0 : total - ok - parcial;
    return { obra: o.obra, semLeitura: !!o.semLeitura, ini: o.ini, fim: o.fim, tipo: o.tipo, fonte: o.fonte, lidoAte: o.lidoAte, lacunas: o.lacunas || [], previstos: total, itens,
      ok, parcial, nao, total, pct: total && !o.semLeitura ? itens.reduce((t, i) => t + parte(i), 0) / total : null };
  });
  for (const [cod, sit] of Object.entries(obrasEncerradas(CFG))) {
    if (obrasFinalizadas(CFG).includes(cod)) continue;
    if (!obrasVisiveis || obrasVisiveis.includes(cod)) linhas.push({ obra: cod, encerrada: sit, lacunas: [], itens: [], ok: 0, parcial: 0, nao: 0, total: 0, previstos: 0, pct: null });
  }
  const contadas = linhas.filter((l) => !l.semLeitura && !l.encerrada);
  const soma = (k) => contadas.reduce((t, l) => t + l[k], 0);
  const total = soma('total');
  return { ini: sem.ini, fim: sem.fim, linhas, totais: { total, ok: soma('ok'), parcial: soma('parcial'), nao: soma('nao'),
    pct: total ? contadas.reduce((t, l) => t + (l.pct == null ? 0 : l.pct * l.total), 0) / total : null,
    obrasSemMeta: linhas.filter((l) => !l.total).length } };
}

// Último dia útil antes de hoje (pula fim de semana e feriado)
export function ultimoDiaUtil(hoje = hojeISO()) {
  let d = somarDias(hoje, -1);
  for (let i = 0; i < 10; i++) {
    const ds = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (ds !== 0 && ds !== 6 && !feriado(d)) return d;
    d = somarDias(d, -1);
  }
  return d;
}

// Alerta do topo da Operação: obras que não mandaram a produtividade no último dia útil
export function alertaProdutividadeOntem(CFG, obrasVisiveis = null) {
  const dia = ultimoDiaUtil();
  const progs = programacoes(CFG).filter((p) => !obrasVisiveis || obrasVisiveis.includes(p.obra));
  const nao = progs.filter((p) => { const r = registroDoDia(p, dia); return r && r.semRelatorio; }).map((p) => p.obra);
  const naoLido = progs.filter((p) => !registroDoDia(p, dia)).map((p) => p.obra);
  if (!nao.length && !naoLido.length) return '';
  const quando = `${dia === somarDias(hojeISO(), -1) ? 'ontem' : 'no último dia útil'} (${dia.slice(8, 10)}/${dia.slice(5, 7)})`;
  return html`<div class="alerta-semana alerta-topo">
    ${nao.length ? html`<b>⚠ Produtividade diária não enviada ${quando}: ${nao.join(', ')}</b>` : ''}
    ${naoLido.length ? html`<p class="pequeno" style="margin:4px 0 0">Ainda não verificado no WhatsApp ${quando}: ${naoLido.join(', ')}.</p>` : ''}
    <a class="link" href="#/planejamento/produtividade" style="font-size:13.5px">Ver a produtividade das obras →</a>
  </div>`;
}

// Operação (topo): os alertas das metas desta semana — números e o que fazer em cada obra (sem "crítico")
export function alertasMetas(CFG, obrasVisiveis = null) {
  const hoje = hojeISO(); const ini = inicioDaSemana(hoje);
  const progs = programacoes(CFG).filter((p) => !obrasVisiveis || obrasVisiveis.includes(p.obra));
  const linhas = progs.map((p) => ({ p, s: situacaoObra(CFG, p, ini, hoje) }));
  const total = (k) => linhas.reduce((t, l) => t + l.s[k].length, 0);
  const semProgDia = linhas.filter((l) => l.s.programacao !== 'Atividades do dia (WhatsApp)').length;
  const comAcao = linhas.filter((l) => l.s.acoes.length);
  return html`<section class="secao"><h2>Alertas das metas <span class="pequeno">semana de ${fmtData(ini).slice(0, 5)}</span></h2>
    ${alertaProdutividadeOntem(CFG, obrasVisiveis)}
    <div class="cards">
      <div class="card"><div class="card-valor ${total('semProd') ? 'tom-ruim' : ''}">${total('semProd')}</div><div class="card-rotulo">Dias sem produtividade enviada</div></div>
      <div class="card"><div class="card-valor ${total('abaixo') ? 'tom-ruim' : ''}">${total('abaixo')}</div><div class="card-rotulo">Itens abaixo da meta</div></div>
      <div class="card"><div class="card-valor">${semProgDia}</div><div class="card-rotulo">Obras sem meta diária</div></div>
    </div>
    ${comAcao.length ? html`<div class="linhas am-lista">${comAcao.map(({ p, s }) => html`<div><b class="cod">${p.obra}</b><span>${s.acoes.join(' · ')}</span></div>`)}</div>` : html`<p class="muted">Nenhum alerta de meta nesta semana.</p>`}
    <p style="margin-top:8px"><a class="link" href="#/operacao/metas">Ver as metas da semana, obra por obra →</a></p>
  </section>`;
}
// Operação › Metas e produtividade: só consulta. Uma linha por obra para o gestor agir; o detalhe abre embaixo.
export function render({ CFG, params, dia, semanaRef }) {
  const minhas = obrasDaPessoa();
  const restrito = funcaoAtual().porObra;               // quem é de obra só vê as suas
  const todas = programacoes(CFG);
  const progs = restrito ? todas.filter((p) => minhas.includes(p.obra)) : todas;
  const hoje = hojeISO();
  const ini = inicioDaSemana(semanaRef || params.get('dia') || dia || hoje);
  const linhas = progs.map((p) => ({ p, s: situacaoObra(CFG, p, ini, hoje) }))
    .sort((a, b) => ['critico', 'atencao', 'ok'].indexOf(a.s.nivel) - ['critico', 'atencao', 'ok'].indexOf(b.s.nivel));

  const nav = html`<div class="periodo">
    <button type="button" class="botao" data-semana-md="${somarDias(ini, -7)}">← Semana anterior</button>
    <div class="atual"><span>Semana</span><b>${fmtData(ini).slice(0, 5)} a ${fmtData(somarDias(ini, 4)).slice(0, 5)}</b></div>
    ${hoje < ini || hoje > somarDias(ini, 6) ? html`<button type="button" class="botao" data-semana-md="${hoje}">Esta semana</button>` : ''}
    <button type="button" class="botao" data-semana-md="${somarDias(ini, 7)}">Próxima semana →</button>
  </div>`;

  const total = (k) => linhas.reduce((t, l) => t + l.s[k].length, 0);
  const resumo = html`<div class="cards">
    <div class="card"><div class="card-valor ${linhas.filter((l) => l.s.nivel === 'critico').length ? 'tom-ruim' : ''}">${linhas.filter((l) => l.s.nivel === 'critico').length}</div><div class="card-rotulo">Obras em situação crítica</div></div>
    <div class="card"><div class="card-valor">${total('semProd')}</div><div class="card-rotulo">Dias sem produtividade enviada</div></div>
    <div class="card"><div class="card-valor">${total('abaixo')}</div><div class="card-rotulo">Itens abaixo da meta</div></div>
    <div class="card"><div class="card-valor">${linhas.filter((l) => l.s.programacao === 'Sem programação' || l.s.programacao === 'Pendências, sem data').length}</div><div class="card-rotulo">Obras sem programação por dia</div></div>
  </div>`;

  const tabela = html`<div class="tabela-rolagem"><table class="tab gestor">
    <thead><tr><th>Obra</th><th>Situação</th><th>Programação</th><th>Produtividade enviada</th><th>Metas batidas</th><th>O que fazer</th></tr></thead>
    <tbody>${linhas.map(({ p, s }) => html`<tr>
      <td class="cod"><button type="button" class="link" data-abrir="det-${p.obra}" title="Ver a semana desta obra">${p.obra}</button></td>
      <td><span class="niv ${s.nivel}">${NIVEL_TXT[s.nivel]}</span></td>
      <td>${s.programacao}</td>
      <td>${s.passados.length ? html`${s.comProd.length} de ${s.passados.length} dias${s.semProd.length ? html`<div class="pequeno pendente">faltou: ${s.semProd.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`).join(', ')}</div>` : ''}` : '—'}</td>
      <td>${s.lancados ? html`<b>${Math.round((s.batidos / s.lancados) * 100)}%</b> <span class="pequeno">(${s.batidos} de ${s.lancados})</span>${s.abaixo.length ? html`<div class="pequeno pendente">${s.abaixo.length} abaixo</div>` : ''}` : html`<span class="muted">sem lançamento</span>`}</td>
      <td>${s.acoes.length ? html`<ul class="acoes-lista">${s.acoes.map((a) => html`<li>${a}</li>`)}</ul>` : html`<span class="muted">Nada pendente</span>`}</td>
    </tr>`)}</tbody></table></div>`;

  const detalhes = linhas.map(({ p }) => html`<details class="caixa" id="det-${p.obra}">
    <summary><span class="caixa-tit">${p.obra} · ver a semana</span><span class="pequeno">programado, executado e quem fez (só consulta)</span></summary>
    <div class="caixa-corpo">${quadroSemana({ CFG, p, ref: ini, leitura: true })}</div>
  </details>`);

  return html`<div class="pagina">
    ${nav}
    <p class="pequeno" style="margin:0">Só consulta. O lançamento da produtividade é feito por quem está na obra, em "Minha semana". Conta os dias úteis já passados da semana.</p>
    ${resumo}
    ${tabela}
    <div>${detalhes}</div>
  </div>`;
}

// ---------------------------------------------------------------- formulário

function diaDoForm(form, CFG) {
  const p = programacoes(CFG).find((x) => x.obra === form.dataset.obra);
  return p && p.dias.find((d) => d.data === form.dataset.dia);
}

// Lê o formulário e valida: abaixo da meta exige motivo; "Outro" exige detalhe.
export function lerFormulario(form, CFG) {
  const dia = diaDoForm(form, CFG);
  if (!dia) return { erro: 'Programação do dia não encontrada.' };
  const fd = new FormData(form);
  const itens = [];
  const faltando = [];
  dia.itens.forEach((it, i) => {
    let feito;
    if (it.meta === null) feito = fd.get(`feito-${i}`) === 'on';
    else { const v = fd.get(`feito-${i}`); feito = v === '' || v === null ? null : Number(v); }
    const motivo = fd.get(`motivo-${i}`) || '';
    const obs = (fd.get(`obs-${i}`) || '').trim();
    const abaixo = it.meta === null ? feito === false : feito !== null && feito < it.meta;
    if (feito === null) faltando.push(`${it.item}: informe a quantidade`);
    else if (abaixo && !motivo) faltando.push(`${it.item}: abaixo da meta, escolha a justificativa`);
    else if (abaixo && motivo === 'Outro' && !obs) faltando.push(`${it.item}: descreva o motivo em "Detalhe"`);
    itens.push({ item: it.item, meta: it.meta, unidade: it.unidade, feito, motivo: abaixo ? motivo : '', obs: abaixo ? obs : '' });
  });
  if (faltando.length) return { erro: faltando.join(' · ') };
  return { lancamento: { obra: form.dataset.obra, data: form.dataset.dia, por: sessao().nome, em: new Date().toISOString(), itens } };
}

// Mostra a caixa de justificativa quando a quantidade fica abaixo da meta
export function atualizarJustificativas(form, CFG) {
  const dia = diaDoForm(form, CFG);
  if (!dia) return;
  dia.itens.forEach((it, i) => {
    const el = form.querySelector(`[name="feito-${i}"]`);
    const box = form.querySelector(`.lanc[data-i="${i}"] .lanc-motivo`);
    if (!el || !box) return;
    const abaixo = it.meta === null ? (!el.checked && el.dataset.tocado === '1') : (el.value !== '' && Number(el.value) < it.meta);
    box.hidden = !abaixo;
  });
}
