// Tela de entrada do sistema. Modo teste: qualquer usuário e senha entram; a função e as obras
// são escolhidas na caixa "Modo teste". Com o Supabase, a caixa some e a função vem do cadastro.

import { html } from '../formato.js';
import { FUNCOES, funcaoPorId } from '../funcoes.js';

export function render({ obras = [], ultimo = {}, erro = '' }) {
  const funcao = ultimo.funcao || 'socio';
  return html`<div class="login-lado">
      <img src="img/logo.png" alt="Sólida">
      <p>Painel da empresa</p>
    </div>
    <div class="login-corpo">
      <form id="form-login" class="login-form" autocomplete="off" novalidate>
        <h1>Entrar</h1>
        <p class="pequeno">Use o seu usuário e senha da Sólida.</p>
        <label>Usuário<input type="search" name="usuario" value="${ultimo.usuario || ''}" autocapitalize="none" spellcheck="false" required></label>
        <label>Senha<input type="password" name="senha" autocomplete="current-password" required></label>

        <fieldset class="teste-caixa">
          <legend>Modo teste</legend>
          <p class="pequeno">Enquanto os acessos não estão cadastrados, qualquer usuário e senha entram. Escolha aqui o perfil que você quer ver.</p>
          <label>Nome<input type="search" name="nome" value="${ultimo.nome || ''}" placeholder="ex.: Pedro"></label>
          <label>Função<select name="funcao">${FUNCOES.map((f) => html`<option value="${f.id}" ${f.id === funcao ? html.seguro('selected') : ''}>${f.nome}</option>`)}</select></label>
          <fieldset class="obras-sel" ${funcaoPorId(funcao).porObra ? '' : html.seguro('hidden')}><legend>Obras vinculadas</legend>
            ${obras.length
              ? obras.map((o) => html`<label class="check"><input type="checkbox" name="obras" value="${o}" ${(ultimo.obras || []).includes(o) ? html.seguro('checked') : ''}> ${o}</label>`)
              : html`<span class="pequeno">Carregando as obras…</span>`}
          </fieldset>
        </fieldset>

        <p class="msg err" id="msg-login">${erro}</p>
        <button type="submit" class="btn">Entrar</button>
      </form>
    </div>`;
}
