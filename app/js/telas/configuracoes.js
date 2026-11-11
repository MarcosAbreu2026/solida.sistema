// Página Configurações (só diretoria): uma seção por aba. Em cada uma: quem vê a aba, quem vê cada bloco dentro dela e as opções (ex.: atas só do próprio
// departamento ou de todos). Cada clique salva na hora; "Restaurar padrão" volta ao que está no código. Pedido do Felipe, 11/11/2026.
import { html } from '../formato.js';
import { FUNCOES, funcaoPorId, abasPadrao } from '../funcoes.js';
import { DEPARTAMENTOS, podeVerDepPadrao } from '../organograma.js';
import { funcaoVe, temConfig } from '../config.js';

const cargos = () => FUNCOES.filter((f) => !['socio', 'coletor'].includes(f.id));
const padraoAba = (id) => (fid) => abasPadrao(funcaoPorId(fid)).includes(id);

// o que dá para configurar em cada aba (blocos e opções entram aqui à medida que a aba ganha o que configurar)
export const paginasConfig = () => [
  { id: 'geral', nome: 'Início', grupo: 'Abas', secoes: [['cumprimento', '1 · Cumprimento da semana'], ['planejado', '2 · Planejado × executado, por obra'], ['meta', '3 · Meta × executado da semana'], ['agir', '4 · Quem precisa agir'], ['orcamento', 'Caixa Orçamento'], ['financeiro', 'Caixa Financeiro']] },
  { id: 'agenda', nome: 'Agenda', grupo: 'Abas' },
  { id: 'atas', nome: 'Tarefas e Atas', grupo: 'Abas', aba: true, padrao: padraoAba('atas'),
    opcoes: [{ chave: 'opcao.atas.escopo_todos', nome: 'Ver as atas de TODOS os departamentos', ajuda: 'Marcadas veem as atas de todos os departamentos. As demais veem só as atas do próprio departamento (e da própria obra). A pessoa continua vendo a pendência criada para ela, mesmo sem ver a ata.', padrao: () => false }] },
  { id: 'treinamentos', nome: 'Treinamentos', grupo: 'Abas', aba: true, padrao: padraoAba('treinamentos') },
  { id: 'feed', nome: 'Feed', grupo: 'Abas', aba: true, padrao: padraoAba('feed') },
  { id: 'escritorio', nome: 'Escritório virtual', grupo: 'Abas', aba: true, padrao: padraoAba('escritorio') },
  { id: 'estoque', nome: 'Estoque', grupo: 'Abas', aba: true, padrao: padraoAba('estoque') },
  { id: 'marketing', nome: 'Marketing', grupo: 'Abas', aba: true, padrao: padraoAba('marketing') },
  ...DEPARTAMENTOS.map((d) => ({ id: d.id, nome: d.nome, grupo: 'Departamentos', aba: true, padrao: (fid) => podeVerDepPadrao(d, funcaoPorId(fid)) })),
];

const chips = (chave, padrao) => html`<div class="cfg-chips"><span class="cfg-chip cfg-fixo" title="A diretoria sempre vê tudo">Sócio / Diretoria · sempre</span>
  ${cargos().map((f) => { const ve = funcaoVe(chave, f.id, padrao(f.id)); return html`<button type="button" class="cfg-chip ${ve ? 'on' : ''}" data-cfg-fn="${chave}|${f.id}" aria-pressed="${ve ? 'true' : 'false'}">${f.nome}</button>`; })}</div>`;
const rodape = (chave) => html`<p class="pequeno">${temConfig(chave) ? html`Valor personalizado. <button type="button" class="ac-mini" data-cfg-reset="${chave}">Restaurar o padrão</button>` : 'Valor padrão do sistema.'}</p>`;

export function render({ pagina = 'geral', msg = '' } = {}) {
  const todas = paginasConfig(); const p = todas.find((x) => x.id === pagina) || todas[0];
  const grupos = [...new Set(todas.map((x) => x.grupo))];
  return html`<div class="pagina cfg">
    ${msg ? html`<p class="msg ok">${msg}</p>` : ''}
    <div class="cfg-corpo">
      <nav class="cfg-menu" aria-label="Abas">${grupos.map((g) => html`<h4>${g}</h4>${todas.filter((x) => x.grupo === g).map((x) => html`<a href="#/configuracoes/${x.id}" class="${x.id === p.id ? 'on' : ''}">${x.nome}</a>`)}`)}</nav>
      <div class="cfg-painel">
        <h2>Configurações · ${p.nome}</h2>
        <p class="pequeno">Cada clique salva na hora. Quem não está marcado deixa de ver; a diretoria sempre vê tudo.</p>
        ${p.aba ? html`<section class="cfg-sec"><h3>Quem vê esta aba</h3>${chips(`pagina.${p.id}`, p.padrao)}${rodape(`pagina.${p.id}`)}</section>` : ''}
        ${(p.secoes || []).length ? html`<section class="cfg-sec"><h3>Quem vê cada bloco desta aba</h3>
          ${p.secoes.map(([id, nome]) => html`<div class="cfg-bloco"><b>${nome}</b>${chips(`secao.${p.id}.${id}`, () => true)}${rodape(`secao.${p.id}.${id}`)}</div>`)}</section>` : ''}
        ${(p.opcoes || []).length ? html`<section class="cfg-sec"><h3>Opções</h3>
          ${p.opcoes.map((o) => html`<div class="cfg-bloco"><b>${o.nome}</b><p class="pequeno">${o.ajuda}</p>${chips(o.chave, o.padrao)}${rodape(o.chave)}</div>`)}</section>` : ''}
        ${!p.aba && !(p.secoes || []).length && !(p.opcoes || []).length ? html`<p class="vazio">Esta aba ainda não tem nada para configurar aqui. Os blocos e opções entram nesta página à medida que forem pedidos.</p>` : ''}
      </div>
    </div></div>`;
}
