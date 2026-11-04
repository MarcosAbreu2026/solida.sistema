// Painel do Planejamento (desenho do Marcos, página 9). Contrato e ctx: ver comum.js.
// Pergunta: cada obra tem meta da semana, cronograma atualizado e o caminho crítico sob controle?
// Fontes: área planejamento do agente (porObra: cronograma e programação), programação por dia (programacao.js),
// produtividade relatada no WhatsApp (CFG.whats) e cronogramas lidos do Drive (telas/operacao.js).
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { somarDias, inicioDaSemana } from '../datas.js';
import { programacoes, feriado } from '../programacao.js';
import { cronogramaDa } from '../telas/operacao.js';
import { avisoLeitura } from './comum.js';

const norm = (s) => String(s || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const curto = (s, n = 60) => { const t = String(s || '').trim(); return t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t; };

// metas com quantidade dos dias já passados da semana × o que a obra relatou no WhatsApp
function aderencia(CFG, p, ini, hoje) {
  const dias = [0, 1, 2, 3, 4].map((i) => somarDias(ini, i)).filter((d) => d < hoje && !feriado(d));
  let total = 0; let feitas = 0; let comRegistro = 0;
  for (const d of dias) {
    const itens = ((p.dias.find((x) => x.data === d) || {}).itens || []).filter((it) => it.tipo !== 'laranja');
    const w = (CFG.whats || []).find((r) => r.obra === p.obra && r.data === d);
    for (const it of itens) {
      total++;
      const wi = w && (w.itens || []).find((x) => norm(x.item) === norm(it.item));
      if (!wi || wi.feito === undefined || wi.feito === null) continue;
      comRegistro++;
      if (it.meta == null ? wi.feito === true : Number(wi.feito) >= it.meta) feitas++;
    }
  }
  return { total, feitas, comRegistro };
}

export function painel(ctx) {
  const CFG = ctx.CFG; const hoje = ctx.hoje;
  const plan = CFG.areas.find((a) => a.id === 'planejamento') || {};
  const porObra = (plan.porObra || []).filter((o) => !ctx.visiveis || ctx.visiveis.includes(o.obra));
  const progs = programacoes(CFG).filter((p) => !ctx.visiveis || ctx.visiveis.includes(p.obra));
  // semana de referência: a atual; na segunda (nada passou ainda), a semana anterior
  let ini = inicioDaSemana(hoje);
  if (hoje <= ini) ini = somarDias(ini, -7);

  const comoNasce = html`<div class="pd-grade3">
    ${pd.caixa('Meta da semana', html`<p class="pd-c-sub" style="margin:0"><b>1 · Planejamento</b><br>Ex.: m² de contrapiso a executar na semana, por obra.</p>`)}
    ${pd.caixa('Programação diária', html`<p class="pd-c-sub" style="margin:0"><b>2 · Gestor de obra</b><br>Divide a meta por dia. Quinta, fim do dia, ou sexta de manhã.</p>`)}
    ${pd.caixa('Registro do dia', html`<p class="pd-c-sub" style="margin:0"><b>3 · Encarregado e estagiário</b><br>Lançam o executado no celular da obra.</p>`)}
  </div>`;

  // aderência à meta da semana
  const linhasAd = progs.map((p) => {
    const a = aderencia(CFG, p, ini, hoje);
    const cr = cronogramaDa(ctx.drive && ctx.drive.projetos, p.obra);
    const rev = !cr.erro && cr.arquivo ? ((String(cr.arquivo).match(/_R(\d+)/i) || [])[1] || '') : '';
    const pctA = a.total ? a.feitas / a.total : null;
    return [
      pd.obraCel(p.obra, '', `#/obra/${encodeURIComponent(p.obra)}`),
      a.total ? `${a.feitas} de ${a.total}${a.comRegistro < a.total ? ` (${a.total - a.comRegistro} sem registro)` : ''}` : (p.faseFinal ? 'fase final: pendências' : 'sem meta com quantidade'),
      pctA == null ? '' : pd.selo(pctA >= 0.9 ? 'ok' : pctA >= 0.5 ? 'atencao' : 'critico', `${Math.round(pctA * 100)}%`),
      rev ? `R${rev}` : '',
    ];
  });

  // caminho crítico: atividade atrasada mais antiga do cronograma do Drive; sem cronograma, o que o agente escreveu
  const linhasCC = porObra.map((o) => {
    const cr = cronogramaDa(ctx.drive && ctx.drive.projetos, o.obra);
    const atras = cr.erro ? [] : cr.ativ.filter((x) => x.atrasada).sort((a, b) => String(a.fim).localeCompare(String(b.fim)));
    const textoCC = [...((o.cronograma || {}).estaSemana || [])].map((t) => (typeof t === 'string' ? t : t && t.texto)).find((t) => /caminho cr[íi]tico/i.test(t || ''));
    if (atras.length) {
      const a = atras[0];
      return [pd.obraCel(o.obra, '', `#/obra/${encodeURIComponent(o.obra)}/cronograma`), `${a.nome}${a.fim ? `, fim previsto ${pd.dm(a.fim)}` : ''}`, `${atras.length} ${atras.length === 1 ? 'atividade atrasada' : 'atividades atrasadas'} no cronograma`, ''];
    }
    if (textoCC) return [pd.obraCel(o.obra), curto(textoCC, 110), '', ''];
    return null;
  }).filter(Boolean);

  // cronogramas e programações em dia
  const linhasDia = porObra.map((o) => {
    const c = o.cronograma || {}; const g = o.programacao || {};
    const sel = (x) => pd.selo(x.ok === true ? 'ok' : x.ok === false ? 'critico' : '', curto(String(x.info || '').split(' · ')[0], 34) || (x.ok === true ? 'em dia' : x.ok === false ? 'pendente' : '—'));
    const pend = /pend[êe]ncias/i.test(`${g.info || ''} ${c.info || ''}`) ? (curto((String(c.obs || g.obs || '').match(/\d+\s+pend[êe]ncias[^.]*/i) || [''])[0], 80) || 'fase final: lista de pendências') : '';
    return [pd.obraCel(o.obra, '', `#/obra/${encodeURIComponent(o.obra)}/programacao`), sel(c), sel(g), pend];
  });

  const sem = plan.semanas || {};
  return html`${pd.pergunta(ctx.dep.pergunta)}
    ${avisoLeitura(ctx, 'Planejamento lido pelo agente em')}
    ${pd.secao('Como a meta nasce', 'Quem faz cada passo', comoNasce)}
    ${pd.secao('Aderência à meta da semana', `Semana de ${pd.dm(ini)} a ${pd.dm(somarDias(ini, 4))} · metas com quantidade da programação × produtividade relatada no grupo`,
      pd.tabela(['Obra', 'Metas concluídas', 'Aderência', 'Cronograma'], linhasAd, { vazio: 'Nenhuma obra com programação.' }))}
    ${pd.secao('Caminho crítico por obra', 'Fonte: cronogramas do Drive (atividade atrasada mais antiga) e o que o agente marcou como caminho crítico',
      pd.tabela(['Obra', 'Item crítico', 'Impacto', 'Responsável'], linhasCC, { vazio: 'Nenhuma atividade atrasada nos cronogramas lidos.' }))}
    ${pd.secao('Cronogramas e programações em dia', sem.atual ? `Semana atual do agente: ${sem.atual}` : 'Fonte: agente de Planejamento',
      pd.tabela(['Obra', 'Cronograma', 'Programação semanal', 'Pendências'], linhasDia, { vazio: 'Nenhuma obra no planejamento.' }))}
    ${pd.secao('Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir(pd.alertasDoAgente(ctx.area, { veValores: ctx.veValores, obras: ctx.visiveis }), { setor: ctx.dep.setor }))}`;
}
