// Celular da obra (desenho do Marcos, página 20): o celular fica na obra; estagiário, encarregado e gestor lançam
// o executado do dia (por item da meta), o efetivo (até 12h) e o diário de obra. O ponto continua sendo batido no Sólides.
// Rota: #/celular/<obra>. Dados: tabela registros_obra (supabase/08-celular-obra.sql); no computador do escritório
// (modo local) ficam neste navegador ('solida.celular').
//
// Exporta: render(ctx, cod, params) · registros() (o que já foi carregado) · carregar(redesenhar) · ligar(redesenhar).

import { html } from '../formato.js';
import { hojeISO, somarDias } from '../datas.js';
import { programacoes, registroDoDia } from '../programacao.js';
import { feriado } from '../feriados.js';
import { NA_NUVEM, listarRegistrosObra, gravarRegistroObra } from '../nuvem.js';
import { sessao, funcaoAtual } from '../sessao.js';
import * as pd from './painel-dep.js';

const CHAVE = 'solida.celular';
let cache = [];
let carregado = false;
let papel = null;          // estagiario · encarregado · gestor (botões do topo)
const msgs = {};           // aviso "Salvo ✓" de cada caixa
let carregando = null;

const PAPEIS = [['estagiario', 'Estagiário'], ['encarregado', 'Encarregado'], ['gestor', 'Gestor']];
const papelPadrao = () => { const f = funcaoAtual().id; return f === 'encarregado' ? 'encarregado' : f === 'estagiario' ? 'estagiario' : 'gestor'; };

const lerLocal = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch { return []; } };
const gravarLocal = (l) => { try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch { /* sem armazenamento */ } };

export const registros = () => cache;

// últimos 14 dias de registros (todas as obras)
export async function carregar(redesenhar) {
  if (carregando) return carregando;
  const ate = somarDias(hojeISO(), 1); const de = somarDias(hojeISO(), -14);
  carregando = (async () => {
    try {
      cache = NA_NUVEM ? await listarRegistrosObra(de, ate) : lerLocal().filter((r) => r.data >= de);
      carregado = true;
    } catch (e) { console.warn('celular da obra:', e.message || e); carregado = true; }
    carregando = null;
    if (redesenhar) redesenhar();
  })();
  return carregando;
}

async function gravar(linha) {
  const l = { ...linha, item: linha.item || '', responsavel: sessao().nome || '', papel: papel || papelPadrao() };
  let salva = l;
  if (NA_NUVEM) salva = await gravarRegistroObra(l);
  else {
    const todos = lerLocal().filter((r) => !(r.obra === l.obra && r.data === l.data && r.tipo === l.tipo && (r.item || '') === l.item));
    salva = { ...l, criado_em: new Date().toISOString() }; todos.push(salva); gravarLocal(todos);
  }
  cache = cache.filter((r) => !(r.obra === l.obra && r.data === l.data && r.tipo === l.tipo && (r.item || '') === l.item));
  cache.push(salva);
}

// ---------------------------------------------------------------- dias e metas
const ehUtil = (d) => { const w = new Date(`${d}T12:00:00`).getDay(); return w >= 1 && w <= 5 && !feriado(d); };
const diaUtil = (d, passo) => { let x = somarDias(d, passo); for (let i = 0; i < 10 && !ehUtil(x); i++) x = somarDias(x, passo); return x; };
const metasDoDia = (prog, d) => ((prog && prog.dias.find((x) => x.data === d)) || { itens: [] }).itens.filter((i) => i.tipo !== 'laranja');
const regDe = (cod, d, tipo, item = '') => cache.find((r) => r.obra === cod && r.data === d && r.tipo === tipo && (r.item || '') === item);
const fmtQ = (n) => (typeof n === 'number' ? n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '');
const dmLongo = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });

// executado de um item num dia: o lançado no celular vale mais que o relatado no grupo de WhatsApp
function executado(cod, prog, d, it) {
  const r = regDe(cod, d, 'executado', it.item);
  if (r) return { valor: r.valor, fonte: 'celular' };
  const w = registroDoDia(prog, d);
  const x = w && (w.relatorio && w.relatorio.itens ? w.relatorio.itens : w.itens || []).find((y) => y.item === it.item && 'feito' in y);
  if (x) return { valor: x.feito === true ? (it.meta ?? 1) : x.feito === false ? 0 : x.feito, fonte: 'WhatsApp' };
  return null;
}

