// Administrativo (Isabelle), desenho do Marcos pág. 19: ainda em definição.
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';

export function painel(ctx) {
  return html`${pd.pergunta(ctx.dep.pergunta)}
    ${pd.emDefinicao(['Ainda sem indicadores definidos.', 'Reunião com a Isabelle para listar as rotinas e o que precisa de alerta.'])}`;
}
