// Operações (desenho do Marcos, página 4). Contrato e ctx: ver comum.js.
// Abas: Painel (resumo, cronograma geral, hoje por obra, efetivo, quem agir, terceirizados) · Dia a dia · Funcionários (semana passada + alocação) · Pendências.
// · Quem precisa agir · Terceirizados × contratos no Mais Controle.
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { avisoLeitura } from './comum.js';
import * as oc from './obras-comum.js';
import { programadorDoCtx } from '../programar-dia.js';
import { somarDias, inicioDaSemana } from '../datas.js';
import * as opSemana from '../op-semana-passada.js';
import * as ent from './entregaveis.js';

const semanasEntre = (de, ate) => (de && ate ? Math.max(0, Math.ceil((new Date(ate) - new Date(de)) / (7 * 86400000))) : null);

export function painel(ctx) {
  const obras = oc.obrasDoPainel(ctx);
  const area = ctx.area || {};
  const leitura = ctx.CFG && ctx.CFG.atualizadoEm ? pd.dm(String(ctx.CFG.atualizadoEm).slice(0, 10)) : '—';
  const dados = obras.map((o) => ({ o, cr: oc.cronograma(ctx, o.obra), ad: oc.aderenciaSemana(ctx, o.obra) }));

  // ---- resumo
  const ads = dados.filter((d) => d.ad);
  const adMin = ads.length ? Math.min(...ads.map((d) => d.ad.valor)) : null; const adMax = ads.length ? Math.max(...ads.map((d) => d.ad.valor)) : null;
  const diaEf = ctx.efetivo && ctx.efetivo.dias && ctx.efetivo.dias[ctx.hoje] ? ctx.hoje : oc.diaUtil(ctx.hoje, -1);
  const comEf = obras.filter((o) => oc.efetivo(ctx, diaEf, o.obra).enviado);
  const temEf = !!(ctx.efetivo && ctx.efetivo.dias && Object.keys(ctx.efetivo.dias).length);
  const resumo = pd.cartoes([
    { rotulo: 'Obras em curso', valor: String(obras.length), sub: obras.map((o) => o.obra).join(', ') },
    { rotulo: 'Aderência à meta da semana', valor: ads.length ? (adMin === adMax ? pd.pct(adMin) : `${pd.pct(adMin)} a ${pd.pct(adMax)}`) : '—',
      sub: ads.length ? ads.map((d) => `${d.o.obra} ${pd.pct(d.ad.valor)}`).join(' · ') : 'Sem produtividade relatada na semana (grupos das obras / celular da obra)',
      nivel: adMin == null ? '' : adMin >= 0.9 ? 'ok' : adMin >= 0.6 ? 'atencao' : 'critico' },
    { rotulo: 'Efetivo enviado', valor: temEf ? pd.pct(comEf.length / (obras.length || 1)) : '—', sub: temEf ? `${comEf.length} de ${obras.length} obras · ${pd.dm(diaEf)}` : 'Efetivo dos grupos ainda não lido', meta: 'Efetivo enviado até 12h' },
    { rotulo: 'Desvio sobre o contrato', valor: '—', sub: 'Precisa do término contratual de cada obra (o cronograma do Drive só traz a previsão atual)' },
  ]);

  // ---- cronograma geral
  const cronLinhas = dados.map(({ o, cr }) => {
    const sit = String((o.cronograma || {}).obs || (o.cronograma || {}).info || '').split(/\.\s/)[0];
    if (cr.erro) return [pd.obraCel(o.obra, '', `#/obra/${encodeURIComponent(o.obra)}`), '', '', '', '', '', '', sit || cr.erro];
    return [pd.obraCel(o.obra, '', `#/obra/${encodeURIComponent(o.obra)}`), pd.dma(cr.inicioObra), pd.traco(), pd.dma(cr.fimObra), pd.traco(),
      cr.fimObra && cr.fimObra >= ctx.hoje ? String(semanasEntre(ctx.hoje, cr.fimObra)) : cr.fimObra ? pd.selo('critico', 'vencida') : '',
      pd.pct(cr.exe), sit];
  });

  // ---- hoje por obra
  const hojeLinhas = obras.map((o) => {
    const e = oc.efetivo(ctx, ctx.hoje, o.obra);
    const equipe = e.enviado ? `${e.solida} da Sólida${e.nomes.length ? ` (${e.nomes.slice(0, 5).join(', ')}${e.nomes.length > 5 ? '…' : ''})` : ''}${e.terceiros ? ` e ${e.terceiros} terceirizados` : ''}${e.hora ? ` · ${e.hora}` : ''}` : '';
    const meta = oc.itensDoDia(ctx, o.obra, ctx.hoje).itens.filter((i) => i.item).slice(0, 3).map((i) => `${i.item}${i.meta != null ? `: ${i.meta.toLocaleString('pt-BR')} ${i.unidade}` : ''}`);
    const atras = oc.lista((o.cronograma || {}).estaSemana).map((t) => (typeof t === 'string' ? t : t && t.texto)).find((t) => /atras/i.test(t || ''));
    const al = oc.alertasDaObra(ctx, o.obra)[0];
    return [pd.obraCel(o.obra, '', `#/obra/${encodeURIComponent(o.obra)}`),
      equipe || html`<span class="pd-def">${oc.efetivoLidoHoje(ctx, o.obra) ? 'efetivo não enviado hoje' : '[efetivo do grupo ainda não lido hoje]'}</span>`,
      meta.length ? pd.itens(meta) : html`<span class="pd-def">[programação semanal]</span>`,
      atras || (al ? al.texto : '')];
  });

  // ---- efetivo real × planejado (semana)
  const ini = inicioDaSemana(ctx.hoje);
  const dias = [0, 1, 2, 3, 4].map((i) => somarDias(ini, i)).filter((d) => d <= ctx.hoje);
  const efLinhas = obras.map((o) => {
    const reg = dias.map((d) => oc.efetivo(ctx, d, o.obra)).filter((x) => x.enviado);
    const media = reg.length ? Math.round(reg.reduce((s, x) => s + x.total, 0) / reg.length) : null;
    const terc = reg.length ? Math.max(...reg.map((x) => x.terceiros)) : null;
    return [pd.obraCel(o.obra), media == null ? pd.selo('', 'sem envio') : pd.selo(reg.length === dias.length ? 'ok' : 'atencao', `${media} / —`),
      terc == null ? '' : String(terc), reg.length ? `${reg.length} de ${dias.length} dias com efetivo` : 'Sem efetivo no grupo nesta semana'];
  });

  // ---- quem precisa agir: alertas do agente + obras com atividades vencidas no cronograma
  const agir = [...pd.alertasDoAgente(area, { veValores: ctx.veValores, obras: ctx.visiveis, limite: 10 }),
    ...dados.filter((d) => !d.cr.erro && d.cr.ativ.filter((a) => a.atrasada).length >= 10).map((d) => ({ nivel: 'atencao', obra: d.o.obra,
      texto: `${d.o.obra}: ${d.cr.ativ.filter((a) => a.atrasada).length} atividades com fim vencido no cronograma ${oc.revisao(d.cr.arquivo)}.` }))].slice(0, 10);

  // ---- terceirizados × contratos
  const emps = oc.lista(ctx.terceiros && ctx.terceiros.empresas).filter((t) => !ctx.visiveis || ctx.visiveis.some((v) => oc.mesmaObra(v, t.obra)));
  const porObra = new Map();
  for (const t of emps) { const k = `${t.obra}|${t.contrato === false ? 'sem' : t.medicao === false ? 'semmed' : 'ok'}`; (porObra.get(k) || porObra.set(k, []).get(k)).push(t.empresa); }
  const tercLinhas = [...porObra.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, l]) => {
    const [obra, s] = k.split('|');
    return [pd.obraCel(obra), l.join(', '), s === 'sem' ? pd.selo('critico', 'Sem contrato no Mais Controle') : s === 'semmed' ? pd.selo('atencao', 'Contrato sem medição') : pd.selo('ok', 'Contrato e medição em dia')];
  });

  const cab = html`${pd.pergunta(ctx.dep.pergunta)}
    ${avisoLeitura(ctx, 'Base: leitura dos agentes')}`;
  const aba = ctx.abaOp || '';
  // ---- aba Dia a dia
  if (aba === 'dia') {
    return html`${cab}
    ${pd.secao('Dia a dia das obras', 'Dia útil anterior (marque feito ou não feito), hoje e os dois próximos dias úteis: quem está em cada obra e a meta do dia · feriado e fim de semana não entram (a Mo602 funciona todos os dias)', ctx.diaFocoOp ? html.seguro(ctx.diaFocoOp({ obras: ctx.obrasAndamento && ctx.obrasAndamento.length ? ctx.obrasAndamento : obras.map((o) => o.obra), itensDoDia: (cod, d) => oc.itensDoDia(ctx, cod, d).itens, semProgramacao: (cod) => !oc.progDa(ctx, cod), programar: programadorDoCtx(ctx) })) : '')}`;
  }
  // ---- aba Funcionários: alocação (semana escolhida) e distribuição da semana passada
  if (aba === 'funcionarios') {
    const passada = somarDias(inicioDaSemana(ctx.hoje), -7);
    return html`${cab}
    ${pd.secao('Distribuição da semana passada', 'Quem esteve em qual obra em cada dia: efetivo real dos grupos de WhatsApp; onde o grupo não enviou, vale a alocação/programação · mais os funcionários em férias', opSemana.render({ ctx, semanaIni: passada, alocLinhas: (ctx.alocSemanaPassada && ctx.alocSemanaPassada(passada)) || [], ferias: ctx.ferias || [], hoje: ctx.hoje }))}
    ${pd.secao('Alocação das obras em andamento', 'Arraste o funcionário para a obra e o dia (semana atual, próximas e anteriores) · a outra aba mostra onde cada funcionário está na semana, com uma cor por função · quem está de férias aparece marcado e não pode ser alocado', ctx.quadroAloc ? html.seguro(ctx.quadroAloc()) : '')}`;
  }
  // ---- aba Pendências
  if (aba === 'pendencias') {
    return html`${cab}
    ${pd.secao('Pendências do departamento', 'Resumo das pendências da Operação: o que está atrasado, o que vence na semana e quem está com cada uma', ctx.pendenciasDep ? html.seguro(ctx.pendenciasDep(ctx.dep.setor)) : '')}
    ${pd.secao('Quem precisa agir', 'Alerta clicado vira tarefa com responsável e data-limite', pd.quemAgir(agir, { setor: 'Operação' }))}`;
  }
  // ---- aba Painel (a página de abertura)
  return html`${cab}
    ${pd.secao('Cronograma geral de obras', 'Obras em andamento nos próximos 4 meses, semana a semana · pós-obras com mais de 4 semanas · orçamentos que acreditamos fechar', ctx.cronogramaGeral ? html.seguro(ctx.cronogramaGeral()) : '', { id: 'cronograma-geral' })}
    ${pd.secao('Quadro de entregáveis', `Documentação obrigatória do gestor de obra, por obra · ${ent.LEGENDA}`, ent.quadro(ctx, ctx.obrasAndamento && ctx.obrasAndamento.length ? ctx.obrasAndamento : obras.map((o) => o.obra), { eventos: ctx.evidenciasLista ? ctx.evidenciasLista() : null, atas: ctx.atasLista ? ctx.atasLista() : null }), { id: 'entregaveis' })}
    ${pd.secao('Resumo das obras', `Fonte: planejamento e grupos das obras · leitura ${leitura}`, resumo)}
    ${pd.secao('Datas dos cronogramas no Drive', 'Fonte: cronogramas no Drive (GERENCIAMENTO › CRONOGRAMA)', pd.tabela(['Obra', 'Início', 'Término contratual', 'Previsão atual', 'Desvio × contrato', 'Semanas até a previsão', 'Avanço médio', 'Situação'], cronLinhas))}
    ${pd.secao('Hoje por obra: equipe, meta e pendência maior', 'Equipe: efetivo do grupo da obra · meta do dia: programação semanal', pd.tabela(['Obra', 'Equipe de hoje', 'Meta do dia (foco)', 'Pendência maior'], hojeLinhas))}
    ${pd.secao('Efetivo real × planejado (semana)', 'Real: efetivo dos grupos (média por dia) · planejado: sai da distribuição de equipe (DIST), ainda não lida pelo sistema', pd.tabela(['Obra', 'Real / planejado', 'Terceirizados', 'Leitura'], efLinhas))}
    ${pd.secao('Quem precisa agir', 'Alerta clicado vira tarefa com responsável e data-limite', pd.quemAgir(agir, { setor: 'Operação' }))}
    ${pd.secao('Terceirizados × contratos no Mais Controle', ctx.terceiros && ctx.terceiros.verificadoEm ? `Leitura de ${pd.dm(String(ctx.terceiros.verificadoEm).slice(0, 10))}` : 'Agente de Operação (Mais Controle)', pd.tabela(['Obra', 'Empresa', 'Situação'], tercLinhas, { vazio: 'O agente de Operação ainda não mandou a conferência dos contratos (terceirizados.json).' }))}`;
}
