// Acessos (só diretoria, na nuvem): criar o login de cada pessoa (usuário + senha provisória), mudar função e
// obras, bloquear ou excluir quem saiu e redefinir a senha de quem esqueceu; e escolher quais abas cada função vê.
// A pessoa cria a própria senha no primeiro acesso. As regras do banco garantem que só a diretoria faz isso.

import { html } from '../formato.js';
import { FUNCOES, funcaoPorId, SETORES, SETORES_ORGANOGRAMA, PAGINAS, abasDa, abasPadrao } from '../funcoes.js';

const opcoesFuncao = (sel = '') => FUNCOES.map((x) => html`<option value="${x.id}" ${x.id === sel ? html.seguro('selected') : ''}>${x.nome}</option>`);
// obras como caixinhas de marcar (antes era uma lista de seleção múltipla, difícil de usar)
// pós-obras ativos vão numa segunda fileira, na mesma lista de obras da pessoa (um já marcado que encerrou continua aparecendo, para dar para tirar)
const caixinhasObras = (obras, sel = [], pos = []) => {
  const chip = (o) => html`<label class="ac-chip"><input type="checkbox" name="obras" value="${o}" ${sel.includes(o) ? html.seguro('checked') : ''}><span>${o}</span></label>`;
  const posTodos = [...pos, ...sel.filter((o) => !obras.includes(o) && !pos.includes(o))];
  return html`<div class="ac-chips">
  ${obras.map(chip)}
  <button type="button" class="ac-mini" data-obras-todas="1">todas</button><button type="button" class="ac-mini" data-obras-todas="0">nenhuma</button>
  ${posTodos.length ? html`<div class="ac-pos"><span class="ac-rot">Pós-obras ativos</span>${posTodos.map(chip)}</div>` : ''}
</div>`;
};

// setores onde a pessoa atua (gestor ou estagiário do setor, conforme o organograma): quem não está em obra nenhuma também fica ligado ao gestor
const caixinhasSetores = (sel = []) => html`<div class="ac-chips">${SETORES_ORGANOGRAMA.map((nome) => html`<label class="ac-chip"><input type="checkbox" name="setores" value="${nome}" ${sel.includes(nome) ? html.seguro('checked') : ''}><span>${nome}</span></label>`)}</div>`;

const ABAS = [...SETORES, ...PAGINAS];

const SITUACOES = [['andamento', 'Em andamento'], ['pausada', 'Pausada'], ['finalizada', 'Finalizada']];
const opcoesSituacao = (sel) => SITUACOES.map(([v, n]) => html`<option value="${v}" ${v === sel ? html.seguro('selected') : ''}>${n}</option>`);

