// Obras em orçamento: cadastro de obras e pós-obras que ainda estão em orçamento. Só o setor ORC Obras Novas (Isabel, Leandro…) e a diretoria veem e mexem;
// as regras do banco garantem isso. Quando a obra é fechada, a diretoria troca a situação em Cadastros e ela passa a ser uma obra de verdade.
import { html } from '../formato.js';

const ehObra = (codigo) => /^mo/i.test(String(codigo || '').trim());

export function render({ obrasCad = [], msg = '' }) {
  const lista = obrasCad.filter((o) => o.situacao === 'orcamento');
  const linha = (o) => html`<form class="ac-linha" data-obraorc="${o.codigo}">
    <div class="ac-quem"><b>${o.codigo}</b></div>
    <label>Nome<input name="nome" value="${o.nome || ''}" placeholder="ex.: Residencial X"></label>
    <span class="ac-botoes"><button type="submit" class="botao on">Salvar</button><button type="button" class="ac-mini" data-excluir-obraorc="${o.codigo}" title="Tirar esta obra da lista">Excluir</button></span>
  </form>`;
  const grupo = (titulo, itens) => itens.length ? html`<h3 class="ac-grupo-obra">${titulo} <span class="pequeno">${itens.length}</span></h3>${itens.map(linha)}` : '';
  return html`<div class="pagina acessos">
    ${msg ? html`<p class="msg ok">${msg}</p>` : ''}
    <section class="secao"><h2>Obras em orçamento <span class="pequeno">${lista.length}</span></h2>
      <p class="pequeno">Obras e pós-obras que ainda estão em orçamento. Elas aparecem na caixinha de obra das tarefas e das atas, em grupos separados, e <b>só o setor ORC Obras Novas e a diretoria veem</b>. Obra tem código <b>Mo…</b> (ex.: Mo461). Pós-obra entra na lista como <b>PO - nome</b> (ex.: PO - Sogra do Thiago).</p>
      <form class="ac-novo" id="obo-novo">
        <label>Tipo<select name="tipo"><option value="obra">Obra</option><option value="pos">Pós-obra</option></select></label>
        <label>Código <span class="pequeno">(só obra)</span><input name="codigo" placeholder="ex.: Mo461" autocapitalize="none" spellcheck="false"></label>
        <label>Nome<input name="nome" placeholder="ex.: Sinagoga Leblon" required></label>
        <button type="submit" class="botao on">Cadastrar em orçamento</button>
      </form>
      ${lista.length ? html`${grupo('Obras em orçamento', lista.filter((o) => ehObra(o.codigo)))}${grupo('Pós-obras em orçamento', lista.filter((o) => !ehObra(o.codigo)))}` : html`<p class="vazio">Nenhuma obra em orçamento ainda.</p>`}
    </section>
  </div>`;
}
