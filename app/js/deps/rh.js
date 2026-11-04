// RH e DP (Leandro), desenho do Marcos pág. 18: faltas, atrasos, horas extras, férias e o efetivo do dia.
// Efetivo: lido dos grupos de WhatsApp das obras (ctx.efetivo, telas/efetivo.js). Faltas/horas extras: Sólides, ainda não lido
// (precisa de login) — traço. Férias: indicadores do agente de RH.
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { areaDeHoje, cartoes as cartoesEfetivo } from '../telas/efetivo.js';
import { cartaoDoAgente } from './comum.js';

export function painel(ctx) {
  const hoje = areaDeHoje(ctx.area || {}, ctx.CFG, ctx.efetivo, ctx.visiveis);
  const k = (re, opts) => cartaoDoAgente(hoje, re, opts);
  const semSolides = 'Sólides ainda não é lido pelo sistema (precisa de login)';
  return html`${pd.pergunta(ctx.dep.pergunta)}
    ${pd.secao('Faltas, atrasos e horas extras', 'Último mês, mês atual e acumulado do ano, com as justificativas · fonte: Sólides',
      pd.tabela(['Funcionário', 'Faltas no mês', 'Atrasos no mês', 'Horas extras no mês', 'Acumulado no ano', 'Justificativas'], [], { vazio: semSolides }))}
    ${pd.secao('Controle de férias', 'Planilha de férias: períodos aquisitivos e concessivos', pd.cartoes([
      cartaoDoAgente(ctx.area, /^f[ée]rias$/i, { rotulo: 'De férias agora' }),
      cartaoDoAgente(ctx.area, /f[ée]rias vencidas/i, { rotulo: 'Férias vencidas', meta: 'Meta 0', nivel: (n) => (n > 0 ? 'critico' : 'ok') }),
      { rotulo: 'A vencer nos próximos 60 dias', valor: '—', sub: 'planilha de férias ainda não lida' },
    ], { colunas: 3 }))}
    ${pd.secao('Efetivo do dia', 'Fonte: grupos azuis das obras (leitura automática do WhatsApp)', pd.cartoes([
      k(/efetivo enviado/i, { rotulo: 'Obras com efetivo enviado' }),
      k(/equipe s[óo]lida/i, { rotulo: 'Equipe Sólida em obra hoje' }),
      k(/terceirizados/i, { rotulo: 'Terceirizados em obra hoje' }),
      k(/sem local/i, { rotulo: 'Funcionários sem local' }),
    ]))}
    <div class="pd-legado">${cartoesEfetivo(ctx.CFG, ctx.efetivo, ctx.visiveis)}</div>
    ${pd.secao('Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir(pd.alertasDoAgente(hoje, { veValores: ctx.veValores, obras: ctx.visiveis }), { setor: ctx.dep.setor }))}`;
}
