// Página da obra: programação de HOJE, da SEMANA (por dia), FASES da semana e MATERIAIS a garantir.
// Fonte: planilha da programação semanal (GERENCIAMENTO\PROGRAMAÇÃO SEMANAL\<obra>_PROGRAMAÇÃO SEMANAL_S<nn>.xlsx), lida por scripts/exportar-drive.ps1
// em projetos.json › obras[].programacao.planilha.linhas { data, fase, cod, tarefa, qtd, un, local, funcionario }; e o cronograma (linhas COMPRA / ENTREGA).
// A programação semanal NÃO traz lista de materiais: os materiais vêm (1) das linhas de compra/entrega do cronograma, com a data prevista, e
// (2) de uma lista de materiais TÍPICOS de cada fase (sugestão, sem quantidade) para a Compras antecipar. Nunca inventamos quantidade.
import { html } from '../formato.js';
import * as pd from './painel-dep.js';
import { somarDias, inicioDaSemana } from '../datas.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const cap = (s) => String(s || '').toLowerCase().replace(/(^|[\s(/-])\S/g, (c) => c.toUpperCase());
const qtd = (n) => (typeof n === 'number' ? n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '');
const NOME_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const diaDe = (iso) => `${NOME_DIA[new Date(`${iso}T12:00:00Z`).getUTCDay()]} ${pd.dm(iso)}`;
const JANELA_COMPRAS = 21;   // dias à frente em que as compras/entregas do cronograma entram na lista

// materiais típicos por tipo de serviço (palavras da fase + tarefa) — sugestão para antecipar a compra, sem quantidade
// terceiro item true = regra exclusiva (se casar, as demais não entram): "revestimento Santa Sofia em forro de drywall" é forro, não piso
const MATERIAIS = [
  [/marcenaria|bancada|painel de madeira/, ['peça de marcenaria / bancada (confirmar entrega da fábrica)'], true],
  [/gesso|forro|drywall|sanca/, ['placas de gesso / drywall', 'perfis e parafusos', 'massa para gesso'], true],
  [/porta|ferragem|esquadria|alisar/, ['portas e ferragens'], true],
  [/limpeza/, ['material de limpeza', 'sacos de entulho'], true], [/demoli|entulho|cacamba/, ['caçamba'], true], [/louca|metais|metal/, ['louças e metais'], true],
  [/massa corrida|lixar massa/, ['massa corrida', 'lixa']], [/lixar e selar|selar|selador/, ['selador', 'lixa']],
  [/pintura/, ['tinta', 'fita crepe', 'rolo e pincel', 'lona']], [/porcelanato|ceramica|revestimento|azulejo|piso|travertino|pastilha/, ['revestimento (confirmar entrega)', 'argamassa colante', 'rejunte', 'espaçadores']],
  [/contrapiso|regulariza/, ['cimento', 'areia']], [/alvenaria|tijolo|bloco/, ['tijolo / bloco', 'cimento', 'areia']],
  [/reboco|emboco|arremate/, ['cimento', 'areia', 'cal']], [/imperm/, ['impermeabilizante / manta']],
  [/conduite|caixinha|valas?/, ['eletrodutos', 'caixinhas']], [/fiacao|fio |cabos?/, ['fios e cabos']], [/tomada|interruptor|acabamentos? eletric/, ['tomadas e interruptores (módulos e placas)']],
  [/luminaria|iluminacao|spot|\bled\b/, ['luminárias e lâmpadas']], [/quadro eletrico|disjuntor/, ['quadro e disjuntores']],
  [/hidraulic|tubulacao|esgoto|registro|\bhep\b|\bhid\b/, ['tubos e conexões', 'registros']], [/ar.?condicionado|\bac\b|dreno/, ['tubulação e dutos do ar-condicionado']],
  [/rodape/, ['rodapé', 'cola']],
];
const materiaisDe = (fase, tarefa) => {
  const t = norm(`${fase} ${tarefa}`);
  const excl = MATERIAIS.find(([re, , ex]) => ex && re.test(t));
  if (excl) return excl[1];
  return [...new Set(MATERIAIS.filter(([re, , ex]) => !ex && re.test(t)).flatMap(([, m]) => m))];
};

