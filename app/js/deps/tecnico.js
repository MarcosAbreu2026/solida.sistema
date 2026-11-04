// Painel do Técnico e Qualidade (desenho do Marcos, página 7). Contrato e ctx: ver comum.js.
// Pergunta: cada serviço foi verificado nas duas conferências (V1 e V2) antes de seguir para a próxima etapa?
// Ainda não há envio dos checklists de serviço para o sistema: as colunas ficam com traço até o dado existir.
import { html } from '../formato.js';
import * as pd from '../telas/painel-dep.js';
import { obrasEmCurso } from './comum.js';

export function painel(ctx) {
  const obras = obrasEmCurso(ctx);
  // registros futuros (celular da obra / checklist): { tipo: 'checklist', obra, dados: { verificacao: 'V1'|'V2', naoConforme: true } }
  const chk = (ctx.celular || []).filter((r) => r.tipo === 'checklist');
  const conta = (obra, f) => { const l = chk.filter((r) => r.obra === obra && f(r.dados || {})); return l.length ? String(l.length) : ''; };
  const linhas = obras.map((o) => [
    pd.obraCel(o, '', `#/obra/${encodeURIComponent(o)}`),
    conta(o, (d) => d.verificacao === 'V1'), conta(o, (d) => d.verificacao === 'V2'), conta(o, (d) => d.naoConforme && !d.resolvida),
  ]);
  return html`${pd.pergunta(ctx.dep.pergunta)}
    ${chk.length ? '' : pd.aviso('Caderno com 11 frentes e 26 checklists, duas verificações (V1 e V2) por serviço · sem dados enviados ainda.', 'info')}
    ${pd.secao('Checklists de serviço por obra', 'Caderno com 11 frentes e 26 checklists, duas verificações (V1 e V2) por serviço', pd.tabela(['Obra', 'V1 feitas', 'V2 feitas', 'Não conformidades abertas'], linhas, { vazio: 'Nenhuma obra em curso.' }))}
    ${pd.secao('Quem precisa agir', 'Cada alerta vira tarefa com responsável e data-limite', pd.quemAgir([], { setor: ctx.dep.setor }, { vazio: 'Sem checklists enviados, ainda não há alertas de qualidade.' }))}`;
}