function resultadoOntem(cod, prog, ontem) {
  const metas = metasDoDia(prog, ontem);
  if (!metas.length) return html`<p class="pd-vazio">Sem meta registrada para ${dmLongo(ontem)}.</p>`;
  const linhas = metas.map((it) => {
    const e = executado(cod, prog, ontem, it);
    const v = e ? Number(e.valor) : null;
    const sit = v == null ? 'nao' : it.meta == null ? (v > 0 ? 'feito' : 'nao') : v >= it.meta * 0.9 ? 'feito' : v > 0 ? 'abaixo' : 'nao';
    return { it, v, sit, e };
  });
  const nao = linhas.filter((l) => l.sit === 'nao'); const abaixo = linhas.filter((l) => l.sit === 'abaixo'); const feito = linhas.filter((l) => l.sit === 'feito');
  const desc = (l) => `${l.it.item}${l.it.meta != null ? ` — meta ${fmtQ(l.it.meta)} ${l.it.unidade || ''}${l.v != null ? `, feito ${fmtQ(l.v)}` : ''}` : ''}`;
  return html`<div class="cel-selos">${feito.length ? pd.selo('ok', `${feito.length} feitos`) : ''}${abaixo.length ? pd.selo('atencao', `${abaixo.length} abaixo da meta`) : ''}${nao.length ? pd.selo('critico', `${nao.length} não feitos`) : ''}</div>
    ${nao.length ? html`<div class="cel-naofeito"><b>NÃO FEITO</b>${pd.itens(nao.map(desc))}</div>` : ''}
    ${abaixo.length ? html`<div class="cel-grupo"><span>Abaixo da meta</span>${pd.itens(abaixo.map(desc))}</div>` : ''}
    ${feito.length ? html`<div class="cel-grupo"><span>Feito</span>${pd.itens(feito.map(desc))}</div>` : ''}
    <p class="cel-nota">O que ficou para trás aparece primeiro, em vermelho.</p>`;
}

// ---------------------------------------------------------------- tela
export function render(ctx, cod, params) {
  if (!cod) return html`<p class="pd-vazio">Escolha a obra (ex.: #/celular/Mo531).</p>`;
  if (!carregado) carregar(null);
  const hoje = ctx.hoje || hojeISO();
  const ontem = diaUtil(hoje, -1); const amanha = diaUtil(hoje, 1);
  const prog = programacoes(ctx.CFG).find((p) => p.obra === cod);
  const pap = (params && params.get && params.get('papel')) || papel || papelPadrao();
  papel = pap;
  const metas = metasDoDia(prog, hoje);
  const ef = regDe(cod, hoje, 'efetivo');
  const efW = ((ctx.efetivo && ctx.efetivo.dias && ctx.efetivo.dias[hoje]) || {})[cod];
  const solida = ef && ef.dados ? ef.dados.solida : efW ? (efW.solida || {}).qtd || 0 : 0;
  const terc = ef && ef.dados ? ef.dados.terceiros : efW ? (efW.terceiros || []).reduce((s, t) => s + (Number(t.qtd) || 0), 0) : 0;
  const diario = regDe(cod, hoje, 'diario');
  const amanhaMetas = metasDoDia(prog, amanha);
  const endereco = (ctx.drive && ctx.drive.projetos && (ctx.drive.projetos.obras || []).find((p) => p.obra === cod) || {}).endereco;
  const passouMeioDia = new Date().getHours() >= 12;
  const msg = (k) => (msgs[k] ? html`<span class="cel-msg">${msgs[k]}</span>` : '');

  return html`<div class="cel">
    <header class="cel-topo"><span>Celular da obra · hoje</span><b>${cod}</b><small>${endereco ? String(endereco).replace(/_/g, ' · ') : dmLongo(hoje)}</small></header>
    <div class="cel-papeis" role="group" aria-label="Quem está lançando">${PAPEIS.map(([id, nome]) => html`<button type="button" class="${id === pap ? 'on' : ''}" data-cel-papel="${id}">${nome}</button>`)}</div>
    <p class="cel-nota">O celular fica na obra. O ponto continua sendo batido nele, no Sólides.</p>

    <section class="cel-caixa"><h3>Resultado de ontem</h3><p class="cel-sub">${dmLongo(ontem)}</p>${resultadoOntem(cod, prog, ontem)}</section>

    <form class="cel-caixa cel-meta" data-cel-form="executado" data-obra="${cod}">
      <h3>Meta de hoje</h3>
      ${metas.length ? metas.map((it, i) => {
        const r = regDe(cod, hoje, 'executado', it.item);
        return html`<div class="cel-item"><div class="cel-item-h"><span>${it.item}</span><b>${it.meta != null ? `${fmtQ(it.meta)} ${it.unidade || ''}` : 'meta'}</b></div>
          <label>Executado hoje${it.unidade ? ` (${it.unidade})` : ''}<input type="number" inputmode="decimal" step="any" min="0" name="ex${i}" data-item="${it.item}" data-meta="${it.meta ?? ''}" data-unidade="${it.unidade || ''}" value="${r && r.valor != null ? r.valor : ''}" placeholder="0"></label></div>`;
      }) : html`<p class="pd-vazio">Sem meta do dia na programação semanal${prog ? '' : ' (obra sem programação lida)'}. O gestor preenche a programação na quinta ou na sexta.</p>`}
      ${metas.length ? html`<button type="submit" class="cel-bt">Salvar executado do dia</button>${msg('executado')}` : ''}
    </form>

    <form class="cel-caixa" data-cel-form="efetivo" data-obra="${cod}">
      <div class="cel-h"><h3>Efetivo do dia</h3><span class="${passouMeioDia && !ef ? 'cel-atraso' : 'cel-prazo'}">${ef ? `enviado ${String(ef.criado_em || '').slice(11, 16)}` : 'enviar até 12h'}</span></div>
      ${[['solida', 'Equipe Sólida em obra', solida], ['terceiros', 'Terceirizados em obra', terc]].map(([n, rot, v]) => html`<label class="cel-cont-r">${rot}
        <span class="cel-cont"><button type="button" data-cel-mais="${n}|-1" aria-label="Menos">−</button><input type="number" inputmode="numeric" min="0" step="1" name="${n}" value="${v || 0}"><button type="button" data-cel-mais="${n}|1" aria-label="Mais">+</button></span></label>`)}
      <button type="submit" class="cel-bt">Enviar efetivo</button>${msg('efetivo')}
    </form>

    <form class="cel-caixa" data-cel-form="diario" data-obra="${cod}">
      <h3>Diário de obra</h3>
      <p class="cel-sub">Meta do POP: diário em dia em pelo menos 95% das obras.</p>
      <textarea name="texto" rows="4" placeholder="O que aconteceu hoje na obra: serviços, clima, visitas, problemas…">${diario ? diario.texto || '' : ''}</textarea>
      <button type="submit" class="cel-bt">Registrar diário de hoje</button>${msg('diario')}
    </form>

    <section class="cel-caixa"><h3>Meta de amanhã</h3><p class="cel-sub">${dmLongo(amanha)}</p>
      ${amanhaMetas.length ? pd.itens(amanhaMetas.map((it) => `${it.item}${it.meta != null ? ` · ${fmtQ(it.meta)} ${it.unidade || ''}` : ''}`)) : html`<p class="pd-vazio">Ainda sem meta para amanhã.</p>`}
      <p class="cel-nota">Só o gestor preenche a programação semanal: quinta, fim do dia, ou sexta de manhã.</p>
      <a class="cel-bt cel-bt-claro" href="#/obra/${encodeURIComponent(cod)}/programacao">Abrir programação semanal</a>
    </section>
  </div>`;
}

