// Painel do Projeto (desenho do Marcos, página 8). Contrato e ctx: ver comum.js.
// Pergunta: para cada obra, que projeto está faltando para as etapas seguintes?
// Fonte: pastas PROJETO e ASBUILT de cada obra no Drive (ctx.drive.projetos) cruzadas com o cronograma (telas/projetos.js › analiseProjetos).
// Prazo de cada projeto = início do serviço no cronograma − antecedência da matriz. Vermelho: vencido ou vence em até 3 dias · Amarelo: 4 a 10 dias · Verde: mais de 10 (só monitorar).
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { analiseProjetos } from '../telas/projetos.js';

const diasEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const prazoTxt = (r) => (r < 0 ? `vencido há ${plural(-r, 'dia', 'dias')}` : r === 0 ? 'vence hoje' : `faltam ${plural(r, 'dia', 'dias')}`);
const SELO = { vermelho: ['critico', 'Vermelho'], amarelo: ['atencao', 'Amarelo'], verde: ['ok', 'Verde'] };

// frases do "entendimento da situação": o que está acontecendo e o que fazer, em português claro
function entendimento(a, nObras) {
  const t = a.totais;
  const linhas = [];
  if (t.vermelhas) linhas.push(`${plural(t.vermelhas, 'projeto está', 'projetos estão')} com o prazo vencido ou vencendo em até 3 dias. É o que precisa de cobrança hoje.`);
  if (t.amarelas) linhas.push(`${plural(t.amarelas, 'projeto vence', 'projetos vencem')} entre 4 e 10 dias: dá tempo de cobrar com calma, mas já tem que estar na fila.`);
  if (!t.vermelhas && !t.amarelas) linhas.push('Nenhum projeto vencido nem vencendo nos próximos 10 dias nas obras que têm cronograma.');
  const porObra = a.obras.filter((o) => o.pendencias.length).sort((x, y) => y.pendencias.filter((p) => p.cor === 'vermelho').length - x.pendencias.filter((p) => p.cor === 'vermelho').length || y.pendencias.length - x.pendencias.length);
  if (porObra[0]) {
    const o = porObra[0]; const p = o.pendencias[0];
    linhas.push(`Obra mais pressionada: ${o.obra}, com ${plural(o.pendencias.length, 'pendência', 'pendências')}. O mais urgente é ${p.item.nome.toLowerCase()} (${prazoTxt(p.restantes)}), para "${p.servico}" que começa em ${pd.dma(p.inicio)}.`);
  }
  linhas.push(`Analisei ${plural(t.analisadas, 'obra', 'obras')} de ${nObras} ativas (as que têm pasta e cronograma lidos). ${t.verdes ? `${plural(t.verdes, 'projeto ainda está', 'projetos ainda estão')} com mais de 10 dias de folga: só monitorar.` : ''}`);
  if (t.retroativas) linhas.push(`${plural(t.retroativas, 'serviço já começou', 'serviços já começaram')} há mais de 3 semanas sem projeto vigente na pasta. Não afirmo que falta: o arquivo pode ter outro nome ou a obra seguiu sem ele. Confira manualmente (lista abaixo).`);
  if (t.semCronograma.length) linhas.push(`Sem cronograma, não dá para analisar: ${t.semCronograma.join(', ')}.`);
  if (t.pausadas.length) linhas.push(`Obra pausada, fora da cobrança de projetos até voltar: ${t.pausadas.join(', ')}.`);
  if (t.semPasta.length) linhas.push(`Sem pasta de projetos no Drive: ${t.semPasta.join(', ')}.`);
  if (t.tardios) linhas.push(`${plural(t.tardios, 'projeto chegou', 'projetos chegaram')} depois do início do serviço correspondente (já aconteceu; serve de aprendizado).`);
  if (t.regrasSugeridas) linhas.push(`${t.regrasSugeridas} das 11 antecedências da matriz ainda são sugestão e precisam de confirmação (marcadas com *).`);
  return linhas;
}

