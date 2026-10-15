// Acessos (só diretoria, na nuvem): criar o login de cada pessoa (usuário + senha provisória), mudar função e
// obras, bloquear quem saiu e redefinir a senha de quem esqueceu. A pessoa cria a própria senha no primeiro
// acesso. As regras do banco garantem que só a diretoria faz isso.

import { html } from '../formato.js';
import { FUNCOES, funcaoPorId } from '../funcoes.js';

const opcoesFuncao = (sel = '') => FUNCOES.map((x) => html`<option value="${x.id}" ${x.id === sel ? html.seguro('selected') : ''}>${x.nome}</option>`);
const opcoesObras = (obras, sel = []) => obras.map((o) => html`<option ${sel.includes(o) ? html.seguro('selected') : ''}>${o}</option>`);

export function render({ perfis = [], obras = [], msg = '', aviso = null }) {
  const linha = (p) => html`<form class="ac-linha ${p.ativo === false ? 'ac-bloq' : ''}" data-acesso="${p.id}">
    <div class="ac-quem"><b>${p.nome || p.usuario}</b><span class="pequeno">usuário: <b>${p.usuario || p.email}</b>${p.trocar_senha ? ' · ainda não criou a senha' : ''}${p.ativo === false ? ' · bloqueado' : ''}</span></div>
    <label>Função<select name="funcao"><option value="">— escolher —</option>${opcoesFuncao(p.funcao)}</select></label>
    <label class="ac-obras">Obras <span class="pequeno">(funções de obra)</span><select name="obras" multiple size="3">${opcoesObras(obras, p.obras || [])}</select></label>
    <label class="check"><input type="checkbox" name="ativo" ${p.ativo === false ? '' : html.seguro('checked')}> ativo</label>
    <span class="ac-botoes"><button type="submit" class="botao on">Salvar</button>
      <button type="button" class="botao" data-redefinir-senha="${p.id}|${p.nome || p.usuario}">Nova senha</button></span>
    ${funcaoPorId(p.funcao || '').porObra && p.funcao && !(p.obras || []).length ? html`<span class="pequeno pendente">escolha as obras</span>` : ''}
  </form>`;
  return html`<div class="pagina acessos">
    ${aviso ? html`<div class="ac-aviso"><b>${aviso.titulo}</b><p>Usuário: <code>${aviso.usuario}</code> · senha provisória: <code>${aviso.senha}</code></p>
      <p class="pequeno">Passe para a pessoa. No primeiro acesso ela cria a própria senha. Esta senha não aparece de novo.</p></div>` : ''}
    ${msg ? html`<p class="msg ok">${msg}</p>` : ''}
    <section class="secao"><h2>Criar login</h2>
      <form class="ac-novo" id="ac-novo">
        <label>Nome<input name="nome" placeholder="ex.: Mariana C." required></label>
        <label>Usuário<input name="usuario" placeholder="ex.: mariana" autocapitalize="none" spellcheck="false" required></label>
        <label>Função<select name="funcao" required><option value="">— escolher —</option>${opcoesFuncao()}</select></label>
        <label class="ac-obras">Obras <span class="pequeno">(funções de obra)</span><select name="obras" multiple size="3">${opcoesObras(obras)}</select></label>
        <button type="submit" class="botao on">Criar login</button>
      </form>
      <p class="pequeno">O sistema gera uma senha provisória e mostra aqui uma vez. Usuário: letras minúsculas, sem acento (pode ter ponto, ex.: pedro.novais).</p>
    </section>
    <section class="secao"><h2>Equipe <span class="pequeno">${perfis.length}</span></h2>${perfis.map(linha)}</section>
  </div>`;
}
