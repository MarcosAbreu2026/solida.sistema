// Telas do Painel da Empresa (Solida.exe v1.7), trazidas para o sistema web sem mudar o que mostram.
// Leem o mesmo dados.json do Drive que os agentes preenchem (estrutura: geral, areas, funcionarios, obras).

import { esc } from './formato.js';

const CURTO = {"Valor enviado aguardando resposta": "Valor enviado", "Cronograma ou pendências em dia": "Cronogramas em dia", "Cronograma ou pendências atualizados": "Cronogramas atualizados", "Desvio custo × orçamento (pior obra)": "Pior desvio de custo", "Solicitações paradas há mais de 3 dias": "Solicitações paradas (> 3 dias)", "Projetos compatibilizados antes da obra": "Projetos compatibilizados", "Planilha Mestre atualizada na sexta": "Planilha Mestre na sexta", "Checklists de ferramentas até quarta": "Checklists até quarta", "Ferramentas com decisão em 7 dias": "Decisão de reparo em 7 dias", "Resposta ao cliente em 2 dias úteis": "Resposta em 2 dias úteis", "Orçamentos aprovados pelo cliente": "Orçamentos aprovados", "Orçamentos no prazo (≤ 10 dias)": "Orçamentos em até 10 dias", "Pendências BeeVale há mais de 7 dias": "Pendências BeeVale (> 7 dias)", "Medições cinza cobradas na terça": "Medições cobradas na terça", "Obras com efetivo enviado": "Efetivo enviado", "Férias programadas com 90 dias": "Férias com 90 dias", "Itens abaixo do mínimo no galpão": "Itens abaixo do mínimo", "Medições de contratos até sexta": "Medições até sexta", "Alterações executadas sem aditivo": "Alterações sem aditivo", "Revisão → abertura do aditivo": "Revisão até o aditivo", "Margem média dos aditivos": "Margem dos aditivos", "Enviados aguardando resposta": "Enviados sem resposta", "Equipe Sólida em obra agora": "Equipe em obra", "Obras sem equipe Sólida hoje": "Obras sem equipe", "Locações devolvidas na data": "Locações no prazo", "Reposições entregues até terça": "Reposições até terça", "Materiais entregues no prazo": "Entregas no prazo", "Faltas de material na obra": "Faltas de material", "Custo mensal de locação": "Custo de locação", "Pior desvio de custo por obra": "Pior desvio de custo", "Prazo médio de recebimento": "Prazo de recebimento", "Margem líquida da empresa": "Margem líquida", "Custo fixo sobre receita": "Custo fixo / receita", "Receita cobrada × orçada": "Cobrado × orçado", "Decisão em 48h após visita": "Decisão em 48h", "Serviços na data agendada": "Serviços na data", "Cobranças enviadas na terça": "Cobranças na terça", "Projetos com cadastro completo": "Cadastro de projetos", "Medições aprovadas sem ajuste": "Medições sem ajuste", "Compras validadas na segunda": "Compras validadas (seg.)", "Medições enviadas no prazo": "Medições no prazo", "Programação semanal em dia": "Programações em dia", "Orçamentos em andamento": "Em andamento", "Efetivo enviado no grupo": "Efetivo enviado", "Serviços de pós-obra em andamento": "Serviços em andamento"};
const curto = (t) => CURTO[t] || t;
export const LBL = { ok: 'Em dia', atencao: 'Atenção', critico: 'Crítico', pendente: 'Aguardando' };
const SIT = { presente: 'Na obra hoje', sem_local: 'Sem local hoje', deslocamento: 'Em deslocamento', ausente: 'Sem registro', ferias: 'Férias', afastado: 'Afastado' };
const NIVEIS = ['ok', 'atencao', 'critico', 'pendente'];
export const CHEV = '<svg class="chev" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const pt = (s) => `<span class="pt ${NIVEIS.includes(s) ? s : 'pendente'}"></span>`;

