// Projetos (setor separado do Planejamento): Resumo (agente + verificação) · Por obra · As-built. Só consulta.
// Fonte: pasta PROJETO de cada obra no Drive (OPERACOES\OBRAS\<obra>\PROJETO), a listagem de projetos
// da obra (quando existe) e o cronograma (GERENCIAMENTO\CRONOGRAMA), lidos por scripts/exportar-drive.ps1.
// Data de recebimento = coluna RECEBIDO da listagem; sem listagem, a data do arquivo na pasta.

import { html, data as fmtData } from '../formato.js';
import { hojeISO, somarDias, inicioDaSemana, diasEntre } from '../datas.js';

export const ABAS_PROJETOS = [
  { id: '', nome: 'Resumo' },
  { id: 'obras', nome: 'Por obra' },
  { id: 'asbuilt', nome: 'As-built' },
];

const MK = {
  ok: html.seguro('<span class="mk y" aria-label="Sim">✓</span>'),
  nao: html.seguro('<span class="mk n" aria-label="Não">✕</span>'),
  q: html.seguro('<span class="mk q" aria-label="Sem informação">–</span>'),
};
// dd/mm no ano corrente; dd/mm/aa nos outros
const dm = (iso) => (!iso ? '' : iso.slice(0, 4) === hojeISO().slice(0, 4) ? fmtData(iso).slice(0, 5) : `${fmtData(iso).slice(0, 6)}${iso.slice(2, 4)}`);
const SEM_DEMOLICAO = /demol|retir|desmont|ensacar|entulho|^DEM\b/i;
// linhas do cronograma que não são o serviço em si (o próprio projeto, contratação, medição)
const NAO_E_SERVICO = /^projeto\b|contrata[çc]|or[çc]amento|aprova[çc]|medi[çc][ãa]o|levantamento/i;

// Projetos que a Sólida considera imprescindíveis para tocar a obra.
// arquivo: como o projeto aparece na pasta/listagem; atividade: o serviço do cronograma que depende dele.
export const IMPRESCINDIVEIS = [
  { id: 'paginacao', nome: 'Paginação de piso', arquivo: /pagina[çc]|revestiment|\bpisos?\b/i,
    atividade: /porcelanato|cer[âa]mica|\bpisos?\b|pedra|m[áa]rmore|granito|assoalho|vin[íi]lico|soleira/i, fora: /contrapiso|imperm|enchimento|regulariza|esquadria|parede/i },
  { id: 'eletrica', nome: 'Elétrica', arquivo: /el[ée]tric|pontos de instala|\bELE\b|\bINST\b/i,
    atividade: /el[ée]tric|condu[íi]te|caixinha|fia[çc]|tomada|quadro de|infra.*(el[ée]|dados)/i },
  { id: 'hidraulica', nome: 'Hidráulica', arquivo: /hidr[áa]ul|hidross|esgoto|\bHID/i,
    atividade: /hidr|esgoto|tubula|[áa]gua (fria|quente)|ralo|registro/i },
  { id: 'forro', nome: 'Forro', arquivo: /forro|teto|gesso/i,
    atividade: /forro|gesso|teto|sanca|cortineiro|tabica/i, fora: /lixar|massa|pintura|selar/i },
  { id: 'acabamentos', nome: 'Acabamentos', arquivo: /acabament|memorial|especifica[çc]|lou[çc]as e metais|revestiment/i,
    atividade: /revest|cer[âa]mica|porcelanato|pintura|rodap|lou[çc]a|metais|bancada/i, fora: /massa|lixar|selar/i },
  { id: 'iluminacao', nome: 'Iluminação', arquivo: /ilumina|lumino|\bLUM\b/i,
    atividade: /lumin|ilumina|spot|perfil de led|\bled\b|pendente/i },
];
const ANTECEDENCIA = 14;   // o projeto precisa chegar pelo menos 2 semanas antes do serviço começar

