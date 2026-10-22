// RH › Efetivo de hoje: um cartão por obra dizendo se o efetivo do dia foi postado no grupo de WhatsApp até as 12h.
// Quem preenche: o leitor automático do computador do escritório (scripts/leitor-whatsapp.mjs, de ~15 em 15 minutos) lê o grupo
// de cada obra e grava dados/json/efetivo.json. O sistema só afirma "não enviou" se o grupo foi lido hoje (campo `leituras`).

import { html, data as fmtData } from '../formato.js';
import { hojeISO } from '../datas.js';

const pad = (n) => String(n).padStart(2, '0');
const totalDe = (e) => (e.solida.qtd || 0) + ((e.terceiros || []).reduce((s, t) => s + (t.qtd || 0), 0));   // sempre Sólida + terceirizados (o total digitado no grupo às vezes só conta a Sólida)
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
    const sub = e ? `${e.hora ? `${e.hora}, ` : ''}${e.solida.qtd} da Sólida${e.terceiros && e.terceiros.length ? ` + ${e.terceiros.reduce((a, t) => a + (t.qtd || 0), 0)} terceirizados` : ''} (total ${totalDe(e)})`
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

// ---------------------------------------------------------------- quem está em cada obra HOJE (zera todo dia)
// A lista de funcionários vem do RH, mas "onde está cada um" vem só do efetivo que as obras postaram HOJE nos grupos de WhatsApp.
// Quem não aparece em nenhum efetivo de hoje fica "sem local hoje" (nada de presença herdada de dias antes). Férias e afastamento
// continuam como o RH informou. O que ainda não é lido pelo sistema: Sólides e Tangerino (precisam de login).
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const semPapel = (n) => norm(String(n).replace(/\(.*?\)/g, ''));
const papelDe = (n) => ((String(n).match(/\(([^)]*)\)/) || [])[1] || '').trim();
function casa(nomeEf, f) {
  const n = semPapel(nomeEf); if (!n) return false;
  const base = norm(String(f.nome || '').replace(/\(.*?\)/g, ''));
  const apelidos = [...String(f.nome || '').matchAll(/\(([^)]*)\)/g)].map((m) => norm(m[1]));
  const palavras = base.split(' ').filter(Boolean);
  return n === base || n === palavras[0] || apelidos.includes(n) || (n.includes(' ') && base.startsWith(n)) || (n.length >= 4 && palavras.includes(n));
}
const chaveDe = (mapa, o) => { const ks = Object.keys(mapa || {}); return ks.find((k) => k === o) || ks.find((k) => o.startsWith(k) || k.startsWith(o)); };

export function funcionariosDeHoje(lista, ef) {
  const hoje = hojeISO();
  const dia = (ef && ef.dias && ef.dias[hoje]) || {};
  const usados = new Set(); const saida = [];
  for (const f of lista || []) {
    let achou = null;
    for (const [obra, e] of Object.entries(dia)) {
      const i = (e.solida.nomes || []).findIndex((n, k) => !usados.has(`${obra}|${k}`) && casa(n, f));
      if (i >= 0) { achou = { obra, e, i }; break; }
    }
    if (achou) { usados.add(`${achou.obra}|${achou.i}`); saida.push({ ...f, obra: achou.obra, situacao: 'presente', fonte: `Efetivo de hoje no WhatsApp${achou.e.hora ? `, ${achou.e.hora}` : ''}` }); }
    else if (['ferias', 'afastado'].includes(f.situacao)) saida.push({ ...f });
    else saida.push({ ...f, obra: '', situacao: 'sem_local', fonte: 'Não apareceu em nenhum efetivo de hoje' });
  }
  // gente que está no efetivo de hoje mas não está na lista do RH
  for (const [obra, e] of Object.entries(dia)) (e.solida.nomes || []).forEach((n, k) => {
    if (usados.has(`${obra}|${k}`)) return;
    saida.push({ nome: String(n).replace(/\s*\(.*\)\s*$/, '').trim(), funcao: papelDe(n) || '—', obra, situacao: 'presente', fonte: `Só no efetivo de hoje${e.hora ? `, ${e.hora}` : ''} (não está na lista do RH)` });
  });
  return saida;
}

