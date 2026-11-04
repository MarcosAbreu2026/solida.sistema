// Estoque: ferramentas, máquinas, consumíveis e EPI. Só consulta.
// Todo mundo vê o que tem no GALPÃO. A visão completa (carros e obras, situação e compras) é da
// diretoria e de quem cuida das ferramentas (pedido do Felipe, 15/10).
// Fonte: PÓS OBRA\FERRAMENTAS\LISTAS\SL_FERRAMENTAS_SOLIDA_Rnn.xlsx (aba CONTROLE), lida por
// scripts/exportar-drive.ps1. Coluna O da planilha = mínimo obrigatório em cada obra.

import { html, numero, data as fmtData } from '../formato.js';

export const CATEGORIAS = {
  FER: 'Ferramentas', MAQ: 'Maquinários', CON: 'Consumíveis', EPI: 'EPI', LIM: 'Limpeza',
  GER: 'Geral (andaimes, escadas…)', ESC: 'Escritório', COZ: 'Cozinha',
};
export const ORDEM = ['FER', 'MAQ', 'CON', 'EPI', 'LIM', 'GER', 'ESC', 'COZ'];

// funções que veem carros e obras além do galpão
export const VE_ESTOQUE_COMPLETO = ['socio', 'ferramentas', 'executor_ferramentas'];

// consumíveis: só sócios e pós-obra veem tudo (quantidade no galpão etc.). Os outros veem, só para consulta,
// os consumíveis obrigatórios de obra: a obra tem que ter, mas quem repõe é a obra — não saem do galpão
// (pedido do Felipe, 15/10).
export const VE_CONSUMIVEIS = ['socio', 'posobra'];

const num = (v) => (typeof v === 'number' ? v : null);
const fmt = (v) => (v == null || v === '' ? '' : typeof v === 'number' ? numero(v) : String(v));
const dm = (iso) => (iso ? fmtData(iso).slice(0, 5) : '');

// célula "atual" com o mínimo embaixo; vermelho quando está abaixo do mínimo
function celula(atual, min) {
  const a = num(atual); const m = num(min);
  if (atual == null && !m) return html`<td class="est-cel est-vazia"></td>`;
  const abaixo = m && (a ?? 0) < m;
  return html`<td class="est-cel ${abaixo ? 'est-abaixo' : ''}" title="${m ? `mínimo ${fmt(m)}` : ''}"><b>${atual == null ? '0' : fmt(atual)}</b>${m ? html`<span>mín ${fmt(m)}</span>` : ''}</td>`;
}

// filtro "Obrigatórias de obra": itens com mínimo de obra (coluna O), consumíveis inclusive (marcados como
// "a obra repõe": o galpão não repõe consumível)
const obrigFiltro = (i) => num(i.minObra) > 0;
const consumivelObra = (i) => i.categoria === 'CON' && num(i.minObra) > 0;
const seloRepoe = (i) => (consumivelObra(i) ? html`<em class="selo-repoe" title="Consumível obrigatório de obra: a obra compra e repõe; não sai do galpão">a obra repõe</em>` : '');

const quebradasCel =(i) => html`<td class="est-cel">${num(i.quebrada) || num(i.consertando) ? html`${num(i.quebrada) ? html`<b class="pendente">${fmt(i.quebrada)}</b><span>quebrada${i.quebrada > 1 ? 's' : ''}</span>` : ''}${num(i.consertando) ? html`<span>${fmt(i.consertando)} no conserto</span>` : ''}` : ''}</td>`;

// Abas de categoria (com "Obrigatórias de obra") — iguais nas duas visões
function abasCategorias(itens, cats) {
  return html`<div class="subnav est-cats" role="tablist">
    <a href="#/estoque" class="on" role="tab" data-est-cat="">Todas <span class="est-n">${itens.length}</span></a>
    <a href="#/estoque" role="tab" data-est-cat="OBRIG" class="est-cat-obrig" title="Itens com mínimo obrigatório de obra (coluna O). Consumíveis: a obra repõe, não saem do galpão">Obrigatórias de obra <span class="est-n">${itens.filter(obrigFiltro).length}</span></a>
    ${cats.map((g) => html`<a href="#/estoque" role="tab" data-est-cat="${g.c}">${(CATEGORIAS[g.c] || g.c).replace(/ \(.*\)$/, '')} <span class="est-n">${g.itens.length}</span></a>`)}
  </div>`;
}

