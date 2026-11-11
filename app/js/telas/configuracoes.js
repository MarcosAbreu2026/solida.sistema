// Página Configurações (só diretoria): uma seção por aba. Em cada uma: quem vê a aba, quem vê cada bloco dentro dela e as opções (ex.: atas só do próprio
// departamento ou de todos). Cada clique salva na hora; "Restaurar padrão" volta ao que está no código. Pedido do Felipe, 11/11/2026.
import { html } from '../formato.js';
import { FUNCOES, funcaoPorId, abasPadrao } from '../funcoes.js';
import { DEPARTAMENTOS, podeVerDepPadrao } from '../organograma.js';
import { funcaoVe, temConfig } from '../config.js';

const cargos = () => FUNCOES.filter((f) => !['socio', 'coletor'].includes(f.id));
// O que cada cargo vê DE VERDADE hoje: diretoria e administrativo veem tudo; os demais só Agenda, Tarefas, Atas, Treinamentos, Feed e Escritório virtual
// (o resto, como o Início e os departamentos, é só da diretoria até ela liberar aqui). Os padrões mostrados abaixo seguem essa regra.
const completo = (fid) => ['socio', 'administrativo'].includes(fid);
const PAGINAS_DE_TODOS = ['treinamentos', 'atas', 'feed', 'escritorio'];
const padraoAba = (id) => (fid) => (completo(fid) ? abasPadrao(funcaoPorId(fid)).includes(id) : PAGINAS_DE_TODOS.includes(id) && abasPadrao(funcaoPorId(fid)).includes(id));
const padraoInicio = (fid) => completo(fid);
const veInicio = (fid) => funcaoVe('pagina.geral', fid, padraoInicio(fid));

// o que dá para configurar em cada aba (blocos e opções entram aqui à medida que a aba ganha o que configurar)
export const paginasConfig = () => {
  const dep = (d) => ({ id: d.id, nome: d.nome, grupo: 'Departamentos', aba: true, padrao: (fid) => completo(fid) && podeVerDepPadrao(d, funcaoPorId(fid)) });
  const deps = DEPARTAMENTOS.flatMap((d) => (d.id === 'transporte' ? [dep(d), { id: 'estoque', nome: 'Estoque', grupo: 'Departamentos', aba: true, padrao: padraoAba('estoque') }] : [dep(d)]));
  // mesmos grupos e mesma ordem do menu da esquerda
  return [
    { id: 'geral', nome: 'Início', grupo: 'Meu trabalho', aba: true, padrao: padraoInicio, secoes: [['cumprimento', '1 · Cumprimento da semana'], ['planejado', '2 · Planejado × executado, por obra'], ['meta', '3 · Meta × executado da semana'], ['agir', '4 · Quem precisa agir'], ['orcamento', 'Caixa Orçamento'], ['financeiro', 'Caixa Financeiro']] },
    { id: 'agenda', nome: 'Agenda', grupo: 'Meu trabalho' },
    { id: 'tarefas', nome: 'Tarefas', grupo: 'Meu trabalho', nota: 'O acesso às Tarefas é o mesmo das Atas: configure em "Atas".' },
    { id: 'atas', nome: 'Atas', grupo: 'Meu trabalho', aba: true, padrao: padraoAba('atas'),
      opcoes: [{ chave: 'opcao.atas.escopo_todos', nome: 'Ver as atas de TODOS os departamentos', ajuda: 'Marcadas veem as atas de todos os departamentos. As demais veem só as atas do próprio departamento (e da própria obra). A pessoa continua vendo a pendência criada para ela, mesmo sem ver a ata.', padrao: () => false }] },
    ...deps,
    { id: 'equipe', nome: 'Ranking', grupo: 'Resultados', nota: 'O Ranking é só da diretoria.' },
    { id: 'meudia', nome: 'Minha semana', grupo: 'Equipe', aba: true, padrao: padraoAba('meudia') },
    { id: 'quadro', nome: 'Quadro de funções', grupo: 'Equipe' },
    { id: 'feed', nome: 'Feed', grupo: 'Equipe', aba: true, padrao: padraoAba('feed') },
    { id: 'escritorio', nome: 'Escritório virtual', grupo: 'Equipe', aba: true, padrao: padraoAba('escritorio') },
    { id: 'treinamentos', nome: 'Treinamentos', grupo: 'Equipe', aba: true, padrao: padraoAba('treinamentos') },
    { id: 'marketing', nome: 'Marketing', grupo: 'Equipe', aba: true, padrao: padraoAba('marketing') },
    { id: 'agentes', nome: 'Agentes', grupo: 'Diretoria', nota: 'Só a diretoria acessa.' },
    { id: 'acessos', nome: 'Cadastros', grupo: 'Diretoria', nota: 'Só a diretoria acessa.' },
    { id: 'configuracoes', nome: 'Configurações', grupo: 'Diretoria', nota: 'Só a diretoria acessa.' },
  ];
};

