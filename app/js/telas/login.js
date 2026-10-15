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
// modo: entrar · criar · esqueci · nova-senha · aguardando (conta criada, esperando a diretoria definir a função)
export function renderNuvem({ modo = 'entrar', erro = '', info = '', email = '' } = {}) {
  const lado = html`<div class="login-lado"><img src="img/logo.png" alt="Sólida"><p>Painel da empresa</p></div>`;
  const link = (m, txt) => html`<button type="button" class="link login-link" data-login-modo="${m}">${txt}</button>`;
  const msg = html`<p class="msg err" id="msg-login">${erro}</p>${info ? html`<p class="msg ok">${info}</p>` : ''}`;
  let corpo;
  if (modo === 'aguardando') {
    corpo = html`<div class="login-form"><h1>Quase lá</h1>
      <p>Sua conta (${email}) foi criada. Agora a diretoria precisa liberar o seu acesso e definir a sua função.</p>
      <p class="pequeno">Assim que liberarem, é só recarregar a página.</p>
      <button type="button" class="btn" data-login-recarregar>Já liberaram — entrar</button>
      <p>${link('sair', 'Sair desta conta')}</p></div>`;
  } else if (modo === 'nova-senha') {
    corpo = html`<form class="login-form" data-modo="nova-senha" novalidate><h1>Nova senha</h1>
      <label>Nova senha<input type="password" name="senha" autocomplete="new-password" minlength="8" required></label>
      ${msg}<button type="submit" class="btn">Salvar a senha</button></form>`;
  } else if (modo === 'esqueci') {
    corpo = html`<form class="login-form" data-modo="esqueci" novalidate><h1>Esqueci a senha</h1>
      <p class="pequeno">Mandamos um link para o seu e-mail da Sólida criar uma senha nova.</p>
      <label>E-mail<input type="email" name="email" value="${email}" placeholder="nome@construcaosolida.com" autocomplete="username" required></label>
      ${msg}<button type="submit" class="btn">Mandar o link</button><p>${link('entrar', '← Voltar para entrar')}</p></form>`;
  } else if (modo === 'criar') {
    corpo = html`<form class="login-form" data-modo="criar" novalidate><h1>Criar minha conta</h1>
      <p class="pequeno">Só para e-mail @construcaosolida.com. Depois de criar, a diretoria libera o seu acesso.</p>
      <label>Nome<input type="text" name="nome" placeholder="como você é chamado" required></label>
      <label>E-mail<input type="email" name="email" value="${email}" placeholder="nome@construcaosolida.com" autocomplete="username" required></label>
      <label>Senha (8 caracteres ou mais)<input type="password" name="senha" autocomplete="new-password" minlength="8" required></label>
      ${msg}<button type="submit" class="btn">Criar conta</button><p>${link('entrar', '← Já tenho conta')}</p></form>`;
  } else {
    corpo = html`<form class="login-form" data-modo="entrar" novalidate><h1>Entrar</h1>
      <p class="pequeno">Use o seu e-mail da Sólida.</p>
      <label>E-mail<input type="email" name="email" value="${email}" placeholder="nome@construcaosolida.com" autocomplete="username" required></label>
      <label>Senha<input type="password" name="senha" autocomplete="current-password" required></label>
      ${msg}<button type="submit" class="btn">Entrar</button>
      <p class="login-links">${link('esqueci', 'Esqueci a senha')} · ${link('criar', 'Criar minha conta')}</p></form>`;
  }
  return html`${lado}<div class="login-corpo">${corpo}</div>`;
}