// Pedidos de itens: ainda não funciona, só a estrutura para o futuro (pedido do Felipe, 15/10).
// Ideia: a obra pede no sistema → o sistema confere o estoque → se tem, cria a retirada do estoque e a
// requisição/nota para o cliente pagar o que saiu; se não tem, vira solicitação de compra.
export function pedidosFuturos({ abrir = false } = {}) {
  const campo = (rotulo, tipo = 'text') => html`<label>${rotulo}<input type="${tipo}" disabled placeholder="em breve"></label>`;
  return html`<details class="caixa est-pedidos" ${abrir ? html.seguro('open') : ''}>
    <summary><span class="caixa-tit">Pedir itens do estoque</span><span class="selo-breve">em manutenção</span></summary>
    <div class="caixa-corpo">
      <ol class="est-fluxo">
        <li><b>Pedido</b><span>a obra pede o item no sistema</span></li>
        <li><b>Confere o estoque</b><span>o sistema vê se o galpão tem</span></li>
        <li><b>Retirada do estoque</b><span>se tem, já cria a retirada</span></li>
        <li><b>Solicitação de compra</b><span>se não tem, vai para Compras</span></li>
        <li><b>Requisição / nota</b><span>para o cliente pagar o que saiu do estoque</span></li>
      </ol>
      <div class="filtros est-pedido-form">
        ${campo('Obra')}${campo('Item')}${campo('Quantidade', 'number')}${campo('Para quando', 'date')}${campo('Motivo')}
      </div>
      <div class="est-pedido-botoes">
        <button type="button" class="botao" data-em-breve>Solicitar retirada do estoque</button>
        <button type="button" class="botao" data-em-breve>Solicitação de compra</button>
        <button type="button" class="botao" data-em-breve>Gerar requisição para o cliente</button>
      </div>
      <p class="pequeno" style="margin:0">Em manutenção: esta parte está sendo preparada para o futuro. Por enquanto, os pedidos continuam como hoje.</p>
    </div>
  </details>`;
}

// Visão do galpão: lista compacta em duas colunas dentro de cada categoria
function renderGalpao(dados, itens, cats, podeCompleto) {
  const gal = (i) => i.locais.galpao || {};
  const conf = dados.conferido || {};
  const tem = itens.filter((i) => num(gal(i).atual) > 0);
  const abaixo = itens.filter((i) => num(gal(i).min) > 0 && (num(gal(i).atual) ?? 0) < gal(i).min);
  const quebradas = itens.reduce((s, i) => s + (num(i.quebrada) || 0), 0);
  const linha = (i) => {
    const g = gal(i);
    const baixo = num(g.min) > 0 && (num(g.atual) ?? 0) < g.min;
    return html`<div class="est-linha ${num(i.minObra) > 0 ? 'est-obrig' : ''}" data-texto="${`${i.cod} ${i.item}`.toLowerCase()}" data-obrig="${obrigFiltro(i) ? '1' : ''}">
      <span class="est-cod">${i.cod}</span>
      <span class="est-nome">${i.item}${num(i.minObra) > 0 ? html`<em class="selo-obrig" title="Obrigatória de obra: mínimo ${fmt(i.minObra)} por obra">obra ${fmt(i.minObra)}</em>` : ''}${seloRepoe(i)}${num(i.quebrada) ? html`<em class="est-queb">${fmt(i.quebrada)} queb.</em>` : ''}</span>
      ${i.consulta ? html`<span class="est-qtd est-consulta" title="Não sai do galpão: a obra compra e repõe">consulta</span>` : html`<span class="est-qtd ${baixo ? 'est-abaixo' : ''}" title="${num(g.min) ? `mínimo do galpão ${fmt(g.min)}` : ''}"><b>${fmt(g.atual) || '0'}</b>${num(g.min) ? html`<small>/ ${fmt(g.min)}</small>` : ''}</span>`}
    </div>`;
  };
  return html`<div class="pagina est-compacto">
    <p class="est-resumo"><b>${tem.length}</b> itens no galpão (${numero(tem.reduce((s, i) => s + gal(i).atual, 0))} un.) · <b class="pendente">${abaixo.length}</b> abaixo do mínimo · <b>${numero(quebradas)}</b> quebradas
      <span class="pequeno"> · ${dados.arquivo}${conf.galpao ? `, conferido em ${dm(conf.galpao)}${dados.viaSite && dados.viaSite.galpao ? ` (contagem feita no site por ${dados.viaSite.galpao.por})` : ''}` : ''}</span>
      ${podeCompleto ? html` · <a class="link" href="#/estoque?ver=tudo">ver carros e obras →</a>` : ''}</p>
    ${abasCategorias(itens, cats)}
    <div class="filtros est-busca"><label>Procurar item<input type="search" id="busca-estoque" placeholder="ex.: furadeira, EPI12" autocomplete="off"></label>
      <p class="pequeno" style="margin:0">Quantidade no galpão / mínimo do galpão · vermelho = abaixo do mínimo · "obra N" = obrigatória de obra (N por obra) · "a obra repõe" = consumível obrigatório: a obra tem que ter, mas não sai do galpão</p></div>
    ${cats.map((g) => html`<section class="est-grupo est-bloco" data-cat="${g.c}">
      <h3 class="est-cat-h">${CATEGORIAS[g.c] || g.c} <span class="pequeno">${g.itens.length}</span></h3>
      <div class="est-col2">${g.itens.map(linha)}</div>
    </section>`)}
  </div>`;
}

