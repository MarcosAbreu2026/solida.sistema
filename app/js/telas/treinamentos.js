// Treinamentos: uma lista, no mesmo padrão da lista do Pós-obra. Cada bloco é um menu da função de quem está vendo e, dentro dele,
// ficam as apresentações (passo a passo com prints). Por enquanto só existe o da ata; os outros entram quando a diretoria pedir
// (acrescentar em app/js/treinamentos-slides.js e gerar os prints com scripts/gerar-prints-treinamento.mjs).

import { html } from '../formato.js';
import { funcaoAtual } from '../sessao.js';
import { TOPICOS, SUBTOPICOS, vistos as slidesVistos } from '../treinamentos-slides.js';
import { paginaVisivel, soMinhasFuncoes, temEstoqueRestrito } from '../funcoes.js';

// (mantido por compatibilidade com o menu: não há mais guias de texto)
export const TREINAMENTOS = [];
export function alternarFeito() { /* os "já li" dos guias antigos não existem mais */ }

const seApplica = (t, funcaoId) => funcaoId === 'socio' || t.funcoes === 'todos' || (Array.isArray(t.funcoes) && t.funcoes.includes(funcaoId));
// o bloco aparece para quem tem aquele menu: setor nas áreas da função; página geral se a função vê a página
// quem tem acesso restrito vê só as telas que aparecem no menu dele: Agenda, Tarefas, Atas, Feed, Treinamentos (e o Estoque, se for do galpão)
const TELAS_RESTRITAS = ['agenda', 'tarefas', 'atas', 'feed', 'treinamentos'];
const topicoVisivel = (t, f) => {
  if (soMinhasFuncoes(f) && !TELAS_RESTRITAS.includes(t.id) && !(t.id === 'estoque' && temEstoqueRestrito(f))) return false;
  return t.tipo === 'setor' ? !f.areas || f.areas.includes(t.id) : paginaVisivel(f, t.pagina);
};

// Os blocos seguem os mesmos grupos do menu da esquerda (pedido do Felipe, 04/11): Meu trabalho · Departamentos · Resultados · Equipe · Diretoria
const GRUPOS = [
  ['Meu trabalho', ['agenda', 'tarefas', 'atas']],
  ['Departamentos', ['operacao', 'posobra', 'transporte', 'suprimentos', 'planejamento', 'projetos', 'comercial', 'orcamentos', 'financeiro', 'rh']],
  ['Resultados', []],
  ['Equipe', ['estoque', 'feed', 'treinamentos', 'marketing']],
  ['Diretoria', []],
];

export function render() {
  const f = funcaoAtual();
  const vistosSet = slidesVistos();
  const doTopico = (t) => SUBTOPICOS.filter((s) => !s.oculto && s.topico === t.id && seApplica(s, f.id));   // oculto: guardado, mas não aparece (ex.: o da ata, por enquanto)
  const topicos = TOPICOS.filter((t) => topicoVisivel(t, f) && doTopico(t).length);
  const linha = (s) => html`<tr><td class="tr-tit"><button type="button" class="tr-abrir" data-trein-slides="${s.id}">${s.titulo}</button></td>
    <td>${s.slides.length} ${s.slides.length === 1 ? 'passo' : 'passos'}</td>
    <td>${vistosSet.has(s.id) ? html`<span class="tr-visto">✓ visto</span>` : html`<span class="muted">não visto</span>`}</td>
    <td class="n"><button type="button" class="ac-mini" data-trein-slides="${s.id}">${vistosSet.has(s.id) ? 'rever' : 'abrir'} ▶</button></td></tr>`;
  const bloco = (t) => html`<details class="pl-obra tr-topico" open>
    <summary><span class="pl-tit"><span class="tr-ico">${t.icone}</span>${t.nome}</span></summary>
    <table class="pl-os tr-tab"><colgroup><col class="tr-c-tit"><col class="tr-c-pas"><col class="tr-c-sit"><col class="tr-c-acao"></colgroup>
      <tbody>${doTopico(t).map(linha)}</tbody></table></details>`;
  // cada tópico entra no grupo do menu a que pertence; o que não estiver na lista vai para "Outros"
  const mapeados = new Set(GRUPOS.flatMap(([, ids]) => ids));
  const grupos = [...GRUPOS, ['Outros', topicos.filter((t) => !mapeados.has(t.id)).map((t) => t.id)]]
    .map(([nome, ids]) => [nome, ids.map((id) => topicos.find((t) => t.id === id)).filter(Boolean)]).filter(([, l]) => l.length);
  return html`<div class="pagina treinamentos pl">
    ${grupos.length ? grupos.map(([nome, lista]) => html`<section class="tr-grupo"><h2 class="tr-grupo-tit">${nome}</h2><div class="pl-lista">${lista.map(bloco)}</div></section>`) : html`<p class="vazio">Nada por aqui ainda.</p>`}
  </div>`;
}
