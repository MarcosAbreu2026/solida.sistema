// Painel do Pós-Obra (desenho do Marcos, página 6). Contrato e ctx: ver comum.js.
// Pergunta: quais solicitações estão abertas, em que fase estão e o que precisa ser cobrado ou agendado?
// Fonte: planilhas do pós-obra lidas do Drive (Controle Operacional, Controle de Cobrança e Agenda semanal) → ctx.base.
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { somarDias, inicioDaSemana } from '../datas.js';
import { PRIORIDADE_SITUACAO, SITUACOES_ABERTAS } from '../regras.js';

const FASES = [
  ['Análise', 'Solicitação em análise'], ['Orçamento', 'Em orçamento ou cotação'], ['Planejamento', 'Aguardando agendamento'],
  ['Execução', 'Serviço em andamento'], ['Concluído', 'Finalizados na planilha'],
];
const rotaOs = (os) => `#/posobra/os/${encodeURIComponent(os)}`;
const rotaObra = (nome) => `#/posobra/obra/${encodeURIComponent(nome)}`;
// nome da agenda sem as anotações ("Cleviano (manhã)", "Início (a confirmar) Nascimento")
const limparNome = (n) => String(n).replace(/\([^)]*\)/g, ' ').replace(/\b(in[íi]cio|a confirmar|a confimar|manh[ãa]|tarde)\b/gi, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
const nomeArq = (x) => String(x || '').replace(/\.xlsx$/i, '');
const dmLido = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };

function avisoFonte(base) {
  const f = base && base.fonte;
  if (!f) return pd.aviso('Planilhas do pós-obra ainda não lidas do Drive.');
  // assinatura = "arquivo|data;arquivo|data" (data de modificação de cada planilha)
  const datas = Object.fromEntries(String(f.assinatura || '').split(';').map((p) => p.split('|')).filter((p) => p.length === 2));
  const parte = (nome, rotulo) => (nome ? `${rotulo} ${nomeArq(nome).replace(/^.*?_?R(\d+)$/i, 'R$1')}${datas[nome] ? ` (${dmLido(datas[nome])})` : ''}` : '');
  return pd.aviso([parte(f.operacional, 'Controle operacional'), parte(f.cobranca, 'controle de cobrança'), parte(f.agenda, 'agenda semanal')].filter(Boolean).join(' e ') + '.');
}