// Mesma validação do Painel da Empresa: completa o que faltar e normaliza os níveis
export function normalizar(d) {
  if (!d || typeof d !== 'object' || !Array.isArray(d.areas) || !d.geral) return null;
  const niv = (x) => (NIVEIS.includes(x) ? x : 'atencao');
  const lista = (x) => (Array.isArray(x) ? x : []);
  return {
    empresa: d.empresa || 'Sólida',
    geral: { ...d.geral, kpis: lista(d.geral.kpis), alertas: lista(d.geral.alertas).map((a) => ({ ...a, nivel: niv(a.nivel) })) },
    areas: d.areas.filter((a) => a && a.id && a.nome).map((a) => ({
      resumo: '', instrucoes: '', frequencia: '', ...a, status: niv(a.status),
      kpis: lista(a.kpis), fontes: lista(a.fontes), alertas: lista(a.alertas).map((x) => ({ ...x, nivel: niv(x.nivel) })),
    })),
    funcionarios: lista(d.funcionarios),
    obras: lista(d.obras).length ? d.obras : [...new Set(lista(d.funcionarios).map((p) => p.obra).filter(Boolean))],
    atualizadoEm: d.atualizadoEm || null,
  };
}

// opc.areaVisivel(area): setores que a pessoa pode ver (os outros nem aparecem)
// opc.obras: obras da pessoa (funções de obra) — o resto não aparece
// opc.resumida: Visão geral só com números, sem frase, alertas ou o detalhe de cada obra
// opc.veBloco(titulo) / opc.itemOculto(label): blocos e indicadores da Visão geral por função
export function criarTelas(CFG, socio, opc = {}) {
  const vis = (x) => socio || !x.restrito;
  const areaVisivel = opc.areaVisivel || (() => true);
  const resumida = !!opc.resumida;
  const nota = (k) => (!resumida && k.nota ? `<div class="n">${esc(k.nota)}</div>` : '');

  function met(k) {
    const p = String(k.valor ?? '—').split(' · ');
    const v = p.shift();
    const sem = v === '—';
    return `<div class="met"><div class="v${sem ? ' sem' : ''}">${esc(v)}</div><div class="l" title="${esc(k.label)}">${esc(curto(k.label))}</div>${p.length ? `<div class="n">${esc(p.join(', '))}</div>` : ''}${k.nota ? `<div class="n">${esc(k.nota)}</div>` : ''}${k.restrito ? '<div class="r">Visível só para sócios</div>' : ''}</div>`;
  }

  // ------------------------------------------------------------ visão geral
  function indHtml(k) {
    const um = k.valor !== undefined && k.mes === undefined && k.ano === undefined;
    const cell = (lab, v) => { const x = String(v ?? '—'); return `<div class="${um ? 'um' : ''}"><span${lab ? '' : ' aria-hidden="true"'}>${lab ? esc(lab) : '&nbsp;'}</span><b class="${x === '—' ? 'sem' : ''}">${esc(x)}</b></div>`; };
    const pctv = (k.pct !== undefined && k.pct !== null) ? `<div class="pct" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, k.pct))}%"></i></div>` : '';
    return `<div class="ind"><div class="t" title="${esc(k.label)}">${esc(curto(k.label))}</div><div class="vals">${um ? cell('', k.valor) : cell('Mês', k.mes) + cell('Ano', k.ano)}</div>${pctv}${nota(k)}${k.restrito ? '<div class="r">Visível só para sócios</div>' : ''}</div>`;
  }
  function celHtml(k) {
    if (!k) return '<td></td>';
    if (!vis(k)) return '<td><div class="cel"><b class="sem">—</b><div class="r">Só sócios</div></div></td>';
    const v = (x) => { const t = String(x ?? '—'); return `<b class="${t === '—' ? 'sem' : ''}">${esc(t)}</b>`; };
    const corpo = (k.mes !== undefined || k.ano !== undefined)
      ? `<div class="ma"><div><span>Mês</span>${v(k.mes)}</div><div><span>Ano</span>${v(k.ano)}</div></div>`
      : `<div class="ma"><div><span>&nbsp;</span>${v(k.valor)}</div></div>`;
    return `<td><div class="cel">${corpo}${nota(k)}${k.restrito ? '<div class="r">Visível só para sócios</div>' : ''}</div></td>`;
  }
  function gradeHtml(b) {
    const cols = b.colunas || [];
    return `<div class="tabela-rolagem"><table class="grade"><thead><tr><th></th>${cols.map((c) => `<th title="${esc(c)}">${esc(curto(c))}</th>`).join('')}</tr></thead><tbody>${b.linhas.map((l) => `<tr><td class="rot">${esc(l.nome)}</td>${cols.map((c, i) => celHtml((l.itens || [])[i])).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function crescHtml(k) {
    if (!vis(k)) return '';
    const cls = k.sentido === 'up' ? 'up' : k.sentido === 'down' ? 'down' : 'eq';
    return `<div class="ind cresc"><div class="t" title="${esc(k.label)}">${esc(curto(k.label))}</div><div class="d ${cls}">${esc(k.delta || '—')}</div><div class="cmp">${esc(k.comparacao || '')}</div>${nota(k)}${k.restrito ? '<div class="r">Visível só para sócios</div>' : ''}</div>`;
  }

  function telaGeral() {
    const g = CFG.geral;
    const todos = g.blocos && g.blocos.length ? g.blocos : [{ titulo: 'Indicadores', itens: g.kpis || [] }];
    const blocos = todos.filter((b) => !opc.veBloco || opc.veBloco(b.titulo));
    const frase = resumida || opc.semFrase ? '' : socio ?(g.fraseSocio || g.resumoSocio) : (g.fraseFunc || g.resumoFunc);
    const dest = resumida ? [] : (g.destaques || g.alertas || []).filter(vis).slice(0, 3);
    return `<div>${frase ? `<p class="frase">${esc(frase)}</p>` : ''}
${blocos.map((b) => {
    if (b.restrito && !socio) return '';
    const head = `<div class="painel-h"><h2>${esc(b.titulo)}</h2>${b.nota && !resumida ? `<p>${esc(b.nota)}</p>` : ''}</div>`;
    if (b.linhas) return `<section class="painel">${head}${gradeHtml(b)}</section>`;
    const it = (b.itens || []).filter(vis).filter((k) => !opc.itemOculto || !opc.itemOculto(k.label));
    if (!it.length) return '';
    const corpo = b.tipo === 'crescimento' ? it.map(crescHtml).join('') : it.map(indHtml).join('');
    return `<section class="painel">${head}<div class="cols n${it.length}" style="--n:${it.length}">${corpo}</div></section>`;
  }).join('')}
<div class="areas">${CFG.areas.filter(areaVisivel).map((a) => `<a href="#/${esc(a.id)}">${pt(a.status)}<span>${esc(a.nome)}</span>${CHEV}</a>`).join('')}</div>
${dest.length ? `<div class="destaques">${dest.map((a) => `<div class="dest"><span class="niv ${a.nivel}">${LBL[a.nivel]}</span><span>${esc(a.texto)}</span></div>`).join('')}</div>` : ''}
</div>`;
  }

  // ------------------------------------------------------------ planejamento por obra
  const MK = (v) => (v === true ? '<span class="mk y" aria-label="Atualizado">✓</span>' : v === false ? '<span class="mk n" aria-label="Não atualizado">✕</span>' : '<span class="mk q" aria-label="Sem informação">–</span>');
  function plano() {
    const p = CFG.areas.find((a) => a.id === 'planejamento') || {};
    const base = Array.isArray(p.porObra) && p.porObra.length ? p
      : { semanas: p.semanas, porObra: (CFG.obras || []).filter((o) => /^Mo/i.test(o)).map((o) => ({ obra: o, cronograma: { ok: null, info: 'Aguardando agente' }, programacao: { ok: null, info: 'Aguardando agente' } })) };
    return opc.obras ? { ...base, porObra: base.porObra.filter((o) => opc.obras.includes(o.obra)) } : base;
  }
  function tabelaObras() {
    const p = plano();
    return `<section class="secao" style="margin-top:0"><h2>Cronograma e programação por obra</h2>
<table class="tab" style="margin-top:18px"><thead><tr><th>Obra</th><th>Cronograma</th><th>Programação semanal</th><th></th></tr></thead><tbody>
${p.porObra.map((o) => `<tr class="lnk" data-href="#/planejamento/obra/${encodeURIComponent(o.obra)}" tabindex="0"><td class="cod">${esc(o.obra)}</td><td>${MK(o.cronograma && o.cronograma.ok)}<span class="muted">${esc((o.cronograma && o.cronograma.info) || '')}</span></td><td>${MK(o.programacao && o.programacao.ok)}<span class="muted">${esc((o.programacao && o.programacao.info) || '')}</span></td><td class="ver"><span>Ver semana${CHEV}</span></td></tr>`).join('')}
</tbody></table>${p.semanas ? `<p class="pequeno" style="margin-top:12px">Semana atual de ${esc(p.semanas.atual)}, próxima de ${esc(p.semanas.proxima)}.</p>` : ''}</section>`;
  }
  const lista = (xs) => (xs && xs.length ? `<ul class="it">${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<div class="vazio">Nada previsto.</div>');
  function telaObra(nome) {
    const p = plano();
    const o = p.porObra.find((x) => x.obra === nome);
    if (!o) return '<div class="vazio">Obra não encontrada.</div>';
    const cr = o.cronograma || {};
    const pg = o.programacao || {};
    return `<div><a class="voltar" href="#/operacao/programacao"><span style="display:inline-flex;transform:rotate(180deg)">${CHEV}</span>Voltar</a>
<section><div style="display:flex;align-items:center;margin-bottom:6px">${MK(cr.ok)}<h2>Cronograma</h2></div><p class="pequeno" style="margin:0 0 18px 34px">${esc(cr.info || '')}</p>${cr.obs ? `<p class="aviso">${esc(cr.obs)}</p>` : ''}
<div class="duas"><div><h3>Esta semana${p.semanas ? `, ${esc(p.semanas.atual)}` : ''}</h3>${lista(cr.estaSemana)}</div><div><h3>Próxima semana${p.semanas ? `, ${esc(p.semanas.proxima)}` : ''}</h3>${lista(cr.proximaSemana)}</div></div></section>
<section class="secao"><div style="display:flex;align-items:center;margin-bottom:6px">${MK(pg.ok)}<h2>Programação semanal</h2></div><p class="pequeno" style="margin:0 0 18px 34px">${esc(pg.info || '')}</p>${pg.obs ? `<p class="aviso">${esc(pg.obs)}</p>` : ''}
${pg.dias && pg.dias.length ? `<div class="dias">${pg.dias.map((d) => `<div><b>${esc(d.dia)}</b>${lista(d.itens)}</div>`).join('')}</div>` : ''}</section></div>`;
  }

  // ------------------------------------------------------------ setor
  // `extraTopo`: conteúdo a mais no começo da página do setor (o pós-obra usa para as abas da planilha integrada)
  // o: { semEstado, semAlertas, depoisIndicadores } — a Operação usa para mostrar indicadores, alertas das metas,
  // o quadro das obras e o Por obra, sem o estado/resumo e sem os alertas do agente (pedido do Felipe, 15/10)
  function telaArea(a, extraTopo = '', o = {}) {
    // funções de obra: no Planejamento só o quadro das suas obras (o resto do setor fala de todas)
    // indicadores que o Felipe tirou do painel (ex.: transporte: veículos e locações)
    const ks = a.kpis.filter(vis).filter((k) => !opc.kpiOculto || !opc.kpiOculto(a.id, k.label));
    const oc = a.kpis.length - ks.length;
    const al = a.alertas.filter(vis);
    const F = CFG.funcionarios || [];
    // Felipe: todas as funções veem onde está cada funcionário (no Solida.exe era só sócio)
    const rh = a.id === 'rh' ?`<a class="acesso" href="#/funcionarios"><div><h3>Funcionários por obra</h3><div class="pequeno" style="margin-top:6px">${F.length ? `${F.filter((p) => p.situacao === 'presente').length} em obra hoje (pelo efetivo dos grupos), ${F.filter((p) => p.situacao === 'sem_local').length} sem local hoje` : 'A lista aparece depois da primeira leitura do RH.'}</div></div><span class="btn-ir">Abrir lista${CHEV}</span></a>` : '';
    // data da última leitura da fonte principal da área (no RH: o efetivo do WhatsApp). Se não for de hoje, avisa em vermelho.
    const leitura = (() => {
      if (a.id === 'rh') return '';   // o RH tem a própria faixa, do efetivo lido automaticamente dos grupos
      const fs = (a.fontes || []).filter((f) => a.id !== 'rh' || /whatsapp/i.test(f.nome));
      const datas = fs.map((f) => String(f.ultima || '').match(/(\d{2})\/(\d{2})(?:[,\s]+(\d{2}:\d{2}))?/)).filter(Boolean)
        .map((m) => ({ txt: m[0], dia: Number(m[1]), mes: Number(m[2]) }));
      if (!datas.length) return '';
      const mais = datas.sort((x, y) => (y.mes * 100 + y.dia) - (x.mes * 100 + x.dia))[0];
      const hj = new Date();
      const hoje = mais.dia === hj.getDate() && mais.mes === hj.getMonth() + 1;
      const dias = Math.round((new Date(hj.getFullYear(), hj.getMonth(), hj.getDate()) - new Date(hj.getFullYear(), mais.mes - 1, mais.dia)) / 86400000);
      const rotulo = a.id === 'rh' ? 'Última leitura do efetivo' : 'Última leitura dos dados';
      return `<p class="leitura ${hoje ? 'leitura-ok' : 'leitura-velha'}"><b>${rotulo}:</b> ${esc(mais.txt)}${hoje ? ' (de hoje)' : ` · ${dias} ${dias === 1 ? 'dia' : 'dias'} atrás: os números abaixo NÃO são de hoje`}</p>`;
    })();
    return `<div>${extraTopo}
${leitura}
${o.semEstado ? '' : `<div class="estado">${pt(a.status)}<span>${LBL[a.status] || ''}</span></div><p class="resumo">${esc(a.resumo)}</p>`}
${rh ? `<div class="secao" style="margin-top:34px">${rh}</div>` : ''}
<section class="secao"><h2>Indicadores</h2><div class="kgrid">${ks.map(met).join('')}</div>${oc ? `<p class="pequeno" style="margin-top:12px">${oc} ${oc > 1 ? 'indicadores visíveis' : 'indicador visível'} só para sócios.</p>` : ''}</section>
${o.depoisIndicadores || ''}
${o.semAlertas ? '' : `<section class="secao"><h2>Alertas</h2><div class="linhas">${al.length ? al.map((x) => `<div><span class="niv ${x.nivel}">${LBL[x.nivel]}</span><span>${esc(x.texto)}</span></div>`).join('') : '<div><span></span><span class="muted">Nenhum alerta no momento.</span></div>'}</div></section>`}
${(a.processos || []).length ? `<details class="caixa"><summary><span class="caixa-tit">Processos do POP acompanhados</span><span class="contador contador-neutro">${a.processos.length}</span><span class="pequeno">clique para ver</span></summary><div class="caixa-corpo"><table class="tab" style="margin-top:6px"><tbody>${a.processos.map((p) => `<tr><td class="cod" style="width:90px">${esc(p.cod)}</td><td>${esc(p.nome)}${p.status && p.status !== 'Ativo' ? ` <span class="pequeno">(${esc(String(p.status).toLowerCase())} no POP)</span>` : ''}</td><td class="muted" style="text-align:right">${esc(p.resp || '')}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
<details class="caixa"><summary><span class="caixa-tit">De onde vêm os dados</span><span class="pequeno">clique para ver</span></summary><div class="caixa-corpo"><div class="fontes" style="margin-top:6px">${(a.fontes || []).map((f) => `<div><b>${esc(f.nome)}</b><span>${esc(f.via)}</span><span>Lido em ${esc(f.ultima)}</span></div>`).join('')}</div></div></details></div>`;
  }

  // ------------------------------------------------------------ funcionários por obra
  function listaPessoas(st) {
    const q = (st.busca || '').toLowerCase();
    const fs = (CFG.funcionarios || []).filter((p) => (st.filtro === 'todos' || p.situacao === st.filtro) && (st.obra === 'todas' || p.obra === st.obra) && (!q || `${p.nome} ${p.funcao}`.toLowerCase().includes(q)));
    if (!fs.length) return '<p class="vazio">Ninguém encontrado com esses filtros.</p>';
    const locais = [...(CFG.obras || []), ...fs.map((p) => p.obra || '')];   // quem não tem local hoje aparece no fim, em "Sem local informado hoje"
    return [...new Set(locais)].filter((o) => fs.some((p) => (p.obra || '') === o)).map((o) => {
      const ps = fs.filter((p) => (p.obra || '') === o);
      return `<div class="grupo"><div class="grupo-h"><h3>${esc(o || 'Sem local informado hoje')}</h3><span class="pequeno">${ps.length} ${ps.length > 1 ? 'pessoas' : 'pessoa'}</span></div>${ps.map((p) => `<div class="pes"><span>${esc(p.nome)}</span><span class="muted">${esc(p.funcao)}</span><span class="sit ${esc(p.situacao)}">${SIT[p.situacao] || esc(p.situacao || '')}</span><span class="pequeno">${esc(p.fonte)}</span></div>`).join('')}</div>`;
    }).join('');
  }
  function telaPessoas(st) {
    const F = CFG.funcionarios || [];
    const n = (k) => F.filter((p) => k === 'todos' || p.situacao === k).length;
    return `<div><a class="voltar" href="#/rh"><span style="display:inline-flex;transform:rotate(180deg)">${CHEV}</span>Voltar ao RH</a>
<div class="filtros-pilula" role="group" aria-label="Situação">${['todos', 'presente', 'sem_local', 'ferias', 'afastado'].map((k) => `<button data-filtro="${k}" class="${st.filtro === k ? 'on' : ''}" aria-pressed="${st.filtro === k}">${k === 'todos' ? 'Todos' : SIT[k]} (${n(k)})</button>`).join('')}</div>
<div class="busca"><div class="campo"><label for="busca">Buscar</label><input id="busca" value="${esc(st.busca)}" placeholder="Nome ou função"></div><div class="campo"><label for="fobra">Local</label><select id="fobra"><option value="todas">Todos os locais</option>${(CFG.obras || []).map((o) => `<option${st.obra === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></div></div>
<div id="lista">${listaPessoas(st)}</div></div>`;
  }

  // ------------------------------------------------------------ agentes
  function telaAgentes() {
    const rows = [{ nome: 'Diretor', fontes: [{ nome: 'Resultado dos 8 setores' }], frequencia: 'Depois de cada rodada', instrucoes: CFG.geral.instrucoes }, ...CFG.areas];
    return `<div><p class="aviso">O que cada agente confere, com base no POP, e de onde lê. Os agentes apenas leem os sistemas: não lançam, não aprovam e não enviam mensagens.</p><div class="linhas">${rows.map((g) => `<div style="grid-template-columns:220px 1fr"><span style="font-size:18px;font-weight:700">${esc(g.nome)}</span><span>${esc(g.instrucoes || '')}<span class="pequeno" style="display:block;margin-top:6px">${esc((g.fontes || []).map((f) => f.nome).join(', '))}${g.frequencia ? `. ${esc(g.frequencia)}.` : ''}</span></span></div>`).join('')}</div></div>`;
  }

  return { telaGeral, telaArea, telaObra, telaPessoas, listaPessoas, telaAgentes };
}