// Obras ativas (as do Planejamento, sem as concluídas) com o que foi lido da pasta delas
export function obrasComProjeto(CFG, proj, visiveis) {
  const plan = (CFG.areas.find((a) => a.id === 'planejamento') || {}).porObra || [];
  const ativas = plan.filter((o) => !/conclu[ií]da|100% executada/i.test(`${(o.cronograma || {}).info || ''} ${(o.cronograma || {}).obs || ''}`))
    .map((o) => o.obra).filter((o) => !visiveis || visiveis.includes(o));
  const lidas = (proj && proj.obras) || [];
  return ativas.map((obra) => lidas.find((p) => p.obra.toLowerCase() === obra.toLowerCase()) || { obra, semPasta: true });
}

// Siglas da listagem de projetos (aba PROJETO ESPECIALIDADE ABREV) → nome da pasta
const SIGLAS = {
  ARQ: 'ARQUITETURA', ELE: 'ELETRICA', INST: 'INSTALAÇÕES', HID: 'HIDRÁULICA', HIDESG: 'HIDRÁULICA', AUT: 'AUTOMAÇÃO',
  EST: 'ESTRUTURA', AC: 'AR CONDICIONADO', PAIS: 'PAISAGISMO', IMP: 'IMPERMEABILIZAÇÃO', INC: 'INCÊNDIO', GAS: 'GÁS',
  LUM: 'ILUMINAÇÃO', CROQUI: 'CROQUIS', SOLOS: 'SONDAGEM', MARC: 'MARCENARIA',
};
const chaveDisciplina = (d) => {
  const s = String(d || '').trim().toUpperCase().replace(/[\s-]+$/, '');
  return SIGLAS[s] || s;
};

// Tudo o que chegou de projeto para a obra: linhas da listagem + arquivos da pasta
// (a própria listagem e a capa do caderno não são projeto recebido)
function documentos(p) {
  const docs = [];
  for (const i of ((p.listagem && p.listagem.itens) || [])) {
    docs.push({ texto: `${i.especialidade} ${i.prancha} ${i.arquivo || ''}`, data: i.recebido || i.data, rev: i.rev, disciplina: chaveDisciplina(i.especialidade), fonte: 'listagem', nome: i.prancha });
  }
  for (const a of (p.arquivos || [])) {
    if (/listagem projetos|capa caderno|controle de projetos/i.test(a.nome)) continue;
    docs.push({ texto: `${a.disciplina} ${a.nome}`, data: a.data, rev: a.rev, disciplina: a.disciplina ? chaveDisciplina(a.disciplina) : 'GERAL', fonte: 'pasta', nome: a.nome, antigo: a.antigo });
  }
  return docs;
}

// Quando o cronograma começa o serviço que depende do projeto
function inicioNoCronograma(p, item) {
  // casa pelo nome da atividade; o grupo só conta quando é sigla (ELE, HID…), não "T01 - LOUÇAS E METAIS - BASES E REGISTROS"
  const texto = (a) => (/^[A-Z]{2,4}$/.test(a.grupo || '') ? `${a.grupo} ${a.nome}` : a.nome);
  const ativ = ((p.cronograma && p.cronograma.atividades) || [])
    .filter((a) => a.inicio && !SEM_DEMOLICAO.test(`${a.grupo} ${a.nome}`) && !NAO_E_SERVICO.test(a.nome)
      && item.atividade.test(texto(a)) && !(item.fora && item.fora.test(a.nome)));
  if (!ativ.length) return null;
  const primeira = ativ.reduce((m, a) => (a.inicio < m.inicio ? a : m));
  return { data: primeira.inicio, atividade: primeira.nome.replace(/\s*\(.*\)\s*$/, '') };
}