export function painel(ctx) {
  const proj = ctx.drive && ctx.drive.projetos;
  const topo = html`${pd.pergunta(ctx.dep.pergunta)}`;
  if (!proj) return html`${topo}${pd.aviso('As pastas de projeto das obras ainda não foram lidas do Drive.')}`;
  const hoje = ctx.hoje;
  const a = analiseProjetos(ctx.CFG, proj, ctx.visiveis, hoje);
  const t = a.totais;
  const lidas = a.obras.filter((o) => o.estado === 'ok').map((o) => o.p);
  const asbuiltParado = lidas.filter((p) => { const ds = (p.asbuilt || []).map((x) => x.data).filter(Boolean).sort(); return !ds.length || diasEntre(ds[ds.length - 1], hoje) > 7; });
  const lidoEm = proj.geradoEm || proj.lidoEm || '';

  const cartoes = pd.cartoes([
    { rotulo: 'Obras analisadas', valor: String(t.analisadas), sub: `${t.semCronograma.length + t.semPasta.length ? `${t.semCronograma.length + t.semPasta.length} sem cronograma ou pasta` : 'todas com cronograma e pasta'}`, nivel: t.semCronograma.length + t.semPasta.length ? 'atencao' : 'ok' },
    { rotulo: 'Vermelhas', valor: String(t.vermelhas), nivel: t.vermelhas ? 'critico' : 'ok', sub: 'prazo vencido ou até 3 dias', meta: 'cobrar hoje' },
    { rotulo: 'Amarelas', valor: String(t.amarelas), nivel: t.amarelas ? 'atencao' : 'ok', sub: 'vencem em 4 a 10 dias', meta: 'cobrar esta semana' },
    { rotulo: 'As-built parado', valor: String(asbuiltParado.length), nivel: asbuiltParado.length ? 'critico' : 'ok', sub: asbuiltParado.map((p) => p.obra).join(', ') || 'todos revisados na semana', meta: 'sem revisão há mais de 7 dias' },
  ]);

  // o que fazer agora: cada projeto vermelho/amarelo, do mais vencido para o mais folgado
  const agir = a.pendencias.map((p) => {
    const [nivel, rot] = SELO[p.cor];
    const titulo = `[${p.obra}] Falta projeto de ${p.item.nome} – necessário até ${pd.dma(p.limite)}`;
    return [
      pd.obraCel(p.obra, '', `#/obra/${encodeURIComponent(p.obra)}`),
      html`${pd.selo(nivel, rot)}`,
      html`<b>${p.item.nome}</b>${p.confirmada ? '' : html` <span class="pequeno" title="Antecedência sugerida (${p.dias} dias), ainda não confirmada">*</span>`}${p.naoLiberado ? html`<span class="pequeno"> · só há versão não liberada</span>` : ''}`,
      html`${p.servico}<span class="pd-obra-sub">começa em ${pd.dma(p.inicio)}</span>`,
      html`${pd.dma(p.limite)}<span class="pd-obra-sub">${prazoTxt(p.restantes)} · ${p.dias} dias de antecedência</span>`,
      p.responsavel || html`<span class="pd-def">[definir]</span>`,
      html`<button type="button" class="pd-bt" data-criar-tarefa="1" data-ct-texto="${titulo}" data-ct-obra="${p.obra}" data-ct-setor="${ctx.dep.setor}" data-ct-prazo="${p.limite}">Criar tarefa</button>`,
    ];
  });

  // situação por obra: das mais pressionadas para as sem análise
  const peso = (o) => (o.estado === 'ok' ? (o.pendencias.some((p) => p.cor === 'vermelho') ? 0 : o.pendencias.length ? 1 : 2) : o.estado === 'sem-cronograma' ? 3 : 4);
  const porObra = [...a.obras].sort((x, y) => peso(x) - peso(y) || y.pendencias.length - x.pendencias.length || x.obra.localeCompare(y.obra)).map((o) => {
    const cr = o.p && o.p.cronograma;
    if (o.estado !== 'ok') return [pd.obraCel(o.obra, '', `#/obra/${encodeURIComponent(o.obra)}`), pd.selo('', o.estado === 'sem-pasta' ? 'sem pasta de projetos' : o.estado === 'pausada' ? 'obra pausada' : 'sem cronograma'), '—', '—', '—', o.estado === 'sem-pasta' ? 'Pasta da obra não encontrada no Drive.' : `Não analisada: ${o.motivo}.`];
    const v = o.pendencias.filter((p) => p.cor === 'vermelho').length; const am = o.pendencias.length - v;
    const sit = v ? pd.selo('critico', 'Vermelho') : am ? pd.selo('atencao', 'Amarelo') : o.retroativas.length ? pd.selo('atencao', 'Verificar') : pd.selo('ok', 'Em dia');
    const obs = [o.retroativas.length ? `${plural(o.retroativas.length, 'serviço já começou', 'serviços já começaram')} sem projeto achado: verificar` : '',o.tardios.length ? `${plural(o.tardios.length, 'projeto chegou', 'projetos chegaram')} depois do serviço` : '', o.verificar.length ? `verificar manualmente: ${o.verificar.map((x) => x.item.nome.toLowerCase()).join(', ')}` : ''].filter(Boolean).join(' · ');
    return [pd.obraCel(o.obra, cr && cr.arquivo ? `${cr.arquivo.replace(/\.xlsx$/i, '')}` : '', `#/obra/${encodeURIComponent(o.obra)}`), sit, v || '—', am || '—', o.verdes.length || '—', obs || '—'];
  });

  // serviço que já começou há mais de 3 semanas e sem projeto vigente na pasta: conferir à mão
  const verificarAgora = a.obras.flatMap((o) => o.retroativas || []).sort((x, y) => x.obra.localeCompare(y.obra) || x.inicio.localeCompare(y.inicio)).map((p) => [
    pd.obraCel(p.obra, '', `#/obra/${encodeURIComponent(p.obra)}`),
    html`<b>${p.item.nome}</b>${p.naoLiberado ? html`<span class="pd-obra-sub">só há versão não liberada</span>` : ''}`,
    html`${p.servico}<span class="pd-obra-sub">começou em ${pd.dma(p.inicio)} (há ${plural(diasEntre(p.inicio, hoje), 'dia', 'dias')})</span>`,
    'Procurar o projeto na pasta ou confirmar com o arquiteto se a obra seguiu sem ele',
  ]);

  const semRegra = a.semRegra.length
    ? pd.itens(a.semRegra.map((s) => `${s.nome} (${s.obras.join(', ')})`))
    : html`<p class="pd-vazio">Todo serviço do cronograma tem regra na matriz.</p>`;

  return html`${topo}
    ${lidoEm ? pd.aviso(`Pastas de projeto e cronogramas lidos do Drive em ${new Date(lidoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}. Os prazos são calculados a partir de hoje (${pd.dma(hoje)}).`, 'info') : ''}
    ${pd.caixa('Entendimento da situação', pd.itens(entendimento(a, a.obras.length)), { direita: 'o que está acontecendo e o que fazer' })}
    ${pd.secao('Resumo', 'Fonte: Drive (pastas PROJETO e ASBUILT) × cronograma de cada obra', cartoes)}
    ${pd.secao('O que fazer agora', 'Projeto que falta, do prazo mais vencido para o mais folgado · cada linha vira tarefa no setor Projetos',
      pd.tabela(['Obra', 'Situação', 'Projeto que falta', 'Serviço que depende', 'Prazo do projeto', 'Responsável', ''], agir, { vazio: 'Nenhum projeto vermelho ou amarelo. Tudo em dia para os próximos 10 dias.' }))}
    ${pd.secao('Situação por obra', 'Vermelho: tem projeto vencido ou a vencer em até 3 dias · Amarelo: 4 a 10 dias · Em dia: nada a cobrar agora',
      pd.tabela(['Obra', 'Situação', 'Vermelhas', 'Amarelas', 'Monitorar (+10 dias)', 'Observação'], porObra, { vazio: 'Nenhuma obra ativa encontrada.' }))}
    ${verificarAgora.length ? pd.secao('Verificar manualmente', 'Serviço que começou há mais de 3 semanas e não achei o projeto vigente na pasta', pd.tabela(['Obra', 'Projeto', 'Serviço do cronograma', 'O que fazer'], verificarAgora)) : ''}
    ${pd.caixa('Serviços do cronograma sem regra na matriz', semRegra, { direita: 'a diretoria decide se entram na matriz' })}
    <p class="pequeno" style="margin-top:14px">Regra: o projeto precisa estar na pasta (revisão mais recente; rascunho, estudo, anteprojeto, obsoleto e antigo não contam) até o início do serviço menos a antecedência (a de cada projeto está na matriz, confirmada pela diretoria).${t.regrasSugeridas ? ' * = antecedência sugerida, ainda não confirmada.' : ''} O sistema só lê o Drive; não move nem apaga arquivos.</p>`;
}
