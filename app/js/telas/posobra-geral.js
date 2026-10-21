// Pós-obra mais dinâmico (pedido de 21/10): os pós-obras em andamento aparecem como cartões clicáveis (andamento de cada um,
// de forma simples), as pendências são as mesmas de "Atas e pendências" e a agenda da semana funciona como "Minhas funções":
// uma aba lateral com os cartões dos funcionários, que se arrastam para a obra e o dia.
import { html } from '../formato.js';
import { somarDias, inicioDaSemana } from '../datas.js';
import { PRIORIDADE_SITUACAO, SITUACOES_ABERTAS } from '../regras.js';
import { partesObra } from '../obras-pos.js';
import { reprogramado, tituloReprogramacao } from '../servicos-pos.js';
import { chipSituacao, chipPrazo, rotaObra, fmt } from '../componentes.js';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// em andamento = tem serviço aberto (situação de execução, atraso, planejamento, agendamento, orçamento, análise, fixo ou pausado), mais urgente primeiro
export function obrasEmAndamento(base) {
  const ordem = (o) => { const i = PRIORIDADE_SITUACAO.indexOf(o.situacao); return i < 0 ? 99 : i; };
  return base.obras.filter((o) => SITUACOES_ABERTAS.includes(o.situacao)).sort((a, b) => ordem(a) - ordem(b) || a.obra.localeCompare(b.obra, 'pt-BR'));
}

// ---------------------------------------------------------------- Pós-obras (lista com os serviços embaixo de cada obra)
const FASE_COR_L = { 'Análise': '#6E7782', 'Orçamento': '#B58A1B', 'Agendamento': '#3C7480', 'Planejamento': '#5B7A2E', 'Execução': '#2F5F86', 'Atrasado': '#9B3A33', 'Concluído': '#4F7D5C', 'Fixo': '#34507A', 'Pausado': '#6E7782', 'Cancelado': '#8A939D' };
const resumoServico = (t) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > 170 ? `${s.slice(0, 170).replace(/\s+\S*$/, '')}…` : s; };
const dBR = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? fmt.data(iso) : '');
const custoDe = (s) => (Number(s.custo_mo) || 0) + (Number(s.gastos) || 0) + (Number(s.materiais) || 0);
const rotaOs = (os) => `#/posobra/os/${encodeURIComponent(os)}`;
export const FASES_FILTRO = ['Análise', 'Orçamento', 'Agendamento', 'Planejamento', 'Execução', 'Atrasado', 'Concluído', 'Fixo', 'Pausado', 'Cancelado'];
const PRAZOS_FILTRO = ['Vencido', 'Vence em 7 dias', 'No prazo', 'Sem prazo'];

// prazo clicável (abre o mini calendário com feriados) + marca de reprogramado; só nos serviços em aberto e para quem edita
export function celulaPrazo(s, podeEditar) {
  const txt = dBR(s.prazo) || (s.prazo ? s.prazo : 'sem prazo');
  const bt = podeEditar && s.aberta ? html`<button type="button" class="at-data-btn pl-prazo-bt" data-os-prazo="${s.os}" title="Clique para reprogramar (escolher outra data)">${txt}</button>` : html`<span class="${dBR(s.prazo) ? '' : 'muted'}">${txt}</span>`;
  return html`<span class="pl-prazo">${bt}${s.aberta && s.statusPrazo && s.statusPrazo !== 'Sem prazo' ? chipPrazo(s.statusPrazo) : ''}${reprogramado(s) ? html`<span class="at-repro-tag" title="${tituloReprogramacao(s)}">↻ era ${dBR(s.prazo_original).slice(0, 5)}</span>` : ''}</span>`;
}
export function celulaFase(s, podeEditar) {
  return podeEditar ? html`<select class="pl-fase-sel" data-os-fase="${s.os}" style="background:${FASE_COR_L[s.situacao] || '#8A939D'}" title="Mudar a fase">${FASES_FILTRO.map((f) => html`<option ${f === s.situacao ? html.seguro('selected') : ''}>${f}</option>`)}${s.situacao && !FASES_FILTRO.includes(s.situacao) ? html`<option selected>${s.situacao}</option>` : ''}${!s.situacao ? html`<option selected value="">sem fase</option>` : ''}</select>`
    : html`<span class="pl-fase" style="background:${FASE_COR_L[s.situacao] || '#8A939D'}">${s.situacao || 'sem fase'}</span>`;
}

