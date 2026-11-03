// Operação › Análise das medições: produtividade × efetivo × programação × metas × medição no Mais Controle, obra por obra.
// O cálculo está em ../analise-medicoes.js; aqui só se desenha. Semana padrão: a que acabou de passar (a análise roda na segunda de manhã).

import { html, numero, data as fmtData } from '../formato.js';
import { hojeISO, inicioDaSemana, somarDias } from '../datas.js';
import { analisarSemana, alertas, RESPONSAVEL, TOLERANCIA } from '../analise-medicoes.js';

const ST = { ok: ['ok', 'Medição confere'], atencao: ['atencao', 'Atenção'], critico: ['critico', 'Divergência'], sem_dados: ['sem', 'Sem dados'] };
const SIT = { ok: ['ok', '✓ bate'], a_mais: ['critico', 'medido a mais'], a_menos: ['atencao', 'medido a menos'], nao_medido: ['atencao', 'não medido'],
  sem_produtividade: ['sem', 'sem produtividade'], so_percentual: ['atencao', 'só em %'], unidade: ['atencao', 'unidade diferente'] };
const DIA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
const dm = (iso) => fmtData(iso).slice(0, 5);
const q = (v, u = '') => (v == null ? '—' : `${numero(Math.round(v * 10) / 10)}${u ? ` ${u}` : ''}`);

export const semanaPadrao = (hoje = hojeISO()) => inicioDaSemana(somarDias(hoje, -7));

function linhaItem(r, comBase = false) {
  const [cls, txt] = SIT[r.situacao] || ['sem', r.situacao];
  const dif = r.medido != null && (r.produzido != null || r.programado != null) ? r.medido - (r.produzido ?? r.programado) : null;
  return html`<tr class="am-l am-${cls}"><td>${r.item}${r.aproximado ? html` <em class="am-aprox" title="O nome no Mais Controle é parecido, não igual: confira se é o mesmo serviço">nome parecido</em>` : ''}${r.contrato ? html`<span class="pequeno am-contr">${r.contrato}</span>` : ''}</td>
    <td>${r.unidade || ''}</td>
    <td class="n">${q(r.meta ?? r.programado)}</td>
    ${comBase ? '' : html`<td class="n">${q(r.produzido)}</td>`}
    <td class="n">${q(r.medido)}</td>
    <td class="n ${dif != null && Math.abs(dif) > 0 ? 'am-dif' : ''}">${dif == null ? '—' : `${dif > 0 ? '+' : ''}${numero(Math.round(dif * 10) / 10)}`}</td>
    <td><span class="am-st am-st-${cls}">${txt}</span></td></tr>`;
}

function tabelaItens(rs, comBase = false) {
  if (!rs.length) return '';
  return html`<div class="tabela-rolagem"><table class="tab am-tab">
    <thead><tr><th>Serviço</th><th>Unid.</th><th class="n">${comBase ? 'Programado' : 'Meta'}</th>${comBase ? '' : html`<th class="n">Produzido</th>`}<th class="n">Medido (MC)</th><th class="n">Diferença</th><th>Situação</th></tr></thead>
    <tbody>${rs.map((r) => linhaItem(r, comBase))}</tbody></table></div>`;
}

function faixaDias(o) {
  return html`<div class="am-dias">${o.dias.map((d, i) => {
    if (d.feriado) return html`<div class="am-dia am-fer"><b>${DIA[i]} ${dm(d.data)}</b><span>feriado</span></div>`;
    if (!d.passou) return html`<div class="am-dia am-fut"><b>${DIA[i]} ${dm(d.data)}</b><span>ainda não chegou</span></div>`;
    const ruim = !!d.flag;
    return html`<div class="am-dia ${ruim ? 'am-dia-ruim' : ''}"><b>${DIA[i]} ${dm(d.data)}</b>
      <span>${d.ef.enviado ? `${d.ef.total} ${d.ef.total === 1 ? 'pessoa' : 'pessoas'}` : 'efetivo não enviado'}</span>
      <span>${d.relatou ? '✓ produtividade' : '✕ sem produtividade'}</span>${d.flag ? html`<em>${d.flag}</em>` : ''}</div>`;
  })}</div>`;
}