export function render(dados, { podeCompleto = false, verTudo = false, veConsumiveis = false } = {}) {
  if (!dados) return html`<div class="erro">Ainda não li a planilha de ferramentas no Drive. Confira se o Google Drive para computador está aberto (pasta G:) e recarregue em 1 minuto.</div>`;
  if (dados.erro) return html`<div class="erro">Não foi possível ler a planilha de ferramentas: ${dados.erro}</div>`;
  const completo = podeCompleto && verTudo;
  const gal = (i) => i.locais.galpao || {};
  // galpão: só os itens que o galpão tem ou deveria ter (mínimo de estoque)
  // (obrigatórias de obra entram sempre, mesmo com zero no galpão: é o que se quer conferir no filtro)
  // sem acesso aos consumíveis: só os obrigatórios de obra, sem as quantidades do galpão e dos carros (consulta)
  const itens = (dados.itens || []).filter((i) => veConsumiveis || i.categoria !== 'CON' || consumivelObra(i))
    .map((i) => (!veConsumiveis && i.categoria === 'CON' ? { ...i, consulta: true, locais: {}, quebrada: null, consertando: null, comprar: null, status: '' } : i))
    .filter((i) => completo || num(gal(i).atual) > 0 || num(gal(i).min) > 0 || obrigFiltro(i));
  const obras = completo ? (dados.obras || []) : [];
  const locais = completo ? (dados.locais || []) : (dados.locais || []).filter((l) => l.id === 'galpao');
  const conf = dados.conferido || {};
  const obrigatorios = itens.filter((i) => num(i.minObra) > 0);
  const quebradas = itens.reduce((s, i) => s + (num(i.quebrada) || 0), 0);
  const consertando = itens.reduce((s, i) => s + (num(i.consertando) || 0), 0);

  const cats = [...ORDEM, ...new Set(itens.map((i) => i.categoria).filter((c) => !ORDEM.includes(c)))]
    .map((c) => ({ c, itens: itens.filter((i) => i.categoria === c) })).filter((g) => g.itens.length);
  if (!completo) return renderGalpao(dados, itens, cats, podeCompleto);
  const nCols = 2 + locais.length + obras.length + (completo ? 3 : 1);

  const linha = (i) => {
    const obrig = num(i.minObra) > 0;
    return html`<tr class="${obrig ? 'est-obrig' : ''}" data-texto="${`${i.cod} ${i.item}`.toLowerCase()}" data-obrig="${obrigFiltro(i) ? '1' : ''}">
      <td class="est-cod">${i.cod}</td>
      <td class="est-item"><b>${i.item}</b>${obrig ? html`<span class="selo-obrig">obrigatória de obra · mín ${fmt(i.minObra)}</span>` : ''}${seloRepoe(i)}${i.obs ? html`<span class="pequeno">${i.obs}</span>` : ''}</td>
      ${locais.map((l) => celula(i.locais[l.id] && i.locais[l.id].atual, i.locais[l.id] && i.locais[l.id].min))}
      ${obras.map((o) => celula(i.obras[o], i.minObra))}
      ${completo ? html`<td class="est-cel est-total"><b>${fmt(i.totalAtual) || '0'}</b>${num(i.totalMin) ? html`<span>mín ${fmt(i.totalMin)}</span>` : ''}</td>` : ''}
      ${quebradasCel(i)}
      ${completo ? html`<td>${i.status ? html`<span class="sit-est ${String(i.status).toLowerCase()}">${i.status}${num(i.comprar) > 0 && /comprar/i.test(i.status) ? ` ${fmt(i.comprar)}` : ''}${num(i.consertar) > 0 && /consertar/i.test(i.status) ? ` ${fmt(i.consertar)}` : ''}</span>` : ''}</td>` : ''}
    </tr>`;
  };

  let cards;
  if (completo) {
    const comprar = itens.filter((i) => num(i.comprar) > 0);
    const faltaObra = obrigatorios.filter((i) => obras.some((o) => typeof i.obras[o] === 'number' && i.obras[o] < i.minObra));
    cards = html`
      <div class="card"><div class="card-valor">${itens.length}</div><div class="card-rotulo">Itens cadastrados</div><div class="card-sub">galpão, carros e obras</div></div>
      <div class="card"><div class="card-valor">${obrigatorios.length}</div><div class="card-rotulo">Obrigatórias de obra</div>
        <div class="card-sub">${faltaObra.length ? `${faltaObra.length} faltando em alguma obra` : 'nenhuma faltando nas obras'}</div></div>
      <div class="card"><div class="card-valor">${comprar.length}</div><div class="card-rotulo">Itens a comprar</div>
        <div class="card-sub">${numero(comprar.reduce((s, i) => s + i.comprar, 0))} unidades no total</div></div>
      <div class="card"><div class="card-valor">${numero(quebradas)}</div><div class="card-rotulo">Quebradas</div><div class="card-sub">${numero(consertando)} no conserto</div></div>`;
  } else {
    const tem = itens.filter((i) => num(gal(i).atual) > 0);
    const abaixo = itens.filter((i) => num(gal(i).min) > 0 && (num(gal(i).atual) ?? 0) < gal(i).min);
    cards = html`
      <div class="card"><div class="card-valor">${tem.length}</div><div class="card-rotulo">Itens disponíveis no galpão</div>
        <div class="card-sub">${numero(tem.reduce((s, i) => s + gal(i).atual, 0))} unidades</div></div>
      <div class="card"><div class="card-valor">${abaixo.length}</div><div class="card-rotulo">Abaixo do mínimo do galpão</div><div class="card-sub">em vermelho na tabela</div></div>
      <div class="card"><div class="card-valor">${numero(quebradas)}</div><div class="card-rotulo">Quebradas</div><div class="card-sub">${numero(consertando)} no conserto</div></div>`;
  }

  return html`<div class="pagina">
    <p class="pequeno" style="margin:0">Galpão, carros e obras · planilha ${dados.arquivo} (Drive › PÓS OBRA › FERRAMENTAS › LISTAS), salva em ${fmtData((dados.modificado || '').slice(0, 10))}${conf.galpao ? `, galpão conferido em ${dm(conf.galpao)}` : ''} · <a class="link" href="#/estoque">← só o galpão</a></p>
    <div class="cards">${cards}</div>
    ${abasCategorias(itens, cats)}
    <div class="filtros" style="margin-top:18px">
      <label>Procurar item<input type="search" id="busca-estoque" placeholder="ex.: furadeira, EPI12" autocomplete="off"></label>
      <p class="pequeno" style="margin:0">Em destaque: obrigatórias de obra. Número vermelho = abaixo do mínimo.</p>
    </div>

    <article class="cartao cartao-largo">
      <div class="tabela-rolagem"><table class="tab est-tab">
        <thead><tr>
          <th>Cód.</th><th>Item</th>
          ${locais.map((l) => html`<th class="est-cel">${completo ? l.nome : 'No galpão'}${completo && conf[l.id] ? html`<span class="pequeno">conferido ${dm(conf[l.id])}</span>` : ''}</th>`)}
          ${obras.map((o) => html`<th class="est-cel">${o}${conf[o] ? html`<span class="pequeno">conferido ${dm(conf[o])}</span>` : ''}</th>`)}
          ${completo ? html`<th class="est-cel">Total</th>` : ''}<th class="est-cel">Quebradas</th>${completo ? html`<th>Situação</th>` : ''}
        </tr></thead>
        ${cats.map((g) => html`<tbody class="est-grupo" data-cat="${g.c}">
          <tr class="est-cat"><th colspan="${nCols}">${CATEGORIAS[g.c] || g.c} <span class="pequeno">${g.itens.length} itens</span></th></tr>
          ${g.itens.map(linha)}
        </tbody>`)}
      </table></div>
    </article>
    <p class="pequeno">${completo ? 'Cada célula: quantidade atual e, embaixo, o mínimo daquele local. Nas obras, o mínimo é o obrigatório de obra (coluna O da planilha). Situação e quantidade a comprar vêm das contas da própria planilha.' : 'Quantidade no galpão e, embaixo, o mínimo que o galpão deve ter.'}</p>
  </div>`;
}
