// Treinamentos: aba criada a pedido do Felipe (15/10); o conteúdo ainda vai ser definido com ele.

import { html } from '../formato.js';

export function render() {
  return html`<div class="pagina">
    <div class="tr-vazio">
      <span class="tr-icone">🎓</span>
      <h2>Treinamentos</h2>
      <p>Aqui vão ficar os treinamentos da equipe. O conteúdo ainda vai ser definido com a diretoria.</p>
      <p class="pequeno">Para sugerir um treinamento, use o botão “Pedir alteração”.</p>
    </div>
  </div>`;
}