function cartaoObra(o, mcLidoEm) {
  const [cls, txt] = ST[o.status];
  const aberto = o.status === 'critico';   // só as obras com divergência já vêm abertas
  const nAchados = o.achados.filter((a) => a.nivel !== 'info').length;
  return html`<details class="caixa am-obra am-o-${cls}" ${aberto ? html.seguro('open') : ''}>
    <summary><span class="caixa-tit">${o.obra}</span><span class="am-st am-st-${cls}">${txt}</span>
      <span class="pequeno">${o.medicao.lida ? 'medição lida no Mais Controle' : 'medição ainda não lida'} · ${o.pessoasDia} pessoas-dia no efetivo${nAchados ? ` · ${nAchados} ${nAchados === 1 ? 'ponto' : 'pontos'}` : ''}</span></summary>
    <div class="caixa-corpo">
      ${o.achados.length ? html`<ul class="am-achados">${o.achados.map((a) => html`<li class="am-a-${a.nivel}">${a.proc ? html`<b>${RESPONSAVEL[a.proc]}</b> — ` : ''}${a.texto}</li>`)}</ul>` : html`<p class="pequeno">Nada fora do esperado nesta semana.</p>`}
      <h4>Produtividade × efetivo, dia a dia</h4>${faixaDias(o)}
      ${o.medicao.itens.length ? html`<h4>Medição da equipe Sólida (cinza) × produzido</h4>${tabelaItens([...o.medicao.itens, ...o.medicao.semProdutividade.map((r) => ({ ...r, produzido: null }))])}`
        : o.itens.length ? html`<h4>Serviços da semana</h4><p class="pequeno">Sem medição lida para comparar. O que a equipe produziu:</p>
          <ul class="am-prod">${o.itens.filter((i) => i.temFeito || i.temMeta).map((i) => html`<li>${i.item}: ${i.temFeito ? q(i.feito, i.unidade) : 'sem produtividade'}${i.temMeta ? ` de ${q(i.meta, i.unidade)} programados` : ''}</li>`)}</ul>` : ''}
      ${o.medicao.laranja.length ? html`<h4>Terceirizados (laranja): medido × programado</h4><p class="pequeno">Terceirizado não manda produtividade diária: a base é a programação da semana.</p>${tabelaItens(o.medicao.laranja, true)}` : ''}
    </div></details>`;
}

