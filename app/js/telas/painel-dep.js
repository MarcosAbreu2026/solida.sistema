// Peças do painel padrão (desenho do Marcos, 04/11/2026). Todo departamento usa o mesmo esqueleto:
//   01 pergunta do painel · 02 indicadores com meta (valor, meta, situação, fonte e data) · 03 quem precisa agir
//   (o que, em qual obra, responsável e data-limite; o alerta vira tarefa) · 04 detalhe por obra · 05 valores só para sócios.
// Aqui só o desenho; os números vêm de app/js/deps/*.js.

import { html } from '../formato.js';

// ---------------------------------------------------------------- topo
export const cabecalho = ({ rotulo = 'Departamentos', resp = '', direita = '' } = {}) => html`<div class="pd-cab">
  <div><span class="pd-rotulo">${rotulo}</span>${resp ? html`<p class="pd-resp">${resp}</p>` : ''}</div>${direita ? html`<div class="pd-cab-dir">${direita}</div>` : ''}
</div>`;

export const pergunta = (texto, rotulo = 'Pergunta do painel') => html`<div class="pd-pergunta"><span>${rotulo}</span><p>${texto}</p></div>`;

// faixa rosa: de onde e de quando são os números (nunca mostrar número velho como se fosse de hoje)
export const aviso = (texto, nivel = 'atencao') => (texto ? html`<div class="pd-aviso pd-av-${nivel}"><i aria-hidden="true">⚠</i><span>${texto}</span></div>` : '');

export const secao = (titulo, fonte, corpo, { id = '' } = {}) => html`<section class="pd-sec"${id ? html.seguro(` id="${id}"`) : ''}>
  <div class="pd-sec-h"><h2>${titulo}</h2>${fonte ? html`<span class="pd-fonte">${fonte}</span>` : ''}</div>
  ${corpo}
</section>`;

// ---------------------------------------------------------------- indicadores
// c = { rotulo, valor, sub, meta, nivel: ok|atencao|critico|'' , barra: 0..1, href }
const NIVEL_COR = { ok: 'pd-ok', atencao: 'pd-at', critico: 'pd-cr' };
export function cartao(c) {
  const corpo = html`<span class="pd-c-rot">${c.rotulo}</span>
    <b class="pd-c-val ${NIVEL_COR[c.nivel] || ''}">${c.valor == null || c.valor === '' ? '—' : c.valor}</b>
    ${typeof c.barra === 'number' ? html`<span class="pd-barra"><i style="width:${Math.max(0, Math.min(100, Math.round(c.barra * 100)))}%"></i></span>` : ''}
    ${c.sub ? html`<span class="pd-c-sub">${c.sub}</span>` : ''}
    ${c.meta ? html`<span class="pd-c-meta">${c.meta}</span>` : ''}`;
  return c.href ? html`<a class="pd-card pd-card-lnk" href="${c.href}">${corpo}</a>` : html`<div class="pd-card">${corpo}</div>`;
}
export const cartoes = (lista, { colunas = 4 } = {}) => html`<div class="pd-cards" style="--pd-n:${colunas}">${lista.map(cartao)}</div>`;

// selo de situação: ok ✓ (azul) · atencao ⚠ (amarelo) · critico ✕ (vermelho) · vazio — (cinza)
const SIMB = { ok: '✓', atencao: '⚠', critico: '✕', info: '' };
export const selo = (nivel, texto) => html`<span class="pd-selo pd-s-${nivel || 'vazio'}">${SIMB[nivel] ? html`<i>${SIMB[nivel]}</i>` : ''}${texto || '—'}</span>`;
export const traco = () => html`<span class="pd-traco">—</span>`;

// ---------------------------------------------------------------- tabelas
// colunas: ['Obra', 'Avanço', …] · linhas: [[cel, cel, …], …] · uma célula pode ser texto ou html
export const tabela = (colunas, linhas, { vazio = 'Nada a mostrar.', classe = '' } = {}) => (linhas.length
  ? html`<div class="pd-tab-caixa ${classe}"><div class="tabela-rolagem"><table class="pd-tab">
      <thead><tr>${colunas.map((c) => html`<th>${c}</th>`)}</tr></thead>
      <tbody>${linhas.map((l) => html`<tr>${l.map((c, i) => html`<td class="${i === 0 ? 'pd-t1' : ''}">${c == null || c === '' ? traco() : c}</td>`)}</tr>`)}</tbody>
    </table></div></div>`
  : html`<div class="pd-tab-caixa"><p class="pd-vazio">${vazio}</p></div>`);

export const obraCel = (cod, sub = '', href = '') => html`${href ? html`<a class="pd-obra" href="${href}">${cod}</a>` : html`<b class="pd-obra">${cod}</b>`}${sub ? html`<span class="pd-obra-sub">${sub}</span>` : ''}`;
export const barraCel = (v, rot) => html`<span class="pd-av"><b>${rot != null ? rot : `${Math.round((v || 0) * 100)}%`}</b><span class="pd-barra"><i style="width:${Math.max(0, Math.min(100, Math.round((v || 0) * 100)))}%"></i></span></span>`;