const linhasDaObra = (p) => ((p && p.programacao && p.programacao.planilha && p.programacao.planilha.linhas) || []).filter((l) => l && l.tarefa);

// o que a obra tem de programação: semana atual, próxima e a situação do arquivo
export function programacaoDaObra(p, hoje) {
  const prog = p && p.programacao;
  const planilha = prog && prog.planilha;
  const linhas = linhasDaObra(p).filter((l) => l.data);
  const semSemana = linhasDaObra(p).filter((l) => !l.data);   // tarefas de preparação sem dia (ex.: "levantar material para alvenaria")
  const ini = inicioDaSemana(hoje); const prox = somarDias(ini, 7);
  const daSemana = (s) => linhas.filter((l) => l.data >= s && l.data <= somarDias(s, 6));
  const ultima = linhas.reduce((m, l) => (l.data > m ? l.data : m), '');
  const emFase = !!prog && prog.tipo === 'pendencias';
  return {
    planilha, emFase, arquivo: planilha && planilha.arquivo, semana: planilha && planilha.semana, ultima, semSemana,
    hoje: linhas.filter((l) => l.data === hoje), atual: daSemana(ini), proxima: daSemana(prox), ini, prox,
    vencida: !!ultima && ultima < ini,   // a última programação publicada já é de semana passada
  };
}

