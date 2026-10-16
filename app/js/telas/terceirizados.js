// Operação › Terceirizados × contratos no Mais Controle (pedido do Felipe, 16/10).
// Terceirizada = toda empresa vinculada a uma obra, seja cinza ou laranja. Para cada uma o sistema confere, no
// Mais Controle (só leitura): tem contrato vinculado à obra? E medição na página de medição de contratos da obra?
// A conferência no Mais Controle é feita pelo agente de Operação no navegador já logado e gravada em
// dados/json/terceirizados.json; o sistema só mostra. Empresa que aparece nas programações e ainda não foi conferida
// entra aqui sozinha como "não conferida". Quem recebe o alerta: Simone (processos 1.1 e 1.4 do POP).
// Nunca acusa falta sem ter lido o Mais Controle.

import { html, data as fmtData } from '../formato.js';

const RESPONSAVEL = 'SIMONE';
const NAO_EMPRESA = /s[óo]lida|arquitet|terceiriz|fornecedor|andamento|aditivo|atrasad|cinza|laranja|cliente|ap[óo]s|aprova[çc]|prazo|pendente|previs|restante|un\b|conclu/i;

// Empresas citadas entre parênteses nos itens da programação semanal: "Porta de correr (Humber)"
function candidatasDaProgramacao(CFG, visiveis) {
  const achadas = [];
  const plan = (CFG && CFG.areas && CFG.areas.find((a) => a.id === 'planejamento')) || {};
  for (const o of (plan.porObra || [])) {
    if (visiveis && !visiveis.includes(o.obra)) continue;
    const cron = o.cronograma || {}; const prog = o.programacao || {};
    const textos = [...(cron.estaSemana || []), ...(cron.proximaSemana || [])];
    for (const d of (prog.dias || [])) textos.push(...(d.itens || []));
    for (const t of textos) {
      const tx = typeof t === 'string' ? t : (t.texto || t.item || '');
      for (const m of String(tx).matchAll(/\(([^)]+)\)/g)) {
        const nome = m[1].split(',')[0].trim();
        // nome de empresa começa com maiúscula e tem poucas palavras ("luminárias da sala" não é empresa)
        if (!nome || nome.length > 28 || nome.split(/\s+/).length > 3 || !/^[A-ZÀ-Ú]/.test(nome) || /\d/.test(nome) || NAO_EMPRESA.test(nome)) continue;
        achadas.push({ obra: o.obra, empresa: nome, vistoEm: 'programação semanal' });
      }
    }
  }
  return achadas;
}const chave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function levantar(CFG, dados, visiveis = null) {
  const lido = (dados && Array.isArray(dados.empresas)) ? dados.empresas : [];
  const mapa = new Map();
  for (const e of lido) if (!visiveis || visiveis.includes(e.obra)) mapa.set(`${e.obra}|${chave(e.empresa)}`, { ...e });
  for (const c of candidatasDaProgramacao(CFG, visiveis)) {
    const k = `${c.obra}|${chave(c.empresa)}`;
    if (!mapa.has(k)) mapa.set(k, { ...c, contrato: null, medicao: null });
  }
  const lista = [...mapa.values()].map((e) => {
    let cod = 'nv';
    if (e.contrato === false) cod = 'sem';
    else if (e.contrato === true && e.medicao === false) cod = 'semmed';
    else if (e.contrato === true) cod = 'ok';
    return { ...e, cod };
  });
  const ordem = { sem: 0, semmed: 1, nv: 2, ok: 3 };
  lista.sort((a, b) => a.obra.localeCompare(b.obra, 'pt-BR', { numeric: true }) || ordem[a.cod] - ordem[b.cod] || a.empresa.localeCompare(b.empresa, 'pt-BR'));
  return lista;
}

const ROTULO = {
  ok: '✓ Contrato e medição em dia', semmed: '⚠ Contrato sem medição', sem: '✕ Sem contrato no Mais Controle', nv: '? Ainda não conferida no Mais Controle',
};

export function render(CFG, dados, visiveis = null) {
  const lista = levantar(CFG, dados, visiveis);
  if (!lista.length) return '';
  const n = (c) => lista.filter((e) => e.cod === c).length;
  const obras = [...new Set(lista.map((e) => e.obra))];
  const lido = dados && dados.verificadoEm
    ? `Mais Controle lido em ${fmtData(String(dados.verificadoEm).slice(0, 10))}${String(dados.verificadoEm).length > 10 ? `, ${String(dados.verificadoEm).slice(11, 16)}` : ''}`
    : 'O Mais Controle ainda não foi conferido para este quadro';
  const alerta = n('sem')
    ? html`<p class="aviso tr-alerta tr-critico"><b>1.1 · ${RESPONSAVEL}</b> — ${n('sem')} ${n('sem') === 1 ? 'empresa está' : 'empresas estão'} na obra sem contrato vinculado no Mais Controle: ${lista.filter((e) => e.cod === 'sem').map((e) => `${e.empresa} (${e.obra})`).join(', ')}.</p>`
    : n('semmed')
      ? html`<p class="aviso tr-alerta"><b>1.4 · ${RESPONSAVEL}</b> — ${n('semmed')} ${n('semmed') === 1 ? 'empresa tem contrato mas está' : 'empresas têm contrato mas estão'} sem medição: ${lista.filter((e) => e.cod === 'semmed').map((e) => `${e.empresa} (${e.obra})`).join(', ')}.</p>`
      : n('nv') ? html`<p class="aviso tr-alerta"><b>${RESPONSAVEL}</b> — ${n('nv')} ${n('nv') === 1 ? 'empresa ainda não foi conferida' : 'empresas ainda não foram conferidas'} no Mais Controle (aparecem nas obras, mas ainda não confirmei o contrato).</p>` : '';
  return html`<section class="secao tr-sec"><h2>Terceirizadas nas obras × contratos no Mais Controle</h2>
    <p class="pequeno">Toda empresa vinculada a uma obra (cinza ou laranja) precisa de contrato vinculado no Mais Controle, com medição na página de medição de contratos da obra. ${lido}.</p>
    ${alerta}
    <div class="cards">
      <div class="card"><div class="card-valor ${n('sem') ? 'tom-ruim' : ''}">${n('sem')}</div><div class="card-rotulo">Sem contrato</div></div>
      <div class="card"><div class="card-valor">${n('semmed')}</div><div class="card-rotulo">Contrato sem medição</div></div>
      <div class="card"><div class="card-valor">${n('nv')}</div><div class="card-rotulo">Ainda não conferidas</div></div>
      <div class="card"><div class="card-valor">${n('ok')}</div><div class="card-rotulo">Em dia</div></div>
    </div>
    <div class="tabela-rolagem"><table class="tab tr-tab"><thead><tr><th>Obra</th><th>Empresa</th><th>Situação no Mais Controle</th><th>Onde apareceu</th></tr></thead><tbody>
      ${lista.map((e) => html`<tr class="tr-${e.cod}"><td class="cod">${e.obra}</td><td><b>${e.empresa}</b>${e.contratoNome ? html` <span class="pequeno">(${e.contratoNome})</span>` : ''}</td><td><span class="tr-selo tr-${e.cod}">${ROTULO[e.cod]}</span>${e.obs ? html` <span class="pequeno">${e.obs}</span>` : ''}</td><td class="pequeno">${e.vistoEm || ''}</td></tr>`)}
    </tbody></table></div>
    <p class="pequeno">${obras.length} ${obras.length === 1 ? 'obra' : 'obras'} · só leitura: o sistema não lança nada no Mais Controle.</p>
  </section>`;
}
