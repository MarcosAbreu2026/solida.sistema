// RH › Efetivo de hoje: um cartão por obra dizendo se o efetivo do dia foi postado no grupo de WhatsApp até as 12h.
// Quem preenche: o leitor automático do computador do escritório (scripts/leitor-whatsapp.mjs, de ~15 em 15 minutos) lê o grupo
// de cada obra e grava dados/json/efetivo.json. O sistema só afirma "não enviou" se o grupo foi lido hoje (campo `leituras`).

import { html, data as fmtData } from '../formato.js';
import { hojeISO } from '../datas.js';

const pad = (n) => String(n).padStart(2, '0');
const ROTULO = {
  ok: '✓ Enviado no prazo', atraso: '⚠ Enviado com atraso', espera: 'Aguardando (até 12h)',
  nao: '✕ NÃO enviou até 12h', nv: 'Grupo ainda não lido hoje', sem: 'Grupo não monitorado pelo sistema',
};
const aMin = (hhmm) => { const m = String(hhmm || '').match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

export function cartoes(CFG, ef, visiveis = null) {
  const hoje = hojeISO();
  const dados = ef && ef.dias ? ef : { dias: {} };
  const agora = new Date(); const minAgora = agora.getHours() * 60 + agora.getMinutes();
  const prazo = aMin(dados.prazo || '12:00');
  const obras = ((CFG && CFG.obras) || []).filter((o) => /^Mo/i.test(o) && (!visiveis || visiveis.includes(o)));
  const doDia = (dados.dias && dados.dias[hoje]) || {};
  // o grupo "Mo565" vale para a obra Mo565D (e vice-versa): casa o código mesmo com a letra do final
  const chaveDe = (mapa, o) => { const ks = Object.keys(mapa || {}); return ks.find((k) => k === o) || ks.find((k) => o.startsWith(k) || k.startsWith(o)); };
  const leitura = (o) => String((dados.leituras || {})[chaveDe(dados.leituras, o)] || '');
  const estado = (o) => {
    const e = doDia[chaveDe(doDia, o)];
    const lida = leitura(o);
    if (e) return { cod: aMin(e.hora) != null && aMin(e.hora) > prazo ? 'atraso' : 'ok', e };
    if (!lida) return { cod: 'sem' };
    if (lida.slice(0, 10) !== hoje) return { cod: 'nv' };
    return { cod: minAgora < prazo ? 'espera' : 'nao' };
  };
  const lista = obras.map((o) => ({ o, ...estado(o) }));
  const enviaram = lista.filter((x) => x.cod === 'ok' || x.cod === 'atraso').length;
  const cobrar = lista.filter((x) => x.cod === 'nao').map((x) => x.o);
  const lidas = Object.values(dados.leituras || {}).map(String).sort();
  const ultima = lidas.length ? lidas[lidas.length - 1] : '';
  const deHoje = ultima.slice(0, 10) === hoje;
  const cab = ultima
    ? html`<p class="leitura ${deHoje ? 'leitura-ok' : 'leitura-velha'}"><b>Última leitura dos grupos:</b> ${fmtData(ultima.slice(0, 10))}, ${ultima.slice(11, 16)}${deHoje ? ' (de hoje)' : ' · não é de hoje: o leitor automático não rodou hoje'}</p>`
    : html`<p class="leitura leitura-velha"><b>Os grupos das obras ainda não foram lidos pelo leitor automático.</b></p>`;
  const card = (x) => {
    const e = x.e;
    const sub = e ? `${e.hora ? `${e.hora}, ` : ''}${e.solida.qtd} da Sólida${e.terceiros && e.terceiros.length ? ` + ${e.terceiros.reduce((a, t) => a + (t.qtd || 0), 0)} terceirizados` : ''} (total ${e.total})`
      : x.cod === 'nao' ? 'cobrar o efetivo no grupo' : x.cod === 'espera' ? 'prazo: 12h' : '';
    const nomes = e && e.solida.nomes.length ? e.solida.nomes.join(', ') : '';
    const terc = e && e.terceiros && e.terceiros.length ? e.terceiros.map((t) => `${t.empresa} (${t.qtd})`).join(', ') : '';
    return html`<div class="ob-card fc-card fc-${x.cod}">
      <span class="ob-topo"><b class="ob-cod">${x.o}</b></span>
      <span class="fc-situacao">${ROTULO[x.cod]}</span>
      <span class="ob-sub">${sub}</span>
      ${nomes ? html`<span class="ob-sub">${nomes}</span>` : ''}
      ${terc ? html`<span class="ob-sub">Terceirizados: ${terc}</span>` : ''}
    </div>`;
  };
  return html`<section class="ob-sec">
    <div class="painel-h"><h2>Efetivo de hoje</h2><p>${fmtData(hoje)} · lido do grupo de cada obra pelo sistema · ${enviaram} de ${obras.length} obras já enviaram${prazo != null ? ` · prazo ${pad(Math.floor(prazo / 60))}h` : ''}</p></div>
    ${cab}
    ${cobrar.length ? html`<p class="leitura leitura-velha"><b>Cobrar o efetivo de hoje:</b> ${cobrar.join(', ')}</p>` : ''}
    <div class="ob-cards">${lista.map(card)}</div>
    <p class="legenda-semana"><span class="fc-b fc-ok"></span> no prazo <span class="fc-b fc-atraso"></span> com atraso <span class="fc-b fc-nao"></span> não enviou <span class="fc-b fc-espera"></span> ainda no prazo <span class="fc-b fc-nv"></span> não lido hoje</p>
  </section>`;
}
