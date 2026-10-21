// Perfil: pontuação das tarefas da semana (quadro de funções, Minhas funções) e sugestões do que melhorar.
// A pontuação sai das marcações ✓ feito / ✕ não feito que cada pessoa faz (gravadas no servidor,
// dados/tarefas-feitas.jsonl). Só contam as tarefas recorrentes da grade (as "fora do quadro" ficam de fora),
// em dias úteis passados, sem feriado, a partir do primeiro dia em que a pessoa marcou alguma coisa.
// As sugestões são automáticas, por regras (nenhum dado sai do sistema e não há API paga — pedido do Felipe).

import { html, data as fmtData } from '../formato.js';
import { somarDias, hojeISO, inicioDaSemana } from '../datas.js';
import { TAREFAS, valeNoDia, naGrade, funcaoPorId, FUNCOES, descreverDias } from '../funcoes.js';
import { lerTodosChecks, lerPessoasTarefas } from '../armazenamento.js';
import { feriado } from '../feriados.js';
import { pessoaDoLogin } from '../escritorio/pessoas.js';
import { provaDe } from '../evidencias.js';
import { NA_NUVEM, listarFotos, enviarFoto as fotoNuvem, removerFoto as tirarFotoNuvem } from '../nuvem.js';

const PONTOS_FEITO = 10;
const DIAS = ['', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// Pontuação de uma pessoa entre duas datas (inclusive)
// ctx = { obras, CFG }: com isso, tarefa sem marcação mas com prova (arquivo no Drive, produtividade no grupo) conta como feita
export function pontuar(pessoa, funcaoId, de, ate, checksTodos = lerTodosChecks(), _ctx = null) {
  const ctx = null;   // 21/10: nada é marcado sozinho; só vale o que a pessoa marcou (✓ ou ✕)
  const checks = checksTodos[pessoa] || {};
  const hoje = hojeISO();
  const marcadas = Object.keys(checks).filter((d) => Object.keys(checks[d] || {}).length).sort();
  let desde = marcadas[0];
  const tarefasF = TAREFAS.filter((t) => t.funcao === funcaoId && naGrade(t));
  // nunca marcou nada, mas o sistema achou provas: conta a partir do primeiro dia com prova
  if (!desde && ctx) {
    // (só a partir desta semana: antes do sistema ninguém marcava, não dá para cobrar)
    for (let d = de > inicioDaSemana(hoje) ? de : inicioDaSemana(hoje); d <= ate && d <= hoje && !desde; d = somarDias(d, 1)) if (tarefasF.some((t) => valeNoDia(t, d) && provaDe(t, d, { funcao: funcaoId, obras: ctx.obras || [] }, ctx.CFG))) desde = d;
  }
  const r = { esperadas: 0, feitas: 0, auto: 0, nao: 0, semMarca: 0, porTarefa: new Map(), porDia: [0, 0, 0, 0, 0, 0, 0].map(() => ({ esperadas: 0, feitas: 0 })), desde };
  if (!desde) return { ...r, taxa: null, pontos: 0, porTarefa: [] };
  const tarefas = TAREFAS.filter((t) => t.funcao === funcaoId && naGrade(t));
  for (let d = de < desde ? desde : de; d <= ate && d <= hoje; d = somarDias(d, 1)) {
    if (feriado(d)) continue;
    for (const t of tarefas) {
      if (!valeNoDia(t, d)) continue;
      let v = (checks[d] || {})[t.id];
      if (!v && ctx && provaDe(t, d, { funcao: funcaoId, obras: ctx.obras || [] }, ctx.CFG)) { v = 'feito'; r.auto++; }
      if (d === hoje && !v) continue;            // hoje ainda dá tempo
      r.esperadas++;
      const pt = r.porTarefa.get(t.id) || { tarefa: t, esperadas: 0, feitas: 0, nao: 0, semMarca: 0 };
      pt.esperadas++;
      const ds = new Date(`${d}T12:00:00`).getDay() || 7;
      r.porDia[ds].esperadas++;
      if (v === 'feito') { r.feitas++; pt.feitas++; r.porDia[ds].feitas++; } else if (v === 'nao') { r.nao++; pt.nao++; } else { r.semMarca++; pt.semMarca++; }
      r.porTarefa.set(t.id, pt);
    }
  }
  return { ...r, taxa: r.esperadas ? r.feitas / r.esperadas : null, pontos: r.feitas * PONTOS_FEITO, porTarefa: [...r.porTarefa.values()] };
}

// Todas as pessoas que já marcaram tarefas (sem os testes do "Ver como"), com a pontuação das últimas 4 semanas
export function ranking(hoje = hojeISO(), CFG = null) {
  const pessoas = lerPessoasTarefas(); const checks = lerTodosChecks();
  const de = somarDias(inicioDaSemana(hoje), -21);
  return Object.entries(pessoas).filter(([, p]) => !p.teste && p.funcao && p.funcao !== 'socio')
    .map(([chave, p]) => ({ chave, ...p, ...pontuar(chave, p.funcao, de, hoje, checks, { obras: p.obras || [], CFG }) }))
    .filter((p) => p.esperadas > 0)
    .sort((a, b) => (b.taxa - a.taxa) || (b.pontos - a.pontos));
}

// ---------------------------------------------------------------- sugestões (regras)
const DICAS = [
  [/di[áa]rio/i, 'Preencha o diário no fim do expediente, antes de sair da obra — 10 minutos com o que aconteceu, equipe e fotos.'],
  [/produtividade/i, 'Mande a produtividade do dia no grupo até as 17h, com a quantidade feita de cada serviço da programação.'],
  [/relat[óo]rio/i, 'Bloqueie um horário fixo na agenda para o relatório e parta do modelo da pasta da obra.'],
  [/reuni[ãa]o/i, 'Deixe a reunião como compromisso fixo no calendário, com lembrete 15 minutos antes.'],
  [/cobrar|cobran[çc]a/i, 'Faça a lista de cobranças logo cedo e envie tudo de uma vez; anote a resposta de cada um.'],
  [/medi[çc]/i, 'Lance as medições no Mais Controle no mesmo dia em que medir, obra por obra.'],
  [/cronograma|programa[çc][ãa]o/i, 'Atualize assim que a informação chegar da obra, em vez de juntar tudo para o fim da semana.'],
  [/planilha|atualizar|cadastrar|lan[çc]ar/i, 'Atualize na hora em que a informação chega — deixar para depois é o que mais faz a tarefa ficar para trás.'],
  [/confer|verific|checklist|vistoria/i, 'Use o checklist do POP e vá marcando item a item; o que faltar vira pendência com responsável e prazo.'],
  [/compra|cota[çc]|fornecedor/i, 'Agrupe as cotações por fornecedor e combine um prazo de resposta; cobre no dia seguinte se não vier.'],
  [/foto|registro/i, 'Tire as fotos durante o dia (antes/depois) e suba no mesmo dia na pasta da obra.'],
];
function dicaPara(t) {
  const d = DICAS.find(([re]) => re.test(t.texto));
  if (d) return d[1];
  return t.hora ? `Reserve o horário previsto (${t.hora}) só para isso, com lembrete no celular.` : 'Escolha um horário fixo do dia para essa tarefa e deixe um lembrete no celular.';
}

export function sugestoes(p) {
  const out = [];
  if (p.taxa == null) return ['Ainda não há marcações suficientes. Marque ✓ feito ou ✕ não feito em Minhas funções todos os dias.'];
  if (p.esperadas >= 5 && p.semMarca / p.esperadas > 0.3) {
    out.push(`${p.semMarca} de ${p.esperadas} tarefas ficaram sem marcação. Marque ✓ ou ✕ no fim de cada dia — tarefa sem marcação conta como não entregue.`);
  }
  const fracas = p.porTarefa.filter((x) => x.esperadas >= 2 && x.feitas / x.esperadas < 0.7)
    .sort((a, b) => (a.feitas / a.esperadas) - (b.feitas / b.esperadas)).slice(0, 4);
  for (const x of fracas) out.push(`«${x.tarefa.texto}»: entregue ${x.feitas} de ${x.esperadas} vezes. ${dicaPara(x.tarefa)}`);
  // dia da semana mais fraco
  const dias = p.porDia.map((d, i) => ({ i, ...d, taxa: d.esperadas ? d.feitas / d.esperadas : null })).filter((d) => d.esperadas >= 3 && d.i >= 1);
  const pior = dias.sort((a, b) => a.taxa - b.taxa)[0];
  if (pior && p.taxa - pior.taxa >= 0.2) out.push(`Na ${DIAS[pior.i]} você entrega menos (${Math.round(pior.taxa * 100)}% contra ${Math.round(p.taxa * 100)}% no geral). Veja se dá para começar esse dia pelas tarefas do quadro.`);
  if (!out.length && p.taxa >= 0.9) out.push('Ótimo ritmo: você está entregando quase tudo do seu quadro. Continue marcando todo dia.');
  if (!out.length) out.push('Bom caminho. As tarefas com menos entregas aparecem na lista abaixo — comece por elas.');
  return out;
}

// ---------------------------------------------------------------- tela
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const nivel = (v) => (v == null ? '' : v >= 0.85 ? 'bom' : v >= 0.6 ? 'medio' : 'baixo');
export const iniciais = (nome) => String(nome || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

// ---------------------------------------------------------------- fotos
// A própria pessoa coloca a foto no Perfil (servidor: dados/fotos). Sem foto: o bonequinho do escritório ou as iniciais.
let fotos = {};
export const chaveFoto = (nome) => String(nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
export async function carregarFotos() {
  if (NA_NUVEM) { try { fotos = await listarFotos(chaveFoto); } catch { /* sem conexão */ } return fotos; }
  try { const r = await fetch('/api/fotos', { cache: 'no-store' }); if (r.ok) fotos = await r.json() || {}; } catch { /* sem servidor */ }
  return fotos;
}
export const temFoto = (nome) => !!fotos[chaveFoto(nome)];
// imagem escolhida → quadrado de 256 px em JPEG (corta o centro) → servidor
export async function enviarFoto(nome, arquivo) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    c.getContext('2d').drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, 256, 256);
    if (NA_NUVEM) { await fotoNuvem(await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85))); await carregarFotos(); return; }
    const r = await fetch('/api/fotos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pessoa: chaveFoto(nome), imagem: c.toDataURL('image/jpeg', 0.85) }) });
    if (!r.ok) throw new Error(await r.text());
    fotos = await r.json() || {};
  } finally { URL.revokeObjectURL(url); }
}
export async function removerFoto(nome) {
  if (NA_NUVEM) { await tirarFotoNuvem(); await carregarFotos(); return; }
  const r = await fetch('/api/fotos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pessoa: chaveFoto(nome), remover: true }) });
  if (r.ok) fotos = await r.json() || {};
}

// avatar: a foto da pessoa; sem foto, o bonequinho do escritório ou as iniciais
export function avatar(nome, tam = 40) {
  const k = chaveFoto(nome);
  if (fotos[k]) return html`<span class="av" style="width:${tam}px;height:${tam}px"><img src="${String(fotos[k]).startsWith('http') ? fotos[k] : `/api/foto/${k}.jpg?v=${fotos[k]}`}" alt=""></span>`;
  const p = pessoaDoLogin({ nome });
  return p ? html`<span class="av" style="width:${tam}px;height:${tam}px"><canvas data-avatar="${p.id}" width="${tam * 2}" height="${tam * 2}"></canvas></span>`
    : html`<span class="av av-ini" style="width:${tam}px;height:${tam}px;font-size:${Math.round(tam * 0.38)}px">${iniciais(nome)}</span>`;
}

export function render({ eu, alvo, podeVerTodos, extra = '', CFG = null }) {
  const hoje = hojeISO();
  const ini = inicioDaSemana(hoje);
  const checks = lerTodosChecks();
  const pessoa = alvo || eu;
  const funcao = funcaoPorId(pessoa.funcao);
  const ctx = { obras: pessoa.obras || [], CFG };
  const semana = pontuar(pessoa.chave, funcao.id, ini, hoje, checks, ctx);
  const mes = pontuar(pessoa.chave, funcao.id, somarDias(ini, -21), hoje, checks, ctx);
  const evolucao = [7, 6, 5, 4, 3, 2, 1, 0].map((k) => { const s = somarDias(ini, -7 * k); return { ini: s, ...pontuar(pessoa.chave, funcao.id, s, somarDias(s, 6), checks, ctx) }; });
  const rk = ranking(hoje, CFG);
  const pos = rk.findIndex((x) => x.chave === pessoa.chave);
  const tarefas = mes.porTarefa.slice().sort((a, b) => (a.feitas / a.esperadas) - (b.feitas / b.esperadas));
  const outro = alvo && alvo.chave !== eu.chave;
  // diretoria não tem quadro de tarefas: o perfil dela é o ranking da equipe
  const semQuadro = !outro && (funcao.semMinhaSemana || !TAREFAS.some((t) => t.funcao === funcao.id && naGrade(t)));

  return html`<div class="pagina perfil">
    ${outro ? html`<a class="link" href="#/perfil">← Meu perfil</a>` : ''}
    <header class="pf-cab"><div class="pf-foto">${avatar(pessoa.nome, 72)}${outro ? '' : html`<label class="pf-foto-btn" title="Trocar a foto">📷<input type="file" id="pf-foto-input" accept="image/*" hidden></label>`}</div><div><h2>${pessoa.nome}</h2><p>${funcao.nome}</p>
      ${outro ? '' : html`<span class="pf-foto-acoes"><label class="link">${temFoto(pessoa.nome) ? 'Trocar foto' : 'Colocar minha foto'}<input type="file" id="pf-foto-input2" accept="image/*" hidden></label>${temFoto(pessoa.nome) ? html` · <button type="button" class="link" data-pf-remover-foto>Remover</button>` : ''}<span id="pf-foto-msg" class="pequeno"></span></span>`}
      ${mes.desde ? html`<span class="pequeno">marcando tarefas desde ${fmtData(mes.desde)}</span>` : ''}</div></header>

    ${semQuadro ? '' : html`<div class="pf-cards">
      <div class="pf-card ${nivel(semana.taxa)}"><span>Esta semana</span><b>${pct(semana.taxa)}</b><small>${semana.feitas} de ${semana.esperadas} tarefas</small></div>
      <div class="pf-card ${nivel(mes.taxa)}"><span>Últimas 4 semanas</span><b>${pct(mes.taxa)}</b><small>${mes.feitas} de ${mes.esperadas}${mes.auto ? ` (${mes.auto} automáticas)` : ''} · ${mes.nao} não feitas · ${mes.semMarca} sem marcar</small></div>
      <div class="pf-card"><span>Pontos (4 semanas)</span><b>${mes.pontos}</b><small>${PONTOS_FEITO} por tarefa feita</small></div>
      <div class="pf-card"><span>Posição</span><b>${pos >= 0 ? `${pos + 1}º` : '—'}</b><small>${pos >= 0 ? `de ${rk.length} pessoas` : 'sem marcações ainda'}</small></div>
    </div>

    <section class="secao"><h2>Evolução semanal</h2>
      <div class="pf-evol">${evolucao.map((s) => html`<div class="pf-col" title="${s.feitas} de ${s.esperadas}"><i class="${nivel(s.taxa)}" style="height:${s.taxa == null ? 0 : Math.max(4, Math.round(s.taxa * 100))}%"></i><b>${pct(s.taxa)}</b><span>${s.ini.slice(8, 10)}/${s.ini.slice(5, 7)}</span></div>`)}</div>
    </section>

    <section class="secao"><h2>Sugestões para melhorar</h2>
      <ul class="pf-sug">${sugestoes(mes).map((s) => html`<li>${s}</li>`)}</ul>
      <p class="pequeno">Sugestões automáticas, montadas pelo sistema a partir das marcações das últimas 4 semanas (nada é enviado para fora).</p>
    </section>

    <section class="secao"><h2>Tarefas recorrentes <span class="pequeno">últimas 4 semanas</span></h2>
      ${tarefas.length ? html`<div class="tabela-rolagem"><table class="tab pf-tab">
        <thead><tr><th>Tarefa</th><th>Quando</th><th>Entregue</th><th></th></tr></thead>
        <tbody>${tarefas.map((x) => { const v = x.feitas / x.esperadas; return html`<tr>
          <td>${x.tarefa.texto}</td><td class="pequeno">${descreverDias(x.tarefa.dias)}${x.tarefa.hora ? ` · ${x.tarefa.hora}` : ''}</td>
          <td class="pf-num">${x.feitas}/${x.esperadas}${x.nao ? html` <span class="pequeno">(${x.nao} não)</span>` : ''}</td>
          <td class="pf-barra"><span class="pf-b ${nivel(v)}"><i style="width:${Math.round(v * 100)}%"></i></span><b>${pct(v)}</b></td></tr>`; })}</tbody>
      </table></div>` : html`<p class="vazio">Ainda não há tarefas marcadas. Marque ✓ ou ✕ em <a class="link" href="#/funcoes">Minhas funções</a>.</p>`}
    </section>`}

    ${podeVerTodos ? html`<section class="secao"><h2>Ranking da equipe <span class="pequeno">últimas 4 semanas · só a diretoria vê</span></h2>
      ${rk.length ? html`<div class="pf-rank">${rk.map((p, i) => html`<a class="pf-rk ${p.chave === pessoa.chave ? 'on' : ''}" href="#/perfil?p=${encodeURIComponent(p.chave)}">
        <span class="pf-rk-n">${i + 1}º</span>${avatar(p.nome, 32)}<span class="pf-rk-nome"><b>${p.nome}</b><small>${funcaoPorId(p.funcao).nome}</small></span>
        <span class="pf-b ${nivel(p.taxa)}"><i style="width:${Math.round((p.taxa || 0) * 100)}%"></i></span><b class="pf-rk-t">${pct(p.taxa)}</b><span class="pequeno">${p.pontos} pts</span></a>`)}</div>`
        : html`<p class="vazio">Ninguém marcou tarefas ainda. A pontuação aparece assim que as pessoas começarem a marcar em Minhas funções.</p>`}
    </section>` : ''}
    ${extra}
  </div>`;
}

export { FUNCOES };