// compras/entregas do cronograma entre hoje-7 e hoje+21 dias
export function comprasDoCronograma(p, hoje) {
  const ativ = ((p && p.cronograma && p.cronograma.atividades) || []);
  return ativ.filter((a) => a.inicio && /^(compra|entrega|or[çc]amento)\b/i.test(a.nome) && a.inicio >= somarDias(hoje, -7) && a.inicio <= somarDias(hoje, JANELA_COMPRAS))
    .map((a) => ({ data: a.inicio, tipo: cap(String(a.nome).split(/\s*[-–(]/)[0].trim()), item: String(a.nome).replace(/^(compra|entrega|or[çc]amento)\s*[-–]?\s*/i, '').replace(/\s*\(.*\)\s*$/, '').trim() || a.nome, fase: String(a.grupoNome || a.grupo || '').replace(/^T\d+\s*-\s*/, '') }))
    .sort((a, b) => a.data.localeCompare(b.data) || a.fase.localeCompare(b.fase));
}

const tabelaTarefas = (linhas) => pd.tabela(['Fase', 'Código', 'Tarefa', 'Quantidade', 'Local', 'Quem'], linhas.map((l) => [
  cap(l.fase), l.cod || '—', cap(l.tarefa), l.qtd != null ? `${qtd(l.qtd)} ${l.un || ''}`.trim() : '—', l.local || '—', cap(l.funcionario) || '—',
]), { vazio: 'Nenhuma tarefa.' });

function fasesDaSemana(linhas) {
  const m = new Map();
  for (const l of linhas) {
    const k = norm(l.fase) || 'sem fase';
    if (!m.has(k)) m.set(k, { fase: l.fase || 'Sem fase', tarefas: new Map(), dias: new Set(), quem: new Set(), mats: new Set() });
    const g = m.get(k);
    const t = norm(l.tarefa); const ja = g.tarefas.get(t) || { tarefa: l.tarefa, qtd: 0, un: l.un, tem: false };
    if (typeof l.qtd === 'number' && (!ja.un || ja.un === l.un)) { ja.qtd += l.qtd; ja.tem = true; }
    g.tarefas.set(t, ja); g.dias.add(l.data); if (l.funcionario) g.quem.add(cap(l.funcionario));
    materiaisDe(l.fase, l.tarefa).forEach((x) => g.mats.add(x));
  }
  return [...m.values()];
}

// situação da obra no cadastro (andamento · pausada · finalizada); sem cadastro: ''
const situacaoDaObra = (ctx, cod) => {
  const cad = Array.isArray(ctx.obrasCad) ? ctx.obrasCad : [];
  const r = cad.find((x) => x.codigo === cod) || cad.find((x) => cod.startsWith(x.codigo) || x.codigo.startsWith(cod));
  return r ? r.situacao : '';
};
// obra em fase de pendências (sem meta por dia): o PDF é de pendências, ou as metas semanais lidas pelo agente são do tipo "pendencias"
const emFasePendencias = (ctx, cod, p) => {
  if (p && p.programacao && p.programacao.tipo === 'pendencias') return true;
  const sem = ((ctx.CFG && ctx.CFG.metasSemanais && ctx.CFG.metasSemanais.semanas) || []).slice(-1)[0];
  return !!sem && (sem.obras || []).some((o) => o.obra === cod && o.tipo === 'pendencias');
};

// ---- as três seções. completo = true na aba Programação semanal (traz o dia a dia da semana inteira)
export function secoes(ctx, p, cod, { completo = false } = {}) {
  const hoje = ctx.hoje;
  const pr = programacaoDaObra(p, hoje);
  const aviso = (t, nivel = 'atencao') => html`${pd.aviso(t, nivel)}`;
  const sit = situacaoDaObra(ctx, cod);
  if (sit === 'pausada') return aviso(`${cod} está pausada no Cadastros: sem programação semanal até a obra ser retomada. Quando voltar, a programação da semana aparece aqui.`, 'info');
  if (sit === 'finalizada') return aviso(`${cod} está finalizada no Cadastros: sem programação semanal.`, 'info');
  if (pr.emFase || emFasePendencias(ctx, cod, p)) return aviso('Obra na fase de pendências: não tem programação semanal por dia. O trabalho é pela lista de pendências de obra (aba Pendências), com responsável e prazo de cada uma.', 'info');
  if (!pr.planilha) return aviso(`Sem planilha de programação semanal na pasta da obra (GERENCIAMENTO › PROGRAMAÇÃO SEMANAL). ${cod} só aparece aqui quando a planilha da semana for salva lá.`);
  if (pr.planilha.erro) return aviso(`Não consegui ler a planilha ${pr.arquivo}: ${pr.planilha.erro}`);
  const blocos = [];
  const semProg = !pr.atual.length && !pr.proxima.length;   // a planilha da pasta não cobre esta semana nem a próxima
  if (semProg) blocos.push(pd.aviso(pr.vencida ? `A última programação publicada (${pr.semana}, ${pr.arquivo}) é de semana passada (até ${pd.dma(pr.ultima)}). A da semana de ${pd.dma(pr.ini)} ainda não está na pasta: pedir ao gestor.` : `A programação ${pr.semana} (${pr.arquivo}) não tem tarefas com data nesta semana.`, 'atencao'));
  else if (!pr.atual.length) blocos.push(pd.aviso(`Ainda não há programação para a semana corrente; a publicada (${pr.semana}) é da semana de ${pd.dma(pr.prox)}.`, 'info'));
  else if (!pr.proxima.length) blocos.push(pd.aviso(`A programação da semana de ${pd.dma(pr.prox)} ainda não está na pasta${hoje >= somarDias(pr.ini, 3) ? ' (o prazo é quinta ou sexta de manhã)' : ''}.`, 'info'));

  const fasesAtual = fasesDaSemana(pr.atual.length ? pr.atual : pr.proxima);
  if (!semProg) {
    // hoje
    const hojeTab = pr.hoje.length ? tabelaTarefas(pr.hoje) : html`<div class="pd-tab-caixa"><p class="pd-vazio">Nenhuma tarefa programada para hoje (${pd.dma(hoje)}).</p></div>`;
    blocos.push(pd.secao(`Programação de hoje · ${diaDe(hoje)}`, `${pr.semana} · ${pr.arquivo}`, hojeTab));
    // fases da semana (a corrente; se ainda não há, a próxima)
    const rotFases = pr.atual.length ? `Semana de ${pd.dma(pr.ini)}` : `Semana de ${pd.dma(pr.prox)}`;
    const linhasFase = fasesAtual.map((g) => [
      html`<b>${cap(g.fase)}</b>`,
      html`${[...g.tarefas.values()].map((t) => html`<span class="pd-obra-sub">${cap(t.tarefa)}${t.tem ? ` · ${qtd(t.qtd)} ${t.un || ''}` : ''}</span>`)}`,
      [...g.dias].filter(Boolean).sort().map((d) => `${NOME_DIA[new Date(`${d}T12:00:00Z`).getUTCDay()].slice(0, 3)} ${pd.dm(d)}`).join(', '),
      [...g.quem].join(', ') || '—',
    ]);
    blocos.push(pd.secao(`Fases da semana · ${rotFases}`, 'O que vai acontecer na obra, para a Compras e o gestor antecipar · quantidade = soma das linhas de cada dia da programação', pd.tabela(['Fase', 'Tarefas e quantidades', 'Dias', 'Quem'], linhasFase, { vazio: 'Sem fases programadas.' })));
    // dia a dia (aba Programação semanal): uma caixa por dia
    if (completo) {
      const diaADia = (linhas) => html`${[...new Set(linhas.map((l) => l.data))].sort().map((d) => pd.caixa(`${diaDe(d)}${d === hoje ? ' · hoje' : ''}`, tabelaTarefas(linhas.filter((l) => l.data === d))))}`;
      if (pr.atual.length) blocos.push(pd.secao(`Esta semana, dia a dia · ${pd.dma(pr.ini)} a ${pd.dma(somarDias(pr.ini, 4))}`, `${pr.semana} · ${pr.arquivo}`, diaADia(pr.atual)));
      if (pr.proxima.length) blocos.push(pd.secao(`Próxima semana, dia a dia · ${pd.dma(pr.prox)} a ${pd.dma(somarDias(pr.prox, 4))}`, `${pr.semana} · ${pr.arquivo}`, diaADia(pr.proxima)));
    }
  }

  // materiais: compras e entregas do cronograma (sempre) + materiais típicos das fases da semana (só com programação)
  const compras = comprasDoCronograma(p, hoje);
  const comprasTab = compras.length ? pd.tabela(['Data prevista', 'O quê', 'Item', 'Fase'], compras.map((c) => [
    html`${pd.dma(c.data)}${c.data < hoje ? html`<span class="pd-obra-sub pd-cr">data já passou: conferir se foi feito</span>` : ''}`, c.tipo, c.item, cap(c.fase) || '—',
  ])) : html`<div class="pd-tab-caixa"><p class="pd-vazio">Nenhuma compra ou entrega com data nas próximas 3 semanas no cronograma.</p></div>`;
  blocos.push(pd.secao('Materiais a garantir', `Compras e entregas do cronograma (de 7 dias atrás a ${JANELA_COMPRAS} dias à frente)`, comprasTab));
  const tipicos = fasesAtual.filter((g) => g.mats.size).map((g) => [html`<b>${cap(g.fase)}</b>`, [...g.mats].join(' · ')]);
  if (tipicos.length) {
    blocos.push(pd.caixa('Materiais típicos das fases da semana', html`${pd.tabela(['Fase', 'Materiais que costumam ser usados'], tipicos)}
      <p class="pequeno" style="margin-top:8px">Sugestão para a Compras conferir o estoque e antecipar; não é a lista de compra e não traz quantidade. A programação semanal não informa materiais.</p>`, { direita: 'sugestão' }));
  }
  if (pr.semSemana.length && completo) blocos.push(pd.caixa('Preparação sem dia definido', pd.itens(pr.semSemana.map((l) => `${cap(l.tarefa)}${l.funcionario ? ` (${cap(l.funcionario)})` : ''}`))));
  return html`${blocos}`;
}
