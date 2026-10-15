import { html, data, reais, numero } from './formato.js';

// Perfil (Sócio × Funcionário), como no Painel da Empresa: funcionário não vê valores em R$.
let perfilSocio = true;
export const definirPerfil = (socio) => { perfilSocio = socio; };
export const ehSocio = () => perfilSocio;

const CLASSE_SITUACAO = {
  'Execução': 's-execucao', 'Atrasado': 's-atrasado', 'Planejamento': 's-planejamento',
  'Agendamento': 's-agendamento', 'Orçamento': 's-orcamento', 'Análise': 's-analise',
  'Fixo': 's-fixo', 'Pausado': 's-neutro', 'Concluído': 's-concluido', 'Cancelado': 's-neutro',
};

export function chipSituacao(sit) {
  const s = sit || 'Sem situação';
  return html`<span class="chip ${CLASSE_SITUACAO[s] || 's-neutro'}"><i></i>${s}</span>`;
}

const PRAZO = {
  'Vencido': ['p-vencido', '✕'],
  'Vence em 7 dias': ['p-alerta', '!'],
  'No prazo': ['p-ok', '✓'],
  'Sem prazo': ['p-neutro', '–'],
  'Encerrado': ['p-neutro', '✓'],
};
export function chipPrazo(status) {
  const [cls, icone] = PRAZO[status] || ['p-neutro', '–'];
  return html`<span class="prazo ${cls}"><b aria-hidden="true">${icone}</b>${status}</span>`;
}

export const CHEV = html.seguro('<svg class="chev" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>');
export const CHEV_VOLTAR = html.seguro('<svg class="chev" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style="transform:rotate(180deg)"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>');

export const rotaObra = (nome) => `#/posobra/obra/${encodeURIComponent(nome)}`;

export function linkObra(nome) {
  return html`<a class="link" href="${rotaObra(nome)}">${nome}</a>`;
}

// Métrica no estilo do painel: valor grande, rótulo embaixo. `restrito` = valor em R$ (só sócios).
export function card(rotulo, valor, { sub = '', tom = '', link = '', restrito = false } = {}) {
  const oculto = restrito && !perfilSocio;
  const corpo = html`<div class="card-valor ${oculto ? 'sem' : ''}">${oculto ? '—' : valor}</div>
    <div class="card-rotulo">${rotulo}${link ? CHEV : ''}</div>
    ${sub && !oculto ? html`<div class="card-sub">${sub}</div>` : ''}
    ${restrito ? html`<div class="r">Visível só para sócios</div>` : ''}`;
  return link
    ? html`<a class="card clicavel ${oculto ? '' : tom}" href="${link}">${corpo}</a>`
    : html`<div class="card ${oculto ? '' : tom}">${corpo}</div>`;
}

export function vazio(texto) {
  return html`<div class="vazio">${texto}</div>`;
}

export function aviso(texto) {
  return html`<div class="aviso"><b aria-hidden="true">●</b><span>${texto}</span></div>`;
}

export const fmt = {
  data: (d) => data(d) || '—',
  reais: (v) => (perfilSocio ? reais(v) : html`<span class="sem">—</span>`),
  diarias: (v) => (v ? numero(v) : '—'),
  margem: (v) => (!perfilSocio ? html`<span class="sem">—</span>` : v === null ? '—' : reais(v)),
};

export function secao(titulo, conteudo, { extra = '' } = {}) {
  return html`<section class="bloco">
    <header class="bloco-topo"><h2>${titulo}</h2>${extra}</header>
    ${conteudo}
  </section>`;
}
