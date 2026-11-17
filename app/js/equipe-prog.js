// RH › Programado × realizado: o que a planilha de distribuição (SL_FUNC_OBRAS) programou para cada funcionário em cada dia
// da semana × onde ele de fato apareceu (efetivo lido dos grupos de WhatsApp das obras).
// O texto da planilha é livre ("Mo358 -10 / Mo602 - 09", "PO 03/11", "FÉRIAS"...): o parser abaixo entende dia a dia e a
// célula mostra o texto original ao passar o mouse, para dar para conferir.
import { html } from './formato.js';
import { somarDias, inicioDaSemana, hojeISO } from './datas.js';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// ---------------------------------------------------------------- parser do texto programado
// devolve { dias: [ [itens do Seg], … 6 ], tag } onde item = { tipo: 'obra'|'po'|'afast', cod, rotulo }
const RE_OBRA = /\b(mo|po)\s*-?\s*(\d{3})\s*([a-z])?\b/i;
const RE_TAG = /f[eé]rias|licen[cç]a|atestado|afastad|falta|remanej|saiu|dep[oó]sito|demitid|desligad/i;

function lerData(spec, segunda, mesPadrao) {
  // devolve os índices (0..5) dos dias citados em `spec`; 'ate' = da segunda até o dia citado
  const idx = new Set(); let ate = false;
  if (/at[eé]\b/i.test(spec)) ate = true;
  const re = /(\d{1,2})(?:\s*\/\s*(\d{1,2}))?/g; let m;
  while ((m = re.exec(spec))) {
    const d = +m[1]; const mes = m[2] ? +m[2] : null;
    if (d < 1 || d > 31 || (mes && mes > 12)) continue;
    for (let i = 0; i < 7; i++) {
      const iso = somarDias(segunda, i); const dd = +iso.slice(8, 10); const mm = +iso.slice(5, 7);
      if (dd === d && (!mes || mes === mm)) { if (i < 6) idx.add(i); if (ate) for (let j = 0; j <= i && j < 6; j++) idx.add(j); }
    }
  }
  return [...idx];
}

export function lerProgramacao(texto, segunda) {
  const dias = [[], [], [], [], [], []]; const todos = [];
  const linhas = String(texto || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
  // linha só com data ("09/11") vale para a linha de obra anterior
  const itensLinha = [];
  for (const l of linhas) {
    const achou = RE_OBRA.exec(l); const tag = RE_TAG.exec(l);
    const semCod = l.replace(RE_OBRA, ' ');
    const soData = !achou && !tag && /\d/.test(l) && itensLinha.length;
    if (soData) { itensLinha[itensLinha.length - 1].spec += ` ${l}`; continue; }
    let item = null;
    if (achou) {
      const cod = achou[1].toUpperCase() + achou[2];
      item = { tipo: achou[1].toLowerCase() === 'po' ? 'po' : 'obra', cod, rotulo: `${achou[1][0].toUpperCase()}${achou[1][1].toLowerCase()}${achou[2]}${(achou[3] || '').toUpperCase()}`, spec: semCod };
    } else if (tag) {
      item = { tipo: 'afast', cod: '', rotulo: /f[eé]rias/i.test(l) ? 'Férias' : /licen/i.test(l) ? 'Licença' : /remanej/i.test(l) ? 'Remanejar' : /saiu|demit|deslig/i.test(l) ? 'Saiu' : /dep/i.test(l) ? 'Depósito' : /falta/i.test(l) ? 'Falta' : 'Afastado', spec: l };
    } else if (/^p\.?o\.?\b/i.test(l) || /p[óo]s[\s-]*obra/i.test(l)) {
      item = { tipo: 'po', cod: 'PO', rotulo: 'Pós-obra', spec: semCod.replace(/^p\.?o\.?\b|p[óo]s[\s-]*obra/i, ' ') };
    }
    if (item) itensLinha.push(item);
  }
  const comData = []; const semData = [];
  for (const it of itensLinha) {
    const idx = /\d/.test(it.spec) ? lerData(it.spec, segunda) : [];
    if (idx.length) comData.push({ it, idx }); else semData.push(it);
  }
  const ocupados = new Set();
  for (const { it, idx } of comData) for (const i of idx) { dias[i].push(it); ocupados.add(i); }
  // sem data = vale para os dias úteis que as linhas com data não cobrem
  for (const it of semData) for (let i = 0; i < 5; i++) if (!ocupados.has(i)) dias[i].push(it);
  for (const it of itensLinha) todos.push(it);
  return { dias, itens: todos };
}

// ---------------------------------------------------------------- nomes: planilha × apelido do efetivo
function chavesDaPessoa(nome) {
  const chaves = new Set(); const t = sem(nome);
  for (const m of t.matchAll(/\(([^)]*)\)/g)) m[1].split(/[\s,]+/).forEach((p) => p.length > 2 && chaves.add(p));
  t.replace(/\([^)]*\)/g, ' ').split(/[\s-]+/).forEach((p) => p.length > 2 && chaves.add(p));
  if (chaves.has('bill')) chaves.add('bil');
  return chaves;
}
const SINONIMOS_FUNCAO = { ajudante: ['ajudante'], pedreiro: ['pedreiro'], ladrilheiro: ['ladrilheiro'], carpinteiro: ['carpinteiro'], bombeiro: ['bombeiro'], eletricista: ['eletricista'], encarregado: ['encarregado', 'mestre'], mestre: ['encarregado', 'mestre'], pintor: ['pintor'] };