export function situacaoImprescindivel(p, item, hoje = hojeISO()) {
  const docs = documentos(p).filter((d) => item.arquivo.test(d.texto) && d.data);
  const recebido = docs.length ? docs.reduce((m, d) => (d.data < m ? d.data : m), docs[0].data) : null;
  const revs = docs.map((d) => d.rev).filter((r) => r != null);
  const rev = revs.length ? Math.max(...revs) : null;
  const crono = inicioNoCronograma(p, item);
  const exemplo = docs.length ? docs.reduce((m, d) => (d.data > m.data ? d : m)) : null;
  let nivel; let texto;
  if (recebido) {
    if (!crono) { nivel = 'ok'; texto = `Recebido ${dm(recebido)}`; }
    else {
      const folga = diasEntre(recebido, crono.data);
      if (folga < 0) { nivel = 'tardio'; texto = `Chegou ${-folga} dias depois de: ${crono.atividade} (${dm(crono.data)})`; }
      else if (folga < ANTECEDENCIA) { nivel = 'justo'; texto = `Chegou só ${folga} dias antes de: ${crono.atividade} (${dm(crono.data)})`; }
      else { nivel = 'ok'; texto = `Chegou ${folga} dias antes de: ${crono.atividade} (${dm(crono.data)})`; }
    }
  } else if (crono) {
    const faltam = diasEntre(hoje, crono.data);
    if (faltam < 0) { nivel = 'falta-atrasado'; texto = `Falta, e ${crono.atividade} já devia ter começado em ${dm(crono.data)}`; }
    else if (faltam <= ANTECEDENCIA + 7) { nivel = 'falta-urgente'; texto = `Falta. ${crono.atividade} começa em ${dm(crono.data)} (${faltam} dias)`; }
    else { nivel = 'falta'; texto = `Falta. Precisa até ${dm(somarDias(crono.data, -ANTECEDENCIA))}`; }
  } else { nivel = 'falta'; texto = p.cronograma && !p.cronograma.erro ? 'Falta (serviço não está no cronograma)' : 'Falta'; }
  return { nivel, texto, recebido, rev, crono, docs: docs.length, exemplo };
}

const CLASSE = {
  ok: 'qs-ok', justo: 'qs-sem', tardio: 'qs-abaixo',
  'falta-atrasado': 'qs-abaixo', 'falta-urgente': 'qs-abaixo', falta: 'qs-futuro',
};

// Revisões por obra: maior revisão de cada disciplina + quantas entregas (datas diferentes) chegaram
export function revisoesDaObra(p) {
  const docs = documentos(p);
  const porDisc = new Map();
  for (const d of docs) {
    // ELETRICA e ELÉTRICA, AUTOMAÇAO e AUTOMAÇÃO: mesma disciplina
    const k = String(d.disciplina || 'GERAL').normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!porDisc.has(k)) porDisc.set(k, { disciplina: k, rev: null, datas: new Set(), arquivos: 0, primeira: null, ultima: null });
    const g = porDisc.get(k);
    if (d.rev != null) g.rev = Math.max(g.rev ?? 0, d.rev);
    if (d.data) {
      g.datas.add(d.data);
      if (!g.primeira || d.data < g.primeira) g.primeira = d.data;
      if (!g.ultima || d.data > g.ultima) g.ultima = d.data;
    }
    g.arquivos++;
  }
  const disciplinas = [...porDisc.values()].sort((a, b) => (b.rev ?? -1) - (a.rev ?? -1));
  const inicioObra = p.cronograma && p.cronograma.inicioObra;
  const datas = [...new Set(docs.map((d) => d.data).filter(Boolean))].sort();
  return {
    disciplinas,
    totalRev: disciplinas.reduce((s, d) => s + (d.rev || 0), 0),
    entregas: datas.length,
    depoisDoInicio: inicioObra ? datas.filter((d) => d > inicioObra).length : null,
    ultimaEntrega: datas[datas.length - 1] || null,
    inicioObra,
  };
}

// ---------------------------------------------------------------- aba Projetos