export function render({ CFG, mc, efetivo, params, visiveis = null }) {
  const hoje = hojeISO();
  const padrao = semanaPadrao(hoje);
  const p = params && typeof params.get === 'function' ? params.get('semana') : '';
  const ini = /^\d{4}-\d{2}-\d{2}$/.test(p || '') ? inicioDaSemana(p) : padrao;
  const a = analisarSemana({ CFG, mc, efetivo, ini, hoje, visiveis });
  const ORDEM = { critico: 0, atencao: 1, ok: 2, sem_dados: 3 };
  a.obras.sort((x, y) => (ORDEM[x.status] - ORDEM[y.status]) || x.obra.localeCompare(y.obra));
  const atual = inicioDaSemana(hoje);
  const base = '#/operacao/medicoes';
  const lido = mc && mc.verificadoEm ? new Date(mc.verificadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
  const outraSemana = mc && mc.semana && mc.semana.inicio !== ini;
  const r = a.resumo;
  return html`<div class="pagina am">
    <p><a class="link" href="#/operacao">← Operação</a></p>
    <div class="periodo">
      <a class="botao" href="${base}?semana=${somarDias(ini, -7)}">← Semana anterior</a>
      <div class="atual"><span>Semana</span><b>${dm(ini)} a ${dm(a.fim)}</b></div>
      ${ini < atual ? html`<a class="botao" href="${base}?semana=${somarDias(ini, 7)}">Semana seguinte →</a>` : ''}
      ${ini !== padrao ? html`<a class="botao" href="${base}">Semana passada</a>` : ''}
    </div>
    <p class="pequeno am-fonte">Produtividade e efetivo vêm dos grupos de WhatsApp das obras; programação e metas, do planejamento; a medição, do Mais Controle, lida pelo agente de Operação${lido ? ` (última leitura: ${lido})` : ' (ainda sem leitura)'}.
      ${outraSemana ? html` <b>O arquivo do Mais Controle é da semana de ${dm(mc.semana.inicio)}: a medição desta semana ainda não foi lida.</b>` : ''}</p>
    ${r.obras ? html`<div class="cards">
      <div class="card"><div class="card-valor">${r.obras}</div><div class="card-rotulo">Obras analisadas</div></div>
      <div class="card ${r.critico ? 'card-alerta' : ''}"><div class="card-valor">${r.critico}</div><div class="card-rotulo">Com divergência</div><div class="card-sub">medido ≠ produzido</div></div>
      <div class="card"><div class="card-valor">${r.atencao}</div><div class="card-rotulo">Com atenção</div><div class="card-sub">dados faltando ou diferença para menos</div></div>
      <div class="card"><div class="card-valor">${r.medicaoLida} de ${r.obras}</div><div class="card-rotulo">Medições lidas</div><div class="card-sub">no Mais Controle</div></div>
    </div>` : ''}
    ${r.obras ? html`<section class="secao">${a.obras.map((o) => cartaoObra(o))}</section>` : html`<p class="vazio">Nenhuma obra com programação para analisar.</p>`}
    <details class="caixa"><summary><span class="caixa-tit">Como a análise é feita</span><span class="pequeno">clique para ver</span></summary><div class="caixa-corpo"><ul>
      <li><b>Item a item:</b> a quantidade medida no Mais Controle de cada serviço é comparada com a quantidade produzida do mesmo serviço na semana (soma dos relatórios diários do grupo). Diferença maior que ${Math.round(TOLERANCIA * 100)}% vira alerta; medido <b>a mais</b> que o produzido é o mais grave.</li>
      <li><b>Efetivo:</b> dia com produtividade e sem efetivo, ou equipe na obra sem produtividade, aparecem como ponto de atenção. Dia sem relatório pode fazer o produzido parecer menor.</li>
      <li><b>Programação e metas:</b> o produzido é comparado com a meta de cada dia; item abaixo da meta sem motivo no grupo aparece nas metas da semana.</li>
      <li><b>Terceirizados (laranja):</b> não enviam produtividade diária; a medição é comparada com a quantidade programada da semana.</li>
      <li><b>Nome parecido:</b> quando o serviço no Mais Controle tem nome parecido (não igual), a linha avisa para conferir.</li>
      <li>Responsáveis: medição cinza ${RESPONSAVEL.cinza}; laranja ${RESPONSAVEL.laranja}. Nenhum valor em R$ é usado.</li></ul></div></details>
  </div>`;
}

// alertas da semana que passou, para o Resumo da Operação (só divergência: medido a mais que o produzido ou medido sem produção)
export function alertasResumo({ CFG, mc, efetivo, visiveis = null }) {
  const hoje = hojeISO();
  const a = analisarSemana({ CFG, mc, efetivo, ini: semanaPadrao(hoje), hoje, visiveis });
  const lista = alertas(a);
  if (!lista.length) return '';
  return html`<section class="secao"><div class="painel-h"><h2>Medição × produtividade</h2><p>semana de ${dm(a.ini)} a ${dm(a.fim)} · <a class="link" href="#/operacao/medicoes">abrir a análise completa</a></p></div>
    <ul class="am-achados">${lista.slice(0, 6).map((x) => html`<li class="am-a-critico">${x.texto}</li>`)}${lista.length > 6 ? html`<li class="pequeno">e mais ${lista.length - 6}…</li>` : ''}</ul></section>`;
}