function obraBase(cod) { const m = /(\d{3})/.exec(cod || ''); return m ? m[1] : ''; }

// quem (da planilha) o apelido do efetivo é, naquele dia e obra
function acharPessoa(apelido, pessoas, obra, idxDia, jaUsados) {
  const t = sem(apelido); const primeiro = t.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/)[0];
  const dica = (/\(([^)]*)\)/.exec(t) || [])[1] || '';
  if (!primeiro || primeiro.length < 3 || primeiro === '*') return null;
  let cands = pessoas.filter((p) => p.chaves.has(primeiro));
  if (!cands.length) return null;
  if (cands.length > 1 && dica) {
    const palavras = Object.keys(SINONIMOS_FUNCAO).filter((k) => dica.includes(k)); const f = (p) => sem(p.funcao);
    const porFuncao = cands.filter((p) => palavras.some((w) => SINONIMOS_FUNCAO[w].some((s) => f(p).includes(s))));
    if (porFuncao.length) cands = porFuncao;
    if (cands.length > 1 && /\br\b/.test(dica)) { const r = cands.filter((p) => /\br\b/.test(f(p))); if (r.length) cands = r; }
  }
  if (cands.length > 1) {   // quem estava programado para essa obra nesse dia
    const prog = cands.filter((p) => (p.prog.dias[idxDia] || []).some((i) => i.tipo === 'obra' && obraBase(i.cod) === obraBase(obra)));
    if (prog.length) cands = prog;
  }
  if (cands.length > 1) { const livres = cands.filter((p) => !jaUsados.has(p.nome + idxDia)); if (livres.length) cands = livres; }
  return cands[0];
}