// ---------------------------------------------------------------- quem precisa agir
// a = { nivel: critico|atencao, texto, resp, prazo (AAAA-MM-DD), obra }; ctx = { setor, obra }
const ROT_NIVEL = { critico: 'Crítico', atencao: 'Atenção', ok: 'Em dia' };
export function quemAgir(alertas, ctx = {}, { vazio = 'Nenhum alerta agora.' } = {}) {
  const lista = alertas.filter((a) => a && a.texto);
  if (!lista.length) return html`<div class="pd-tab-caixa"><p class="pd-vazio">${vazio}</p></div>`;
  return html`<div class="pd-tab-caixa"><div class="tabela-rolagem"><table class="pd-tab pd-agir">
    <thead><tr><th>Nível</th><th>O que está acontecendo</th><th>Responsável</th><th>Data-limite</th><th></th></tr></thead>
    <tbody>${lista.map((a) => html`<tr>
      <td>${selo(a.nivel === 'critico' ? 'critico' : 'atencao', ROT_NIVEL[a.nivel] || 'Atenção')}</td>
      <td>${a.texto}</td>
      <td class="pd-resp-cel">${a.resp || html`<span class="pd-def">[definir]</span>`}</td>
      <td>${a.prazo ? a.prazo.split('-').reverse().join('/') : html`<span class="pd-def">[definir]</span>`}</td>
      <td><button type="button" class="pd-bt" data-criar-tarefa="1" data-ct-texto="${a.texto}" data-ct-obra="${a.obra || ctx.obra || ''}" data-ct-setor="${a.setor || ctx.setor || ''}" data-ct-prazo="${a.prazo || ''}">Criar tarefa</button></td>
    </tr>`)}</tbody></table></div></div>`;
}

// alertas do dados.json (agentes) → quem precisa agir. Tenta achar a obra e o responsável no texto ("1.8 · LARISSA — Mo358 …").
const NOMES = ['SIMONE', 'LARISSA', 'ROSE', 'JULIANA', 'MARIANA', 'JULIA', 'JÚLIA', 'ISABEL', 'ISABELLE', 'MARCOS H', 'PAIVA', 'ANDERSON', 'ENIO', 'ÊNIO', 'LETICIA', 'LETÍCIA', 'LEANDRO', 'MÁRCIO', 'MARCIO', 'AUGUSTO', 'TAISA', 'THAISSA', 'PEDRO', 'FLÁVIO', 'FLAVIO'];
const capital = (s) => s.toLocaleLowerCase('pt-BR').replace(/(^|\s)\S/g, (m) => m.toLocaleUpperCase('pt-BR'));
export function alertasDoAgente(area, { veValores = false, obras = null, limite = 8 } = {}) {
  const lista = ((area && area.alertas) || []).filter((a) => a && a.texto && (!a.restrito || veValores));
  return lista
    .map((a) => {
      const t = String(a.texto);
      const obra = (t.match(/\b(M[oO]\d{3}[A-Z]?|P[oO]\d{3})\b/) || [])[1] || '';
      const nome = NOMES.find((n) => new RegExp(`\\b${n}\\b`).test(t.toUpperCase().normalize('NFC')));
      return { nivel: a.nivel === 'critico' ? 'critico' : 'atencao', texto: t.replace(/^\s*[\d.]+\s*·\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ .]+\s*[—-]\s*/, ''), resp: nome ? capital(nome) : '', obra: obra ? obra.replace(/^m/, 'M').replace(/^p/, 'P') : '' };
    })
    .filter((a) => !obras || !a.obra || obras.some((o) => o.toLowerCase() === a.obra.toLowerCase()))
    .sort((x, y) => (x.nivel === y.nivel ? 0 : x.nivel === 'critico' ? -1 : 1))
    .slice(0, limite);
}

// indicador do agente pela etiqueta (ex.: /diário/i) → { valor, sub }
export function kpiDoAgente(area, re) {
  const k = ((area && area.kpis) || []).find((x) => re.test(x.label));
  if (!k) return null;
  const partes = String(k.valor).split(' · ');
  return { rotulo: k.label, valor: partes[0], sub: partes.slice(1).join(' · '), restrito: k.restrito };
}

// ---------------------------------------------------------------- textos
export const itens = (lista) => html`<ul class="pd-lista">${lista.map((t) => html`<li>${t}</li>`)}</ul>`;
export const caixa = (titulo, corpo, { direita = '' } = {}) => html`<div class="pd-caixa">
  <div class="pd-caixa-h"><h3>${titulo}</h3>${direita ? html`<span class="pd-fonte">${direita}</span>` : ''}</div>${corpo}</div>`;
export const emDefinicao = (lista, direita = 'Cada responsável define o que o seu painel mostra') => caixa('Em definição', itens(lista), { direita });

// abas do departamento (Painel · Detalhes · …)
export const abas = (lista, ativa) => html`<div class="subnav pd-abas" role="tablist">${lista.map((a) => html`<a href="${a.href}" class="${a.id === ativa ? 'on' : ''}" role="tab">${a.nome}</a>`)}</div>`;

// datas
export const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
export const dma = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
export const diasDesde = (iso, hoje) => (iso ? Math.round((new Date(hoje) - new Date(String(iso).slice(0, 10))) / 86400000) : null);
export const pct = (v) => (v == null || Number.isNaN(v) ? '—' : `${Math.round(v * 100)}%`);