export function abaProjetos(CFG, proj, visiveis) {
  if (!proj) return semDados();
  const obras = obrasComProjeto(CFG, proj, visiveis);
  const hoje = hojeISO();
  const linhas = obras.map((p) => ({ p, sits: p.semPasta ? null : IMPRESCINDIVEIS.map((i) => situacaoImprescindivel(p, i, hoje)), rv: p.semPasta ? null : revisoesDaObra(p) }));

  // alerta: projeto imprescindível faltando com o serviço chegando, ou que chegou depois do serviço
  const urgentes = linhas.flatMap(({ p, sits }) => (sits || []).map((s, i) => ({ obra: p.obra, item: IMPRESCINDIVEIS[i].nome, s }))
    .filter((x) => ['falta-atrasado', 'falta-urgente'].includes(x.s.nivel)));

  const celula = (s) => html`<td class="qs-cel ${CLASSE[s.nivel]}" title="${s.exemplo ? `Último: ${s.exemplo.nome} (${dm(s.exemplo.data)})` : ''}">
    <b>${s.recebido ? `✓ ${dm(s.recebido)}${s.rev != null ? ` · R${String(s.rev).padStart(2, '0')}` : ''}` : '✕ falta'}</b><em>${/^Recebido /.test(s.texto) ? '' : s.texto}</em></td>`;

  const quadro = html`<article class="cartao cartao-largo">
    <header class="cartao-cab"><h3>Projetos imprescindíveis por obra</h3><span class="pequeno">recebido × quando o cronograma começa o serviço</span></header>
    <div class="tabela-rolagem"><table class="quadro-semana">
      <thead><tr><th>Obra</th>${IMPRESCINDIVEIS.map((i) => html`<th>${i.nome}</th>`)}</tr></thead>
      <tbody>${linhas.map(({ p, sits }) => html`<tr>
        <td class="qs-item"><b>${p.obra}</b>${p.semPasta ? html`<span class="pequeno">pasta da obra não encontrada</span>` : html`<span class="pequeno">${p.listagem && !p.listagem.erro ? 'com listagem de projetos' : 'sem listagem: datas da pasta'}${p.cronograma && !p.cronograma.erro ? '' : ' · sem cronograma semanal'}</span>`}</td>
        ${sits ? sits.map(celula) : IMPRESCINDIVEIS.map(() => html`<td class="qs-cel qs-sem"><span>—</span></td>`)}</tr>`)}</tbody>
    </table></div>
    <p class="legenda-semana"><span class="lg lg-ok"></span> chegou com ${ANTECEDENCIA} dias ou mais de antecedência <span class="lg lg-sem"></span> chegou em cima <span class="lg lg-abaixo"></span> chegou depois do serviço / falta com o serviço chegando <span class="lg lg-futuro"></span> falta, ainda há prazo</p>
  </article>`;

  const ranking = linhas.filter((l) => l.rv).sort((a, b) => b.rv.totalRev - a.rv.totalRev || b.rv.entregas - a.rv.entregas);
  const maxRev = Math.max(1, ...ranking.map((l) => l.rv.totalRev));
  const tabRevisoes = html`<section class="secao">
    <div class="painel-h" style="margin-bottom:14px"><h2>Obras com mais revisão de projeto</h2>
      <p>Soma da última revisão de cada disciplina. "Com a obra andando" = entregas que chegaram depois da 1ª semana do cronograma: projeto tardio que pode atrasar a obra.</p></div>
    <div class="tabela-rolagem"><table class="tab">
      <thead><tr><th>Obra</th><th>Revisões</th><th>Disciplinas mais revisadas</th><th>Entregas</th><th>Com a obra andando</th><th>Última entrega</th></tr></thead>
      <tbody>${ranking.map(({ p, rv }) => html`<tr class="lnk" data-href="#/projetos/obras?obra=${encodeURIComponent(p.obra)}" tabindex="0">
        <td class="cod">${p.obra}</td>
        <td style="min-width:150px"><b>${rv.totalRev}</b><div class="pct"><i style="width:${Math.round((rv.totalRev / maxRev) * 100)}%"></i></div></td>
        <td class="pequeno">${rv.disciplinas.filter((d) => d.rev).slice(0, 4).map((d) => `${cap(d.disciplina)} R${String(d.rev).padStart(2, '0')}`).join(' · ') || '—'}</td>
        <td>${rv.entregas}</td>
        <td>${rv.depoisDoInicio == null ? html`<span class="muted">sem cronograma</span>` : rv.depoisDoInicio ? html`<b class="pendente">${rv.depoisDoInicio}</b> <span class="pequeno">desde ${dm(rv.inicioObra)}</span>` : '0'}</td>
        <td>${rv.ultimaEntrega ? fmtData(rv.ultimaEntrega) : '—'}</td></tr>`)}</tbody>
    </table></div></section>`;

  const detalhes = linhas.filter((l) => l.rv).map(({ p, rv }) => html`<details class="caixa" id="proj-${p.obra}"><summary><span class="caixa-tit">${p.obra}: disciplinas recebidas (${rv.disciplinas.length})</span><span class="pequeno">clique para ver</span></summary>
    <div class="tabela-rolagem" style="margin:0 22px 18px"><table class="tab">
      <thead><tr><th>Disciplina</th><th>Arquivos</th><th>Última revisão</th><th>Primeira entrega</th><th>Última entrega</th><th>Entregas</th></tr></thead>
      <tbody>${rv.disciplinas.map((d) => html`<tr><td>${cap(d.disciplina)}</td><td>${d.arquivos}</td><td>${d.rev != null ? `R${String(d.rev).padStart(2, '0')}` : html`<span class="muted">—</span>`}</td>
        <td>${d.primeira ? fmtData(d.primeira) : ''}</td><td>${d.ultima ? fmtData(d.ultima) : ''}</td><td>${d.datas.size}</td></tr>`)}</tbody>
    </table>
    <p class="pequeno">${p.listagem && !p.listagem.erro ? `Listagem: ${p.listagem.arquivo}. ` : 'Obra sem listagem de projetos preenchida: datas = data do arquivo na pasta. '}${p.cronograma && !p.cronograma.erro ? `Cronograma: ${p.cronograma.arquivo}.` : ''}</p></div></details>`);

  return html`<div>
    ${urgentes.length ? html`<div class="alerta-semana alerta-topo"><b>Projeto faltando com o serviço chegando</b>
      <ul>${urgentes.map((u) => html`<li><b>${u.obra}</b>: ${u.item}. ${u.s.texto}</li>`)}</ul></div>` : ''}
    ${quadro}${tabRevisoes}${detalhes}
    <p class="pequeno" style="margin-top:18px">Pasta OPERACOES\\OBRAS\\&lt;obra&gt;\\PROJETO no Drive. Os arquivos-modelo (copiados da pasta Moxxx) não contam como recebidos. Revisão = número Rnn no nome do arquivo ou na listagem.</p>
  </div>`;
}