// ---------------------------------------------------------------- comparação de uma semana
export function comparar(eqp, efetivo, segunda, hoje) {
  const pessoas = ((eqp && eqp.pessoas) || []).map((p) => ({ ...p, chaves: chavesDaPessoa(p.nome), prog: lerProgramacao(p.semanas[segunda] || '', segunda), real: [[], [], [], [], [], []] }));
  const orfaos = [];   // apareceram no efetivo mas não estão na distribuição
  const usados = new Set();
  for (let i = 0; i < 6; i++) {
    const dia = somarDias(segunda, i); const obras = (efetivo && efetivo.dias && efetivo.dias[dia]) || {};
    for (const [obra, reg] of Object.entries(obras)) {
      for (const nome of ((reg.solida && reg.solida.nomes) || [])) {
        const p = acharPessoa(nome, pessoas, obra, i, usados);
        if (p) { usados.add(p.nome + i); if (!p.real[i].includes(obra)) p.real[i].push(obra); } else if (/[a-zà-ú]{3}/i.test(nome)) orfaos.push({ dia, obra, nome: nome.replace(/\s+/g, ' ').trim() });
      }
    }
  }
  const resumo = { ok: 0, outra: 0, semRegistro: 0, fora: 0, conferidos: 0 };
  const linhas = [];
  for (const p of pessoas) {
    const temProg = p.prog.dias.some((d) => d.length); const temReal = p.real.some((d) => d.length);
    if (!temProg && !temReal) continue;
    const cel = []; const cont = { ok: 0, conf: 0 };
    for (let i = 0; i < 6; i++) {
      const dia = somarDias(segunda, i); const passado = dia <= hoje; const prog = p.prog.dias[i]; const real = p.real[i];
      const obrasProg = prog.filter((x) => x.tipo === 'obra').map((x) => x.cod); const afast = prog.find((x) => x.tipo === 'afast'); const po = prog.find((x) => x.tipo === 'po');
      let est = '';
      if (!passado || (dia === hoje && !real.length)) est = prog.length ? 'futuro' : '';   // hoje o efetivo ainda pode chegar
      else if (afast && !obrasProg.length) est = real.length ? 'outra' : 'afast';
      else if (obrasProg.length) {
        if (!real.length) est = 'semreg';
        else est = real.some((o) => obrasProg.some((c) => obraBase(c) === obraBase(o))) ? 'ok' : 'outra';
      } else if (po) {
        // pós-obra: o grupo de gestão do pós-obra manda o efetivo com o local "Pós-obra"; sem esse efetivo no dia, não dá para conferir
        const noPos = real.some((o) => /^p[óo]s|^po\d/i.test(o)); const gruposPos = !!((efetivo && efetivo.dias && efetivo.dias[dia]) || {})['Pós-obra'];
        est = noPos ? 'ok' : real.length ? 'outra' : (gruposPos ? 'semreg' : 'po');
      }
      else if (real.length) est = 'fora';
      if (est === 'ok') { resumo.ok++; cont.ok++; } else if (est === 'outra') resumo.outra++; else if (est === 'semreg') resumo.semRegistro++; else if (est === 'fora') resumo.fora++;
      if (['ok', 'outra', 'semreg'].includes(est)) { resumo.conferidos++; cont.conf++; }
      cel.push({ dia, est, prog, real });
    }
    linhas.push({ pessoa: p, cel, ...cont });
  }
  return { linhas, resumo, orfaos, segunda };
}

// ---------------------------------------------------------------- tela
let semanaSel = null;
export const mudarSemana = (delta, semanas) => {
  const atual = semanaSel || inicioDaSemana(hojeISO());
  semanaSel = delta === 0 ? inicioDaSemana(hojeISO()) : somarDias(atual, 7 * delta);
  return semanaSel;
};

const ROT = { ok: 'Bateu', outra: 'Em outra obra', semreg: 'Sem registro', fora: 'Fora do programado', afast: 'Afastado', po: 'Pós-obra', futuro: 'A realizar' };

function celula(c) {
  const prog = c.prog.map((i) => i.rotulo).join(' + ');
  const real = c.real.join(' + ');
  if (!prog && !real) return html`<td class="ep-c"></td>`;
  const dica = `${ROT[c.est] || ''}${prog ? ` · programado: ${prog}` : ''}${real ? ` · esteve: ${real}` : ''}`;
  return html`<td class="ep-c ep-${c.est || 'vazio'}" title="${dica}">
    <div class="ep-p"><small>Prog.</small> ${prog || '—'}</div>
    <div class="ep-r"><small>Real.</small> ${c.est === 'futuro' ? '' : (real || (c.est === 'afast' || c.est === 'po' ? '' : '—'))}</div></td>`;
}