export function renderResumo(base, params, { podeEditar = false, veValores = false } = {}) {
  const faseF = params.get('fase') || ''; const prazoF = params.get('prazo') || ''; const q = (params.get('q') || '').toLocaleLowerCase('pt-BR');
  const filtrando = !!(faseF || prazoF || q);
  const passa = (s) => (!faseF || s.situacao === faseF) && (!prazoF || (s.aberta ? s.statusPrazo : 'Encerrado') === prazoF)
    && (!q || `${s.os} ${s.obra} ${s.relato} ${s.profissionais} ${partesObra(base.obraPorNome.get(s.obra) || { obra: s.obra }).titulo}`.toLocaleLowerCase('pt-BR').includes(q));
  const em = obrasEmAndamento(base);
  const encerradas = base.obras.filter((o) => !SITUACOES_ABERTAS.includes(o.situacao));
  const atrasadas = em.filter((o) => o.situacao === 'Atrasado').length;
  const abertas = em.reduce((t, o) => t + (o.abertas || 0), 0);
  const incompletas = em.filter((o) => partesObra(o).incompleta);
  const colunas = html`<colgroup><col class="c-os"><col class="c-serv"><col class="c-fase"><col class="c-ini"><col class="c-prazo"><col class="c-quem">${veValores ? html`<col class="c-custo">` : ''}</colgroup>`;
  const linhaOs = (s) => html`<tr>
    <td class="pl-os-cod"><a href="${rotaOs(s.os)}" title="Abrir a OS">${s.os}</a></td>
    <td class="pl-os-resumo"><a href="${rotaOs(s.os)}" title="Abrir a OS">${resumoServico(s.relato) || html`<span class="muted">sem descrição</span>`}</a></td>
    <td>${celulaFase(s, podeEditar)}</td>
    <td>${dBR(s.data_inicio) || html`<span class="muted">—</span>`}</td>
    <td>${celulaPrazo(s, podeEditar)}</td>
    <td class="pl-quem">${s.profissionais || html`<span class="muted">—</span>`}</td>
    ${veValores ? html`<td class="n">${custoDe(s) ? fmt.reais(custoDe(s)) : html`<span class="muted">—</span>`}</td>` : ''}</tr>`;
  const tabela = (lista) => html`<table class="pl-os">${colunas}<thead><tr><th>OS</th><th>Serviço</th><th>Fase</th><th>Início</th><th>Prazo</th><th>Quem</th>${veValores ? html`<th class="n">Custo</th>` : ''}</tr></thead><tbody>${lista.map(linhaOs)}</tbody></table>`;
  const bloco = (o, aberto = true) => {
    const pt = partesObra(o); const todos = (o.servicos || []).filter(passa);
    const abertasO = todos.filter((s) => s.aberta); const feitas = todos.filter((s) => !s.aberta);
    if (filtrando && !todos.length) return '';
    const nAbertas = (o.servicos || []).filter((s) => s.aberta).length;
    return html`<details class="pl-obra pl-${String(o.situacao || 'sem').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')}" ${aberto || filtrando ? html.seguro('open') : ''}>
      <summary><span class="pl-tit"><a href="${rotaObra(o.obra)}" title="Abrir o andamento desta obra">${pt.titulo}</a></span> ${chipSituacao(o.situacao)}
        <span class="pl-sub ${pt.sub ? '' : 'pl-falta'}">${pt.sub || 'cliente e endereço ainda não cadastrados'}</span>
        <span class="pl-cont">${nAbertas} ${nAbertas === 1 ? 'serviço aberto' : 'serviços abertos'}${o.proximoPrazo ? ` · próx. prazo ${fmt.data(o.proximoPrazo)}` : ''}</span>
        ${podeEditar ? html`<button type="button" class="ac-mini" data-po-editar="${o.obra}" title="Completar nome, cliente e endereço">${pt.incompleta ? 'completar dados' : 'editar dados'}</button>` : ''}</summary>
      ${abertasO.length ? tabela(abertasO) : html`<p class="pequeno pl-vazio">${filtrando ? 'Nenhum serviço em aberto com este filtro.' : 'Nenhum serviço aberto nesta obra.'}</p>`}
      ${feitas.length ? html`<details class="pl-feitos" ${filtrando ? html.seguro('open') : ''}><summary>Concluídos e cancelados (${feitas.length})</summary>${tabela(feitas)}</details>` : ''}
    </details>`;
  };
  const sel = (nome, rotulo, opcoes, atual) => html`<label>${rotulo}<select data-atas-filtro="${nome}"><option value="">Todas</option>${opcoes.map((v) => html`<option ${v === atual ? html.seguro('selected') : ''}>${v}</option>`)}</select></label>`;
  return html`<section class="pl">
    <div class="pg-faixa">
      <div><b>${em.length}</b><span>pós-obras em andamento</span></div>
      <div class="${atrasadas ? 'tom-ruim' : ''}"><b>${atrasadas}</b><span>atrasados</span></div>
      <div><b>${abertas}</b><span>serviços abertos</span></div>
    </div>
    ${incompletas.length ? html`<p class="aviso pl-aviso">${incompletas.length} ${incompletas.length === 1 ? 'pós-obra está sem' : 'pós-obras estão sem'} cliente ou endereço cadastrado, por isso nem sempre dá para saber de onde é cada serviço. ${podeEditar ? 'Use "completar dados" em cada um: o que você preencher vale por cima da planilha.' : 'Peça ao gestor do pós-obra para completar.'}</p>` : ''}
    <div class="at-filtros pl-filtros">${sel('fase', 'Fase', FASES_FILTRO, faseF)}${sel('prazo', 'Prazo', PRAZOS_FILTRO.concat(['Encerrado']), prazoF)}
      <label>Procurar<input type="search" data-atas-filtro="q" value="${params.get('q') || ''}" placeholder="OS, obra, cliente, pessoa…"></label>
      ${filtrando ? html`<a class="ac-mini" href="#/posobra">limpar filtros</a>` : ''}
      <span class="pl-tudo"><button type="button" class="ac-mini" data-po-todos="abrir">abrir tudo</button> <button type="button" class="ac-mini" data-po-todos="fechar">recolher tudo</button></span></div>
    <h2 class="pg-tit">Em andamento <span class="pequeno">cada pós-obra com os serviços (OS) embaixo; clique na OS para ver os detalhes</span></h2>
    ${em.length ? html`<div class="pl-lista">${em.map((o) => bloco(o, true))}</div>` : html`<p class="vazio">Nenhum pós-obra em andamento.</p>`}
    ${encerradas.length ? html`<details class="pg-enc" ${filtrando ? html.seguro('open') : ''}><summary>Concluídos, cancelados e sem serviço aberto (${encerradas.length})</summary><div class="pl-lista">${encerradas.map((o) => bloco(o, false))}</div></details>` : ''}
    <p class="pequeno pg-rodape">Tabelas da planilha: <a class="link" href="#/posobra/painel">painel</a> · <a class="link" href="#/posobra/obras">obras</a> · <a class="link" href="#/posobra/servicos-tabela">serviços (tabela da planilha)</a>. As pendências de cada OS aparecem em <a class="link" href="#/atas">Atas e pendências</a>.</p>
  </section>`;
}

