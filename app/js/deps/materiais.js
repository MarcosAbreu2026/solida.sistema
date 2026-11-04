// Materiais e venda de materiais (Marcos H. · Flávio), desenho do Marcos pág. 14: o que saiu do galpão, o que foi vendido e o que está acabando.
// Itens abaixo do mínimo: planilha SL_FERRAMENTAS (ctx.drive.estoque, coluna do galpão). Saídas e vendas ainda não são somadas pelo sistema.
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function painel(ctx) {
  const est = ctx.drive && ctx.drive.estoque;
  const itens = (est && est.itens) || [];
  const gal = (i) => (i.locais && i.locais.galpao) || {};
  // materiais = consumíveis (categoria CON); as ferramentas e máquinas ficam no painel de Ferramentas e EPI
  const abaixo = itens.filter((i) => i.categoria === 'CON' && !i.consulta && n(gal(i).min) > 0 && (n(gal(i).atual) ?? 0) < gal(i).min)
    .map((i) => ({ i, falta: gal(i).min - (n(gal(i).atual) ?? 0) })).sort((a, b) => b.falta - a.falta);
  const conf = est && est.conferido && est.conferido.galpao;
  // dentro do Transporte e Logística (pedido do Felipe, 04/11: "venda de materiais" fica no Transporte)
  if (ctx.parte === 'vendas') return pd.secao('Venda e saída de materiais', 'Marcos H. · Flávio · o que saiu do galpão e o que foi vendido', pd.cartoes([
    { rotulo: 'Saídas do galpão no mês', valor: '—', sub: 'guias de movimentação (Estoque) ainda não somadas aqui', href: '#/estoque/movimentacao' },
    { rotulo: 'Material vendido no mês', valor: '—', sub: 'grupo Galpão Vendas ainda não lido' },
    { rotulo: 'Consumíveis abaixo do mínimo', valor: est ? String(abaixo.length) : '—', sub: est ? 'no galpão (planilha de ferramentas)' : '', meta: 'Meta 0', nivel: est ? (abaixo.length ? 'critico' : 'ok') : '', href: '#/estoque' },
    { rotulo: 'Saídas por obra', valor: '—', sub: 'guias de movimentação ainda não somadas aqui', href: '#/estoque/movimentacao' },
  ]));
  return html`${pd.pergunta(ctx.dep.pergunta)}
    ${est ? pd.aviso(`Planilha ${est.arquivo}${est.modificado ? `, salva em ${pd.dm(String(est.modificado).slice(0, 10))}` : ''}${conf ? ` · galpão conferido em ${pd.dm(conf)}` : ''}. Saídas e vendas ainda não são somadas pelo sistema.`, 'info') : pd.aviso('A planilha de ferramentas e materiais (SL_FERRAMENTAS) ainda não foi lida do Drive.')}
    ${pd.secao('Galpão', 'O responsável define o que mostrar', pd.cartoes([
      { rotulo: 'Saídas do galpão no mês', valor: '—', sub: 'guias de movimentação (Estoque) ainda não somadas aqui' },
      { rotulo: 'Material vendido no mês', valor: '—', sub: 'grupo Galpão Vendas ainda não lido' },
      { rotulo: 'Itens abaixo do mínimo', valor: est ? String(abaixo.length) : '—', sub: est ? 'consumíveis abaixo do mínimo do galpão' : '', meta: 'Meta 0', nivel: est ? (abaixo.length ? 'critico' : 'ok') : '', href: '#/estoque' },
      { rotulo: 'Saídas por obra', valor: '—', sub: 'guias de movimentação ainda não somadas aqui' },
    ]))}
    ${est ? pd.secao('O que está acabando', `${abaixo.length} consumíveis abaixo do mínimo do galpão · os 12 com mais falta`, pd.tabela(['Item', 'No galpão', 'Mínimo', 'Falta'],
      abaixo.slice(0, 12).map(({ i, falta }) => [html`<b>${i.item}</b> <span class="pd-obra-sub">${i.cod}</span>`, String(n(gal(i).atual) ?? 0), String(gal(i).min), html`<b>${falta.toLocaleString('pt-BR')}</b>`]),
      { vazio: 'Nenhum item abaixo do mínimo.' })) : ''}
    ${pd.caixa('Sugestão de conteúdo', pd.itens(['Material que sai do galpão, por obra e por pessoa', 'Material vendido, com valor e cliente', 'Itens com estoque abaixo do mínimo']), { direita: 'Origem: grupo Galpão Vendas e Gestão do Galpão' })}`;
}