const chips = (chave, padrao) => html`<div class="cfg-chips"><span class="cfg-chip cfg-fixo" title="A diretoria sempre vê tudo">Sócio / Diretoria · sempre</span>
  ${cargos().map((f) => { const ve = funcaoVe(chave, f.id, padrao(f.id)); return html`<button type="button" class="cfg-chip ${ve ? 'on' : ''}" data-cfg-fn="${chave}|${f.id}" aria-pressed="${ve ? 'true' : 'false'}">${f.nome}</button>`; })}</div>`;
const rodape = (chave) => html`<p class="pequeno">${temConfig(chave) ? html`Valor personalizado. <button type="button" class="ac-mini" data-cfg-reset="${chave}">Restaurar o padrão</button>` : 'Valor padrão do sistema.'}</p>`;

export function render({ pagina = 'geral', msg = '' } = {}) {
  const todas = paginasConfig(); const p = todas.find((x) => x.id === pagina) || todas[0];
  const grupos = ['Meu trabalho', 'Departamentos', 'Resultados', 'Equipe', 'Diretoria'];
  return html`<div class="pagina cfg">
    ${msg ? html`<p class="msg ok">${msg}</p>` : ''}
    <div class="cfg-corpo">
      <div class="cfg-menu" role="navigation" aria-label="Abas">${grupos.map((g) => html`<h4>${g}</h4>${todas.filter((x) => x.grupo === g).map((x) => html`<a href="#/configuracoes/${x.id}" class="${x.id === p.id ? 'on' : ''}">${x.nome}</a>`)}`)}</div>
      <div class="cfg-painel">
        <h2>Configurações · ${p.nome}</h2>
        <p class="pequeno">Cada clique salva na hora. Quem não está marcado deixa de ver; a diretoria sempre vê tudo. Marcado em azul = vê hoje.</p>
        ${p.aba ? html`<section class="cfg-sec"><h3>Quem vê esta aba</h3>${chips(`pagina.${p.id}`, p.padrao)}${rodape(`pagina.${p.id}`)}</section>` : ''}
        ${(p.secoes || []).length ? html`<section class="cfg-sec"><h3>Quem vê cada bloco desta aba</h3>
          ${p.secoes.map(([id, nome]) => html`<div class="cfg-bloco"><b>${nome}</b>${chips(`secao.${p.id}.${id}`, p.id === 'geral' ? veInicio : () => true)}${rodape(`secao.${p.id}.${id}`)}</div>`)}</section>` : ''}
        ${(p.opcoes || []).length ? html`<section class="cfg-sec"><h3>Opções</h3>
          ${p.opcoes.map((o) => html`<div class="cfg-bloco"><b>${o.nome}</b><p class="pequeno">${o.ajuda}</p>${chips(o.chave, o.padrao)}${rodape(o.chave)}</div>`)}</section>` : ''}
        ${!p.aba && !(p.secoes || []).length && !(p.opcoes || []).length ? html`<p class="vazio">${p.nota || 'Esta aba ainda não tem nada para configurar aqui. Os blocos e opções entram nesta página à medida que forem pedidos.'}</p>` : ''}
      </div>
    </div></div>`;
}
