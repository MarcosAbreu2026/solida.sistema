// Pós-obra mais dinâmico (pedido de 21/10): os pós-obras em andamento aparecem como cartões clicáveis (andamento de cada um,
// de forma simples), as pendências são as mesmas de "Atas e pendências" e a agenda da semana funciona como "Minhas funções":
// uma aba lateral com os cartões dos funcionários, que se arrastam para a obra e o dia.
import { html } from '../formato.js';
import { somarDias, inicioDaSemana } from '../datas.js';
import { PRIORIDADE_SITUACAO, SITUACOES_ABERTAS } from '../regras.js';
import { chipSituacao, chipPrazo, rotaObra, fmt } from '../componentes.js';

const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// em andamento = tem serviço aberto (situação de execução, atraso, planejamento, agendamento, orçamento, análise, fixo ou pausado), mais urgente primeiro
export function obrasEmAndamento(base) {
  const ordem = (o) => { const i = PRIORIDADE_SITUACAO.indexOf(o.situacao); return i < 0 ? 99 : i; };
  return base.obras.filter((o) => SITUACOES_ABERTAS.includes(o.situacao)).sort((a, b) => ordem(a) - ordem(b) || a.obra.localeCompare(b.obra, 'pt-BR'));
}

// ---------------------------------------------------------------- Pós-obras (cartões)
export function renderResumo(base, semanaIni, linhasAgenda) {
  const em = obrasEmAndamento(base);
  const encerradas = base.obras.filter((o) => !SITUACOES_ABERTAS.includes(o.situacao));
  const semana = new Set(Array.from({ length: 7 }, (_, i) => somarDias(semanaIni, i)));
  const gente = (o) => new Set([...linhasAgenda.filter((l) => l.obra === o.obra && semana.has(l.data)).map((l) => l.pessoa)]).size;
  const atrasadas = em.filter((o) => o.situacao === 'Atrasado').length;
  const abertas = em.reduce((t, o) => t + (o.abertas || 0), 0);
  const cartao = (o) => html`<a class="pg-obra pg-${String(o.situacao || 'sem').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')}" href="${rotaObra(o.obra)}">
    <div class="pg-topo"><b>${o.obra}</b>${chipSituacao(o.situacao)}</div>
    <div class="pg-sub">${o.cliente || 'Cliente não informado'}${o.tipo ? html` · <span>${o.tipo}</span>` : ''}</div>
    <div class="pg-nums"><span><b>${o.abertas || 0}</b> ${o.abertas === 1 ? 'serviço aberto' : 'serviços abertos'}</span>
      <span>${o.proximoPrazo ? html`próx. prazo <b>${fmt.data(o.proximoPrazo)}</b>` : 'sem prazo marcado'}</span>
      <span>${gente(o) ? html`<b>${gente(o)}</b> ${gente(o) === 1 ? 'pessoa' : 'pessoas'} na agenda da semana` : 'ninguém escalado na semana'}</span></div>
    <div class="pg-ver">Ver o andamento →</div></a>`;
  return html`<section class="pg-resumo">
    <div class="pg-faixa">
      <div><b>${em.length}</b><span>pós-obras em andamento</span></div>
      <div class="${atrasadas ? 'tom-ruim' : ''}"><b>${atrasadas}</b><span>atrasados</span></div>
      <div><b>${abertas}</b><span>serviços abertos</span></div>
    </div>
    <h2 class="pg-tit">Em andamento <span class="pequeno">clique num pós-obra para ver o andamento dele</span></h2>
    ${em.length ? html`<div class="pg-grade">${em.map(cartao)}</div>` : html`<p class="vazio">Nenhum pós-obra em andamento.</p>`}
    ${encerradas.length ? html`<details class="pg-enc"><summary>Concluídos, cancelados e sem serviço aberto (${encerradas.length})</summary><div class="pg-grade">${encerradas.map(cartao)}</div></details>` : ''}
    <p class="pequeno pg-rodape">Tabelas da planilha: <a class="link" href="#/posobra/painel">painel</a> · <a class="link" href="#/posobra/obras">obras</a> · <a class="link" href="#/posobra/servicos-tabela">serviços (tabela da planilha)</a>. As pendências novas ficam na aba <a class="link" href="#/posobra/pendencias">Pendências</a>, a mesma lista de Atas e pendências.</p>
  </section>`;
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
export function renderAgenda({ base, semanaIni, linhasAgenda, podeEditar, selecionado, erro }) {
  const obras = obrasEmAndamento(base);
  const dias = DIAS.map((_, i) => somarDias(semanaIni, i));
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
        <tbody>${obras.map((o) => html`<tr><th class="ap-obra"><a href="${rotaObra(o.obra)}">${o.obra}</a><small>${o.situacao || ''}</small></th>${dias.map((d) => celula(o, d))}</tr>`)}</tbody></table></div>
    </div>
  </section>`;
}

export const segundaDa = (iso) => inicioDaSemana(iso);

// ---------------------------------------------------------------- página de uma obra (simples e didática)
const ETAPAS = ['Análise', 'Orçamento', 'Agendamento', 'Planejamento', 'Execução', 'Concluído'];
export function renderObra({ base, nome, semanaIni, linhasAgenda, pendencias = [], linkCompleto }) {
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
    <h2 class="po-nome">${o.obra} ${chipSituacao(o.situacao)}</h2>
    <p class="pequeno po-meta">${[o.cliente, o.tipo, o.responsavel ? `responsável: ${o.responsavel}` : '', o.endereco].filter(Boolean).join(' · ') || 'Sem mais dados cadastrados'}</p>

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
    <p><a class="botao" href="#/posobra/pendencias?obra=${encodeURIComponent(nome)}">Ver no quadro de pendências</a></p>

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
    <div class="sv-topo"><b>${s.os}</b>${s.noSistema ? html`<span class="sv-novo">novo</span>` : ''}<span class="sv-obra" title="${s.obra}">${curtoObra(s.obra)}</span></div>
    <div class="sv-relato">${s.relato || html`<span class="muted">sem descrição</span>`}</div>
    <div class="sv-info"><span>${s.profissionais ? `com ${s.profissionais}` : 'sem responsável'}</span>${s.prazo && /^\d{4}/.test(s.prazo) ? html`<span>prazo ${fmt.data(s.prazo)}</span>` : ''}${s.statusPrazo && s.aberta ? chipPrazo(s.statusPrazo) : ''}</div>
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