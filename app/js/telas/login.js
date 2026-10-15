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

// ---------------------------------------------------------------- na nuvem (Supabase)
// Login por usuário e senha, criados pela diretoria (Acessos). modo: entrar · nova-senha (primeiro acesso) · esqueci
export function renderNuvem({ modo = 'entrar', erro = '', info = '', usuario = '' } = {}) {
  const lado = html`<div class="login-lado"><img src="img/logo.png" alt="Sólida"><p>Painel da empresa</p></div>`;
  const link = (m, txt) => html`<button type="button" class="link login-link" data-login-modo="${m}">${txt}</button>`;
  const msg = html`<p class="msg err" id="msg-login">${erro}</p>${info ? html`<p class="msg ok">${info}</p>` : ''}`;
  let corpo;
  if (modo === 'nova-senha') {
    corpo = html`<form class="login-form" data-modo="nova-senha" novalidate><h1>Crie a sua senha</h1>
      <p class="pequeno">Primeiro acesso: troque a senha provisória por uma só sua (8 caracteres ou mais).</p>
      <label>Nova senha<input type="password" name="senha" autocomplete="new-password" minlength="8" required></label>
      <label>Repita a senha<input type="password" name="senha2" autocomplete="new-password" minlength="8" required></label>
      ${msg}<button type="submit" class="btn">Salvar e entrar</button><p>${link('sair', 'Sair')}</p></form>`;
  } else if (modo === 'esqueci') {
    corpo = html`<div class="login-form"><h1>Esqueci a senha</h1>
      <p>Peça para a diretoria (Felipe ou Marcos) redefinir a sua senha. Você recebe uma senha provisória e cria a sua de novo no primeiro acesso.</p>
      <p>${link('entrar', '← Voltar para entrar')}</p></div>`;
  } else {
    corpo = html`<form class="login-form" data-modo="entrar" novalidate><h1>Entrar</h1>
      <p class="pequeno">Use o usuário e a senha que a diretoria passou para você.</p>
      <label>Usuário<input type="text" name="usuario" value="${usuario}" placeholder="ex.: mariana" autocapitalize="none" spellcheck="false" autocomplete="username" required></label>
      <label>Senha<input type="password" name="senha" autocomplete="current-password" required></label>
      ${msg}<button type="submit" class="btn">Entrar</button>
      <p class="login-links">${link('esqueci', 'Esqueci a senha')}</p></form>`;
  }
  return html`${lado}<div class="login-corpo">${corpo}</div>`;
}
