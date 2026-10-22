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

// ---------------------------------------------------------------- histórico POR FUNCIONÁRIO: em que obra cada um esteve em cada dia
// Lista de funcionários com os últimos 5 dias úteis (obra de cada dia); clicar abre o mês em calendário, com setas para meses anteriores.
// Tudo sai do efetivo que as obras postam nos grupos (e que fica guardado no banco, sem apagar). Sólides e Tangerino ainda não entram.
const DIA_SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const NOME_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const csvCel = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
const CORES = [['#E3EEF9', '#1F4E79'], ['#E4F2E8', '#2F6B43'], ['#FBEFD5', '#7A5A1E'], ['#F5E1EA', '#8A2F55'], ['#E8E4F5', '#4B3A8A'], ['#DDF1F0', '#1F6B68'], ['#F8E4DC', '#9A4A2A'], ['#EAEAEA', '#444444']];
const corDe = (o) => { let h = 0; for (const c of String(o)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return CORES[h % CORES.length]; };
const chipObra = (o) => { const [bg, fg] = corDe(o); return html`<span class="ef-chip" style="background:${bg};color:${fg}">${o}</span>`; };
const isoDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const iniciais = (n) => String(n).replace(/\(.*?\)/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

// casa cada nome do efetivo de cada dia com um funcionário da lista do RH; quem não está na lista entra como "só no efetivo"
function indicePessoas(CFG, ef) {
  const lista = (CFG && (CFG.funcionariosRH || CFG.funcionarios)) || [];
  const pessoas = lista.filter((f) => f && f.nome).map((f, i) => ({ chave: `f${i}`, nome: f.nome, funcao: f.funcao || '', extra: false }));
  const extras = new Map(); const porDia = {};
  const dias = (ef && ef.dias) || {};
  for (const dia of Object.keys(dias).sort()) {
    porDia[dia] = {}; const usados = new Set();
    for (const [obra, e] of Object.entries(dias[dia] || {})) {
      ((e.solida && e.solida.nomes) || []).forEach((n) => {
        const i = pessoas.findIndex((p) => !usados.has(p.chave) && casa(n, { nome: p.nome }));
        let chave;
        if (i >= 0) { chave = pessoas[i].chave; usados.add(chave); }
        else { chave = `x:${semPapel(n)}`; if (!extras.has(chave)) extras.set(chave, { chave, nome: String(n).replace(/\s*\(.*\)\s*$/, '').trim(), funcao: papelDe(n) || '—', extra: true }); }
        (porDia[dia][chave] = porDia[dia][chave] || []).push(obra);
      });
    }
  }
  return { pessoas: [...pessoas, ...extras.values()], porDia };
}
const ultimosUteis = (n, hoje) => { const r = []; const d = new Date(`${hoje}T12:00:00`); while (r.length < n) { if (d.getDay() !== 0 && d.getDay() !== 6) r.push(isoDe(d)); d.setDate(d.getDate() - 1); } return r; };
const visivelObra = (o, visiveis) => !visiveis || visiveis.some((v) => o.startsWith(v) || v.startsWith(o));

export function historico(CFG, ef, params = {}, visiveis = null) {
  const hoje = hojeISO();
  const { pessoas, porDia } = indicePessoas(CFG, ef);
  const obrasDe = (chave, dia) => ((porDia[dia] || {})[chave] || []).filter((o) => visivelObra(o, visiveis));
  const gp = (k) => String((params && typeof params.get === 'function' ? params.get(k) : params && params[k]) || '');   // params vem como URLSearchParams
  const ehPessoa = pessoas.find((p) => p.chave === gp('p'));
  const mes = /^\d{4}-\d{2}$/.test(gp('mes')) ? gp('mes') : hoje.slice(0, 7);

  // ----------------------------------------------------- calendário de um funcionário
  if (ehPessoa) {
    const [a, m] = mes.split('-').map(Number);
    const nDias = new Date(a, m, 0).getDate(); const primeiro = (new Date(a, m - 1, 1).getDay() + 6) % 7;   // semana começa na segunda
    const mesAnt = m === 1 ? `${a - 1}-12` : `${a}-${pad(m - 1)}`; const mesProx = m === 12 ? `${a + 1}-01` : `${a}-${pad(m + 1)}`;
    const contagem = new Map(); let diasEmObra = 0; let uteisSemRegistro = 0;
    const inicioDados = Object.keys((ef && ef.dias) || {}).sort()[0] || hoje;   // antes disso o sistema ainda não guardava o efetivo: não dá para dizer "sem registro"
    const cels = [];
    for (let i = 0; i < primeiro; i++) cels.push(html`<div class="ef-cal-vazio"></div>`);
    for (let d = 1; d <= nDias; d++) {
      const iso = `${mes}-${pad(d)}`; const dow = new Date(`${iso}T12:00:00`).getDay(); const fds = dow === 0 || dow === 6;
      const obras = iso <= hoje ? obrasDe(ehPessoa.chave, iso) : [];
      if (obras.length) { diasEmObra++; for (const o of new Set(obras)) contagem.set(o, (contagem.get(o) || 0) + 1); }
      else if (!fds && iso < hoje && iso >= inicioDados) uteisSemRegistro++;
      const cls = ['ef-cal-dia', obras.length ? 'ef-cal-obra' : '', fds ? 'ef-cal-fds' : '', iso === hoje ? 'ef-cal-hoje' : '', iso > hoje ? 'ef-cal-fut' : ''].filter(Boolean).join(' ');
      const hora = obras.length ? ((((ef.dias || {})[iso] || {})[chaveDe((ef.dias || {})[iso] || {}, obras[0])] || {}).hora || '') : '';
      cels.push(html`<div class="${cls}" title="${obras.length ? `${[...new Set(obras)].join(' e ')}${hora ? ` · efetivo postado às ${hora}` : ''}` : (fds ? 'Fim de semana' : iso > hoje ? '' : iso < inicioDados ? 'Antes de o sistema começar a guardar o efetivo' : 'Não apareceu no efetivo de nenhuma obra')}"><span class="ef-cal-n">${d}</span>${obras.length ? html`<div class="ef-cal-obras">${[...new Set(obras)].map(chipObra)}</div>` : (!fds && iso <= hoje && iso >= inicioDados ? html`<span class="ef-cal-sem">sem registro</span>` : '')}</div>`);
    }
    const csv = ['Data;Dia;Obra;Funcionário'].concat(Array.from({ length: nDias }, (_, i) => `${mes}-${pad(i + 1)}`).filter((iso) => iso <= hoje).flatMap((iso) => {
      const os = obrasDe(ehPessoa.chave, iso); return [[fmtData(iso), DIA_SEM[new Date(`${iso}T12:00:00`).getDay()], os.length ? [...new Set(os)].join(' / ') : '', ehPessoa.nome].map(csvCel).join(';')];
    })).join('\r\n');
    const href = `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${csv}`)}`;
    return html`<section class="ef-hist">
      <a class="voltar" href="#/rh/efetivo">← Todos os funcionários</a>
      <div class="ef-pessoa"><span class="ef-av ef-av-g">${iniciais(ehPessoa.nome)}</span><div><h2>${ehPessoa.nome}</h2><p class="pequeno">${ehPessoa.funcao}${ehPessoa.extra ? ' · só aparece no efetivo (não está na lista do RH)' : ''}</p></div></div>
      <div class="periodo ef-nav">
        <a class="botao" href="#/rh/efetivo?p=${encodeURIComponent(ehPessoa.chave)}&mes=${mesAnt}">← ${NOME_MES[(m + 10) % 12]}</a>
        <div class="atual"><span>Mês</span><b>${NOME_MES[m - 1]} de ${a}</b></div>
        ${mes < hoje.slice(0, 7) ? html`<a class="botao" href="#/rh/efetivo?p=${encodeURIComponent(ehPessoa.chave)}&mes=${mesProx}">${NOME_MES[m % 12]} →</a>` : ''}
        <a class="botao on ef-baixar" download="${ehPessoa.nome.replace(/[^\wÀ-ú]+/g, '-')}-${mes}.csv" href="${html.seguro(href)}">⬇ Baixar planilha do mês</a>
      </div>
      <p class="ef-resumo"><b>${diasEmObra}</b> ${diasEmObra === 1 ? 'dia' : 'dias'} em obra no mês${[...contagem.entries()].length ? ' · ' : ''}${[...contagem.entries()].sort((x, y) => y[1] - x[1]).map(([o, n]) => html`${chipObra(o)} <span class="muted">${n}×</span> `)}${uteisSemRegistro ? html` · <span class="muted">${uteisSemRegistro} ${uteisSemRegistro === 1 ? 'dia útil' : 'dias úteis'} sem registro</span>` : ''}</p>
      <div class="ef-cal"><div class="ef-cal-cab">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((x) => html`<span>${x}</span>`)}</div><div class="ef-cal-grade">${cels}</div></div>
      <p class="legenda-semana">Cada cor é uma obra. "sem registro" = o funcionário não apareceu no efetivo de nenhuma obra naquele dia (pode ser folga, falta, ou a obra não postou). Dados do efetivo dos grupos de WhatsApp. O sistema começou a guardar o efetivo em ${fmtData(inicioDados)}; os dias antes disso ficam em branco.</p>
    </section>`;
  }

  // ----------------------------------------------------- lista de funcionários com os últimos 5 dias úteis
  const cinco = ultimosUteis(5, hoje);
  const linhas = pessoas.map((p) => ({ p, dias: cinco.map((d) => ({ d, os: [...new Set(obrasDe(p.chave, d))] })) }))
    .map((x) => ({ ...x, n: x.dias.filter((y) => y.os.length).length }))
    .sort((x, y) => (y.n - x.n) || x.p.nome.localeCompare(y.p.nome, 'pt-BR'));
  const [a, m] = hoje.slice(0, 7).split('-').map(Number);
  const csvAll = ['Funcionário;Função'].map((h) => h + ';' + Array.from({ length: new Date(a, m, 0).getDate() }, (_, i) => `${pad(i + 1)}/${pad(m)}`).join(';'))
    .concat(pessoas.map((p) => [p.nome, p.funcao].map(csvCel).join(';') + ';' + Array.from({ length: new Date(a, m, 0).getDate() }, (_, i) => { const iso = `${hoje.slice(0, 7)}-${pad(i + 1)}`; return csvCel(iso <= hoje ? [...new Set(obrasDe(p.chave, iso))].join(' / ') : ''); }).join(';'))).join('\r\n');
  const hrefAll = `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${csvAll}`)}`;
  return html`<section class="ef-hist">
    <div class="painel-h"><h2>Histórico do efetivo</h2><p>Em que obra cada funcionário esteve, dia a dia, segundo o efetivo que as obras postam nos grupos de WhatsApp. Clique no funcionário para ver o mês em calendário. Sólides e Tangerino ainda não entram.</p></div>
    <div class="ef-barra"><input id="ef-busca" type="search" placeholder="Buscar funcionário ou função" autocomplete="off"><a class="botao on ef-baixar" download="efetivo-funcionarios-${hoje.slice(0, 7)}.csv" href="${html.seguro(hrefAll)}">⬇ Planilha do mês (funcionário × dia)</a></div>
    <div class="ef-cinco-cab"><span>Últimos 5 dias úteis</span><span>${cinco.slice().reverse().map((d) => html`<b>${DIA_SEM[new Date(`${d}T12:00:00`).getDay()]} ${fmtData(d).slice(0, 5)}</b>`)}</span></div>
    <div class="ef-lista">${linhas.length ? linhas.map(({ p, dias }) => html`<a class="ef-linha" href="#/rh/efetivo?p=${encodeURIComponent(p.chave)}" data-busca="${norm(`${p.nome} ${p.funcao}`)}">
      <span class="ef-av">${iniciais(p.nome)}</span>
      <span class="ef-nome"><b>${p.nome}</b><small>${p.funcao}${p.extra ? ' · só no efetivo' : ''}</small></span>
      <span class="ef-cinco">${dias.slice().reverse().map(({ d, os }) => html`<span class="ef-d ${os.length ? '' : 'ef-d-vazio'}" title="${fmtData(d)}">${os.length ? os.map(chipObra) : html`<i>—</i>`}</span>`)}</span>
      <span class="ef-seta" aria-hidden="true">›</span></a>`) : html`<p class="vazio">Ainda não há efetivo registrado.</p>`}</div>
  </section>`;
}
// busca na lista de funcionários (filtra as linhas sem recarregar a página)
if (typeof document !== 'undefined') {
  document.addEventListener('input', (e) => {
    if (!e.target || e.target.id !== 'ef-busca') return;
    const q = norm(e.target.value);
    document.querySelectorAll('.ef-linha').forEach((l) => { l.style.display = !q || (l.dataset.busca || '').includes(q) ? '' : 'none'; });
  });
}