// ---------------------------------------------------------------- Resumo (topo da aba Resumo)

// O que precisa de ação: projeto imprescindível faltando, projeto que chegou tarde e as-built parado
export function resumoProjetos(CFG, proj, visiveis) {
  if (!proj) return '';
  const hoje = hojeISO();
  const obras = obrasComProjeto(CFG, proj, visiveis).filter((p) => !p.semPasta);
  const sits = obras.flatMap((p) => IMPRESCINDIVEIS.map((i) => ({ obra: p.obra, item: i.nome, s: situacaoImprescindivel(p, i, hoje) })));
  const faltando = sits.filter((x) => /^falta/.test(x.s.nivel));
  const urgentes = faltando.filter((x) => x.s.nivel !== 'falta');
  const tardios = sits.filter((x) => x.s.nivel === 'tardio');
  const asbuiltParado = obras.filter((p) => {
    const ds = (p.asbuilt || []).map((a) => a.data).filter(Boolean).sort();
    return !ds.length || diasEntre(ds[ds.length - 1], hoje) > 7;
  });
  return String(html`<div class="cards" style="margin-top:22px">
    <a class="card" href="#/projetos/obras"><div class="card-valor">${faltando.length}</div><div class="card-rotulo">Projetos imprescindíveis faltando</div>
      <div class="card-sub">${urgentes.length ? `${urgentes.length} com o serviço já começando` : 'nenhum com o serviço começando'} · ${obras.length} obras verificadas</div></a>
    <a class="card" href="#/projetos/obras"><div class="card-valor">${tardios.length}</div><div class="card-rotulo">Chegaram depois do serviço</div>
      <div class="card-sub">${tardios.map((x) => `${x.obra} ${x.item.toLowerCase()}`).join(' · ') || 'nenhum'}</div></a>
    <a class="card" href="#/projetos/asbuilt"><div class="card-valor">${asbuiltParado.length}</div><div class="card-rotulo">As-built sem revisão há mais de 7 dias</div>
      <div class="card-sub">${asbuiltParado.map((p) => p.obra).join(' · ') || 'todos revisados na semana'}</div></a>
  </div>
  ${urgentes.length ? html`<div class="alerta-semana alerta-topo" style="margin-top:18px"><b>Projeto faltando com o serviço chegando</b>
    <ul>${urgentes.map((u) => html`<li><b>${u.obra}</b>: ${u.item}. ${u.s.texto}</li>`)}</ul></div>` : ''}`);
}

