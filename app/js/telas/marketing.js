// Marketing (pedido de 21/10): caixinha nova no menu, vista só por administrativo, financeiro e diretoria
// (Marcos e Márcio). O conteúdo ainda vai ser definido com a diretoria; por enquanto a página só mostra
// de onde os dados poderiam vir e ideias do que colocar aqui.

import { html } from '../formato.js';

export function render() {
  return html`<div class="pagina marketing">
    <div class="tr-vazio">
      <span class="tr-icone">📣</span>
      <h2>Marketing</h2>
      <p>Esta aba é vista só por administrativo, financeiro e diretoria. O conteúdo ainda vai ser definido.</p>
    </div>
    <section class="secao"><h2>Ideias do que colocar aqui</h2>
      <ul class="tn-ideias">
        <li>Calendário de postagens e o que está aprovado para publicar.</li>
        <li>Portfólio das obras concluídas: fotos, antes e depois, quem autorizou o uso da imagem.</li>
        <li>Depoimentos de clientes e arquitetos parceiros.</li>
        <li>Material comercial pronto (apresentação da Sólida, modelo de proposta, fotos por tipo de obra).</li>
        <li>Resultados das redes e dos anúncios do mês.</li>
        <li>Pedidos de arte e vídeo, com quem pediu, prazo e status.</li>
        <li>Orçamentos e arquiteturas que mais trazem obra (já existe em Comercial e orçamentos), para decidir onde investir.</li>
      </ul>
      <p class="pequeno">Hoje as pastas MARKETING MARCOS e MARKETING SOLIDA, no Drive, guardam os arquivos. Diga o que você quer ver aqui e eu monto.</p>
    </section>
  </div>`;
}