const hhmmBR = (iso) => (iso ? `${fmtData(String(iso).slice(0, 10)).slice(0, 5)}, ${String(iso).slice(11, 16)}` : '—');
// Indicadores, resumo e alertas do RH calculados do efetivo de hoje (no lugar dos números antigos do agente)
export function areaDeHoje(area, CFG, ef, visiveis = null) {
  const hoje = hojeISO();
  const dados = ef && ef.dias ? ef : { dias: {} };
  const d = dados.dias[hoje] || {};
  const agora = new Date(); const minAgora = agora.getHours() * 60 + agora.getMinutes(); const prazo = aMin(dados.prazo || '12:00');
  const obras = ((CFG && CFG.obras) || []).filter((o) => /^Mo/i.test(o) && (!visiveis || visiveis.includes(o)));
  let enviaram = 0; let sol = 0; let ter = 0; const faltam = [];
  for (const o of obras) {
    const e = d[chaveDe(d, o)];
    if (e) { enviaram++; sol += e.solida.qtd || 0; ter += (e.terceiros || []).reduce((a, t) => a + (t.qtd || 0), 0); } else faltam.push(o);
  }
  const lista = (CFG && CFG.funcionarios) || [];
  const semLocal = lista.filter((p) => p.situacao === 'sem_local').length;
  const lidas = Object.values(dados.leituras || {}).map(String).sort(); const ultima = lidas.length ? lidas[lidas.length - 1] : '';
  const alertas = [];
  if (minAgora >= prazo && faltam.length) alertas.push({ nivel: 'atencao', texto: `Cobrar o efetivo de hoje (prazo ${pad(Math.floor(prazo / 60))}h): ${faltam.join(', ')}.`, restrito: false });
  if (semLocal) alertas.push({ nivel: 'atencao', texto: `${semLocal} funcionário${semLocal > 1 ? 's' : ''} da lista não aparece${semLocal > 1 ? 'm' : ''} em nenhum efetivo de hoje. Veja em "Funcionários por obra" quem é, e confira se estão em obra, de folga ou faltaram.`, restrito: false });
  alertas.push({ nivel: 'atencao', texto: 'Sólides e Tangerino ainda não são lidos pelo sistema (precisam de login); a presença de hoje vem só dos grupos de WhatsApp das obras.', restrito: false });
  return {
    ...area,
    status: faltam.length && minAgora >= prazo ? 'atencao' : 'ok',
    resumo: `Hoje, ${enviaram} de ${obras.length} obras enviaram o efetivo: ${sol} pessoas da Sólida e ${ter} terceirizados em obra. ${semLocal} dos ${lista.length} funcionários da lista não aparecem em nenhum efetivo de hoje.`,
    kpis: [
      { label: 'Obras com efetivo enviado hoje', valor: `${enviaram} de ${obras.length} · prazo ${pad(Math.floor(prazo / 60))}h`, restrito: false },
      { label: 'Equipe Sólida em obra hoje', valor: String(sol), restrito: false },
      { label: 'Terceirizados em obra hoje', valor: String(ter), restrito: false },
      { label: 'Funcionários sem local hoje', valor: `${semLocal} de ${lista.length}`, restrito: false },
    ],
    alertas,
    fontes: [
      { nome: 'WhatsApp', via: 'Efetivo do dia nos grupos das obras (leitura automática)', ultima: hhmmBR(ultima) },
      { nome: 'Sólides / Tangerino', via: 'Ainda não lidos pelo sistema (pedem login)', ultima: '—' },
    ],
  };
}

