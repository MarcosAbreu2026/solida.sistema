// Orçamento (Isabel · Leandro), desenho do Marcos pág. 11: status dos orçamentos do ano, resultado do ano e obras fechadas por ano.
// Fonte: SL_ORÇAMENTOS<ano> no Drive (ctx.drive.orcamentos; a situação é a cor da linha na planilha) + indicadores do agente Comercial.
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { cartaoDoAgente, num } from './comum.js';

const brl = (v) => (v >= 1e6 ? `R$ ${(Math.round(v / 1e5) / 10).toLocaleString('pt-BR')} mi` : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));

export function painel(ctx) {
  const crm = pd.secao('CRM dos orçamentos', 'O que ainda vamos fechar: arraste o card pelas colunas · prazo de entrega, início previsto e tarefas ficam dentro do card · ★ viável aparece no cronograma geral de Operações', ctx.quadroOrc ? html.seguro(ctx.quadroOrc()) : '');
  const com =ctx.CFG && ctx.CFG.areas.find((a) => a.id === 'comercial');
  const dados = ctx.drive && ctx.drive.orcamentos;
  const todos = (dados && dados.orcamentos) || [];
  const anos = [...new Set(todos.map((o) => o.ano))].sort();
  const ano = anos[anos.length - 1];
  const xs = todos.filter((o) => o.ano === ano);
  const conta = (s) => xs.filter((o) => o.situacao === s).length;
  const fonte = ((dados && dados.fontes) || []).find((f) => f.ano === ano);
  const alertas = pd.alertasDoAgente(com, { veValores: ctx.veValores });

  if (!xs.length) {
    return html`${pd.pergunta(ctx.dep.pergunta)}
      ${crm}
      ${pd.aviso('A planilha de orçamentos (SL_ORÇAMENTOS) ainda não foi lida do Drive.')}
      ${pd.secao('Quem precisa agir', '', pd.quemAgir(alertas, { setor: ctx.dep.setor }))}`;
  }
  const fech = conta('fechado'); const nao = conta('nao_fechado');
  const andamento = conta('em_orcamento') + conta('aguardando') + conta('enviado');
  const semCor = xs.filter((o) => !o.situacao).length;
  const conv = fech + nao ? fech / (fech + nao) : null;
  const prazo = cartaoDoAgente(com, /no prazo|10 dias/i, { rotulo: 'Orçamentos em até 10 dias', meta: 'Meta ≥ 90%', semDado: 'a planilha não tem a data do pedido nem a do envio' });
  const enviadoValor = xs.filter((o) => o.situacao === 'enviado' && typeof o.valor === 'number').reduce((s, o) => s + o.valor, 0);

  const porAno = anos.slice(-3).map((a) => {
    const f = todos.filter((o) => o.ano === a && o.situacao === 'fechado');
    const m2 = f.reduce((s, o) => s + (typeof o.area === 'number' ? o.area : 0), 0);
    const valor = f.reduce((s, o) => s + (typeof o.valor === 'number' ? o.valor : 0), 0);
    const m2v = f.filter((o) => typeof o.area === 'number' && o.area > 0 && typeof o.valor === 'number').reduce((s, o) => s + o.area, 0);
    const valv = f.filter((o) => typeof o.area === 'number' && o.area > 0 && typeof o.valor === 'number').reduce((s, o) => s + o.valor, 0);
    const so = html`<span class="pd-def">só sócios</span>`;
    return [html`<b class="pd-obra">${a}</b>`, f.length ? String(f.length) : '',
      m2 ? `${Math.round(m2).toLocaleString('pt-BR')} m²` : '',
      ctx.veValores ? (valor ? brl(valor) : '') : so,
      ctx.veValores ? (m2v ? brl(valv / m2v) : '') : so];
  });

  return html`${pd.pergunta(ctx.dep.pergunta)}
    ${crm}
    ${pd.aviso(`Planilha ${fonte ? fonte.arquivo : `SL_ORÇAMENTOS${ano}`}${fonte && fonte.modificado ? ` (salva em ${pd.dm(fonte.modificado.slice(0, 10))})` : ''}${dados.geradoEm ? `, lida em ${pd.dm(String(dados.geradoEm).slice(0, 10))}` : ''}. A situação de cada orçamento é a cor da linha na planilha.`, 'info')}
    ${pd.secao(`Status dos orçamentos de ${ano}`, 'Foco das reuniões · Excel de orçamentos', pd.cartoes([
      { rotulo: 'Em orçamento', valor: String(conta('em_orcamento')) },
      { rotulo: 'Aguardando arquiteto ou fornecedor', valor: String(conta('aguardando')) },
      { rotulo: 'Enviado, sem resposta', valor: String(conta('enviado')), sub: ctx.veValores && enviadoValor ? `${brl(enviadoValor)} aguardando resposta` : '' },
      { rotulo: 'Não fechado', valor: String(nao) },
      { rotulo: 'Fechado', valor: String(fech), nivel: 'ok' },
    ], { colunas: 5 }))}
    ${pd.secao('Resultado do ano', `${fech} fechados e ${fech + nao} com resposta · meta do POP de conversão: 25%`, pd.cartoes([
      { rotulo: 'Taxa de conversão', valor: pd.pct(conv), sub: `${fech} de ${fech + nao} com resposta`, meta: 'Meta ≥ 25%', nivel: conv == null ? '' : conv >= 0.25 ? 'ok' : 'critico' },
      { rotulo: 'Em andamento', valor: String(andamento), sub: `${conta('em_orcamento')} + ${conta('aguardando')} + ${conta('enviado')} (em orçamento, aguardando, enviado)` },
      { rotulo: 'Orçamentos no ano', valor: num(xs.length), sub: `${fech} fechados, ${nao} não fechados, ${andamento} em andamento${semCor ? `, ${semCor} sem cor` : ''}` },
      prazo,
    ]))}
    ${pd.secao('Obras fechadas por ano', ctx.veValores ? 'R$/m² médio = valor fechado ÷ m² fechados (só orçamentos com área e valor)' : 'Valores só para sócios', pd.tabela(['Ano', 'Obras fechadas', 'm² fechados', 'Valor fechado', 'R$/m² médio'], porAno))}
    ${pd.secao('Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir(alertas, { setor: ctx.dep.setor }))}
    ${pd.caixa('O que falta para fechar esses números', pd.itens([
      `O status do orçamento é a cor da linha na planilha${semCor ? `: ${semCor} orçamentos de ${ano} estão sem cor reconhecida` : ''}. O ideal é virar uma coluna de status para o sistema ler sem depender da cor.`,
      'Para medir "orçamento em até 10 dias", a planilha precisa da data do pedido e da data do envio.',
      `A planilha traz ÁREA, VALOR TOTAL e R$/m², que alimentam o preço médio, o m² e o valor fechado (anos lidos: ${anos.join(', ')}).`,
    ]))}`;
}
