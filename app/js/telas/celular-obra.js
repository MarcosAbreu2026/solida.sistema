// Celular da obra (desenho do Marcos): o celular fica na obra; estagiário, encarregado e gestor lançam o executado do dia,
// o efetivo (até 12h) e o diário de obra. O ponto continua sendo batido no Sólides.
import { html } from '../formato.js';

export function render(ctx, cod) {
  return html`<div class="cel"><p class="pd-vazio">Celular da obra ${cod}: em montagem.</p></div>`;
}

// registros do celular da obra já carregados (para os painéis)
export const registros = () => [];
