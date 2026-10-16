// Transporte e logística › Reposição de ferramentas obrigatórias de obra (pedido do Felipe, 16/10).
// Lê o estoque da planilha SL_FERRAMENTAS_SOLIDA_Rnn (aba CONTROLE) e mostra, de forma didática:
//   1. o que falta em cada obra (e nos carros e no galpão);
//   2. as movimentações que repõem tudo com o que já existe (obra finalizada → galpão, galpão → obra,
//      obra → obra, obra → galpão) — cada origem → destino é uma viagem do Anderson;
//   3. o que sobra para comprar (maquinário: confirmar o uso antes de comprar).
// Só entram os itens obrigatórios de obra (mínimo de obra > 0). Sem valores em R$.
// Regras combinadas com o Felipe:
//   - sobra = o que passa do mínimo do lugar; obra abaixo do mínimo nunca cede; carro nunca cede;
//   - prioridade para cobrir falta: sobra do galpão → sobra de outra obra → comprar;
//   - obra finalizada devolve tudo o que tiver para o galpão;
//   - quebrada/em conserto não conta como disponível;
//   - consumíveis (CON) são repostos pela própria obra: aparecem como falta, mas não saem do galpão nem entram na compra;
//   - contagem em texto (escada "2-7D", "C") soma o número antes do traço e mostra o tipo; o que não dá para entender vai para "verificar";
//   - célula vazia = não contado: nunca vira falta.

import { html, numero, data as fmtData } from '../formato.js';
import { hojeISO, diasEntre } from '../datas.js';

export const ABAS_TRANSPORTE = [
  { id: '', nome: 'Resumo' },
  { id: 'reposicao', nome: 'Reposição de ferramentas' },
];

const NOME_FIXO = { galpao: 'Galpão', anderson: 'Carro do Anderson', nascimento: 'Carro do Nascimento', enio: 'Carro do Enio' };
const DIAS_VELHO = 7;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Quantidade de uma célula: número, vazio (não contado) ou texto tipo "2-7D" / "7-7D, 2-5D"
function qtd(v) {
  if (v == null || v === '') return { n: null };
  if (typeof v === 'number') return { n: v };
  const s = String(v).trim();
  const partes = s.split(/[,;+]/).map((p) => p.trim()).filter(Boolean);
  let total = 0; let ok = partes.length > 0;
  for (const p of partes) {
    const m = p.match(/^(\d+)\s*-\s*\S+$/);
    if (m) total += Number(m[1]);
    else if (/^\d+$/.test(p)) total += Number(p);
    else ok = false;
  }
  return ok ? { n: total, detalhe: s } : { n: null, texto: s };
}
const mostra = (q) => (q.detalhe ? q.detalhe : q.n == null ? (q.texto || '—') : numero(q.n));