// ---------------------------------------------------------------- histórico: quem estava em cada obra em cada dia
const DIA_SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const csvCel = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
export function historico(CFG, ef, params = {}, visiveis = null) {
  const hoje = hojeISO();
  const dias = (ef && ef.dias) || {};
  const mes = /^\d{4}-\d{2}$/.test(params.mes || '') ? params.mes : hoje.slice(0, 7);
  const [a, m] = mes.split('-').map(Number);
  const nDias = new Date(a, m, 0).getDate();
  const mesAnt = m === 1 ? `${a - 1}-12` : `${a}-${pad(m - 1)}`; const mesProx = m === 12 ? `${a + 1}-01` : `${a}-${pad(m + 1)}`;
  const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  // colunas: as obras ativas + qualquer outra com dados neste mês (Mo565 e Mo565D são a mesma obra: fica a do cadastro)
  const doCadastro = ((CFG && CFG.obras) || []).filter((o) => /^Mo/i.test(o));
  const comDadosNoMes = [...new Set(Object.entries(dias).filter(([d]) => d.startsWith(mes)).flatMap(([, o]) => Object.keys(o)))];
  let obras = [...new Set([...doCadastro, ...comDadosNoMes.filter((o) => !doCadastro.some((c) => c.startsWith(o) || o.startsWith(c)))])].sort();
  if (visiveis) obras = obras.filter((o) => visiveis.some((v) => o.startsWith(v) || v.startsWith(o)));
  const lista = []; for (let i = nDias; i >= 1; i--) { const iso = `${mes}-${pad(i)}`; if (iso <= hoje) lista.push(iso); }
  const agora = new Date(); const aguardando = agora.getHours() * 60 + agora.getMinutes() < (aMin((ef && ef.prazo) || '12:00') || 720);
  const [selDia, selObra] = String(params.sel || '').split('|');
  const reg = (dia, o) => { const mapa = dias[dia] || {}; const k = chaveDe(mapa, o); return k ? mapa[k] : null; };
  const terTot = (e) => (e.terceiros || []).reduce((s, t) => s + (t.qtd || 0), 0);

  const linhas = lista.map((dia) => {
    const dow = new Date(`${dia}T12:00:00`).getDay(); const fds = dow === 0 || dow === 6;
    let somaDia = 0; let algum = false;
    const cels = obras.map((o) => {
      const e = reg(dia, o);
      if (e) { somaDia += totalDe(e); algum = true; const t = terTot(e); const sel = selDia === dia && selObra === o ? ' ef-sel' : '';
        return html`<td class="ef-c ef-ok${sel}"><a href="#/rh/efetivo?mes=${mes}&sel=${dia}|${o}" title="Ver quem estava em ${o} em ${fmtData(dia)}"><b>${totalDe(e)}</b>${t ? html`<small>${e.solida.qtd}+${t}</small>` : ''}</a></td>`; }
      if (fds) return html`<td class="ef-c ef-fds">·</td>`;
      if (dia === hoje && aguardando) return html`<td class="ef-c ef-esp">aguardando</td>`;
      return html`<td class="ef-c ef-nao" title="Não enviou o efetivo neste dia">—</td>`;
    });
    return html`<tr class="${dia === hoje ? 'ef-hoje' : ''}"><th class="ef-dia" scope="row"><b>${fmtData(dia).slice(0, 5)}</b> <small>${DIA_SEM[dow]}</small></th>${cels}<td class="ef-tot">${algum ? somaDia : ''}</td></tr>`;
  });

  // detalhe da célula escolhida
  let detalhe = '';
  if (selDia && selObra) {
    const e = reg(selDia, selObra);
    detalhe = e
      ? html`<section class="ef-detalhe"><h3>${selObra} · ${fmtData(selDia)} (${DIA_SEM[new Date(`${selDia}T12:00:00`).getDay()]})</h3>
        <p class="pequeno">Efetivo postado${e.hora ? ` às ${e.hora}` : ''} no grupo da obra · total de ${totalDe(e)} ${totalDe(e) === 1 ? 'pessoa' : 'pessoas'}</p>
        <div class="ef-listas"><div><h4>Equipe Sólida (${e.solida.qtd})</h4>${(e.solida.nomes || []).length ? html`<ul>${e.solida.nomes.map((n) => html`<li>${n}</li>`)}</ul>` : html`<p class="muted">Nenhum nome informado.</p>`}</div>
        <div><h4>Terceirizados (${terTot(e)})</h4>${(e.terceiros || []).length ? html`<ul>${e.terceiros.map((t) => html`<li>${t.empresa}${t.qtd ? ` · ${t.qtd}` : ''}${t.funcao ? ` (${t.funcao})` : ''}</li>`)}</ul>` : html`<p class="muted">Nenhum.</p>`}</div></div></section>`
      : html`<section class="ef-detalhe"><h3>${selObra} · ${fmtData(selDia)}</h3><p class="muted">Não há efetivo registrado para esta obra neste dia.</p></section>`;
  }

  // planilha (CSV, abre no Excel): uma linha por obra e dia do mês
  const csv = ['Data;Dia;Obra;Horário do envio;Equipe Sólida (qtd);Nomes da Sólida;Terceirizados (qtd);Terceirizados;Total']
    .concat(Object.keys(dias).filter((d) => d.startsWith(mes)).sort().flatMap((dia) => Object.entries(dias[dia]).filter(([o]) => !visiveis || visiveis.some((v) => o.startsWith(v) || v.startsWith(o))).map(([o, e]) =>
      [fmtData(dia), DIA_SEM[new Date(`${dia}T12:00:00`).getDay()], o, e.hora || '', e.solida.qtd, (e.solida.nomes || []).join(', '), terTot(e), (e.terceiros || []).map((t) => `${t.empresa} (${t.qtd || 1})`).join(', '), totalDe(e)].map(csvCel).join(';'))))
    .join('\r\n');
  const href = `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${csv}`)}`;
  const temDados = Object.keys(dias).some((d) => d.startsWith(mes));

  return html`<section class="ef-hist">
    <div class="painel-h"><h2>Histórico do efetivo</h2><p>Quem estava em cada obra em cada dia, lido do efetivo que as obras postam nos grupos de WhatsApp. Clique num número para ver os nomes. "—" = a obra não enviou o efetivo naquele dia; "·" = fim de semana. Sólides e Tangerino ainda não entram aqui.</p></div>
    <div class="periodo ef-nav">
      <a class="botao" href="#/rh/efetivo?mes=${mesAnt}">← ${NOME_MES[(m + 10) % 12]}</a>
      <div class="atual"><span>Mês</span><b>${NOME_MES[m - 1]} de ${a}</b></div>
      ${mes < hoje.slice(0, 7) ? html`<a class="botao" href="#/rh/efetivo?mes=${mesProx}">${NOME_MES[m % 12]} →</a>` : ''}
      <a class="botao on ef-baixar" download="efetivo-${mes}.csv" href="${html.seguro(href)}">⬇ Baixar planilha do mês</a>
    </div>
    ${temDados || lista.length ? html`<div class="ef-rolagem"><table class="ef-tab"><thead><tr><th>Dia</th>${obras.map((o) => html`<th>${o}</th>`)}<th>Total</th></tr></thead><tbody>${linhas}</tbody></table></div>` : html`<p class="vazio">Nenhum dia neste mês.</p>`}
    ${detalhe}
    <p class="legenda-semana">Número grande = total de pessoas no dia; pequeno = Sólida + terceirizados. O histórico fica guardado no banco de dados e não é apagado.</p>
  </section>`;
}
