// Financeiro (Letícia · valores só para sócios), desenho do Marcos pág. 17: pagamento ou recebimento travando obra.
// Fonte: indicadores e alertas do agente Financeiro (Conta Azul e Mais Controle). Quem não vê valores vê só o que não é R$.
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { cartaoDoAgente } from './comum.js';

export function painel(ctx) {
  const area = ctx.area; const v = ctx.veValores;
  const zero = (n) => (n > 0 ? 'critico' : 'ok');
  const cards = [
    cartaoDoAgente(area, /pend[êe]ncias|beevale|paradas/i, { rotulo: 'Pendências paradas há mais de 7 dias', meta: 'Meta 0', veValores: v, nivel: zero }),
    cartaoDoAgente(area, /medi[çc][õo]es.*cobrad/i, { rotulo: 'Medições cobradas na terça', meta: 'Meta 100%', veValores: v }),
    cartaoDoAgente(area, /prazo.*recebimento/i, { rotulo: 'Prazo de recebimento', meta: 'Meta ≤ 15 dias', veValores: v }),
    cartaoDoAgente(area, /inadimpl/i, { rotulo: 'Inadimplência', meta: 'Meta ≤ 3%', veValores: v }),
    cartaoDoAgente(area, /margem/i, { rotulo: 'Margem líquida', meta: 'Meta ≥ 12%', veValores: v }),
  ];
  const desvio = cartaoDoAgente(area, /desvio/i, { rotulo: 'Pior desvio de custo por obra', meta: 'Meta ≤ 5%', veValores: v });
  return html`${pd.pergunta(ctx.dep.pergunta)}
    ${pd.aviso(`Em definição: o financeiro será detalhado depois. Abaixo, o que já existe no painel atual.${v ? '' : ' Valores visíveis só para sócios.'}`)}
    ${pd.secao('Indicadores previstos', 'Fontes: Conta Azul e Mais Controle', pd.cartoes([...cards, desvio], { colunas: 3 }))}
    ${pd.secao('Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir(pd.alertasDoAgente(area, { veValores: v }), { setor: ctx.dep.setor }))}`;
}
