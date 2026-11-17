// Acessos (só diretoria, na nuvem): criar o login de cada pessoa (usuário + senha provisória), mudar função e
// obras, bloquear ou excluir quem saiu e redefinir a senha de quem esqueceu; e escolher quais abas cada função vê.
// A pessoa cria a própria senha no primeiro acesso. As regras do banco garantem que só a diretoria faz isso.

import { html } from '../formato.js';
import { FUNCOES, funcaoPorId, SETORES, SETORES_ORGANOGRAMA, PAGINAS, abasDa, abasPadrao } from '../funcoes.js';
import { secaoObras } from './cadastro-obras.js';

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

export function render({ perfis = [], obras = [], posObras = [], obrasCad = [], msg = '', aviso = null, meuId = null, listaAberta = false }) {
  const linha = (p) => {
    // a conta do computador do escritório (coletor) não se edita aqui: mudar a função dela faz o envio de dados parar
    if (p.funcao === 'coletor' || /^coletor@/i.test(p.email || '')) return html`<div class="ac-linha"><div class="ac-quem"><b>${p.nome || 'Coletor'}</b><span class="pequeno">conta do computador do escritório (envia os dados ao site) · não editar</span></div></div>`;
    const protegido = p.id === meuId || p.funcao === 'coletor';
    const falta = funcaoPorId(p.funcao || '').porObra && p.funcao && !(p.obras || []).length;
    return html`<form class="ac-pessoa ${p.ativo === false ? 'ac-bloq' : ''}" data-acesso="${p.id}">
    <div class="ac-pessoa-cab">
      <div class="ac-pessoa-id"><b class="ac-nome-click" data-ac-nome title="Clique para ver e editar o e-mail e as configurações">${p.nome || p.usuario}</b>
        <span class="pequeno">usuário <b>${p.usuario || p.email}</b> · ${p.funcao ? funcaoPorId(p.funcao).nome : html`<span class="pendente">sem função</span>`}${p.trocar_senha ? ' · ainda não criou a senha' : ''}${p.ativo === false ? ' · bloqueado' : ''}${p.id === meuId ? ' · você' : ''}${falta ? html` · <span class="pendente">escolha as obras</span>` : ''}</span></div>
      <div class="ac-pessoa-acoes">
        <button type="button" class="botao" data-ac-abrir aria-expanded="false" title="Função, obras e setores desta pessoa">⚙ Configurações ▾</button>
        <button type="button" class="botao" data-redefinir-senha="${p.id}|${p.nome || p.usuario}">Nova senha</button>
        ${protegido ? '' : html`<button type="button" class="botao ac-excluir" data-excluir-login="${p.id}|${p.nome || p.usuario}">Excluir</button>`}
      </div>
    </div>
    <div class="ac-pessoa-corpo" hidden>
      <label class="ac-pessoa-func">E-mail da Sólida <span class="pequeno">(para convidar para as reuniões no Google Agenda)</span><input type="email" name="email_agenda" value="${p.email_agenda || ''}" placeholder="nome@construcaosolida.com" autocomplete="off"></label>
      <label class="ac-pessoa-func">Função<select name="funcao"><option value="">— escolher —</option>${opcoesFuncao(p.funcao)}</select></label>
      <div class="ac-obras"><span class="ac-rot">Obras e pós-obras <span class="pequeno">(quem a pessoa acompanha)</span></span>${caixinhasObras(obras, p.obras || [], posObras)}</div>
      <div class="ac-obras"><span class="ac-rot">Setores <span class="pequeno">(onde atua: gestor ou estagiário do setor)</span></span>${caixinhasSetores(p.setores || [])}</div>
      <div class="ac-pessoa-salvar"><button type="submit" class="botao on">Salvar configurações</button></div>
    </div>
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
    ${secaoObras({ obrasCad, podeExcluir: true, listaAberta })}
    <section class="secao"><h2>Setores <span class="pequeno">${SETORES_ORGANOGRAMA.length}</span></h2>
      <p class="pequeno">Departamentos usados em atas, pendências, tarefas e acessos. O que você criar ou excluir aqui aparece na hora em todas as telas.</p>
      <form class="ac-novo" id="set-novo"><label>Novo setor<input name="nome" placeholder="ex.: Jurídico" autocomplete="off" required></label><button type="submit" class="botao on">Criar setor</button></form>
      <div class="ac-chips">${SETORES_ORGANOGRAMA.map((s) => html`<span class="ac-chip"><span>${s}</span> <button type="button" class="ac-mini" data-excluir-setor="${s}" title="Excluir o setor">×</button></span>`)}</div>
    </section>
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