export function painel(ctx) {
  const base = ctx.base;
  if (!base) return html`${pd.pergunta(ctx.dep.pergunta)}${pd.aviso('Carregando as planilhas do pós-obra…')}`;
  const serv = base.servicos || [];
  const conta = (sit) => serv.filter((s) => s.situacao === sit);
  const hoje = ctx.hoje;

  // 1. do pedido ao serviço concluído
  const fases = pd.cartoes(FASES.map(([sit, sub]) => ({ rotulo: sit, valor: String(conta(sit).length), sub, nivel: 'ok' })), { colunas: 5 });

  // 2. outros estados
  const lista = (sit) => [...new Set(conta(sit).map((s) => s.obra))].join(' e ');
  const atrasados = conta('Atrasado');
  const outros = pd.cartoes([
    { rotulo: 'Atrasado', valor: String(atrasados.length), nivel: atrasados.length ? 'critico' : '', sub: atrasados.map((s) => `${s.obra}${s.prazo ? `, prazo de ${pd.dm(s.prazo)}` : ''}`).join(' · ') || 'nenhum' },
    { rotulo: 'Pausado', valor: String(conta('Pausado').length), sub: lista('Pausado') || 'nenhum' },
    { rotulo: 'Fixos (contínuos)', valor: String(conta('Fixo').length), sub: lista('Fixo') || 'nenhum' },
  ], { colunas: 3 });

  // 3. pós-obras em andamento: um por obra, com o serviço aberto de prazo mais próximo
  const ordem = (o) => { const i = PRIORIDADE_SITUACAO.indexOf(o.situacao); return i < 0 ? 99 : i; };
  const andamento = (base.obras || []).filter((o) => SITUACOES_ABERTAS.includes(o.situacao) && !['Fixo', 'Pausado'].includes(o.situacao))
    .sort((a, b) => ordem(a) - ordem(b) || String(a.obra).localeCompare(String(b.obra), 'pt-BR'));
  const linhas = andamento.map((o) => {
    const abertos = (o.servicos || []).filter((s) => s.aberta);
    const s = abertos.filter((x) => x.prazo).sort((a, b) => String(a.prazo).localeCompare(String(b.prazo)))[0] || abertos[0] || {};
    const venc = s.prazo && /^\d{4}-\d{2}-\d{2}/.test(s.prazo) && s.prazo < hoje;
    const prazo = s.prazo && /^\d{4}-\d{2}-\d{2}/.test(s.prazo) ? html`${pd.selo(venc ? 'critico' : 'ok', pd.dm(s.prazo))}${venc ? html`<span class="pd-obra-sub">vencido</span>` : ''}` : '';
    const resp = s.profissionais || o.responsavel || '';
    return [
      pd.obraCel(o.obra, s.os || '', s.os ? rotaOs(s.os) : rotaObra(o.obra)),
      o.situacao, resp || html`<span class="pd-def">[definir]</span>`, prazo || html`<span class="pd-def">[definir]</span>`, s.agenda_fixa || '',
    ];
  });
  const tabAndamento = pd.tabela(['OS / obra', 'Situação', 'Responsável', 'Prazo', 'Agenda'], linhas, { vazio: 'Nenhum pós-obra em andamento na planilha.' });

  // 4. profissionais na semana (agenda semanal): semana atual; sem lançamento, a última semana com agenda
  const agenda = base.agenda || [];
  let ini = inicioDaSemana(hoje);
  if (!agenda.some((a) => a.data >= ini && a.data <= somarDias(ini, 6))) {
    const ult = agenda.map((a) => a.data).filter((d) => d && d <= hoje).sort().pop();
    if (ult) ini = inicioDaSemana(ult);
  }
  const fim = somarDias(ini, 6);
  const porPessoa = new Map();
  for (const a of agenda.filter((x) => x.data >= ini && x.data <= fim)) {
    const nomes = (a.pessoas && a.pessoas.length ? a.pessoas : String(a.texto || '').split(/[/,+]| e /)).map(limparNome).filter((n) => n.length > 1 && !/^-+$/.test(n));
    for (const n of nomes) {
      const k = n.toLocaleLowerCase('pt-BR');
      if (!porPessoa.has(k)) porPessoa.set(k, { nome: n.charAt(0).toLocaleUpperCase('pt-BR') + n.slice(1), dias: new Map() });
      const g = porPessoa.get(k).dias; (g.get(a.obra) || g.set(a.obra, []).get(a.obra)).push(a.data);
    }
  }
  const funcaoDe = (nome) => { const e = (base.equipe || []).find((x) => String(x.nome || x.apelido || '').toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR')); return e ? (e.funcao || e.cargo || '') : ''; };
  const linhasAg = [...porPessoa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map((p) => [
    html`<b>${p.nome}</b>`, funcaoDe(p.nome),
    [...p.dias.entries()].map(([obra, ds]) => `${obra} em ${[...new Set(ds)].sort().map(pd.dm).join(' e ')}`).join(', '),
  ]);
  const tabAgenda = pd.tabela(['Profissional', 'Função', 'Alocação na semana'], linhasAg, { vazio: 'Agenda da semana ainda não lançada.' });

  // 5. cobrança (só sócios): situação de cobrança escrita na planilha de cobrança, entre parênteses no fim da descrição
  let cobranca = '';
  if (ctx.veValores) {
    const fin = (base.financeiro || []).filter((x) => x.receita);
    const tag = (x) => ((String(x.descricao || '').match(/\(([^)]+)\)\s*$/) || [])[1] || '').toUpperCase();
    const ROT = [['NÃO COBRAR', 'Não cobrar'], ['COB AGUARDANDO PAG', 'Cobrar, aguardando pagamento'], ['COB PARCELA', 'Cobrar parcela'], ['COB FINAL', 'Cobrar final'], ['FINALIZADO', 'Finalizado']];
    const aReceber = fin.filter((x) => !x.quitado).reduce((t, x) => t + (Number(x.valor) || 0), 0);
    const reais = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const linhasCob = ROT.map(([k, rot]) => { const l = fin.filter((x) => tag(x) === k); return [rot, String(l.length), l.length ? reais(l.reduce((t, x) => t + (Number(x.valor) || 0), 0)) : '']; });
    cobranca = pd.secao('Cobrança do pós-obra', `Fonte: controle de cobrança${base.fonte && base.fonte.cobranca ? ` ${nomeArq(base.fonte.cobranca).replace(/^.*?_?R(\d+)$/i, 'R$1')}` : ''} · valores visíveis só para sócios`,
      html`${pd.tabela(['Financeiro', 'Quantidade', 'Valor'], linhasCob)}<p class="pd-fonte" style="margin:6px 2px 0">A receber em aberto: <b>${reais(aReceber)}</b>.</p>`);
  }

  return html`${pd.pergunta(ctx.dep.pergunta)}
    ${avisoFonte(base)}
    ${pd.secao('Solicitações: do pedido ao serviço concluído', 'Situações como estão no controle operacional. O mapeamento para solicitado, orçamento, a agendar, agendado e finalizado precisa ser confirmado.', fases)}
    ${pd.secao('Outros estados no controle', 'Fonte: Controle Operacional Pós-Obra', outros)}
    ${pd.secao('Pós-obras em andamento e pendências específicas', 'Quadro geral do Drive. Um clique abre a OS (ou o pós-obra).', tabAndamento)}
    ${pd.secao(`Profissionais de pós-obra na semana de ${pd.dm(ini)}`, 'Fonte: agenda semanal (feita pelo Ênio)', tabAgenda)}
    ${cobranca}
    ${pd.secao('Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir([
      ...atrasados.map((s) => ({ nivel: 'critico', texto: `${s.obra} (${s.os}) atrasado${s.prazo ? ` desde ${pd.dm(s.prazo)}` : ''}: ${String(s.relato || '').slice(0, 140)}`, resp: s.profissionais || '', obra: s.obra })),
      ...pd.alertasDoAgente(ctx.area, { veValores: ctx.veValores, limite: 6 }),
    ], { setor: ctx.dep.setor }))}`;
}