// ---------------------------------------------------------------- eventos (o main chama uma vez)
export function ligar(redesenhar) {
  document.addEventListener('click', (e) => {
    const p = e.target.closest && e.target.closest('[data-cel-papel]');
    if (p) { papel = p.dataset.celPapel; redesenhar(); return; }
    const m = e.target.closest && e.target.closest('[data-cel-mais]');
    if (m) {
      const [nome, passo] = m.dataset.celMais.split('|');
      const inp = m.closest('form').querySelector(`input[name="${nome}"]`);
      inp.value = Math.max(0, (Number(inp.value) || 0) + Number(passo));
    }
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest && e.target.closest('[data-cel-form]'); if (!f) return;
    e.preventDefault();
    const tipo = f.dataset.celForm; const obra = f.dataset.obra; const data = hojeISO();
    const bt = f.querySelector('button[type=submit]'); if (bt) bt.disabled = true;
    try {
      if (tipo === 'executado') {
        const ins = [...f.querySelectorAll('input[data-item]')].filter((i) => i.value !== '');
        if (!ins.length) throw new Error('Preencha o executado de pelo menos um item.');
        for (const i of ins) await gravar({ obra, data, tipo, item: i.dataset.item, valor: Number(String(i.value).replace(',', '.')), dados: { meta: i.dataset.meta === '' ? null : Number(i.dataset.meta), unidade: i.dataset.unidade } });
      } else if (tipo === 'efetivo') {
        const s = Math.max(0, Number(f.elements.solida.value) || 0); const t = Math.max(0, Number(f.elements.terceiros.value) || 0);
        await gravar({ obra, data, tipo, valor: s + t, dados: { solida: s, terceiros: t, hora: new Date().toTimeString().slice(0, 5) } });
      } else if (tipo === 'diario') {
        const texto = String(f.elements.texto.value || '').trim();
        if (!texto) throw new Error('Escreva o diário de hoje.');
        await gravar({ obra, data, tipo, texto });
      }
      msgs[tipo] = 'Salvo ✓';
      setTimeout(() => { delete msgs[tipo]; }, 8000);
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      redesenhar();
    } catch (err) {
      alert(`Não foi possível salvar (${err.message || err}).`);
    } finally { if (bt) bt.disabled = false; }
  });
}