export function calcular(est) {
  const hoje = hojeISO();
  const itens = ((est && est.itens) || []).filter((i) => num(i.minObra) > 0);
  const obrasCols = (est && est.obras) || [];
  const cad = (est && est.cadastroObras) || [];
  const finalizada = (o) => { const c = cad.find((x) => x.obra === o); return !!c && /finaliz|encerr|conclu|entreg/i.test(c.status || ''); };
  const conf = (est && est.conferido) || {};

  const locais = [
    ...obrasCols.map((o) => ({ id: o, nome: o, tipo: 'obra', finalizada: finalizada(o) })),
    ...['anderson', 'nascimento', 'enio'].map((id) => ({ id, nome: NOME_FIXO[id], tipo: 'carro' })),
    { id: 'galpao', nome: NOME_FIXO.galpao, tipo: 'galpao' },
  ];
  for (const l of locais) {
    l.conferido = conf[l.id] || null;
    l.dias = l.conferido ? diasEntre(l.conferido, hoje) : null;
    l.velha = l.dias == null || l.dias > DIAS_VELHO;
    l.faltas = []; l.sem = []; l.verificar = []; l.ok = 0;
  }
  const por = new Map(locais.map((l) => [l.id, l]));
  const nomeDe = (id) => (por.get(id) ? por.get(id).nome : id);

  const movs = new Map(); // `${de}>${para}|${cod}`
  const compras = [];
  const mover = (i, de, para, n, nota = '') => {
    if (n <= 0) return;
    const k = `${de}>${para}|${i.cod}`;
    const m = movs.get(k) || { cod: i.cod, item: i.item, cat: i.categoria, de, para, qtd: 0, nota };
    m.qtd += n; if (nota && !m.nota) m.nota = nota; movs.set(k, m);
  };

  for (const i of itens) {
    const min = num(i.minObra);
    const consumivel = i.categoria === 'CON';
    const gMin = num(i.locais.galpao.min) || 0;
    const g = qtd(i.locais.galpao.atual);
    const quebradas = (num(i.quebrada) || 0) + (num(i.consertando) || 0);
    let galpao = g.n == null ? 0 : Math.max(0, g.n - quebradas);
    const notaGalpao = g.detalhe ? `no galpão: ${g.detalhe}` : '';

    const sobraObra = []; const faltas = []; // faltas: { id, falta, tem, min }
    for (const l of locais.filter((x) => x.tipo === 'obra')) {
      const q = qtd(i.obras[l.id]);
      if (q.texto) { l.verificar.push({ cod: i.cod, item: i.item, texto: q.texto }); continue; }
      if (q.n == null) { l.sem.push({ cod: i.cod, item: i.item }); continue; }
      if (l.finalizada) { if (q.n > 0 && !consumivel && !l.velha) { mover(i, l.id, 'galpao', q.n, q.detalhe ? `na obra: ${q.detalhe}` : ''); galpao += q.n; } continue; }
      if (q.n >= min) { l.ok++; if (q.n > min && !consumivel) sobraObra.push({ id: l.id, s: q.n - min, detalhe: q.detalhe }); }
      else faltas.push({ id: l.id, falta: min - q.n, tem: q, min });
    }
    // carros: mínimo próprio, só contado se tiver número
    for (const id of ['anderson', 'nascimento', 'enio']) {
      const cm = num(i.locais[id].min) || 0; const cq = qtd(i.locais[id].atual);
      if (cm > 0 && cq.n != null) { const l = por.get(id); if (cq.n < cm) faltas.push({ id, falta: cm - cq.n, tem: cq, min: cm }); else l.ok++; }
    }
    // galpão: abaixo do mínimo (depois de descontar quebradas e somar as devoluções)
    const gDevolv = galpao;
    if (gMin > 0 && g.n != null && gDevolv < gMin) faltas.push({ id: 'galpao', falta: gMin - gDevolv, tem: g, min: gMin });
    else if (gMin > 0 && g.n != null) por.get('galpao').ok++;

    let sobraG = Math.max(0, galpao - gMin);
    sobraObra.sort((a, b) => b.s - a.s);
    // ordem das faltas: obras, carros, galpão
    const ordem = { obra: 0, carro: 1, galpao: 2 };
    faltas.sort((a, b) => ordem[por.get(a.id).tipo] - ordem[por.get(b.id).tipo]);
    for (const f of faltas) {
      const l = por.get(f.id); let resta = f.falta; const como = [];
      if (!consumivel) {
        if (f.id !== 'galpao' && sobraG > 0) { const t = Math.min(resta, sobraG); mover(i, 'galpao', f.id, t, notaGalpao); como.push({ de: 'galpao', qtd: t }); sobraG -= t; resta -= t; }
        for (const s of sobraObra) {
          if (resta <= 0) break;
          if (s.id === f.id || s.s <= 0) continue;
          const t = Math.min(resta, s.s); mover(i, s.id, f.id, t, s.detalhe ? `na obra: ${s.detalhe}` : ''); como.push({ de: s.id, qtd: t }); s.s -= t; resta -= t;
        }
      }
      let comprar = 0;
      if (resta > 0 && !consumivel) { comprar = resta; compras.push({ cod: i.cod, item: i.item, cat: i.categoria, para: f.id, qtd: resta }); }
      l.faltas.push({ cod: i.cod, item: i.item, cat: i.categoria, tem: mostra(f.tem), min: f.min, falta: f.falta, como, comprar, repoeObra: consumivel && l.tipo === 'obra' });
    }
  }
  // sobra de obra que ficou sem destino e o galpão está abaixo do mínimo já foi tratada como falta do galpão
  return { locais, movs: [...movs.values()], compras, nomeDe };
}

// ---------------------------------------------------------------- tela
const dm = (iso) => (iso ? fmtData(iso).slice(0, 5) : '');
const un = (n) => numero(n);

