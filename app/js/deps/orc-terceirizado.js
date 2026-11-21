// Painel do Orçamento Terceirizado (laranja) (desenho do Marcos, página 10). Contrato e ctx: ver comum.js.
// Pergunta: quais contratações e orçamentos de terceiros faltam em cada obra e qual é a prioridade?
// Fontes: itens laranja (terceiros / fornecedores) da programação das obras (programacao.js), empresas sem contrato
// no Mais Controle (terceirizados.json) e alertas de contratação do Planejamento e da Operação. Prioridade = fim da obra mais perto.
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { programacoes } from '../programacao.js';
import { cronogramaDa } from '../telas/operacao.js';
import { avisoLeitura } from './comum.js';
import { FUNCOES } from '../funcoes.js';

const curto = (s, n = 150) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t; };
const tipoDe = (t) => (/aditivo/i.test(t) ? 'Aditivo' : /contrat|or[çc]ament|cota[çc]/i.test(t) ? 'Contratação' : /compra|pedido|entrega|chegar|material/i.test(t) ? 'Compra' : 'Fornecedor');
function situacaoDe(t) {
  if (/atras|vencid|sem avan|parad/i.test(t)) return ['critico', 'Atrasado'];
  if (/sem contrato/i.test(t)) return ['critico', 'Sem contrato'];
  if (/aguard|pendente|falta|em cima/i.test(t)) return ['atencao', 'Aguardando'];
  if (/pedido|contratad|fechad|aprovad/i.test(t)) return ['ok', 'Encaminhado'];
  return ['', 'Na semana'];
}

export function painel(ctx) {
  const CFG = ctx.CFG;
  const vis = (o) => !ctx.visiveis || ctx.visiveis.includes(o);
  const fimDe = (obra) => { const c = cronogramaDa(ctx.drive && ctx.drive.projetos, obra); return c.erro ? null : c.fimObra || null; };
  const itens = [];
  // 1) itens laranja da programação (esta semana e a próxima)
  for (const p of programacoes(CFG).filter((x) => vis(x.obra))) {
    const vistos = new Set();
    for (const s of p.semanas || []) {
      for (const x of (s.naSemana || []).filter((y) => y.tipo === 'laranja')) {
        const t = String(x.texto || x.item || '').trim(); if (!t || vistos.has(t)) continue; vistos.add(t);
        itens.push({ obra: p.obra, texto: t, origem: 'programação' });
      }
    }
  }
  // 2) empresas na obra sem contrato no Mais Controle
  for (const e of ((ctx.terceiros && ctx.terceiros.empresas) || []).filter((x) => x.contrato === false && vis(x.obra))) {
    itens.push({ obra: e.obra, texto: `${e.empresa}: sem contrato no Mais Controle${e.obs ? ` (${e.obs})` : ''}`, origem: 'Mais Controle' });
  }
  // 3) alertas de contratação dos agentes
  for (const id of ['planejamento', 'operacao']) {
    const a = CFG.areas.find((x) => x.id === id);
    for (const al of pd.alertasDoAgente(a, { veValores: ctx.veValores, obras: ctx.visiveis, limite: 50 }).filter((x) => /contrata[çc]|terceirizad|laranja|fornecedor|sem contrato/i.test(x.texto) && !/medi[çc][õo]es de contratos/i.test(x.texto))) {
      itens.push({ obra: al.obra || '', texto: al.texto, origem: 'agente', nivel: al.nivel, resp: al.resp });
    }
  }
  // prioridade: obra que termina antes primeiro; sem data de fim, no fim da lista
  const ordenados = itens.map((i) => ({ ...i, fim: i.obra ? fimDe(i.obra) : null }))
    .sort((a, b) => String(a.fim || '9999').localeCompare(String(b.fim || '9999')) || String(a.obra).localeCompare(String(b.obra)));
  const linhas = ordenados.map((i) => {
    const [nv, rot] = i.nivel === 'critico' ? ['critico', 'Crítico'] : situacaoDe(i.texto);
    return [
      i.obra ? pd.obraCel(i.obra, '', `#/obra/${encodeURIComponent(i.obra)}/programacao`) : '',
      curto(i.texto), tipoDe(i.texto), pd.selo(nv, rot),
      i.fim ? `Fim da obra ${i.fim.slice(0, 4) === ctx.hoje.slice(0, 4) ? pd.dm(i.fim) : pd.dma(i.fim)}${i.fim < ctx.hoje ? ' (prazo passou)' : ''}` : '',
    ];
  });

  return html`${pd.pergunta(ctx.dep.pergunta)}
    ${avisoLeitura(ctx, 'Programação e alertas lidos pelo agente em')}
    ${pd.secao('Terceirizados por obra: cinza e laranja', 'A planilha de acompanhamento de cada obra no sistema: item, escopo, orçado, prazos, data limite, quem está cotando, quem fechou e contrato · todos os gestores e estagiários de obra veem o status das suas obras', ctx.acompTerc ? html.seguro(ctx.acompTerc()) : '', { id: 'acompanhamento' })}
    ${pd.secao('Cards de orçamento terceirizado', ctx.obraSel ? `Só ${ctx.obraSel} · cada card é um item a contratar ou comprar, com o código e as tarefas dentro` : 'Cada card é um item a contratar ou comprar (ex.: louças e metais) ligado a uma obra: arraste para a coluna certa; as tarefas e as fotos ficam dentro do card', ctx.quadroTerc ? html.seguro(ctx.quadroTerc()) : '')}
    ${pd.secao('Tarefas por cargo', ctx.obraSel ? `Só ${ctx.obraSel} · abra o cargo para ver as tarefas dele` : 'Abra o cargo para ver as tarefas dele · o cargo é escolhido em cada tarefa', tarefasPorCargo(ctx))}
    ${pd.secao('Pendências de contratação', 'Quanto mais perto do fim da obra, maior a prioridade · itens laranja da programação, contratos no Mais Controle e alertas',
      pd.tabela(['Obra', 'Pendência', 'Tipo', 'Situação', 'Impacto'], linhas, { vazio: 'Nenhum item de terceiro ou fornecedor na programação das obras.' }))}
    ${pd.secao('Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir(ordenados.filter((i) => i.nivel === 'critico' || /sem contrato/i.test(i.texto)).map((i) => ({ nivel: 'critico', texto: `${i.obra ? `${i.obra}: ` : ''}${curto(i.texto, 200)}`, resp: i.resp || 'Júlia', obra: i.obra })), { setor: ctx.dep.setor }, { vazio: 'Nenhuma contratação crítica agora.' }))}`;
}

