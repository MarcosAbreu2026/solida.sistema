// Compras (Marcos H. · Pedro M.), desenho do Marcos pág. 13: solicitações e cotações paradas no Mais Controle.
// Fonte: indicadores e alertas do agente de Suprimentos (Mais Controle). Os períodos (ano, mês, semana) ainda não vêm do agente.
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { avisoLeitura, cartaoDoAgente } from './comum.js';

export function painel(ctx) {
  const area = ctx.area;
  const acimaDeZero = (n) => (n > 0 ? 'critico' : 'ok');
  const cards = [
    cartaoDoAgente(area, /paradas/i, { rotulo: 'Solicitações paradas há mais de 3 dias', meta: 'Meta 0', nivel: acimaDeZero }),
    cartaoDoAgente(area, /em aprova/i, { rotulo: 'Solicitações em aprovação' }),
    cartaoDoAgente(area, /a atender/i, { rotulo: 'Solicitações a atender' }),
    cartaoDoAgente(area, /cota[çc]/i, { rotulo: 'Cotações em aberto' }),
  ];
  const linhasPeriodo = ['Desde o início do ano', 'Mês', 'Semana', 'Semana passada'].map((p) => [html`<b class="pd-obra">${p}</b>`, '', '', '']);
  return html`${pd.pergunta(ctx.dep.pergunta)}
    ${avisoLeitura(ctx, 'Leitura do Mais Controle (agente de Suprimentos)')}
    ${pd.secao('Agora', 'Fonte: Mais Controle', pd.cartoes(cards))}
    ${pd.secao('Solicitações e cotações por período', 'Três níveis de verificação: ano, mês e semana · o agente ainda não manda por período', pd.tabela(['Período', 'Solicitações em aberto', 'Cotações em aberto', 'Finalizadas'], linhasPeriodo))}
    ${pd.secao('Quem precisa agir', 'Compras paradas · cada alerta vira tarefa', pd.quemAgir(pd.alertasDoAgente(area, { veValores: ctx.veValores, obras: ctx.visiveis }), { setor: ctx.dep.setor }))}`;
}
