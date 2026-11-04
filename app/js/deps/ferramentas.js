// Ferramentas e EPI (Paiva · Anderson), desenho do Marcos pág. 16: estoque do galpão e checklists de ferramentas por obra e veículo.
// Fontes: planilha SL_FERRAMENTAS (ctx.drive.estoque) e as fotos da planilha de ferramentas obrigatórias no grupo do WhatsApp
// (ctx.ferrChk; ciclo de 14 dias, vence na quarta da primeira semana — o sistema nunca diz "não enviada" sem ter lido o grupo).
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { locaisDoChecklist, inicioDoCiclo, CICLO_DIAS } from '../telas/ferramentas-checklist.js';
import { somarDias } from '../datas.js';
import { ultimaSexta } from './comum.js';

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const chave = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^carro\s+(do|da|de)?\s*/, 'carro ').replace(/\s+/g, ' ').trim();
const DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const diaBR = (iso) => `${DIA[new Date(`${iso}T12:00:00`).getDay()]}, ${pd.dm(iso)}`;

export function painel(ctx) {
  const est = ctx.drive && ctx.drive.estoque;
  const itens = (est && est.itens) || [];
  const gal = (i) => (i.locais && i.locais.galpao) || {};
  const tem = itens.filter((i) => n(gal(i).atual) > 0);
  const unidades = tem.reduce((s, i) => s + gal(i).atual, 0);
  const abaixo = itens.filter((i) => !i.consulta && n(gal(i).min) > 0 && (n(gal(i).atual) ?? 0) < gal(i).min).length;
  const quebradas = itens.reduce((s, i) => s + (n(i.quebrada) || 0), 0);
  const mod = est && est.modificado ? String(est.modificado).slice(0, 10) : '';
  const sexta = ultimaSexta(ctx.hoje);
  const mestreOk = mod ? mod >= sexta : null;

  // checklists: situação do ciclo de 14 dias de cada local
  const dados = ctx.ferrChk || { registros: [] };
  const regs = (dados.registros || []).filter((r) => r && r.local && /^\d{4}-\d{2}-\d{2}$/.test(String(r.enviadoEm || '')));
  const lido = String(dados.verificadoEm || '').slice(0, 10);
  const ini = inicioDoCiclo(ctx.hoje, dados.inicio || '2026-10-12');
  const quarta = somarDias(ini, 2);
  const locais = locaisDoChecklist(ctx.CFG, ctx.visiveis, est);
  const linhas = locais.map((l) => {
    const rs = regs.filter((r) => chave(r.local) === chave(l)).sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm));
    const doCiclo = rs.find((r) => r.enviadoEm >= ini && r.enviadoEm <= somarDias(ini, CICLO_DIAS - 1));
    const sit = doCiclo ? (doCiclo.enviadoEm <= quarta ? pd.selo('ok', 'No prazo') : pd.selo('atencao', 'Atrasada'))
      : ctx.hoje <= quarta ? pd.selo('info', 'Aguardando (até quarta)')
        : lido >= quarta ? pd.selo('critico', 'Não enviada') : pd.selo('vazio', 'Não verificado');
    return [html`<b class="pd-obra">${l}</b>`, rs[0] ? `${diaBR(rs[0].enviadoEm)}${rs[0].por ? ` · ${rs[0].por}` : ''}` : 'Nenhuma enviada', sit];
  });
  const avisoTxt = [est ? `Planilha ${est.arquivo}${mod ? ` salva em ${pd.dm(mod)}` : ''}${est.conferido && est.conferido.galpao ? `, galpão conferido em ${pd.dm(est.conferido.galpao)}` : ''}` : 'Planilha de ferramentas ainda não lida do Drive',
    lido ? `checklists lidos até ${pd.dm(lido)}` : 'grupo dos checklists ainda não lido'].join(' · ');

  const resumo = pd.secao('Estoque do galpão', est ? `Fonte: ${est.arquivo}` : '', pd.cartoes([
      { rotulo: 'Itens no galpão', valor: est ? String(tem.length) : '—', sub: est ? `${unidades.toLocaleString('pt-BR')} unidades` : '' },
      { rotulo: 'Abaixo do mínimo', valor: est ? String(abaixo) : '—', nivel: est ? (abaixo ? 'critico' : 'ok') : '', meta: 'Meta 0' },
      { rotulo: 'Quebradas', valor: est ? String(quebradas) : '—', nivel: quebradas ? 'critico' : '' },
      { rotulo: 'Planilha mestre na sexta', valor: mestreOk == null ? '—' : mestreOk ? 'Sim' : 'Não', nivel: mestreOk == null ? '' : mestreOk ? 'ok' : 'critico', sub: mod ? `última revisão salva em ${pd.dm(mod)} (sexta: ${pd.dm(sexta)})` : '', meta: 'Meta: toda sexta' },
    ]));
  const tabelaChk = pd.secao('Checklists de ferramentas por obra e veículo', `Enviados no grupo do WhatsApp até a quarta do ciclo de 14 dias (este: ${pd.dm(ini)} a ${pd.dm(somarDias(ini, CICLO_DIAS - 1))})`, pd.tabela(['Local', 'Última checklist enviada', 'Situação'], linhas));
  const avisoH = pd.aviso(`${avisoTxt}.`, mestreOk === false || !lido ? 'atencao' : 'info');
  if (ctx.parte === 'resumo') return html`${avisoH}${resumo}`;
  if (ctx.parte === 'checklists') return html`${avisoH}${tabelaChk}`;
  return html`${pd.pergunta(ctx.dep.pergunta)}
    ${avisoH}
    ${pd.secao('Estoque do galpão', est ? `Fonte: ${est.arquivo}` : '', pd.cartoes([
      { rotulo: 'Itens no galpão', valor: est ? String(tem.length) : '—', sub: est ? `${unidades.toLocaleString('pt-BR')} unidades` : '', href: '#/estoque' },
      { rotulo: 'Abaixo do mínimo', valor: est ? String(abaixo) : '—', nivel: est ? (abaixo ? 'critico' : 'ok') : '', meta: 'Meta 0', href: '#/estoque' },
      { rotulo: 'Quebradas', valor: est ? String(quebradas) : '—', nivel: quebradas ? 'critico' : '' },
      { rotulo: 'Planilha mestre na sexta', valor: mestreOk == null ? '—' : mestreOk ? 'Sim' : 'Não', nivel: mestreOk == null ? '' : mestreOk ? 'ok' : 'critico', sub: mod ? `última revisão salva em ${pd.dm(mod)} (sexta: ${pd.dm(sexta)})` : '', meta: 'Meta: toda sexta' },
    ]))}
    ${pd.secao('Checklists de ferramentas por obra e veículo', `Enviados no grupo do WhatsApp até a quarta do ciclo de 14 dias (este: ${pd.dm(ini)} a ${pd.dm(somarDias(ini, CICLO_DIAS - 1))})`, pd.tabela(['Local', 'Última checklist enviada', 'Situação'], linhas))}
    <p><a class="pd-bt" href="#/estoque">Abrir o estoque</a> <a class="pd-bt" href="#/ferramentas/detalhe">Cartões dos checklists e reposição</a></p>
    ${pd.secao('Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir(pd.alertasDoAgente(ctx.area, { veValores: ctx.veValores }).filter((a) => !/rota|strada/i.test(a.texto)), { setor: ctx.dep.setor }))}`;
}