// ---------------------------------------------------------------- página de uma OS: dados, atualizações e pendências dela
const quando = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
export function renderOS({ base, os, atualizacoes = [], pendencias = [], podeEditar = false, veValores = false }) {
  const s = (base.servicos || []).find((x) => x.os === os);
  if (!s) return html`<p class="vazio">OS "${os}" não encontrada. <a class="link" href="#/posobra">Voltar aos pós-obras</a></p>`;
  const o = base.obraPorNome.get(s.obra) || { obra: s.obra }; const pt = partesObra(o);
  const minhas = pendencias.filter((p) => p.os === os && p.status !== 'cancelada' && p.na_lista !== false);
  const abertas = minhas.filter((p) => p.status === 'aberta'); const feitas = minhas.filter((p) => p.status === 'feita');
  const dado = (rotulo, valor) => html`<div class="os-dado"><span>${rotulo}</span><b>${valor}</b></div>`;
  const pend = (p) => html`<div class="os-pend ${p.status === 'feita' ? 'feita' : ''}"><div class="os-pend-desc">${descricaoComAssunto(p.descricao)}</div>
    <div class="os-pend-info"><span>${p.responsavel_nome || '—'}</span><span>${p.prazo ? `prazo ${fmt.data(p.prazo)}` : 'sem prazo'}</span>${p.prazo_original && p.prazo_original !== p.prazo ? html`<span class="at-repro-tag">↻ era ${dBR(p.prazo_original).slice(0, 5)}</span>` : ''}
      ${p.status === 'feita' ? html`<span class="muted">concluída</span>` : html`<button type="button" class="ac-mini" data-cal-prazo="${p.id}" title="Reprogramar">↻ data</button><button type="button" class="ac-mini at-ok" data-pend="${p.id}|feita">✓ concluir</button>`}</div></div>`;
  return html`<div class="os-pagina">
    <p><a class="link" href="#/posobra">← Pós-obras</a></p>
    <h2 class="po-nome">${s.os} ${celulaFase(s, podeEditar)}</h2>
    <p class="pequeno po-meta"><a class="link" href="${rotaObra(s.obra)}">${pt.titulo}</a>${pt.sub ? ` · ${pt.sub}` : ' · cliente e endereço ainda não cadastrados'}</p>
    <div class="os-dados">${dado('Início', dBR(s.data_inicio) || '—')}${dado('Prazo', celulaPrazo(s, podeEditar))}${dado('Concluído em', dBR(s.concluido_em) || '—')}${dado('Quem faz', s.profissionais || '—')}${s.diasAtraso ? dado('Dias em atraso', s.diasAtraso) : ''}${veValores ? dado('Custo até agora', custoDe(s) ? fmt.reais(custoDe(s)) : '—') : ''}${dado('Origem', s.noSistema ? 'criada no sistema' : 'planilha do pós-obra')}</div>
    <h3>O serviço</h3><div class="os-relato">${s.relato || html`<span class="muted">sem descrição</span>`}</div>${s.obs ? html`<p class="pequeno"><b>Observação:</b> ${s.obs}</p>` : ''}

    <h3>Pendências desta OS <span class="pequeno">${abertas.length} ${abertas.length === 1 ? 'aberta' : 'abertas'}</span>${podeEditar ? html` <button type="button" class="ac-mini" data-os-pend="${os}" data-os-obra="${s.obra}">+ nova pendência</button>` : ''}</h3>
    <p class="pequeno">Só entra aqui o que realmente é pendência (alguém precisa fazer algo, com responsável e prazo). Elas também aparecem em <a class="link" href="#/atas?obra=${encodeURIComponent(s.obra)}">Atas e pendências</a>.</p>
    ${abertas.length ? html`<div class="os-pends">${abertas.map(pend)}</div>` : html`<p class="vazio">Nenhuma pendência aberta nesta OS.</p>`}
    ${feitas.length ? html`<details class="po-feitas"><summary>Pendências concluídas (${feitas.length})</summary><div class="os-pends">${feitas.map(pend)}</div></details>` : ''}

    <h3>Atualizações</h3>
    ${podeEditar ? html`<form class="os-nota" id="os-nota" data-os="${os}"><textarea name="texto" rows="2" required placeholder="O que aconteceu? (visita, retorno do cliente, orçamento enviado…)"></textarea><button type="submit" class="botao on">Registrar atualização</button></form>` : ''}
    ${atualizacoes.length ? html`<ol class="os-linha">${atualizacoes.map((a) => html`<li class="os-at os-at-${a.tipo}"><span class="os-at-quando">${quando(a.criado_em)}${a.por_nome ? ` · ${a.por_nome}` : ''}</span>
      <div>${a.tipo === 'fase' ? html`Fase: <b>${a.de || '—'}</b> → <b>${a.para}</b>` : a.tipo === 'prazo' ? html`Prazo reprogramado: <b>${a.de ? dBR(a.de) : 'sem prazo'}</b> → <b>${dBR(a.para)}</b>` : a.texto}</div></li>`)}</ol>` : html`<p class="vazio">Ainda não há atualizações desta OS.</p>`}
  </div>`;
}
const descricaoComAssunto = (t) => { const s = String(t || ''); const i = s.indexOf(','); return i > 0 && i < 60 ? html`<b>${s.slice(0, i).toLocaleUpperCase('pt-BR')}</b>${s.slice(i)}` : s; };
// janela para completar os dados de uma obra
export function formObra(o) {
  const pt = partesObra(o);
  return html`<form class="at-nova-pend at-avulsa" id="ob-form" data-obra="${o.obra}">
    <h3>Dados da obra</h3><p class="pequeno at-av-sub">${o.obra}. O que você preencher aqui aparece no lugar do que está na planilha.</p>
    <div class="at-av-grade">
      <label class="av-m">Nome (como deve aparecer)<input name="apelido" autocomplete="off" value="${o.apelido || pt.nome}" placeholder="ex.: Apartamento da Luciana"></label>
      <label class="av-m">Cliente<input name="cliente" autocomplete="off" value="${o.cliente || ''}" placeholder="ex.: Luciana Badaró"></label>
      <label class="av-m" style="grid-column:1/-1">Endereço<input name="endereco" autocomplete="off" value="${o.endereco || ''}" placeholder="ex.: Rua Marcelo Roberto 238, apto 101"></label>
      <label class="av-m">Responsável pelo pós-obra<input name="responsavel" autocomplete="off" value="${o.responsavel || ''}" placeholder="ex.: Ênio"></label>
    </div>
    <div class="at-av-botoes"><button type="button" class="botao" data-av-fechar>Cancelar</button><button type="submit" class="botao on">Salvar</button></div></form>`;
}
// o que a planilha do pós-obra já diz para a semana: quem (reconhecido na equipe, sem os genéricos) vai para qual obra em qual dia
export function daPlanilha(base, semanaIni) {
  const dias = new Set(DIAS.map((_, i) => somarDias(semanaIni, i))); const obras = new Set(obrasEmAndamento(base).map((o) => o.obra)); const vistos = new Set(); const out = [];
  for (const e of base.agenda) {
    if (!dias.has(e.data) || !obras.has(e.obra)) continue;
    for (const { pessoa } of e.pessoas || []) { if (pessoa.generico) continue; const k = `${e.data}|${e.obra}|${pessoa.nome}`; if (vistos.has(k)) continue; vistos.add(k); out.push({ data: e.data, obra: e.obra, pessoa: pessoa.nome }); }
  }
  return out;
}

