// Acessos (só diretoria, na nuvem): quem criou conta aparece aqui "aguardando liberação"; a diretoria define a
// função e as obras e libera. Também dá para bloquear quem saiu da empresa. As regras do banco garantem que só
// a diretoria muda função, obras e bloqueio.

import { html } from '../formato.js';
import { FUNCOES, funcaoPorId } from '../funcoes.js';

export function render({ perfis = [], obras = [], msg = '' }) {
  const linha = (p) => {
    const f = p.funcao ? funcaoPorId(p.funcao) : null;
    return html`<form class="ac-linha ${p.funcao ? '' : 'ac-nova'} ${p.ativo === false ? 'ac-bloq' : ''}" data-acesso="${p.id}">
      <div class="ac-quem"><b>${p.nome || p.email}</b><span class="pequeno">${p.email}${p.funcao ? '' : ' · aguardando liberação'}${p.ativo === false ? ' · bloqueado' : ''}</span></div>
      <label>Função<select name="funcao"><option value="">— escolher —</option>${FUNCOES.map((x) => html`<option value="${x.id}" ${x.id === p.funcao ? html.seguro('selected') : ''}>${x.nome}</option>`)}</select></label>
      <label class="ac-obras">Obras <span class="pequeno">(funções de obra)</span>
        <select name="obras" multiple size="3">${obras.map((o) => html`<option ${(p.obras || []).includes(o) ? html.seguro('selected') : ''}>${o}</option>`)}</select></label>
      <label class="check"><input type="checkbox" name="ativo" ${p.ativo === false ? '' : html.seguro('checked')}> ativo</label>
      <button type="submit" class="botao on">${p.funcao ? 'Salvar' : 'Liberar'}</button>
      ${f && f.porObra && !(p.obras || []).length ? html`<span class="pequeno pendente">escolha as obras</span>` : ''}
    </form>`;
  };
  const novas = perfis.filter((p) => !p.funcao);
  return html`<div class="pagina acessos">
    <p class="pequeno">Cada pessoa cria a própria conta com o e-mail @construcaosolida.com na tela de entrada. Aqui você define a função (o que ela vê) e libera.</p>
    ${msg ? html`<p class="msg ok">${msg}</p>` : ''}
    ${novas.length ? html`<section class="secao"><h2>Aguardando liberação <span class="pequeno">${novas.length}</span></h2>${novas.map(linha)}</section>` : ''}
    <section class="secao"><h2>Equipe <span class="pequeno">${perfis.length - novas.length}</span></h2>${perfis.filter((p) => p.funcao).map(linha)}</section>
  </div>`;
}