function selaConferencia(l) {
  if (!l.conferido) return html`<span class="rp-velha">sem data de conferência</span>`;
  return html`<span class="${l.velha ? 'rp-velha' : 'rp-recente'}">conferido em ${dm(l.conferido)} (${l.dias === 0 ? 'hoje' : `há ${l.dias} ${l.dias === 1 ? 'dia' : 'dias'}`})</span>`;
}

function blocoLocal(l, nomeDe) {
  const nFalta = l.faltas.length;
  const tit = l.tipo === 'obra' ? l.nome : l.nome;
  const situ = l.finalizada ? 'finalizada: devolve o que tiver ao galpão' : nFalta ? `${nFalta} ${nFalta === 1 ? 'item' : 'itens'} abaixo do mínimo` : 'tudo no mínimo';
  const comoTxt = (f) => {
    if (f.repoeObra) return html`<span class="rp-obra-repoe">a obra compra e repõe</span>`;
    const partes = f.como.map((c) => html`<span class="rp-via rp-${c.de === 'galpao' ? 'galpao' : 'obra'}">${c.de === 'galpao' ? 'Galpão' : nomeDe(c.de)} envia ${un(c.qtd)}</span>`);
    if (f.comprar) partes.push(html`<span class="rp-via rp-compra">comprar ${un(f.comprar)}</span>`);
    return html`${partes}`;
  };
  return html`<details class="caixa rp-local ${nFalta ? 'rp-falta' : 'rp-ok'}" ${nFalta && !l.finalizada ? html.seguro('open') : ''}>
    <summary><span class="caixa-tit">${tit}</span><span class="contador ${nFalta ? '' : 'contador-neutro'}">${nFalta}</span><span class="pequeno">${situ} · ${selaConferencia(l)}</span></summary>
    <div class="caixa-corpo">
      ${nFalta ? html`<div class="tabela-rolagem"><table class="tab rp-tab"><thead><tr><th>Item</th><th class="n">Tem</th><th class="n">Mínimo</th><th class="n">Falta</th><th>Como resolver</th></tr></thead><tbody>
        ${l.faltas.map((f) => html`<tr><td><b>${f.item}</b> <span class="pequeno">${f.cod}</span></td><td class="n">${f.tem}</td><td class="n">${un(f.min)}</td><td class="n"><b class="pendente">${un(f.falta)}</b></td><td>${comoTxt(f)}</td></tr>`)}
      </tbody></table></div>` : html`<p class="pequeno">Nenhum item obrigatório abaixo do mínimo, entre os que foram contados.</p>`}
      ${l.verificar.length ? html`<p class="pequeno rp-nota"><b>Verificar com o Anderson</b> (contagem que o sistema não entendeu): ${l.verificar.map((v) => `${v.item} = "${v.texto}"`).join('; ')}</p>` : ''}
      ${l.sem.length ? html`<details class="rp-sem"><summary class="pequeno">${l.sem.length} ${l.sem.length === 1 ? 'item' : 'itens'} sem contagem (não entram no cálculo)</summary><p class="pequeno">${l.sem.map((s) => s.item).join(', ')}</p></details>` : ''}
    </div>
  </details>`;
}

function viagens(movs, nomeDe, por) {
  const rank = (m) => (por.get(m.de) && por.get(m.de).finalizada ? 0 : m.de === 'galpao' ? 1 : m.para === 'galpao' ? 3 : 2);
  const grupos = new Map();
  for (const m of movs) { const k = `${m.de}>${m.para}`; if (!grupos.has(k)) grupos.set(k, { de: m.de, para: m.para, itens: [] }); grupos.get(k).itens.push(m); }
  const tipoDest = (g) => ({ obra: 0, carro: 1, galpao: 2 }[(por.get(g.para) || {}).tipo] ?? 0); // obras antes dos carros
  const lista = [...grupos.values()].sort((a, b) => rank(a.itens[0]) - rank(b.itens[0]) || tipoDest(a) - tipoDest(b) || nomeDe(a.de).localeCompare(nomeDe(b.de)) || nomeDe(a.para).localeCompare(nomeDe(b.para)));
  return lista;
}
const TIPO_VIAGEM = (g, por) => (por.get(g.de) && por.get(g.de).finalizada ? 'Devolução de obra finalizada' : g.de === 'galpao' ? 'Sai do galpão' : g.para === 'galpao' ? 'Volta para o galpão' : 'Entre obras');