// ---------------------------------------------------------------- Agenda da semana (cartões de funcionários)
export function renderAgenda({ base, semanaIni, linhasAgenda, podeEditar, selecionado, erro, extras = [] }) {
  const todasEm = obrasEmAndamento(base);
  const dias = DIAS.map((_, i) => somarDias(semanaIni, i));
  // só aparecem as obras com alguém escalado (ou escrito na planilha) nesta semana, mais as que você escolher em "+ Adicionar pós-obra"
  const comMovimento = (o) => linhasAgenda.some((l) => l.obra === o.obra) || base.agenda.some((a) => a.obra === o.obra && dias.includes(a.data));
  const obras = todasEm.filter((o) => comMovimento(o) || extras.includes(o.obra));
  const outras = todasEm.filter((o) => !obras.includes(o));
  const gente = base.equipe.filter((e) => e.profissional && !/\(/.test(e.profissional)).sort((a, b) => a.profissional.localeCompare(b.profissional, 'pt-BR'));
  const naSemana = (nome) => new Set(linhasAgenda.filter((l) => l.pessoa === nome).map((l) => l.data)).size;
  const planilha = (obra, data) => base.agenda.filter((a) => a.obra === obra && a.data === data).map((a) => a.texto).filter(Boolean);
  const partes = (obra, data) => { const mesmoDia = (l) => l.data === data; return { daqui: linhasAgenda.filter((l) => l.obra === obra && mesmoDia(l)), todas: linhasAgenda.filter(mesmoDia) }; };
  const celula = (o, d) => {
    const { daqui, todas } = partes(o.obra, d); const txt = planilha(o.obra, d);
    return html`<td class="ap-cel" data-ap-obra="${o.obra}" data-ap-data="${d}">
      ${daqui.map((l) => { const n = todas.filter((x) => x.pessoa === l.pessoa).length; return html`<span class="ap-chip ${n > 1 ? 'ap-div' : ''}" ${podeEditar ? html.seguro('draggable="true"') : ''} data-ap-chip="${l.id}" title="${n > 1 ? `${l.pessoa} está em ${n} obras neste dia: a diária é dividida` : l.pessoa}">${l.pessoa}${n > 1 ? html` <small>1/${n}</small>` : ''}${podeEditar ? html`<button type="button" data-ap-del="${l.id}" title="Tirar da agenda">×</button>` : ''}</span>`; })}
      ${txt.map((t) => html`<div class="ap-plan" title="Escrito na planilha do pós-obra">${t}</div>`)}
    </td>`;
  };
  const nav = html`<div class="periodo ap-nav">
    <button type="button" class="botao" data-ap-sem="${somarDias(semanaIni, -7)}">← Semana anterior</button>
    <div class="atual"><span>Semana</span><b>${dm(semanaIni)} a ${dm(somarDias(semanaIni, 5))}</b></div>
    <button type="button" class="botao" data-ap-sem="hoje">Esta semana</button>
    <button type="button" class="botao" data-ap-sem="${somarDias(semanaIni, 7)}">Próxima semana →</button>
  </div>`;
  const faltam = podeEditar ? daPlanilha(base, semanaIni).filter((n) => !linhasAgenda.some((x) => x.data === n.data && x.obra === n.obra && x.pessoa === n.pessoa)).length : 0;
  return html`<section class="ap">
    ${nav}
    ${faltam ? html`<p class="ap-importar"><button type="button" class="botao" data-ap-importar>Trazer da planilha: preencher a semana com os ${faltam} nomes que já estão lá</button> <span class="pequeno">cria os cartões na agenda; depois você move e tira como quiser</span></p>` : ''}
    ${erro ? html`<p class="erro">${erro}</p>` : ''}
    <p class="pequeno">${podeEditar ? 'Arraste o cartão de um funcionário (à esquerda) para a obra e o dia, ou toque no nome e depois no quadrado. Dá para arrastar o nome de um dia para outro e tirar no ×.' : 'Só o gestor do pós-obra, a coordenação e a diretoria mexem na agenda; você vê quem vai para onde.'} Em cinza, o que está escrito na planilha do pós-obra.</p>
    <div class="ap-corpo">
      ${podeEditar ? html`<aside class="ap-func"><h3>Funcionários</h3>
        ${gente.map((e) => html`<div class="ap-card ${selecionado === e.profissional ? 'sel' : ''}" draggable="true" data-ap-pessoa="${e.profissional}">
          <b>${e.profissional}</b><small>${e.funcao || ''}${e.vinculo ? ` · ${e.vinculo}` : ''}</small><span class="ap-n">${naSemana(e.profissional)} ${naSemana(e.profissional) === 1 ? 'dia' : 'dias'}</span></div>`)}
      </aside>` : ''}
      <div class="ap-grade tabela-rolagem"><table class="ap-tab"><thead><tr><th>Obra</th>${dias.map((d, i) => html`<th>${DIAS[i]} <small>${dm(d)}</small></th>`)}</tr></thead>
        <tbody>${obras.map((o) => { const pt = partesObra(o); return html`<tr><th class="ap-obra"><a href="${rotaObra(o.obra)}" title="${pt.sub}">${pt.titulo}</a><small>${pt.sub || o.situacao || ''}</small>${podeEditar && extras.includes(o.obra) && !comMovimento(o) ? html`<button type="button" class="ac-mini" data-ap-tirar-obra="${o.obra}">tirar da semana</button>` : ''}</th>${dias.map((d) => celula(o, d))}</tr>`; })}</tbody></table>
        ${!obras.length ? html`<p class="vazio">Ninguém escalado nesta semana. Escolha um pós-obra abaixo ou traga o que está na planilha.</p>` : ''}
        ${podeEditar && outras.length ? html`<p class="ap-mais"><label>+ Adicionar pós-obra à semana <select data-ap-mais><option value="">escolher…</option>${outras.map((o) => html`<option value="${o.obra}">${partesObra(o).titulo}</option>`)}</select></label></p>` : ''}</div>
    </div>
  </section>`;
}

export const segundaDa = (iso) => inicioDaSemana(iso);

// ---------------------------------------------------------------- página de uma obra (simples e didática)
const ETAPAS = ['Análise', 'Orçamento', 'Agendamento', 'Planejamento', 'Execução', 'Concluído'];
export function renderObra({ base, nome, semanaIni, linhasAgenda, pendencias = [], linkCompleto, podeEditar = false }) {
  const o = base.obraPorNome.get(nome);
  if (!o) return html`<p class="vazio">Obra "${nome}" não encontrada. <a class="link" href="#/posobra">Voltar aos pós-obras</a></p>`;
  const abertas = (o.servicos || []).filter((s) => s.aberta).sort((a, b) => String(a.prazo || '9').localeCompare(String(b.prazo || '9')));
  const feitas = (o.servicos || []).filter((s) => !s.aberta).sort((a, b) => String(b.concluido_em || '').localeCompare(String(a.concluido_em || ''))).slice(0, 8);
  const sit = o.situacao === 'Atrasado' ? 'Execução' : o.situacao; const atual = ETAPAS.indexOf(sit);
  const dias = DIAS.map((_, i) => somarDias(semanaIni, i));
  const dodia = (d) => ({ sis: linhasAgenda.filter((l) => l.obra === nome && l.data === d), plan: base.agenda.filter((a) => a.obra === nome && a.data === d).map((a) => a.texto).filter(Boolean) });
  const pend = pendencias.filter((p) => p.obra === nome && p.status === 'aberta' && p.na_lista !== false);
  return html`<div class="po-obra">
    <p><a class="link" href="#/posobra">← Pós-obras</a></p>
    <h2 class="po-nome">${partesObra(o).titulo} ${chipSituacao(o.situacao)}</h2>
    <p class="pequeno po-meta">${[partesObra(o).sub, o.tipo, o.responsavel ? `responsável: ${o.responsavel}` : ''].filter(Boolean).join(' · ') || 'Cliente e endereço ainda não cadastrados'}${podeEditar ? html` <button type="button" class="ac-mini" data-po-editar="${o.obra}">completar dados</button>` : ''}</p>

    <h3>Em que pé está</h3>
    <ol class="po-etapas">${ETAPAS.map((e, i) => html`<li class="${atual < 0 ? '' : i < atual ? 'feita' : i === atual ? 'atual' : ''} ${e === 'Execução' && o.situacao === 'Atrasado' ? 'atrasada' : ''}"><span>${i + 1}</span>${e}${e === 'Execução' && o.situacao === 'Atrasado' ? html`<small>atrasado</small>` : ''}</li>`)}</ol>
    ${atual < 0 ? html`<p class="pequeno">Situação "${o.situacao}": ${o.situacao === 'Sem OS' ? 'ainda não há nenhum serviço cadastrado para esta obra.' : o.situacao === 'Pausado' ? 'obra pausada.' : o.situacao === 'Fixo' ? 'manutenção fixa (sem fim previsto).' : 'sem etapa definida.'}</p>` : ''}

    <h3>O que falta fazer <span class="pequeno">${abertas.length} ${abertas.length === 1 ? 'serviço aberto' : 'serviços abertos'}</span></h3>
    ${abertas.length ? html`<div class="po-lista">${abertas.map((s) => html`<div class="po-item"><div><b>${s.os}</b> <span class="pequeno">${s.situacao || ''}</span></div>
      <div class="po-relato">${s.relato || html`<span class="muted">sem descrição</span>`}</div>
      <div class="po-linha-peq"><span>${s.profissionais ? `com ${s.profissionais}` : 'sem responsável'}</span><span>${s.prazo ? (/^\d{4}/.test(s.prazo) ? `prazo ${fmt.data(s.prazo)}` : `prazo: ${s.prazo}`) : 'sem prazo'}</span>${chipPrazo(s.statusPrazo)}</div></div>`)}</div>` : html`<p class="vazio">Nada em aberto nesta obra.</p>`}

    <h3>Quem vai esta semana <span class="pequeno">${dm(dias[0])} a ${dm(dias[5])}</span></h3>
    <div class="po-semana">${dias.map((d, i) => { const x = dodia(d); return html`<div class="po-dia"><b>${DIAS[i]} <small>${dm(d)}</small></b>${x.sis.map((l) => html`<span class="ap-chip">${l.pessoa}</span>`)}${x.plan.map((t) => html`<div class="ap-plan">${t}</div>`)}${!x.sis.length && !x.plan.length ? html`<span class="muted">—</span>` : ''}</div>`; })}</div>
    <p class="pequeno">Para escalar alguém, use a aba <a class="link" href="#/posobra/agenda">Agenda</a>.</p>

    <h3>Pendências desta obra <span class="pequeno">${pend.length} ${pend.length === 1 ? 'aberta' : 'abertas'}</span></h3>
    <p><a class="botao" href="#/atas?obra=${encodeURIComponent(nome)}">Ver em Atas e pendências</a></p>

    ${feitas.length ? html`<details class="po-feitas"><summary>Já concluídos (${feitas.length} mais recentes)</summary>${feitas.map((s) => html`<div class="po-item po-feito"><b>${s.os}</b> <span class="pequeno">${s.concluido_em ? `concluído em ${fmt.data(s.concluido_em)}` : s.situacao}</span><div class="po-relato">${s.relato || ''}</div></div>`)}</details>` : ''}
    <p class="pequeno po-completo"><a class="link" href="${linkCompleto}">Ver os detalhes completos desta obra (agenda da planilha, custos e financeiro)</a></p>
  </div>`;
}
// ---------------------------------------------------------------- Serviços em quadro por fase
const FASES_QUADRO = ['Análise', 'Orçamento', 'Agendamento', 'Planejamento', 'Execução', 'Atrasado', 'Concluído'];
const OUTRAS_FASES = ['Fixo', 'Pausado', 'Cancelado'];
const FASE_COR = { 'Análise': '#6E7782', 'Orçamento': '#B58A1B', 'Agendamento': '#3C7480', 'Planejamento': '#5B7A2E', 'Execução': '#2F5F86', 'Atrasado': '#9B3A33', 'Concluído': '#4F7D5C', 'Fixo': '#34507A', 'Pausado': '#6E7782', 'Cancelado': '#8A939D' };
export const FASES_TODAS = [...FASES_QUADRO, ...OUTRAS_FASES];
const curtoObra = (n) => String(n || '').replace(/^\s*(?:PO|MO)\d*\s*[-–]\s*/i, '').trim() || String(n || '');
export function renderServicos({ base, params, podeEditar }) {
  const obraF = params.get('obra') || ''; const q = (params.get('q') || '').toLocaleLowerCase('pt-BR');
  const lista = (base.servicos || []).filter((s) => (!obraF || s.obra === obraF) && (!q || `${s.os} ${s.obra} ${s.relato} ${s.profissionais}`.toLocaleLowerCase('pt-BR').includes(q)));
  const obrasLista = [...new Set((base.servicos || []).map((s) => s.obra).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const cartao = (s) => html`<article class="sv-card" ${podeEditar ? html.seguro('draggable="true"') : ''} data-sv-os="${s.os}">
    <div class="sv-topo"><a class="sv-os" href="${rotaOs(s.os)}" title="Abrir a OS"><b>${s.os}</b></a>${s.noSistema ? html`<span class="sv-novo">novo</span>` : ''}<span class="sv-obra" title="${s.obra}">${partesObra({ obra: s.obra, ...((base.obraPorNome.get(s.obra)) || {}) }).titulo}</span></div>
    <div class="sv-relato">${s.relato || html`<span class="muted">sem descrição</span>`}</div>
    <div class="sv-info"><span>${s.profissionais ? `com ${s.profissionais}` : 'sem responsável'}</span>${celulaPrazo(s, podeEditar)}</div>
    ${podeEditar ? html`<div class="sv-acoes"><select data-sv-mover="${s.os}" title="Mover para outra fase"><option value="">Mover para…</option>${FASES_TODAS.filter((f) => f !== s.situacao).map((f) => html`<option>${f}</option>`)}</select>${s.noSistema ? html`<button type="button" class="ac-mini" data-sv-apagar="${s.os}" title="Apagar este serviço (só os criados aqui)">apagar</button>` : ''}</div>` : ''}
  </article>`;
  const coluna = (fase, estreita = false) => {
    let itens = lista.filter((s) => s.situacao === fase);
    if (fase === 'Concluído') itens = itens.sort((a, b) => String(b.concluido_em || '').localeCompare(String(a.concluido_em || '')));
    const total = itens.length; const mostra = fase === 'Concluído' || fase === 'Cancelado' ? itens.slice(0, 15) : itens;
    return html`<section class="sv-col ${estreita ? 'sv-estreita' : ''}" data-sv-fase="${fase}"><header style="background:${FASE_COR[fase]}"><b>${fase}</b><span>${total}</span>${podeEditar ? html`<button type="button" class="sv-mais" data-sv-novo="${fase}" title="Novo serviço em ${fase}">+</button>` : ''}</header>
      <div class="sv-itens">${mostra.map(cartao)}${total > mostra.length ? html`<p class="pequeno">e mais ${total - mostra.length} (mais antigos)</p>` : ''}</div></section>`;
  };
  return html`<section class="sv">
    <div class="at-filtros"><label>Obra<select data-atas-filtro="obra"><option value="">Todas</option>${obrasLista.map((o) => html`<option value="${o}" ${o === obraF ? html.seguro('selected') : ''}>${o}</option>`)}</select></label>
      <label>Procurar<input type="search" data-atas-filtro="q" value="${params.get('q') || ''}" placeholder="serviço, obra, pessoa…"></label></div>
    <p class="pequeno">${podeEditar ? 'Arraste o cartão para a fase certa (ou use "Mover para…"). O + cria um serviço novo naquela fase.' : 'Só o gestor do pós-obra, a coordenação e a diretoria mexem nas fases; você acompanha.'} Os serviços vêm da planilha do pós-obra; o que mudar aqui vale por cima dela.</p>
    <div class="sv-quadro">${FASES_QUADRO.map((f) => coluna(f))}</div>
    <h4 class="sv-outras-tit">Outros</h4>
    <div class="sv-quadro sv-outras">${OUTRAS_FASES.map((f) => coluna(f, true))}</div>
  </section>`;
}

// janela de novo serviço
export function formServico(base, fase) {
  const obras = base.obras.map((o) => o.obra);
  return html`<form class="at-nova-pend at-avulsa" id="sv-form" data-fase="${fase}">
    <h3>Novo serviço</h3><p class="pequeno at-av-sub">Entra na fase "${fase}". Pode mudar de fase depois, arrastando o cartão.</p>
    <div class="at-av-grade">
      <label class="av-m">Obra<select name="obra" required><option value="">— escolher —</option>${obras.map((o) => html`<option>${o}</option>`)}</select></label>
      <label class="av-m">Quem faz<input name="profissionais" autocomplete="off" placeholder="ex.: Ênio, Marcos"></label>
      <label class="av-m" style="grid-column:1/-1">O que é o serviço<input name="relato" required autocomplete="off" placeholder="ex.: Pintar o rodapé e trocar o ralo da varanda"></label>
      <label class="av-m">Prazo<input type="date" name="prazo"></label>
    </div>
    <div class="at-av-botoes"><button type="button" class="botao" data-av-fechar>Cancelar</button><button type="submit" class="botao on">Criar serviço</button></div></form>`;
}