export function render({ perfis = [], obras = [], posObras = [], obrasCad = [], msg = '', aviso = null, meuId = null }) {
  const linhaObra = (o) => html`<form class="ac-linha ${o.situacao === 'finalizada' ? 'ac-bloq' : ''}" data-obra-cad="${o.codigo}">
    <div class="ac-quem"><b>${o.codigo}</b>${o.semCadastro ? html`<span class="pequeno pendente">ainda não cadastrada (vem dos dados): clique em Salvar para cadastrar</span>` : ''}</div>
    <label>Nome<input name="nome" value="${o.nome || ''}" placeholder="ex.: Residencial X"></label>
    <label>Situação<select name="situacao">${opcoesSituacao(o.situacao)}</select></label>
    <span class="ac-botoes"><button type="submit" class="botao on">Salvar</button>
      <button type="button" class="botao ac-excluir" data-excluir-obra="${o.codigo}">Remover</button></span>
  </form>`;
  const linha = (p) => {
    // a conta do computador do escritório (coletor) não se edita aqui: mudar a função dela faz o envio de dados parar
    if (p.funcao === 'coletor' || /^coletor@/i.test(p.email || '')) return html`<div class="ac-linha"><div class="ac-quem"><b>${p.nome || 'Coletor'}</b><span class="pequeno">conta do computador do escritório (envia os dados ao site) · não editar</span></div></div>`;
    const protegido = p.id === meuId || p.funcao === 'coletor';
    return html`<form class="ac-linha ${p.ativo === false ? 'ac-bloq' : ''}" data-acesso="${p.id}">
    <div class="ac-quem"><b>${p.nome || p.usuario}</b><span class="pequeno">usuário: <b>${p.usuario || p.email}</b>${p.trocar_senha ? ' · ainda não criou a senha' : ''}${p.ativo === false ? ' · bloqueado' : ''}${p.id === meuId ? ' · você' : ''}</span></div>
    <label>Função<select name="funcao"><option value="">— escolher —</option>${opcoesFuncao(p.funcao)}</select></label>
    <div class="ac-obras"><span class="ac-rot">Obras e pós-obras <span class="pequeno">(quem a pessoa acompanha)</span></span>${caixinhasObras(obras, p.obras || [], posObras)}</div>
    <div class="ac-obras"><span class="ac-rot">Setores <span class="pequeno">(onde atua: gestor ou estagiário do setor)</span></span>${caixinhasSetores(p.setores || [])}</div>
   <span class="ac-botoes"><button type="submit" class="botao on">Salvar</button>
      <button type="button" class="botao" data-redefinir-senha="${p.id}|${p.nome || p.usuario}">Nova senha</button>
      ${protegido ? '' : html`<button type="button" class="botao ac-excluir" data-excluir-login="${p.id}|${p.nome || p.usuario}">Excluir</button>`}</span>
    ${funcaoPorId(p.funcao || '').porObra && p.funcao && !(p.obras || []).length ? html`<span class="pequeno pendente">escolha as obras</span>` : ''}
  </form>`;
  };
  const funcoes = FUNCOES.filter((f) => f.id !== 'socio');
  const linhaAbas = (f) => {
    const atuais = abasDa(f); const padrao = abasPadrao(f);
    const mudou = f.personalizada && (atuais.length !== padrao.length || atuais.some((a) => !padrao.includes(a)));
    return html`<tr data-padrao="${padrao.join(',')}"><th class="ab-fn">${f.nome}${mudou ? html` <span class="ab-per">personalizado</span>` : ''}</th>
      ${ABAS.map(([id]) => html`<td><input type="checkbox" name="aba:${f.id}" value="${id}" ${atuais.includes(id) ? html.seguro('checked') : ''} aria-label="${f.nome}: ${id}"></td>`)}
      <td><button type="button" class="ac-mini" data-abas-padrao="1" title="Voltar ao padrão desta função">padrão</button></td></tr>`;
  };
  return html`<div class="pagina acessos">
    ${aviso ? html`<div class="ac-aviso"><b>${aviso.titulo}</b><p>Usuário: <code>${aviso.usuario}</code> · senha provisória: <code>${aviso.senha}</code></p>
      <p class="pequeno">Passe para a pessoa. No primeiro acesso ela cria a própria senha. Esta senha não aparece de novo.</p></div>` : ''}
    ${msg ? html`<p class="msg ok">${msg}</p>` : ''}
    <section class="secao"><h2>Obras <span class="pequeno">${obrasCad.length}</span></h2>
      <p class="pequeno">Obra com código <b>Mo…</b> é obra (operação) e com <b>Po…</b> é pós-obra: o sistema entende sozinho. As que já existem nos dados mas ainda não foram cadastradas aparecem aqui com um aviso; é só clicar em Salvar. Cadastre as que faltam e mude a situação: <b>em andamento</b> e <b>pausada</b> aparecem para escolher nos logins e nas listas; <b>finalizada</b> sai das listas.</p>
      <form class="ac-novo" id="ob-novo">
        <label>Código<input name="codigo" placeholder="ex.: Mo565" autocapitalize="none" spellcheck="false" required></label>
        <label>Nome <span class="pequeno">(opcional)</span><input name="nome" placeholder="ex.: Residencial X"></label>
        <label>Situação<select name="situacao">${opcoesSituacao('andamento')}</select></label>
        <button type="submit" class="botao on">Cadastrar obra</button>
      </form>
      ${obrasCad.map(linhaObra)}</section>
    <section class="secao"><h2>Criar login</h2>
      <form class="ac-novo" id="ac-novo">
        <label>Nome<input name="nome" placeholder="ex.: Mariana C." required></label>
        <label>Usuário<input name="usuario" placeholder="ex.: mariana" autocapitalize="none" spellcheck="false" required></label>
        <label>Função<select name="funcao" required><option value="">— escolher —</option>${opcoesFuncao()}</select></label>
        <div class="ac-obras"><span class="ac-rot">Obras <span class="pequeno">(funções de obra)</span></span>${caixinhasObras(obras, [], posObras)}</div>
        <button type="submit" class="botao on">Criar login</button>
      </form>
      <p class="pequeno">O sistema gera uma senha provisória e mostra aqui uma vez. Usuário: letras minúsculas, sem acento (pode ter ponto, ex.: pedro.novais).</p>
    </section>
    <section class="secao"><h2>Equipe <span class="pequeno">${perfis.length}</span></h2>
      <p class="pequeno">Quem saiu da empresa: use <b>Excluir</b>. Isso apaga o login e tudo o que a pessoa marcou no sistema (tarefas, publicações do feed).</p>
      ${perfis.map(linha)}</section>
    <section class="secao"><h2>Abas de cada função</h2>
      <p class="pequeno">Marque o que cada função enxerga no menu. A Visão geral e o Perfil aparecem para todos; a diretoria vê tudo. Sem mexer, vale o padrão de cada função.</p>
      <form id="ac-abas"><div class="tabela-rolagem"><table class="tab ab-tab"><thead><tr><th>Função</th>${ABAS.map(([, nome]) => html`<th class="ab-col"><span>${nome}</span></th>`)}<th></th></tr></thead>
        <tbody>${funcoes.map(linhaAbas)}</tbody></table></div>
        <p style="margin-top:10px"><button type="submit" class="botao on">Salvar abas</button></p>
      </form>
    </section>
  </div>`;
}