export function render(est) {
  if (!est || est.erro || !Array.isArray(est.itens)) {
    return html`<p class="vazio">Não consegui ler a planilha de ferramentas${est && est.erro ? `: ${est.erro}` : ''}. Quando o coletor ler a planilha (pasta Pós-obra › Ferramentas › Listas), esta tela se monta sozinha.</p>`;
  }
  const r = calcular(est);
  const por = new Map(r.locais.map((l) => [l.id, l]));
  const obras = r.locais.filter((l) => l.tipo === 'obra' && !l.finalizada);
  const encerradas = r.locais.filter((l) => l.tipo === 'obra' && l.finalizada);
  const outros = r.locais.filter((l) => l.tipo !== 'obra');
  const via = viagens(r.movs, r.nomeDe, por);
  const pecas = r.movs.reduce((s, m) => s + m.qtd, 0);
  const compraPorItem = new Map();
  for (const c of r.compras) { const x = compraPorItem.get(c.cod) || { cod: c.cod, item: c.item, cat: c.cat, total: 0, onde: [] }; x.total += c.qtd; x.onde.push(`${r.nomeDe(c.para)}: ${un(c.qtd)}`); compraPorItem.set(c.cod, x); }
  const compras = [...compraPorItem.values()].sort((a, b) => a.cod.localeCompare(b.cod, 'pt-BR', { numeric: true }));
  const comprarJa = compras.filter((c) => c.cat !== 'MAQ');
  const confirmar = compras.filter((c) => c.cat === 'MAQ');
  const obrasComFalta = obras.filter((o) => o.faltas.length).length;
  const velhas = r.locais.filter((l) => l.velha && !l.finalizada && (l.tipo === 'obra' ? true : l.tipo === 'carro' ? true : true));
  const resumo = (v, r1, r2 = '') => html`<div class="rp-kpi"><b>${v}</b><span>${r1}</span>${r2 ? html`<em>${r2}</em>` : ''}</div>`;

  const linhaViagem = (g, n) => html`<article class="cartao rp-viagem">
    <header class="cartao-cab"><h3><span class="rp-n">${n}</span>${r.nomeDe(g.de)} <span class="rp-seta">→</span> ${r.nomeDe(g.para)}</h3><span class="pequeno">${TIPO_VIAGEM(g, por)} · ${g.itens.length} ${g.itens.length === 1 ? 'item' : 'itens'}</span></header>
    <table class="tab rp-tab"><thead><tr><th>Levar</th><th class="n">Qtd.</th><th></th></tr></thead><tbody>
      ${g.itens.map((m) => html`<tr><td><b>${m.item}</b> <span class="pequeno">${m.cod}</span></td><td class="n"><b>${un(m.qtd)}</b></td><td class="pequeno">${m.nota || ''}</td></tr>`)}
    </tbody></table>
  </article>`;

  return html`<div class="rp">
    <div class="rp-barra"><p class="pequeno">Só itens <b>obrigatórios de obra</b> (${est.itens.filter((i) => num(i.minObra) > 0).length} itens). Planilha ${est.arquivo || ''}, lida do Drive.</p><button type="button" class="botao" data-imprimir>🖨 Imprimir</button></div>

    <section class="ob-sec rp-resumo">
      ${resumo(obrasComFalta, obrasComFalta === 1 ? 'obra com falta' : 'obras com falta', `de ${obras.length} ativas`)}
      ${resumo(via.length, via.length === 1 ? 'viagem' : 'viagens do Anderson', `${un(pecas)} peças no total`)}
      ${resumo(comprarJa.length, comprarJa.length === 1 ? 'item para comprar' : 'itens para comprar', `${un(comprarJa.reduce((s, c) => s + c.total, 0))} unidades`)}
      ${resumo(confirmar.length, 'maquinário a confirmar', 'antes de comprar')}
    </section>
    ${velhas.length ? html`<p class="aviso rp-aviso">⚠ <b>Contagem antiga ou sem data</b> em: ${velhas.map((l) => `${l.nome}${l.conferido ? ` (${dm(l.conferido)})` : ''}`).join(', ')}. Quanto mais velha a contagem, menos confiável a lista abaixo; atualize a planilha de ferramentas obrigatórias dessas obras.</p>` : ''}

    <details class="caixa rp-como"><summary><span class="caixa-tit">Como ler esta tela</span><span class="pequeno">clique para ver</span></summary><div class="caixa-corpo"><ol>
      <li><b>Mínimo:</b> cada lugar (obra, carro, galpão) tem uma quantidade mínima de cada item. <b>Sobra</b> é o que passa do mínimo; <b>falta</b> é o que está abaixo.</li>
      <li><b>Ordem para resolver uma falta:</b> 1º a sobra do galpão · 2º a sobra de outra obra · 3º comprar. Obra abaixo do mínimo nunca cede; carro nunca cede.</li>
      <li><b>Obra finalizada</b> devolve tudo o que tiver para o galpão (e isso entra na conta antes de qualquer outra coisa).</li>
      <li><b>Quebrada ou em conserto</b> não conta como disponível.</li>
      <li><b>Cada "origem → destino"</b> é uma viagem do Anderson. Elas estão na ordem sugerida: devoluções, galpão para as obras, entre obras.</li>
      <li><b>Consumíveis</b> obrigatórios (parafuso, fita, bucha…) aparecem como falta, mas a própria obra compra e repõe: não saem do galpão nem entram na compra.</li>
      <li><b>Escada:</b> a contagem vem como "2-7D" = 2 escadas de 7 degraus. O sistema soma as escadas e mostra os tipos; na hora de levar, escolher o tipo certo.</li>
      <li><b>Maquinário</b> (esmerilhadeira, extensão, laser…) é obrigatório, mas pode não estar em uso em todas as obras. Por isso a compra dele fica numa lista à parte, "confirmar antes de comprar".</li>
      <li>Item sem contagem na planilha <b>não conta como falta</b>: o sistema só cobra o que foi contado.</li>
    </ol></div></details>

    ${encerradas.length ? html`<p class="pequeno rp-nota">Obras encerradas, fora desta lista: <b>${encerradas.map((l) => l.nome).join(', ')}</b>. ${encerradas.some((l) => !l.velha) ? 'O que ainda estava nelas volta para o galpão (veja as viagens).' : 'As contagens delas são antigas, então não geram viagem.'}</p>` : ''}
    <section class="ob-sec"><div class="painel-h"><h2>1 · O que falta em cada obra</h2><p>Abra uma obra para ver item por item e como resolver</p></div>
      ${obras.map((l) => blocoLocal(l, r.nomeDe))}
      <h3 class="rp-sub">Carros e galpão</h3>
      ${outros.map((l) => blocoLocal(l, r.nomeDe))}
    </section>

    <section class="ob-sec"><div class="painel-h"><h2>2 · Movimentações para repor</h2><p>${via.length ? 'Cada cartão é uma viagem: origem → destino' : 'Nenhuma movimentação necessária com o que já existe'}</p></div>
      <div class="rp-viagens">${via.map((g, i) => linhaViagem(g, i + 1))}</div>
    </section>

    <section class="ob-sec"><div class="painel-h"><h2>3 · O que comprar</h2><p>Depois de usar tudo o que dá para mover</p></div>
      ${comprarJa.length ? html`<article class="cartao"><header class="cartao-cab"><h3>Comprar</h3><span class="pequeno">sem valores: só item e quantidade</span></header><table class="tab rp-tab"><thead><tr><th>Item</th><th class="n">Comprar</th><th>Onde falta</th></tr></thead><tbody>
        ${comprarJa.map((c) => html`<tr><td><b>${c.item}</b> <span class="pequeno">${c.cod}</span></td><td class="n"><b>${un(c.total)}</b></td><td class="pequeno">${c.onde.join(' · ')}</td></tr>`)}
      </tbody></table></article>` : html`<p class="pequeno">Nada para comprar agora.</p>`}
      ${confirmar.length ? html`<article class="cartao rp-confirmar"><header class="cartao-cab"><h3>Maquinário: confirmar antes de comprar</h3><span class="pequeno">obrigatório, mas pode não estar em uso em todas as obras</span></header><table class="tab rp-tab"><thead><tr><th>Maquinário</th><th class="n">Falta</th><th>Onde falta</th></tr></thead><tbody>
        ${confirmar.map((c) => html`<tr><td><b>${c.item}</b> <span class="pequeno">${c.cod}</span></td><td class="n"><b>${un(c.total)}</b></td><td class="pequeno">${c.onde.join(' · ')}</td></tr>`)}
      </tbody></table><p class="pequeno">Pergunte ao gestor de cada obra se a obra usa mesmo; só compre o que for confirmado.</p></article>` : ''}
    </section>
  </div>`;
}
