// Início · visão do CEO (desenho do Marcos). Contrato e ctx: ver comum.js.
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { avisoLeitura } from './comum.js';

export function painel(ctx) {
  const g = (ctx.CFG && ctx.CFG.geral) || {};
  return html`${pd.pergunta('O que está acontecendo hoje no canteiro? Está de acordo com o planejado? Se não, quem precisa agir?', 'Pergunta do dia')}
    ${avisoLeitura(ctx)}
    ${pd.secao('Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir(pd.alertasDoAgente(g, { veValores: ctx.veValores, obras: ctx.visiveis })))}`;
}