export function secaoProgramadoRealizado(eqp, efetivo, hoje = hojeISO()) {
  if (!eqp || !eqp.pessoas || !eqp.pessoas.length) {
    return html`<p class="pd-vazio">A distribuição de funcionários (SL_FUNC_OBRAS) ainda não chegou do computador do escritório${eqp && eqp.erro ? ` — ${eqp.erro}` : ''}.</p>`;
  }
  const segunda = semanaSel || inicioDaSemana(hoje);
  const r = comparar(eqp, efetivo, segunda, hoje);
  const tem = r.linhas.some((l) => l.pessoa.prog.itens.length);
  const sabado = r.linhas.some((l) => l.cel[5].prog.length || l.cel[5].real.length);
  const nDias = sabado ? 6 : 5;
  const aderencia = r.resumo.conferidos ? Math.round((r.resumo.ok / r.resumo.conferidos) * 100) : null;
  const cartao = (rot, v, cls) => html`<div class="ep-k ${cls}"><b>${v}</b><span>${rot}</span></div>`;
  return html`<div class="ep">
    <div class="ep-nav">
      <button type="button" class="botao" data-ep-sem="-1">‹ Semana anterior</button>
      <b>${dm(segunda)} a ${dm(somarDias(segunda, nDias - 1))}/${segunda.slice(0, 4)}</b>
      <button type="button" class="botao" data-ep-sem="1">Próxima ›</button>
      <button type="button" class="botao" data-ep-sem="0">Esta semana</button>
    </div>
    <div class="ep-resumo">
      ${cartao('Aderência ao programado', aderencia == null ? '—' : `${aderencia}%`, aderencia != null && aderencia < 70 ? 'ep-ruim' : '')}
      ${cartao('Bateu com o programado', r.resumo.ok, 'ep-ok')}
      ${cartao('Em outra obra', r.resumo.outra, r.resumo.outra ? 'ep-ruim' : '')}
      ${cartao('Sem registro no efetivo', r.resumo.semRegistro, r.resumo.semRegistro ? 'ep-alerta' : '')}
      ${cartao('Fora do programado', r.resumo.fora, r.resumo.fora ? 'ep-alerta' : '')}
    </div>
    ${tem ? '' : html`<p class="pd-vazio">Nada programado para esta semana na distribuição de funcionários.</p>`}
    <div class="pd-tab-caixa"><div class="tabela-rolagem"><table class="pd-tab ep-tab">
      <thead><tr><th>Funcionário</th>${DIAS.slice(0, nDias).map((d, i) => html`<th class="ep-th">${d} <small>${dm(somarDias(segunda, i))}</small></th>`)}<th>Bateu</th></tr></thead>
      <tbody>${r.linhas.map((l) => html`<tr>
        <td class="pd-t1"><b>${l.pessoa.nome}</b><span class="pd-obra-sub">${l.pessoa.funcao}</span></td>
        ${l.cel.slice(0, nDias).map(celula)}
        <td class="ep-tot">${l.conf ? `${l.ok}/${l.conf}` : '—'}</td></tr>`)}</tbody>
    </table></div></div>
    <p class="ep-leg"><i class="ep-ok"></i>Bateu <i class="ep-outra"></i>Esteve em outra obra <i class="ep-semreg"></i>Programado e sem registro no efetivo <i class="ep-fora"></i>Esteve em obra sem estar programado <i class="ep-afast"></i>Afastado <i class="ep-po"></i>Pós-obra (só confere se o grupo de gestão mandou o efetivo) · passe o mouse na célula para ver o texto da planilha</p>
    ${r.orfaos.length ? html`<details class="ep-orf"><summary>${r.orfaos.length} presença(s) no efetivo que não foram ligadas a ninguém da distribuição</summary>
      <p class="pequeno">${r.orfaos.map((o) => `${dm(o.dia)} ${o.obra}: ${o.nome}`).join(' · ')}</p></details>` : ''}
    <p class="pequeno">Programado: planilha SL_FUNC_OBRAS (${eqp.arquivo || ''}) · Realizado: efetivo enviado nos grupos de WhatsApp das obras. Dias futuros não entram na conferência.</p>
  </div>`;
}
