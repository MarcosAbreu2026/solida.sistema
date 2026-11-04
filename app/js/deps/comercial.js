// Comercial (Marcos · Marketing e Novos negócios), desenho do Marcos pág. 12: CRM de arquitetos, categorias, fila de ataque e marketing.
// O CRM (CRM_Construcao_Solida) ainda não é lido pelo sistema: esses números ficam com traço. O que já dá para mostrar sai das
// planilhas de orçamento (coluna ARQ): quem manda orçamento e quem parou de mandar ("reatar contato").
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { analisarArquiteturas } from '../telas/comercial.js';

const CATEGORIAS = ['0 · Ativo (obra ou orçamento em andamento)', '1 · Fechou obra antiga', '2 · Orçou e não fechou', '3 · Já sondado', '4 · Frio', '5 · Sem interesse', 'Pesquisar quem é'];

export function painel(ctx) {
  const area = ctx.area;
  const a = analisarArquiteturas(ctx.drive && ctx.drive.orcamentos);
  const semCrm = 'CRM_Construcao_Solida ainda não lido pelo sistema';
  const crm = pd.cartoes([
    { rotulo: 'Arquitetos no CRM', valor: '—', sub: semCrm },
    { rotulo: 'Em conversa', valor: '—', sub: semCrm },
    { rotulo: 'Novos, sem contato', valor: '—', sub: semCrm },
    { rotulo: 'Em orçamento', valor: '—', sub: semCrm },
    { rotulo: 'Fila de ataque', valor: '—', sub: 'próximo contato vencido (vem do CRM)' },
  ], { colunas: 5 });

  let arqSec = '';
  if (a) {
    const doAno = a.arqs.filter((x) => x.atual > 0);
    const jaFecharam = a.arqs.filter((x) => x.fech > 0);
    const andando = a.arqs.filter((x) => x.emAndamento > 0);
    arqSec = html`${pd.secao(`Arquiteturas nas planilhas de orçamento (${a.anos[0]} a ${a.atual})`, 'Fonte: SL_ORÇAMENTOS, coluna ARQ · grafias parecidas juntadas', pd.cartoes([
        { rotulo: 'Arquiteturas com orçamento em toda a história', valor: String(a.arqs.length) },
        { rotulo: `Mandaram orçamento em ${a.atual}`, valor: String(doAno.length) },
        { rotulo: `Com orçamento andando em ${a.atual}`, valor: String(andando.length), sub: 'em orçamento, aguardando ou enviado' },
        { rotulo: 'Reatar contato', valor: String(a.reatar.length), sub: `mandavam e pararam ou caíram em ${a.atual}`, nivel: a.reatar.length ? 'atencao' : '' },
      ]))}
      ${pd.secao('Próximas ações: reatar contato', `Enquanto o CRM não é lido: quem mandava orçamento e caiu em ${a.atual}, primeiro quem já fechou obra`, pd.tabela(
        ['Arquitetura', 'Gancho', 'Último orçamento', 'Próximo contato', 'Status'],
        a.reatar.slice(0, 8).map((x) => [html`<b>${x.nome}</b>`,
          `${x.antes} orçamento${x.antes > 1 ? 's' : ''} antes de ${a.atual}${x.fech ? `, fechou ${x.fech} obra${x.fech > 1 ? 's' : ''} com a Sólida` : ''}; ${x.atual} em ${a.atual}`,
          `${x.ultimo.ref} (${x.ultimo.ano}${x.ultimo.cliente ? ` · ${String(x.ultimo.cliente).trim()}` : ''})`,
          '', pd.selo('atencao', 'Reatar')]),
        { vazio: 'Nenhuma arquitetura parou de mandar orçamento.' }))}`;
  }

  return html`${pd.pergunta(ctx.dep.pergunta)}
    ${pd.aviso('O CRM de arquitetos (CRM_Construcao_Solida) ainda não é lido pelo sistema: CRM, categorias e fila de ataque ficam com traço até a planilha entrar na leitura do Drive.')}
    ${pd.secao('CRM de arquitetos', 'Fonte: CRM_Construcao_Solida', crm)}
    ${pd.secao('Por categoria', 'Relacionamento com a Sólida · fonte: CRM', pd.tabela(['Categoria', 'Quantidade'], CATEGORIAS.map((c) => [c, ''])))}
    ${arqSec}
    ${pd.secao('Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir(pd.alertasDoAgente(area, { veValores: ctx.veValores }), { setor: ctx.dep.setor }))}
    ${pd.caixa('Marketing: o que o painel pode mostrar', pd.itens(['Calendário de postagens e o que está aprovado', 'Portfólio das obras concluídas e quem autorizou a imagem', 'Resultados das redes e dos anúncios do mês', 'Pedidos de arte e vídeo, com prazo e status']), { direita: 'O responsável define' })}`;
}
