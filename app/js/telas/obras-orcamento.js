// Página "Cadastro de obras" dos setores que também cadastram e editam obras (ORC Obras Novas, Pós-obra e ORC Terceirizado Laranja): a mesma tela do Cadastros da
// diretoria, sem o botão de excluir (só a diretoria exclui). As regras do banco garantem isso.
import { html } from '../formato.js';
import { secaoObras } from './cadastro-obras.js';

export function render({ obrasCad = [], msg = '', listaAberta = true }) {
  return html`<div class="pagina acessos">
    ${msg ? html`<p class="msg ok">${msg}</p>` : ''}
    ${secaoObras({ obrasCad, podeExcluir: false, listaAberta })}
  </div>`;
}