// Tarefas do departamento agrupadas por cargo: abrir o cargo mostra as tarefas dele (campo Cargo da tarefa)
export function tarefasPorCargo(ctx) {
  const SETOR = 'ORC Terceirizado Laranja';
  const nomes = Object.fromEntries(FUNCOES.map((f) => [f.id, f.nome]));
  const ts = (ctx.pendencias || []).filter((p) => p.status !== 'cancelada' && p.na_lista !== false && (p.setor === SETOR || /^TL-/.test(String(p.os || ''))) && (!ctx.obraSel || p.obra === ctx.obraSel));
  if (!ts.length) return html`<p class="pd-vazio">Nenhuma tarefa deste departamento ainda. Ao criar uma tarefa, escolha o cargo dela.</p>`;
  const grupos = new Map();
  for (const p of ts) { const k = p.cargo || ''; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(p); }
  const ordem = [...grupos.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : (nomes[a] || a).localeCompare(nomes[b] || b, 'pt-BR')));
  return html`${ordem.map((k) => {
    const l = grupos.get(k).sort((a, b) => String(a.prazo || '9').localeCompare(String(b.prazo || '9')));
    const ab = l.filter((p) => p.status === 'aberta').length;
    return html`<details class="caixa"><summary><span class="caixa-tit">${k ? (nomes[k] || k) : 'Sem cargo'}</span><span class="pequeno">${ab} em aberto · ${l.length} no total</span></summary>
      <div style="padding:6px 18px 12px">${pd.tabela(['Tarefa', 'Obra', 'Responsável', 'Executor', 'Prazo', 'Situação'], l.map((p) => [p.descricao, p.obra || '', p.responsavel_nome || '', p.executor || '', p.prazo && /^\d{4}/.test(p.prazo) ? pd.dma(p.prazo) : '', p.status === 'feita' ? 'feita' : 'aberta']), { vazio: '' })}</div></details>`;
  })}`;
}