// Status do setor (bolinha do menu): crítico com projeto faltando e serviço começando; atenção com
// projeto faltando ou as-built parado há mais de 7 dias
export function statusProjetos(CFG, proj) {
  if (!proj) return null;
  const hoje = hojeISO();
  const obras = obrasComProjeto(CFG, proj, null).filter((p) => !p.semPasta);
  const niveis = obras.flatMap((p) => IMPRESCINDIVEIS.map((i) => situacaoImprescindivel(p, i, hoje).nivel));
  if (niveis.some((n) => n === 'falta-atrasado' || n === 'falta-urgente')) return 'critico';
  const parado = obras.some((p) => { const ds = (p.asbuilt || []).map((a) => a.data).filter(Boolean).sort(); return !ds.length || diasEntre(ds[ds.length - 1], hoje) > 7; });
  return niveis.some((n) => n === 'falta' || n === 'tardio') || parado ? 'atencao' : 'ok';
}

// ---------------------------------------------------------------- aba As-built

// Semana a semana: o .dwg do as-built (PROJETO\ASBUILT) foi salvo naquela semana?
export function abaAsbuilt(CFG, proj, visiveis, ref) {
  if (!proj) return semDados();
  const obras = obrasComProjeto(CFG, proj, visiveis);
  const hoje = hojeISO();
  const fimRef = inicioDaSemana(ref || hoje);
  const semanas = [-7, -6, -5, -4, -3, -2, -1, 0].map((i) => somarDias(fimRef, i * 7));
  const nav = html`<div class="periodo">
    <button type="button" class="botao" data-semana-md="${somarDias(fimRef, -7)}">← Semana anterior</button>
    <div class="atual"><span>8 semanas até</span><b>${dm(fimRef)} a ${dm(somarDias(fimRef, 6))}</b></div>
    ${fimRef !== inicioDaSemana(hoje) ? html`<button type="button" class="botao" data-semana-md="${hoje}">Esta semana</button>` : ''}
    <button type="button" class="botao" data-semana-md="${somarDias(fimRef, 7)}">Próxima semana →</button>
  </div>`;

  const situacao = (p) => {
    const dwg = (p.asbuilt || []).filter((a) => a.data);
    if (!dwg.length) return { dwg, ultimo: null };
    const ultimo = dwg.reduce((m, a) => (a.data > m.data || (a.data === m.data && (a.rev ?? -1) > (m.rev ?? -1)) ? a : m));
    return { dwg, ultimo };
  };
  const linhas = obras.map((p) => ({ p, ...situacao(p) }));
  const atrasadas = linhas.filter((l) => !l.p.semPasta && (!l.ultimo || diasEntre(l.ultimo.data, hoje) > 7));

  const cel = (l, ini) => {
    const fim = somarDias(ini, 6);
    if (ini > hoje) return html`<td class="qs-cel qs-futuro"><span>—</span></td>`;
    const daSemana = l.dwg.filter((a) => a.data >= ini && a.data <= fim);
    if (daSemana.length) {
      const revs = daSemana.map((a) => a.rev).filter((r) => r != null);
      return html`<td class="qs-cel qs-ok"><b class="qs-situacao">${revs.length ? `R${String(Math.max(...revs)).padStart(2, '0')}` : 'salvo'}</b><em>${dm(daSemana.reduce((m, a) => (a.data > m ? a.data : m), daSemana[0].data))}</em></td>`;
    }
    if (ini <= hoje && fim >= hoje) return html`<td class="qs-cel qs-sem"><span>até ${dm(fim)}</span></td>`;
    return html`<td class="qs-cel qs-abaixo"><b class="qs-situacao">sem revisão</b></td>`;
  };

  return html`<div>
    ${nav}
    ${atrasadas.length ? html`<div class="alerta-semana alerta-topo" style="margin-top:22px"><b>As-built sem revisão há mais de uma semana</b>
      <ul>${atrasadas.map((l) => html`<li><b>${l.p.obra}</b>: ${l.ultimo ? `última revisão ${l.ultimo.rev != null ? `R${String(l.ultimo.rev).padStart(2, '0')} ` : ''}em ${fmtData(l.ultimo.data)} (${diasEntre(l.ultimo.data, hoje)} dias)` : 'nenhum .dwg de as-built da obra na pasta (só o modelo)'}</li>`)}</ul></div>` : ''}
    <article class="cartao cartao-largo" style="margin-top:22px">
      <header class="cartao-cab"><h3>Revisão semanal do as-built</h3><span class="pequeno">.dwg salvo em PROJETO\\ASBUILT na semana (segunda a domingo)</span></header>
      <div class="tabela-rolagem"><table class="quadro-semana">
        <thead><tr><th>Obra</th>${semanas.map((s) => html`<th class="${s === inicioDaSemana(hoje) ? 'qs-hoje' : ''}">${dm(s)}</th>`)}<th>Última revisão</th></tr></thead>
        <tbody>${linhas.map((l) => html`<tr>
          <td class="qs-item"><b>${l.p.obra}</b>${l.p.semPasta ? html`<span class="pequeno">pasta da obra não encontrada</span>` : ''}</td>
          ${l.p.semPasta ? semanas.map(() => html`<td class="qs-cel qs-sem"><span>—</span></td>`) : semanas.map((s) => cel(l, s))}
          <td>${l.ultimo ? html`<b>${l.ultimo.rev != null ? `R${String(l.ultimo.rev).padStart(2, '0')}` : ''}</b> ${fmtData(l.ultimo.data)}<div class="pequeno">${l.ultimo.nome}</div>` : html`<span class="pendente">sem as-built</span>`}</td></tr>`)}</tbody>
      </table></div>
      <p class="legenda-semana"><span class="lg lg-ok"></span> revisado na semana <span class="lg lg-abaixo"></span> sem revisão <span class="lg lg-sem"></span> semana em andamento</p>
    </article>
    <p class="pequeno" style="margin-top:18px">Pasta OPERACOES\\OBRAS\\&lt;obra&gt;\\PROJETO\\ASBUILT no Drive. Conta a data em que o .dwg foi salvo. O arquivo-modelo (Moxxx/Mo420 MODELO) não conta.</p>
  </div>`;
}

const cap = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

function semDados() {
  return html`<div class="erro">Ainda não li as pastas de projeto no Drive. Confira se o Google Drive para computador está aberto (pasta G:) e recarregue em 1 minuto.</div>`;
}
