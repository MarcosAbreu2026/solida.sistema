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
//   - consumíveis (categoria CON) não entram: a obra compra e repõe; esta tela é só para o que não é consumível;
//   - a compra é uma só para todas as obras e tudo chega no galpão; de lá o Anderson leva para onde falta;
//   - contagem em texto (escada "2-7D", "C") soma o número antes do traço e mostra o tipo; o que não dá para entender vai para "verificar";
//   - célula vazia = não contado: nunca vira falta.

import { html, numero, data as fmtData } from '../formato.js';
import { hojeISO, diasEntre } from '../datas.js';

export const ABAS_TRANSPORTE = [
  { id: '', nome: 'Resumo' },
  { id: 'reposicao', nome: 'Reposição de ferramentas' },
];

const NOME_FIXO = { galpao: 'Galpão', anderson: 'Carro do Anderson', nascimento: 'Carro do Nascimento', enio: 'Carro do Enio' };
const DIAS_VELHO = 15; // aferição de 15 em 15 dias (a compra demora a chegar)
// consumível = categoria CON + produtos de limpeza que se gastam (a obra compra); pá de lixo, rodo e vassoura continuam
const GASTA = /[áa]gua sanit|[áa]lcool|desinfet|detergente|esponja|multiuso|papel higi|sab[ãa]o|saco de lixo|pano de ch[ãa]o/i;
const consumivelItem = (i) => i.categoria === 'CON' || (i.categoria === 'LIM' && GASTA.test(i.item || ''));
const num =(v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

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
  const itens = ((est && est.itens) || []).filter((i) => num(i.minObra) > 0 && !consumivelItem(i));
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
    const consumivel = false;
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

// ---------------------------------------------------------------- rota do Anderson
const soma = (lista) => { const m = new Map(); for (const x of lista) { const a = m.get(x.cod) || { cod: x.cod, item: x.item, qtd: 0, nota: '' }; a.qtd += x.qtd; if (x.nota && !a.nota) a.nota = x.nota; m.set(x.cod, a); } return [...m.values()]; };

// Uma saída só: sai do galpão carregado, passa pelas obras e volta. Testa todas as ordens possíveis das obras
// (são poucas) e fica com a que faz menos paradas; só repete uma obra se uma cede o que outra precisa e vice-versa.
function simularRota(ordem, doGalpao, soltosIni, tipo) {
  let carregado = [...doGalpao]; let soltos = [...soltosIni]; const paradas = [];
  const pronto = () => !soltos.length && !carregado.some((m) => tipo(m.para) === 'obra');
  for (let passada = 0; passada < 6 && !pronto(); passada++) {
    let mexeu = false;
    for (const id of ordem) {
      const deixar = carregado.filter((m) => m.para === id); const pegar = soltos.filter((m) => m.de === id);
      if (!deixar.length && !pegar.length) continue;
      carregado = carregado.filter((m) => m.para !== id); soltos = soltos.filter((m) => m.de !== id); carregado.push(...pegar);
      paradas.push({ id, pegar, deixar, carros: [] }); mexeu = true;
    }
    if (!mexeu) break;
  }
  return { paradas, carregado, ok: pronto() };
}
function permutacoes(xs) { if (xs.length <= 1) return [xs]; const out = []; xs.forEach((x, i) => { for (const p of permutacoes([...xs.slice(0, i), ...xs.slice(i + 1)])) out.push([x, ...p]); }); return out; }

function montarRota(movs, por) {
  const tipo = (id) => (por.get(id) || {}).tipo;
  const aCarros = movs.filter((m) => m.de === 'galpao' && tipo(m.para) === 'carro');
  const doGalpao = movs.filter((m) => m.de === 'galpao' && tipo(m.para) === 'obra');
  const soltos = movs.filter((m) => m.de !== 'galpao');
  const ids = [...new Set([...doGalpao.map((m) => m.para), ...soltos.map((m) => m.de), ...soltos.map((m) => m.para)])].filter((id) => tipo(id) === 'obra').sort();
  let melhor = null;
  for (const ordem of (ids.length <= 7 ? permutacoes(ids) : [ids])) {
    const r = simularRota(ordem, doGalpao, soltos, tipo);
    if (r.ok && (!melhor || r.paradas.length < melhor.paradas.length)) melhor = r;
  }
  if (!melhor) melhor = simularRota(ids, doGalpao, soltos, tipo);
  return [
    { id: 'galpao', pegar: doGalpao, deixar: [], carros: aCarros },
    ...melhor.paradas,
    { id: 'galpao', volta: true, pegar: [], deixar: melhor.carregado.filter((m) => tipo(m.para) === 'galpao'), carros: melhor.carregado.filter((m) => tipo(m.para) === 'carro') },
  ].filter((p, k, arr) => k === 0 || p.pegar.length || p.deixar.length || p.carros.length);
}
// Depois que a compra chegar no galpão: pega tudo e deixa em cada lugar, numa saída só
function rotaDaCompra(compras, por) {
  const itens = compras.filter((c) => c.cat !== 'MAQ');
  const tipo = (id) => (por.get(id) || {}).tipo;
  const daObra = itens.filter((c) => tipo(c.para) === 'obra');
  const dosCarros = itens.filter((c) => tipo(c.para) === 'carro');
  const ids = [...new Set(daObra.map((c) => c.para))];
  if (!ids.length && !dosCarros.length) return [];
  const paradas = [{ id: 'galpao', pegar: soma(daObra), deixar: [], carros: dosCarros.map((c) => ({ ...c, para: c.para })) }];
  for (const id of ids) paradas.push({ id, pegar: [], deixar: soma(daObra.filter((c) => c.para === id)), carros: [] });
  paradas.push({ id: 'galpao', volta: true, pegar: [], deixar: [], carros: [] });
  return paradas.filter((p, k) => k === 0 || p.pegar.length || p.deixar.length || p.carros.length);
}

export function render(est) {
  if (!est || est.erro || !Array.isArray(est.itens)) {
    return html`<p class="vazio">Não consegui ler a planilha de ferramentas${est && est.erro ? `: ${est.erro}` : ''}. Quando o coletor ler a planilha (pasta Pós-obra › Ferramentas › Listas), esta tela se monta sozinha.</p>`;
  }
  const r = calcular(est);
  const por = new Map(r.locais.map((l) => [l.id, l]));
  const obras = r.locais.filter((l) => l.tipo === 'obra' && !l.finalizada);
  const encerradas = r.locais.filter((l) => l.tipo === 'obra' && l.finalizada);
  const outros = r.locais.filter((l) => l.tipo !== 'obra');
  const nome = r.nomeDe;
  const compraPorItem = new Map();
  for (const c of r.compras) { const x = compraPorItem.get(c.cod) || { cod: c.cod, item: c.item, cat: c.cat, total: 0, onde: [] }; x.total += c.qtd; x.onde.push(`${nome(c.para)}: ${un(c.qtd)}`); compraPorItem.set(c.cod, x); }
  const compras = [...compraPorItem.values()].sort((a, b) => a.cod.localeCompare(b.cod, 'pt-BR', { numeric: true }));
  const comprarJa = compras.filter((c) => c.cat !== 'MAQ');
  const confirmar = compras.filter((c) => c.cat === 'MAQ');
  const rota1 = r.movs.length ? montarRota(r.movs, por) : [];
  const rota2 = rotaDaCompra(r.compras, por);
  const obrasComFalta = obras.filter((o) => o.faltas.length).length;
  const velhas = r.locais.filter((l) => l.velha && !l.finalizada);
  const resumo = (v, r1, r2 = '') => html`<div class="rp-kpi"><b>${v}</b><span>${r1}</span>${r2 ? html`<em>${r2}</em>` : ''}</div>`;

  const chips = (lista, cls) => lista.map((m) => html`<span class="rt-item rt-${cls}" title="${m.nota || ''}">${m.item} <b>×${un(m.qtd)}</b>${m.nota ? html` <i>(${m.nota})</i>` : ''}</span>`);
  const nomeCarro = (id) => nome(id).replace('Carro do ', 'carro do ');
  const parada = (p, n) => html`<li class="rt-parada ${p.volta ? 'rt-volta' : ''}"><span class="rt-n">${n}</span><div class="rt-corpo">
      <b class="rt-local">${nome(p.id)}${p.volta ? html` <em>(voltar)</em>` : ''}</b>
      ${p.pegar.length ? html`<div class="rt-linha"><span class="rt-rot rt-pegar">pegar</span>${chips(soma(p.pegar), 'pegar')}</div>` : ''}
      ${p.deixar.length ? html`<div class="rt-linha"><span class="rt-rot rt-deixar">deixar</span>${chips(p.id === 'galpao' ? soma(p.deixar) : p.deixar.length ? soma(p.deixar) : [], 'deixar')}</div>` : ''}
      ${p.carros.length ? html`<div class="rt-linha"><span class="rt-rot rt-carro">${p.volta ? 'deixar nos carros' : 'colocar nos carros'}</span>${chips(p.carros.map((m) => ({ ...m, item: `${m.item} (${nomeCarro(m.para)})` })), 'carro')}</div>` : ''}
    </div></li>`;

  return html`<div class="rp">
    <div class="rp-barra"><p class="pequeno">Só itens <b>obrigatórios de obra</b> (${est.itens.filter((i) => num(i.minObra) > 0 && !consumivelItem(i)).length} itens, sem consumíveis). Planilha ${est.arquivo || ''}, lida do Drive.</p><button type="button" class="botao" data-imprimir>🖨 Imprimir</button></div>

    <section class="ob-sec rp-resumo">
      ${resumo(comprarJa.length, comprarJa.length === 1 ? 'item para comprar' : 'itens para comprar', `${un(comprarJa.reduce((s, c) => s + c.total, 0))} unidades`)}
      ${resumo(rota1.filter((p) => p.id !== 'galpao').length, 'paradas na rota de hoje', rota1.length ? 'uma saída só' : 'nada para mover')}
      ${resumo(rota2.filter((p) => p.id !== 'galpao').length, 'paradas quando a compra chegar', 'uma saída só')}
      ${resumo(confirmar.length, 'maquinário a confirmar', 'antes de comprar')}
    </section>
    ${velhas.length ? html`<p class="aviso rp-aviso">⚠ <b>Contagem antiga ou sem data</b> em: ${velhas.map((l) => `${l.nome}${l.conferido ? ` (${dm(l.conferido)})` : ''}`).join(', ')}. Quanto mais velha a contagem, menos confiável a lista abaixo; atualize a planilha de ferramentas obrigatórias dessas obras.</p>` : ''}
    ${encerradas.length ? html`<p class="pequeno rp-nota">Obras encerradas, fora desta lista: <b>${encerradas.map((l) => l.nome).join(', ')}</b>.</p>` : ''}

    <section class="ob-sec"><div class="painel-h"><h2>1 · Lista de compras</h2><p>Uma compra só para todas as obras; tudo chega no galpão. Sem valores.</p></div>
      ${comprarJa.length ? html`<article class="cartao"><table class="tab rp-tab"><thead><tr><th>Item</th><th class="n">Comprar</th><th>Para repor em</th></tr></thead><tbody>
        ${comprarJa.map((c) => html`<tr><td><b>${c.item}</b> <span class="pequeno">${c.cod}</span></td><td class="n"><b>${un(c.total)}</b></td><td class="pequeno">${c.onde.join(' · ')}</td></tr>`)}
      </tbody></table></article>` : html`<p class="pequeno">Nada para comprar agora.</p>`}
      ${confirmar.length ? html`<article class="cartao rp-confirmar"><header class="cartao-cab"><h3>Maquinário: confirmar antes de comprar</h3><span class="pequeno">obrigatório, mas pode não estar em uso em todas as obras</span></header><table class="tab rp-tab"><thead><tr><th>Maquinário</th><th class="n">Falta</th><th>Onde falta</th></tr></thead><tbody>
        ${confirmar.map((c) => html`<tr><td><b>${c.item}</b> <span class="pequeno">${c.cod}</span></td><td class="n"><b>${un(c.total)}</b></td><td class="pequeno">${c.onde.join(' · ')}</td></tr>`)}
      </tbody></table><p class="pequeno">Pergunte ao gestor de cada obra se a obra usa mesmo; só compre o que for confirmado.</p></article>` : ''}
    </section>

    <section class="ob-sec"><div class="painel-h"><h2>2 · Rota de hoje</h2><p>Com o que já existe: sai do galpão, passa por cada obra e volta</p></div>
      ${rota1.length ? html`<ol class="rt-rota">${rota1.map((p, k) => parada(p, k + 1))}</ol>` : html`<p class="pequeno">Nenhuma movimentação necessária com o que já existe.</p>`}
    </section>

    <section class="ob-sec"><div class="painel-h"><h2>3 · Rota quando a compra chegar</h2><p>Leva do galpão o que foi comprado para quem precisa (sem o maquinário a confirmar)</p></div>
      ${rota2.length ? html`<ol class="rt-rota">${rota2.map((p, k) => parada(p, k + 1))}</ol>` : html`<p class="pequeno">Nada a levar depois da compra.</p>`}
    </section>

    <details class="caixa rp-detalhe"><summary><span class="caixa-tit">Detalhe: o que falta em cada lugar</span><span class="contador">${obrasComFalta}</span><span class="pequeno">${obrasComFalta} de ${obras.length} obras com falta · clique para ver item por item</span></summary><div class="caixa-corpo">
      ${obras.map((l) => blocoLocal(l, nome))}
      <h3 class="rp-sub">Carros e galpão</h3>
      ${outros.map((l) => blocoLocal(l, nome))}
    </div></details>

    <details class="caixa rp-como"><summary><span class="caixa-tit">Como ler esta tela</span><span class="pequeno">clique para ver</span></summary><div class="caixa-corpo"><ol>
      <li><b>Mínimo:</b> cada lugar (obra, carro, galpão) tem uma quantidade mínima de cada item. <b>Sobra</b> é o que passa do mínimo; <b>falta</b> é o que está abaixo.</li>
      <li><b>Ordem para resolver uma falta:</b> 1º a sobra do galpão · 2º a sobra de outra obra · 3º comprar. Obra abaixo do mínimo nunca cede; carro nunca cede.</li>
      <li><b>Rota de hoje:</b> uma saída só. Em cada parada, "pegar" é o que carrega ali e "deixar" é o que entrega ali; as paradas estão na ordem em que o que uma obra cede chega na outra.</li>
      <li><b>Rota quando a compra chegar:</b> a compra é uma só e entra no galpão; então o Anderson leva para cada lugar o que falta, de uma vez.</li>
      <li><b>Quebrada ou em conserto</b> não conta como disponível. <b>Consumíveis</b> não aparecem: cada obra compra os seus.</li>
      <li><b>Escada:</b> a contagem vem como "2-7D" = 2 escadas de 7 degraus; o sistema soma e mostra o tipo.</li>
      <li><b>Maquinário</b> é obrigatório, mas pode não estar em uso em todas as obras; fica à parte para confirmar antes de comprar.</li>
      <li><b>A contagem é de 15 em 15 dias</b>, porque a compra demora a chegar. Item sem contagem na planilha <b>não conta como falta</b>.</li>
    </ol></div></details>
  </div>`;
}