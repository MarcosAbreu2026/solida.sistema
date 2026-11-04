// Painel do Projeto (desenho do Marcos, página 8). Contrato e ctx: ver comum.js.
// Pergunta: para cada obra, que projeto está faltando para as etapas seguintes?
// Fonte: pastas PROJETO e ASBUILT de cada obra no Drive (ctx.drive.projetos) cruzadas com o cronograma (telas/projetos.js).
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { obrasComProjeto, IMPRESCINDIVEIS, situacaoImprescindivel } from '../telas/projetos.js';

const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

export function painel(ctx) {
  const proj = ctx.drive && ctx.drive.projetos;
  const topo = html`${pd.pergunta(ctx.dep.pergunta)}`;
  if (!proj) return html`${topo}${pd.aviso('As pastas de projeto das obras ainda não foram lidas do Drive.')}`;
  const hoje = ctx.hoje;
  const obras = obrasComProjeto(ctx.CFG, proj, ctx.visiveis).filter((p) => !p.semPasta);
  const sits = obras.flatMap((p) => IMPRESCINDIVEIS.map((i) => ({ obra: p.obra, item: i.nome, s: situacaoImprescindivel(p, i, hoje) })));
  const faltando = sits.filter((x) => /^falta/.test(x.s.nivel));
  const urgentes = faltando.filter((x) => x.s.nivel !== 'falta');
  const tardios = sits.filter((x) => x.s.nivel === 'tardio');
  const asbuiltParado = obras.filter((p) => { const ds = (p.asbuilt || []).map((a) => a.data).filter(Boolean).sort(); return !ds.length || diasEntre(ds[ds.length - 1], hoje) > 7; });
  const lidoEm = proj.geradoEm || proj.lidoEm || '';

  const resumo = pd.cartoes([
    { rotulo: 'Projetos imprescindíveis faltando', valor: String(faltando.length), nivel: urgentes.length ? 'critico' : faltando.length ? 'atencao' : 'ok', sub: urgentes.length ? `${urgentes.length} com o serviço já começando` : 'nenhum com o serviço começando', href: '#/projetos/detalhe' },
    { rotulo: 'Chegaram depois do serviço', valor: String(tardios.length), nivel: tardios.length ? 'atencao' : 'ok', sub: tardios.map((x) => `${x.obra} ${x.item.toLowerCase()}`).join(' · ') || 'nenhum' },
    { rotulo: 'As-built sem revisão há mais de 7 dias', valor: String(asbuiltParado.length), nivel: asbuiltParado.length ? 'critico' : 'ok', sub: asbuiltParado.map((p) => p.obra).join(', ') || 'todos revisados na semana' },
    { rotulo: 'Compatibilizações pendentes', valor: '—', sub: 'sem controle de compatibilização no Drive ainda' },
  ]);

  // projeto faltando com o serviço já marcado no cronograma (primeiro os que já deviam ter começado)
  const ordemNivel = { 'falta-atrasado': 0, 'falta-urgente': 1, tardio: 2, falta: 3 };
  const linhas = [...faltando.filter((x) => x.s.crono), ...tardios]
    .sort((a, b) => (ordemNivel[a.s.nivel] - ordemNivel[b.s.nivel]) || String(a.s.crono && a.s.crono.data).localeCompare(String(b.s.crono && b.s.crono.data)))
    .map((x) => [
      pd.obraCel(x.obra, '', `#/obra/${encodeURIComponent(x.obra)}`),
      pd.selo(x.s.nivel === 'falta' ? 'atencao' : 'critico', x.s.nivel === 'tardio' ? `${x.item} (chegou tarde)` : x.item),
      x.s.crono ? x.s.crono.atividade : '',
      x.s.crono ? pd.dm(x.s.crono.data) : '',
    ]);
  const semCrono = faltando.filter((x) => !x.s.crono);

  // atenção: alertas do agente sobre projeto + obras sem listagem de projetos
  const semListagem = obras.filter((p) => !(p.listagem && !p.listagem.erro)).map((p) => p.obra);
  const atencao = [
    ...((ctx.area && ctx.area.alertas) || []).filter((a) => !a.restrito || ctx.veValores).map((a) => a.texto),
    ...(semListagem.length ? [`Sem listagem de projetos preenchida (datas tiradas dos arquivos da pasta): ${semListagem.join(', ')}.`] : []),
    ...(semCrono.length ? [`${semCrono.length} projetos imprescindíveis faltando sem o serviço no cronograma: ${[...new Set(semCrono.map((x) => x.obra))].join(', ')}.`] : []),
    'Listagem de projetos de cada obra, com o que existe e o que não existe, a definir com a Isabel.',
  ];

  return html`${topo}
    ${lidoEm ? pd.aviso(`Pastas de projeto lidas do Drive em ${new Date(lidoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}.`, 'info') : ''}
    ${pd.secao('Resumo', 'Fonte: Drive (pastas PROJETO e ASBUILT de cada obra)', resumo)}
    ${pd.secao('Projeto faltando, obra por obra', 'Projeto que falta (ou chegou depois) × serviço do cronograma que depende dele',
      pd.tabela(['Obra', 'Projeto faltando', 'Serviço que depende', 'Devia ter começado'], linhas, { vazio: 'Nenhum projeto imprescindível faltando para serviço do cronograma.' }))}
    ${pd.caixa('Atenção', pd.itens(atencao))}
    ${pd.secao('Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir(urgentes.map((x) => ({ nivel: x.s.nivel === 'falta-atrasado' ? 'critico' : 'atencao', texto: `${x.obra}: ${x.item}. ${x.s.texto}`, resp: 'Isabel', obra: x.obra })), { setor: ctx.dep.setor }, { vazio: 'Nenhum projeto faltando com o serviço chegando.' }))}`;
}
